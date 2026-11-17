const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const PREFERRED_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';
const DIMENSIONS = ['外型風格', '氣質人設', '作品類型', '表演風格', '資歷區間', '觀看情境'];
const NEUTRAL_VALUES = new Set(['沒有特別偏好', '沒有特別要求', '皆可', '無限制', '不拘', '不限資歷', '不限平台', '不限片長', '作品類型不限']);
// These IDs are listed by Google's model/grounding documentation as stable models with Search grounding support.
const STABLE_SEARCH_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
const LABELS = {
  appearance: ['清新自然', '成熟穩重', '陽光活潑', '優雅知性', '個性時尚'],
  personality: ['溫柔親切', '幽默風趣', '自信獨立', '沉穩內斂', '熱情活潑'],
  genres: ['喜劇', '愛情', '科幻', '懸疑', '動作', '劇情', '紀錄片', '動畫'],
  performance: ['自然寫實', '情感細膩', '幽默誇張', '感染力強', '風格多變'],
  experience: ['新生代演員', '發展中演員', '資深演員'],
  platform: ['串流平台', '電影院', '電視', '免費影音平台'],
  duration: ['30 分鐘以內', '30～60 分鐘', '60～120 分鐘', '120 分鐘以上'],
  quality: ['一般畫質即可', 'Full HD', '4K 高畫質']
};

