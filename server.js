const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const PREFERRED_MODEL = 'gemini-3.8-flash';
const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';
const DIMENSIONS = ['外型風格', '氣質人設', '作品類型', '表演風格', '資歷區間', '觀看情境'];
const NEUTRAL_VALUES = new Set(['沒有特別偏好', '沒有特別要求', '皆可', '無限制', '不拘', '不限資歷', '不限平台', '不限片長', '作品類型不限']);
const STABLE_SEARCH_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
const RESULT_SOURCE_STATUS = 'google-search-grounded-not-independently-verified';
const IN_FLIGHT = new Map();
const MAX_IN_FLIGHT = 20;
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
  if (preference === undefined || preference === null || preference === '') return null;
  const labels = Array.isArray(options) ? options : [options];
  if (!labels.length) return null;
  return labels.includes(preference) ? 100 : 0;
}
function matchMultiple(selected, options) {
  if (!Array.isArray(selected) || selected.length === 0) return null;
  if (selected.includes('作品類型不限')) return 100;
  const labels = Array.isArray(options) ? options : [];
  if (!labels.length) return null;
  return Math.round(selected.filter(item => labels.includes(item)).length / selected.length * 100);
}
function getWeights(preferences) {
  const saved = Array.isArray(preferences.weights) ? preferences.weights : [];
  const items = DIMENSIONS.map((name, index) => saved.find(item => item && item.name === name) || saved[index]);
  const scores = items.map(item => Number(item?.score));
  const validScores = scores.every(value => Number.isFinite(value) && value >= 0);
  const values = validScores ? scores : items.map(item => Number(item?.percentage));
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!values.every(value => Number.isFinite(value) && value >= 0) || total <= 0) return DIMENSIONS.map(() => 100 / DIMENSIONS.length);
  return values.map(value => value / total * 100);
}
function getDimensionScores(preferences, person) {
  const viewingPreference = preferences.viewing || {};
  const viewingData = person.viewing || {};
  const viewingParts = [
    matchSingle(viewingPreference.platform, viewingData.platform),
    matchSingle(viewingPreference.duration, viewingData.duration),
    matchSingle(viewingPreference.quality, viewingData.quality)
  ].filter(score => score !== null);
  const viewingScore = viewingParts.length ? Math.round(viewingParts.reduce((sum, score) => sum + score, 0) / viewingParts.length) : null;
  return [
    { name: DIMENSIONS[0], score: matchSingle(preferences.appearance, person.appearance) },
    { name: DIMENSIONS[1], score: matchSingle(preferences.personality, person.personality) },
    { name: DIMENSIONS[2], score: matchMultiple(preferences.genres, person.genres) },
    { name: DIMENSIONS[3], score: matchSingle(preferences.performance, person.performance) },
    { name: DIMENSIONS[4], score: matchSingle(preferences.experience, person.experience) },
    { name: DIMENSIONS[5], score: viewingScore }
  ];
}
function fail(code, message, status = 502) { const error = new Error(message); error.code = code; error.status = status; return error; }
function parseJson(text, phase) {
  const cleaned = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) throw fail('INVALID_GEMINI_RESPONSE', `Gemini ${phase}回應格式無效，未產生推薦。`);
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { throw fail('INVALID_GEMINI_RESPONSE', `Gemini ${phase}回應 JSON 無效，未產生推薦。`); }
}
function responseText(data) { return data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('\n') || ''; }
async function geminiFetch(url, options, timeoutMs = 45000) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  catch (error) {
    if (error.name === 'AbortError') throw fail('API_TIMEOUT', 'Gemini API 請求逾時，未產生推薦。', 504);
    throw fail('API_UNAVAILABLE', '無法連接 Gemini API，未產生推薦。', 502);
  } finally { clearTimeout(timer); }
}
async function listAvailableModels() {
  const models = [];
  let pageToken = '';
  do {
    const query = new URLSearchParams({ pageSize: '100' });
    if (pageToken) query.set('pageToken', pageToken);
    const response = await geminiFetch(`${API_ROOT}/models?${query}`, { headers: { 'x-goog-api-key': GEMINI_API_KEY } });
    if (!response.ok) {
      if ([401, 403].includes(response.status)) throw fail('API_KEY_INVALID_OR_FORBIDDEN', 'Gemini API Key 無效或帳戶沒有 API 使用權限。', 503);
      if (response.status === 429) throw fail('API_QUOTA_OR_PERMISSION', 'Gemini API 額度或使用權限不足。', 429);
      throw fail('MODEL_LIST_FAILED', `Gemini models.list 失敗（HTTP ${response.status}），無法確認可用模型。`, 502);
    }
    let body; try { body = await response.json(); } catch { throw fail('INVALID_GEMINI_RESPONSE', 'Gemini models.list 回傳格式無效。'); }
    if (!Array.isArray(body.models)) throw fail('INVALID_GEMINI_RESPONSE', 'Gemini models.list 未回傳 models 陣列。');
    models.push(...body.models);
    pageToken = typeof body.nextPageToken === 'string' ? body.nextPageToken : '';
  } while (pageToken && models.length < 500);
  return models;
}
function chooseModel(models) {
  const byName = new Map(models.map(model => [String(model.name || '').replace(/^models\//, ''), model]));
  for (const id of [PREFERRED_MODEL, ...STABLE_SEARCH_MODELS.filter(candidate => candidate !== PREFERRED_MODEL)]) {
    const model = byName.get(id);
    if (STABLE_SEARCH_MODELS.includes(id) && model?.supportedGenerationMethods?.includes('generateContent')) return id;
  }
  throw fail('MODEL_UNAVAILABLE', '此 API Key 沒有可用且支援 generateContent 的穩定 Google Search grounding 模型；未執行推薦。', 503);
}
async function generate(model, prompt, useSearch = false) {
  const response = await geminiFetch(`${API_ROOT}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], ...(useSearch ? { tools: [{ google_search: {} }] } : {}), generationConfig: { temperature: 0.1, maxOutputTokens: 3500 } })
  });
  if (!response.ok) {
    let detail = ''; try { detail = (await response.json())?.error?.message || ''; } catch {}
    if ([401, 403].includes(response.status)) throw fail('API_KEY_INVALID_OR_FORBIDDEN', 'Gemini API Key 無效或帳戶沒有 API 使用權限。', 503);
    if (response.status === 429) throw fail('API_QUOTA_OR_PERMISSION', 'Gemini API 額度或使用權限不足。', 429);
    if ([400, 404].includes(response.status)) throw fail(useSearch ? 'GROUNDING_UNAVAILABLE' : 'MODEL_UNAVAILABLE', useSearch ? `模型或帳戶不支援 Google Search Grounding：${detail || '請確認模型及帳戶資格'}。` : `Gemini 模型不可用：${detail || '請確認模型 ID'}。`, 503);
    throw fail('GEMINI_REQUEST_FAILED', `Gemini generateContent 失敗（HTTP ${response.status}）；未產生推薦。`, 502);
  }
  let data; try { data = await response.json(); } catch { throw fail('INVALID_GEMINI_RESPONSE', 'Gemini generateContent 回傳無效 JSON。'); }
  if (!data?.candidates?.[0]?.content?.parts?.length) throw fail('INVALID_GEMINI_RESPONSE', 'Gemini 沒有回傳可用內容，未產生推薦。');
  return data;
}
function validHttpUrl(value) { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } }
function groundingEvidence(data) {
  const metadata = data?.candidates?.[0]?.groundingMetadata;
  if (!metadata || !Array.isArray(metadata.groundingChunks) || !Array.isArray(metadata.groundingSupports)) return { urls: [], supports: [], chunks: [] };
  const chunks = metadata.groundingChunks;
  return {
    urls: [...new Set(chunks.map(chunk => validHttpUrl(chunk?.web?.uri)).filter(Boolean))],
    supports: metadata.groundingSupports.filter(item => typeof item?.segment?.text === 'string' && Array.isArray(item.groundingChunkIndices)),
    chunks
  };
}
function citedUrlsForText(evidence, text) {
  const query = String(text || '').trim().toLocaleLowerCase();
  if (!query) return [];
  return [...new Set(evidence.supports.filter(support => String(support.segment.text).toLocaleLowerCase().includes(query)).flatMap(support => support.groundingChunkIndices.map(index => validHttpUrl(evidence.chunks[index]?.web?.uri)).filter(Boolean)))];
}
function cleanLabels(value, allowed, evidence, name) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(label => typeof label === 'string' && allowed.includes(label) && citedUrlsForText(evidence, `${name} ${label}`).length > 0))].slice(0, 8);
}
function validateCandidates(result, evidence) {
  if (!result || typeof result !== 'object' || !Array.isArray(result.candidates)) throw fail('INVALID_SEARCH_DATA', '搜尋結果格式不符，未產生推薦。');
  const people = [];
  for (const raw of result.candidates.slice(0, 10)) {
    if (!raw || typeof raw !== 'object' || typeof raw.name !== 'string' || raw.name.trim().length < 2 || raw.name.length > 100) continue;
    const name = raw.name.trim();
    const identitySources = citedUrlsForText(evidence, name).filter(url => evidence.urls.includes(url));
    const declaredSources = Array.isArray(raw.sourceUrls) ? raw.sourceUrls.map(validHttpUrl).filter(Boolean) : [];
    const sourceUrls = declaredSources.filter(url => identitySources.includes(url));
    if (!sourceUrls.length) continue;
    const works = (Array.isArray(raw.works) ? raw.works : []).slice(0, 5).flatMap(work => {
      if (!work || typeof work.title !== 'string' || !work.title.trim()) return [];
      const title = work.title.trim();
      const citedWorkUrls = citedUrlsForText(evidence, title).filter(url => sourceUrls.includes(url));
      const workSources = Array.isArray(work.sourceUrls) ? work.sourceUrls.map(validHttpUrl).filter(url => citedWorkUrls.includes(url)) : [];
      if (!workSources.length) return [];
      return [{ title, type: typeof work.type === 'string' ? work.type.slice(0, 80) : '', year: typeof work.year === 'string' || typeof work.year === 'number' ? String(work.year).slice(0, 12) : '', sourceUrls: [...new Set(workSources)] }];
    });
    const viewing = raw.viewing && typeof raw.viewing === 'object' ? raw.viewing : {};
    people.push({
      id: people.length + 1, name, category: typeof raw.category === 'string' ? raw.category.slice(0, 40) : '演員',
      appearance: cleanLabels(raw.appearance, LABELS.appearance, evidence, name),
      personality: cleanLabels(raw.personality, LABELS.personality, evidence, name),
      genres: cleanLabels(raw.genres, LABELS.genres, evidence, name),
      performance: cleanLabels(raw.performance, LABELS.performance, evidence, name),
      experience: LABELS.experience.includes(raw.experience) && citedUrlsForText(evidence, `${name} ${raw.experience}`).length ? raw.experience : '',
      viewing: {
        platform: cleanLabels(viewing.platform, LABELS.platform, evidence, name),
        duration: cleanLabels(viewing.duration, LABELS.duration, evidence, name),
        quality: cleanLabels(viewing.quality, LABELS.quality, evidence, name)
      },
      description: typeof raw.description === 'string' ? raw.description.slice(0, 700) : '', works,
      evidence: { sourceStatus: RESULT_SOURCE_STATUS, sourceUrls: [...new Set(sourceUrls)], note: 'Grounding metadata 的公開來源引用與人物姓名有文字關聯；不是人工查證。標籤/描述是 Gemini 整理內容，只保留能與姓名及特徵文字同時對應的引用標籤。' }
    });
  }
  return people;
}
function isSkipped(preferences, name) { return Array.isArray(preferences.skippedDimensions) && preferences.skippedDimensions.includes(name); }
function buildRanking(preferences, people) {
  const weights = getWeights(preferences);
  return people.map(person => {
    const dimensions = getDimensionScores(preferences, person).map(item => ({
      ...item,
      skipped: isSkipped(preferences, item.name),
      status: isSkipped(preferences, item.name) ? 'skipped' : item.score === null ? 'unknown' : 'scored'
    }));
    const comparable = dimensions.map((item, index) => ({ ...item, weight: weights[index] }))
      .filter(item => !item.skipped && item.score !== null && item.weight > 0);
    const weightTotal = comparable.reduce((sum, item) => sum + item.weight, 0);
    const score = weightTotal > 0 ? Math.round(comparable.reduce((sum, item) => sum + item.score * item.weight, 0) / weightTotal * 10) / 10 : null;
    return {
      rank: 0, name: person.name, category: person.category, score,
      description: person.description, dimensions, works: person.works, evidence: person.evidence,
      dataCompleteness: `${comparable.length}/6`,
      bestMatches: comparable.filter(item => item.score >= 80).map(item => item.name),
      gaps: comparable.filter(item => item.score < 50).map(item => item.name),
      unknownDimensions: dimensions.filter(item => item.status === 'unknown').map(item => item.name),
      weightsUsed: comparable.reduce((sum, item) => sum + item.weight, 0)
    };
  }).filter(person => Number.isFinite(person.score) && person.dataCompleteness !== '0/6')
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-Hant'))
    .map((person, index) => ({ ...person, rank: index + 1 }));
}
function validatePreferences(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (!LABELS.appearance.includes(value.appearance) && !isNeutral(value.appearance)) return false;
  if (!LABELS.personality.includes(value.personality) && !isNeutral(value.personality)) return false;
  if (!Array.isArray(value.genres) || !value.genres.length || value.genres.some(item => item !== '作品類型不限' && !LABELS.genres.includes(item))) return false;
  if (value.genres.includes('作品類型不限') && value.genres.length !== 1) return false;
  if (!LABELS.performance.includes(value.performance) && !isNeutral(value.performance)) return false;
  if (!LABELS.experience.includes(value.experience) && value.experience !== '不限資歷') return false;
  if (!value.viewing || typeof value.viewing !== 'object' || Array.isArray(value.viewing)) return false;
  if (!LABELS.platform.includes(value.viewing.platform) && value.viewing.platform !== '不限平台') return false;
  if (!LABELS.duration.includes(value.viewing.duration) && value.viewing.duration !== '不限片長') return false;
  if (!LABELS.quality.includes(value.viewing.quality) && !isNeutral(value.viewing.quality)) return false;
  const skipped = value.skippedDimensions === undefined ? [] : value.skippedDimensions;
  if (!Array.isArray(skipped) || skipped.some(name => !DIMENSIONS.includes(name)) || new Set(skipped).size !== skipped.length) return false;
  if (skipped.length === DIMENSIONS.length) return false;
  if (!Array.isArray(value.weights) || value.weights.length !== DIMENSIONS.length) return false;
  const weightItems = DIMENSIONS.map(name => value.weights.find(item => item?.name === name));
  if (weightItems.some(item => !item || !Number.isFinite(Number(item.score)) || Number(item.score) < 0 || Number(item.score) > 5)) return false;
  for (let index = 0; index < DIMENSIONS.length; index += 1) {
    const shouldSkip = skipped.includes(DIMENSIONS[index]);
    if (shouldSkip !== (Number(weightItems[index].score) === 0)) return false;
    if (!Number.isFinite(Number(weightItems[index].percentage)) || Number(weightItems[index].percentage) < 0) return false;
  }
  return true;
}
async function analyze(preferences) {
  if (!GEMINI_API_KEY) throw fail('API_NOT_CONFIGURED', 'Gemini AI 適配分析服務尚未設定 GEMINI_API_KEY；未執行分析或人物搜尋。', 503);
  const model = chooseModel(await listAvailableModels());
  const preferenceData = await generate(model, `只分析偏好並輸出 JSON，不推薦人物、不使用模型記憶提供人物資料。格式：{"searchQuery":"供 Google Search 使用的公開影視演員搜尋文字","preferenceSummary":"簡短偏好摘要","relevantDimensions":[六維度名稱]}。維度只能是 ${DIMENSIONS.join('、')}。使用者問卷：${JSON.stringify(preferences)}`);
  const understanding = parseJson(responseText(preferenceData), '偏好理解');
  if (typeof understanding.searchQuery !== 'string' || !understanding.searchQuery.trim() || typeof understanding.preferenceSummary !== 'string' || !Array.isArray(understanding.relevantDimensions) || understanding.relevantDimensions.some(name => !DIMENSIONS.includes(name))) throw fail('INVALID_GEMINI_RESPONSE', 'Gemini 偏好理解回應未通過格式/維度驗證，未執行搜尋。');
  const query = `搜尋任務：${understanding.searchQuery}\n偏好摘要：${understanding.preferenceSummary}\n只整理本次 Google Search 搜尋結果可支持的真人演員與非露骨影視作品。不要用模型記憶、猜測、虛構人物或作品。姓名需在 grounding 支持的文字片段中出現；人物至少有一個對應 URL。作品須由 grounding 片段支持其名稱，否則省略。標籤只能使用問卷選項，且只有同一引用文字片段同時提到姓名和標籤時才填。無來源的欄位留空/省略。輸出 JSON：{"summary":"...","recommendationReason":"基於本次搜尋引用的簡短理由","candidates":[{"name":"...","category":"演員","appearance":["..."],"personality":["..."],"genres":["..."],"performance":["..."],"experience":"...","viewing":{"platform":["..."],"duration":["..."],"quality":["..."]},"description":"AI整理描述，不是已查證事實","sourceUrls":["本次搜尋 grounding 的 URL"],"works":[{"title":"...","type":"...","year":"...","sourceUrls":["本次搜尋 grounding URL"]}]}]}\n標籤選項：外型 ${LABELS.appearance.join('、')}；氣質 ${LABELS.personality.join('、')}；類型 ${LABELS.genres.join('、')}；表演 ${LABELS.performance.join('、')}；資歷 ${LABELS.experience.join('、')}；平台 ${LABELS.platform.join('、')}；片長 ${LABELS.duration.join('、')}；畫質 ${LABELS.quality.join('、')}。`;
  const searchData = await generate(model, query, true);
  const result = parseJson(responseText(searchData), '人物搜尋');
  if (typeof result.summary !== 'string' || typeof result.recommendationReason !== 'string') throw fail('INVALID_SEARCH_DATA', '搜尋回應缺少摘要或推薦理由，未產生結果。');
  const evidence = groundingEvidence(searchData);
  if (!evidence.urls.length || !evidence.supports.length) throw fail('GROUNDING_VALIDATION_FAILED', '目前無法取得足夠的可靠資料，暫時無法產生推薦結果。', 404);
  const people = validateCandidates(result, evidence);
  if (!people.length) throw fail('GROUNDING_VALIDATION_FAILED', '目前無法取得與候選人姓名有關聯的可靠來源，暫時無法產生推薦結果。', 404);
  const ranking = buildRanking(preferences, people);
  if (!ranking.length || ranking.some(person => person.dimensions.length !== 6 || (person.score !== null && !Number.isFinite(person.score)) || !person.evidence.sourceUrls.length)) throw fail('RESULT_VALIDATION_FAILED', '六維度計分或來源驗證失敗，未產生推薦。');
  return { model, summary: result.summary.slice(0, 700), preferenceSummary: understanding.preferenceSummary.slice(0, 500), recommendationReason: result.recommendationReason.slice(0, 1000), ranking };
}

app.use(express.json({ limit: '1mb' }));
app.get('/api/health', (req, res) => res.json({ ok: true, geminiConfigured: Boolean(GEMINI_API_KEY), preferredModel: PREFERRED_MODEL, searchTool: 'google_search', status: GEMINI_API_KEY ? 'configured' : 'not_configured' }));
app.post('/api/recommendations', async (req, res) => {
  if (!validatePreferences(req.body)) return res.status(400).json({ success: false, ok: false, error: 'INVALID_PREFERENCES', message: '請提供完整且有效的六維度問卷資料。' });
  const requestKey = JSON.stringify(req.body);
  if (IN_FLIGHT.has(requestKey)) {
    try { return res.json(await IN_FLIGHT.get(requestKey)); }
    catch (error) { return res.status(error.status || 502).json({ success: false, ok: false, error: error.code || 'ANALYSIS_FAILED', message: error.message }); }
  }
  if (IN_FLIGHT.size >= MAX_IN_FLIGHT) return res.status(503).json({ success: false, ok: false, error: 'SERVICE_BUSY', message: '目前分析請求較多，請稍後重試。' });
  const task = analyze(req.body).then(result => ({ success: true, ok: true, geminiEnabled: true, searchPerformed: true, model: result.model, sourceStatus: RESULT_SOURCE_STATUS, summary: result.summary, preferenceSummary: result.preferenceSummary, recommendationReason: result.recommendationReason, ranking: result.ranking })).finally(() => IN_FLIGHT.delete(requestKey));
  IN_FLIGHT.set(requestKey, task);
  try { return res.json(await task); }
  catch (error) { return res.status(error.status || 502).json({ success: false, ok: false, geminiEnabled: false, searchPerformed: false, error: error.code || 'ANALYSIS_FAILED', message: error.message || 'Gemini AI 適配分析失敗；未產生推薦。' }); }
});
app.use(express.static(path.join(__dirname, '.')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
if (require.main === module) app.listen(PORT, () => {
  console.log(`[MatchLens] Server running at http://localhost:${PORT}`);
  if (!GEMINI_API_KEY) console.log('[MatchLens] Gemini API is not enabled. Set GEMINI_API_KEY in the server environment.');
});
module.exports = { app, isNeutral, matchSingle, matchMultiple, getWeights, getDimensionScores, chooseModel, groundingEvidence, validateCandidates, buildRanking, validatePreferences, analyze, DIMENSIONS, STABLE_SEARCH_MODELS, RESULT_SOURCE_STATUS };