function isNeutral(value) { return typeof value === 'string' && NEUTRAL_VALUES.has(value); }
function matchSingle(preference, options) {
  if (isNeutral(preference)) return 100;
  if (preference === undefined || preference === null || preference === '') return 0;
  return (Array.isArray(options) ? options : [options]).includes(preference) ? 100 : 0;
}
function matchMultiple(selected, options) {
  if (!Array.isArray(selected) || selected.length === 0) return 0;
  if (selected.includes('作品類型不限')) return 100;
  const labels = Array.isArray(options) ? options : [];
  return Math.round(selected.filter(item => labels.includes(item)).length / selected.length * 100);
}
function getWeights(preferences) {
  const saved = Array.isArray(preferences.weights) ? preferences.weights : [];
  const items = DIMENSIONS.map((name, i) => saved.find(item => item && item.name === name) || saved[i]);
  const raw = items.map(item => Number(item?.score));
  const hasRaw = raw.every(value => Number.isFinite(value) && value > 0);
  const values = hasRaw ? raw : items.map(item => Number(item?.percentage));
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!values.every(value => Number.isFinite(value) && value >= 0) || total <= 0) return DIMENSIONS.map(() => 100 / 6);
  return values.map(value => value / total * 100);
}
function getDimensionScores(preferences, person) {
  const viewing = preferences.viewing || {};
  const pv = person.viewing || {};
  const viewingScore = (matchSingle(viewing.platform, pv.platform) + matchSingle(viewing.duration, pv.duration) + matchSingle(viewing.quality, pv.quality)) / 3;
  return [
    { name: DIMENSIONS[0], score: matchSingle(preferences.appearance, person.appearance) },
    { name: DIMENSIONS[1], score: matchSingle(preferences.personality, person.personality) },
    { name: DIMENSIONS[2], score: matchMultiple(preferences.genres, person.genres) },
    { name: DIMENSIONS[3], score: matchSingle(preferences.performance, person.performance) },
    { name: DIMENSIONS[4], score: matchSingle(preferences.experience, person.experience) },
    { name: DIMENSIONS[5], score: Math.round(viewingScore) }
  ];
}
function fail(message, status = 502) { const error = new Error(message); error.status = status; return error; }
function parseJson(text, phase) {
  const cleaned = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) throw fail(`Gemini ${phase}回應不是有效 JSON，未產生推薦。`);
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { throw fail(`Gemini ${phase}回應 JSON 格式無效，未產生推薦。`); }
}
function responseText(data) { return data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('\n') || ''; }
async function geminiFetch(url, options, timeoutMs = 45000) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  catch (error) { if (error.name === 'AbortError') throw fail('Gemini API 請求逾時，未產生推薦。', 504); throw fail('無法連接 Gemini API，未產生推薦。', 502); }
  finally { clearTimeout(timer); }
}
async function listAvailableModels() {
  const response = await geminiFetch(`${API_ROOT}/models?pageSize=100`, { headers: { 'x-goog-api-key': GEMINI_API_KEY } });
  if (!response.ok) throw fail(`Gemini models.list 失敗（HTTP ${response.status}），無法確認帳戶可用模型。`, response.status === 401 || response.status === 403 ? 503 : 502);
  let body; try { body = await response.json(); } catch { throw fail('Gemini models.list 回傳格式無效。'); }
  if (!Array.isArray(body.models)) throw fail('Gemini models.list 未回傳 models 陣列。');
  return body.models;
}
function chooseModel(models) {
  const byName = new Map(models.map(model => [String(model.name || '').replace(/^models\//, ''), model]));
  const ordered = [PREFERRED_MODEL, ...STABLE_SEARCH_MODELS.filter(id => id !== PREFERRED_MODEL)];
  for (const id of ordered) {
    if (!STABLE_SEARCH_MODELS.includes(id)) continue;
    const model = byName.get(id);
    if (model && Array.isArray(model.supportedGenerationMethods) && model.supportedGenerationMethods.includes('generateContent')) return id;
  }
  throw fail(`此 API 帳戶未列出可用的穩定 Google Search grounding 模型（首選 ${PREFERRED_MODEL}）；請確認官方模型清單及帳戶資格。未執行搜尋。`, 503);
}
async function generate(model, contents, useSearch = false) {
  const response = await geminiFetch(`${API_ROOT}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: contents }] }], ...(useSearch ? { tools: [{ google_search: {} }] } : {}), generationConfig: { temperature: 0.1, maxOutputTokens: 3500 } })
  });
  if (!response.ok) {
    let detail = ''; try { detail = (await response.json())?.error?.message || ''; } catch {}
    if (response.status === 400 && /google_search|tool|ground/i.test(detail)) throw fail(`模型 ${model} 或目前 API 帳戶不支援 Google Search grounding：${detail || 'API 拒絕 google_search 工具'}。未產生推薦。`, 503);
    throw fail(`Gemini generateContent 失敗（HTTP ${response.status}）${detail ? `：${detail}` : ''}；未產生推薦。`, response.status === 401 || response.status === 403 ? 503 : 502);
  }
  let data; try { data = await response.json(); } catch { throw fail('Gemini generateContent 回傳無效 JSON。'); }
  if (!data?.candidates?.[0]?.content?.parts?.length) throw fail('Gemini 沒有回傳可用內容，未產生推薦。');
  return data;
}
function validHttpUrl(value) { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } }
function groundingEvidence(data) {
  const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const urls = chunks.map(chunk => validHttpUrl(chunk.web?.uri)).filter(Boolean);
  const supports = data?.candidates?.[0]?.groundingMetadata?.groundingSupports || [];
  return { urls: [...new Set(urls)], supports, chunks };
}
function citedUrlsForText(evidence, text) {
  const matching = evidence.supports.filter(support => String(support.segment?.text || '').toLocaleLowerCase().includes(text.toLocaleLowerCase()));
  const urls = matching.flatMap(support => (support.groundingChunkIndices || []).map(index => validHttpUrl(evidence.chunks[index]?.web?.uri)).filter(Boolean));
  return [...new Set(urls)];
}
function cleanLabels(value, allowed) { return Array.isArray(value) ? [...new Set(value.filter(item => typeof item === 'string' && allowed.includes(item)))].slice(0, 8) : []; }
function validateCandidates(result, evidence) {
  if (!result || typeof result !== 'object' || !Array.isArray(result.candidates)) throw fail('搜尋結果格式不符：缺少 candidates 陣列，未產生推薦。');
  const output = [];
  for (const raw of result.candidates.slice(0, 5)) {
    if (!raw || typeof raw !== 'object' || typeof raw.name !== 'string' || raw.name.trim().length < 2 || raw.name.length > 100) continue;
    const name = raw.name.trim();
    const nameCitations = citedUrlsForText(evidence, name);
    const declaredSources = Array.isArray(raw.sourceUrls) ? raw.sourceUrls.map(validHttpUrl).filter(Boolean) : [];
    const sourceUrls = declaredSources.filter(url => evidence.urls.includes(url) && nameCitations.includes(url));
    if (!sourceUrls.length) continue;
    const works = (Array.isArray(raw.works) ? raw.works : []).slice(0, 5).filter(work => work && typeof work.title === 'string' && work.title.trim()).map(work => {
      const title = work.title.trim();
      const workCitations = citedUrlsForText(evidence, title);
      const workUrls = (Array.isArray(work.sourceUrls) ? work.sourceUrls.map(validHttpUrl).filter(Boolean) : []).filter(url => evidence.urls.includes(url) && nameCitations.includes(url) && workCitations.includes(url));
      if (!workUrls.length) return null;
      return { title, type: typeof work.type === 'string' ? work.type.slice(0, 80) : '', year: typeof work.year === 'string' || typeof work.year === 'number' ? String(work.year).slice(0, 12) : '', sourceUrls: workUrls };
    }).filter(Boolean);
    const viewing = raw.viewing && typeof raw.viewing === 'object' ? raw.viewing : {};
    output.push({
      id: output.length + 1, name, category: typeof raw.category === 'string' ? raw.category.slice(0, 40) : '演員',
      appearance: cleanLabels(raw.appearance, LABELS.appearance), personality: cleanLabels(raw.personality, LABELS.personality),
      genres: cleanLabels(raw.genres, LABELS.genres), performance: cleanLabels(raw.performance, LABELS.performance),
      experience: LABELS.experience.includes(raw.experience) ? raw.experience : '',
      viewing: { platform: cleanLabels(viewing.platform, LABELS.platform), duration: cleanLabels(viewing.duration, LABELS.duration), quality: cleanLabels(viewing.quality, LABELS.quality) },
      description: typeof raw.description === 'string' ? raw.description.slice(0, 700) : '', works,
      evidence: { sourceStatus: 'google-search-grounded-not-independently-verified', sourceUrls, note: '網址來自本次 Google Search grounding 並與人物姓名的搜尋引用關聯；人物身分與資料未經人工獨立查證。標籤及描述為 Gemini 整理，不視為來源已證實事實。' }
    });
  }
  return output;
}
function buildRanking(preferences, people) {
  const weights = getWeights(preferences);
  return people.map(person => {
    const dimensions = getDimensionScores(preferences, person);
    const score = Math.round(dimensions.reduce((sum, item, index) => sum + item.score * weights[index] / 100, 0) * 10) / 10;
    return { rank: 0, name: person.name, category: person.category, score, description: person.description, dimensions, works: person.works, evidence: person.evidence, bestMatches: dimensions.filter(item => item.score >= 80).map(item => item.name), gaps: dimensions.filter(item => item.score < 50).map(item => item.name) };
  }).sort((a, b) => b.score - a.score).map((person, index) => ({ ...person, rank: index + 1 }));
}
function validatePreferences(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return typeof value.appearance === 'string' && typeof value.personality === 'string' && Array.isArray(value.genres) && typeof value.performance === 'string' && typeof value.experience === 'string' && value.viewing && typeof value.viewing === 'object';
}
async function analyze(preferences) {
  if (!GEMINI_API_KEY) throw fail('Gemini AI 適配分析服務尚未啟用：伺服器未設定 GEMINI_API_KEY。未執行分析或人物搜尋。', 503);
  const available = await listAvailableModels();
  const model = chooseModel(available);
  const understandingPrompt = `以 JSON 理解這份問卷偏好，勿推薦或列出任何人物。整理簡短 searchQuery、偏好摘要 preferenceSummary，以及 relevantDimensions（只能是六維度名稱）。輸出格式：{"searchQuery":"...","preferenceSummary":"...","relevantDimensions":["..."]}。問卷：${JSON.stringify(preferences)}`;
  const understanding = parseJson(responseText(await generate(model, understandingPrompt)), '偏好理解');
  if (typeof understanding.searchQuery !== 'string' || !understanding.searchQuery.trim() || typeof understanding.preferenceSummary !== 'string' || !Array.isArray(understanding.relevantDimensions) || understanding.relevantDimensions.some(name => !DIMENSIONS.includes(name))) throw fail('Gemini 偏好理解回應未通過格式/維度驗證，未執行人物搜尋。');
  const searchPrompt = `搜尋任務：${understanding.searchQuery}\n偏好摘要：${understanding.preferenceSummary}\n依本次 Google Search 實際搜尋結果，整理最多 5 位真實演員及有來源支持的公開作品。禁止使用模型記憶、猜測或虛構人物/作品；沒有可在 grounding metadata 找到對應引用的姓名就不要回傳。所有網址必須逐字取自本次 Google Search grounding；輸出 JSON：{"summary":"...","recommendationReason":"基於本次搜尋引用的簡短理由","candidates":[{"name":"...","category":"演員","appearance":["..."],"personality":["..."],"genres":["..."],"performance":["..."],"experience":"...","viewing":{"platform":["..."],"duration":["..."],"quality":["..."]},"description":"Gemini 整理的描述，避免聲稱已查證","sourceUrls":["grounding URL"],"works":[{"title":"...","type":"...","year":"...","sourceUrls":["grounding URL"]}]}]}。標籤只能取用問卷選項：外型 ${LABELS.appearance.join('、')}；氣質 ${LABELS.personality.join('、')}；類型 ${LABELS.genres.join('、')}；表演 ${LABELS.performance.join('、')}；資歷 ${LABELS.experience.join('、')}；平台 ${LABELS.platform.join('、')}；片長 ${LABELS.duration.join('、')}；畫質 ${LABELS.quality.join('、')}。沒有可靠證據的欄位留空。每位人物來源須能由本次 grounding 引用連結到姓名；作品須能由 grounding 引用連結到作品名稱。`;
  const searchData = await generate(model, searchPrompt, true);
  const result = parseJson(responseText(searchData), '人物搜尋');
  const evidence = groundingEvidence(searchData);
  if (!evidence.urls.length || !evidence.supports.length) throw fail('Google Search grounding 未回傳可核對來源引用；未產生推薦。', 404);
  const people = validateCandidates(result, evidence);
  if (!people.length) throw fail('搜尋結果沒有可由 grounding 引用關聯至人物姓名的候選；未以虛構資料補足。', 404);
  const ranking = buildRanking(preferences, people);
  if (!ranking.length || ranking.some(person => person.dimensions.length !== 6 || !Number.isFinite(person.score))) throw fail('六維度計分結果格式驗證失敗。');
  return { model, summary: result.summary.slice(0, 700), recommendationReason: result.recommendationReason.slice(0, 1000), ranking };
}

app.use(express.json({ limit: '1mb' }));
app.get('/api/health', (req, res) => res.json({ ok: true, geminiConfigured: Boolean(GEMINI_API_KEY), preferredModel: PREFERRED_MODEL, searchTool: 'google_search', status: GEMINI_API_KEY ? 'configured' : 'not_configured' }));
app.post('/api/recommendations', async (req, res) => {
  try {
    if (!validatePreferences(req.body)) return res.status(400).json({ ok: false, error: '請提供完整有效的六維度問卷資料。' });
    const result = await analyze(req.body);
    return res.json({ ok: true, geminiEnabled: true, searchPerformed: true, model: result.model, sourceStatus: 'google-search-grounded-not-independently-verified', summary: result.summary, preferenceSummary: 'Gemini 偏好理解已完成；請參照搜尋引用自行核對。', recommendationReason: result.recommendationReason, ranking: result.ranking });
  } catch (error) {
    const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600 ? error.status : 502;
    return res.status(status).json({ ok: false, geminiEnabled: false, searchPerformed: false, error: error.message || 'Gemini AI 適配分析暫時無法使用；未產生推薦。' });
  }
});
app.use(express.static(path.join(__dirname, '.')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(PORT, () => {
  console.log(`[MatchLens] Server running at http://localhost:${PORT}`);
  console.log(`[MatchLens] Preferred Gemini model: ${PREFERRED_MODEL}; Search tool: google_search`);
  if (!GEMINI_API_KEY) console.log('[MatchLens] Gemini API is not enabled. Set GEMINI_API_KEY in the server environment.');
});
