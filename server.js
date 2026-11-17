const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const DIMENSIONS = ['外型風格', '氣質人設', '作品類型', '表演風格', '資歷區間', '觀看情境'];
const NEUTRAL_VALUES = new Set(['沒有特別偏好', '沒有特別要求', '皆可', '無限制', '不拘', '不限資歷', '不限平台', '不限片長', '作品類型不限']);

function isNeutral(value) {
  return typeof value === 'string' && NEUTRAL_VALUES.has(value);
}

// Keep the existing six-dimension match and weight normalization rules.
function matchSingle(preference, options) {
  if (isNeutral(preference)) return 100;
  if (preference === undefined || preference === null || preference === '') return 0;
  const labels = Array.isArray(options) ? options : [options];
  return labels.includes(preference) ? 100 : 0;
}

function matchMultiple(selected, options) {
  if (!Array.isArray(selected) || selected.length === 0) return 0;
  if (selected.includes('作品類型不限')) return 100;
  const labels = Array.isArray(options) ? options : [];
  const matched = selected.filter(item => labels.includes(item));
  return Math.round((matched.length / selected.length) * 100);
}

function getWeights(preferences) {
  const savedWeights = Array.isArray(preferences.weights) ? preferences.weights : [];
  const items = DIMENSIONS.map((name, index) => savedWeights.find(item => item && item.name === name) || savedWeights[index]);
  const rawScores = items.map(item => Number(item?.score));
  const hasValidRawScores = rawScores.every(value => Number.isFinite(value) && value > 0);
  const source = hasValidRawScores ? rawScores : items.map(item => Number(item?.percentage));
  const total = source.reduce((sum, value) => sum + value, 0);
  if (!source.every(value => Number.isFinite(value) && value >= 0) || total <= 0) return DIMENSIONS.map(() => 100 / DIMENSIONS.length);
  return source.map(value => value / total * 100);
}

function getDimensionScores(preferences, person) {
  const viewing = preferences.viewing || {};
  const personViewing = person.viewing || {};
  const viewingScore = (
    matchSingle(viewing.platform, personViewing.platform) +
    matchSingle(viewing.duration, personViewing.duration) +
    matchSingle(viewing.quality, personViewing.quality)
  ) / 3;
  return [
    { name: DIMENSIONS[0], score: matchSingle(preferences.appearance, person.appearance) },
    { name: DIMENSIONS[1], score: matchSingle(preferences.personality, person.personality) },
    { name: DIMENSIONS[2], score: matchMultiple(preferences.genres, person.genres) },
    { name: DIMENSIONS[3], score: matchSingle(preferences.performance, person.performance) },
    { name: DIMENSIONS[4], score: matchSingle(preferences.experience, person.experience) },
    { name: DIMENSIONS[5], score: Math.round(viewingScore) }
  ];
}

function parseJson(text) {
  const cleaned = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Gemini 沒有回傳可讀取的搜尋結果。');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function getGroundedUrls(data) {
  const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  return [...new Set(chunks.map(chunk => chunk.web?.uri).filter(url => {
    try { return ['http:', 'https:'].includes(new URL(url).protocol); } catch { return false; }
  }))];
}

async function searchAndAnalyze(preferences) {
  if (!GEMINI_API_KEY) {
    const error = new Error('Gemini AI 適配分析服務尚未啟用：伺服器未設定 GEMINI_API_KEY。未執行人物搜尋，也未產生推薦。');
    error.status = 503;
    throw error;
  }

  const prompt = `你是以公開網頁搜尋結果為依據的人物資料研究助理。請依使用者偏好搜尋真實、可查證的演員或人物，並從搜尋到的公開網頁整理最多 5 位適合者。不能用虛構人物、示範資料、猜測或模型記憶填補搜尋結果；找不到可靠來源就回傳空 candidates。使用者偏好：\n${JSON.stringify(preferences)}\n\n只輸出 JSON：{"summary":"...","recommendationReason":"依搜尋證據撰寫的簡短說明","candidates":[{"name":"公開人物姓名","category":"演員","appearance":["只填有來源支持且符合問卷選項的標籤"],"personality":["..."],"genres":["..."],"performance":["..."],"experience":"...","viewing":{"platform":["..."],"duration":["..."],"quality":["..."]},"description":"有來源支持的簡介","works":[{"title":"可查證作品","type":"...","year":"...","url":"搜尋來源中的作品網址"}],"sourceUrls":["必須逐字取自本次 Google 搜尋結果的網址"]}]}。六維度標籤只能使用問卷選項；沒有來源證據時回傳空陣列或空字串。每人需至少有一個本次搜尋提供的 sourceUrls。人物可用來源必須取自搜尋結果，不可自行編造 URL。\n外型選項：清新自然、成熟穩重、陽光活潑、優雅知性、個性時尚。氣質選項：溫柔親切、幽默風趣、自信獨立、沉穩內斂、熱情活潑。類型：喜劇、愛情、科幻、懸疑、動作、劇情、紀錄片、動畫。表演：自然寫實、情感細膩、幽默誇張、感染力強、風格多變。資歷：新生代演員、發展中演員、資深演員。觀看平台：串流平台、電影院、電視、免費影音平台；片長：30 分鐘以內、30～60 分鐘、60～120 分鐘、120 分鐘以上；畫質：一般畫質即可、Full HD、4K 高畫質。偏好 JSON 僅供標籤比對，觀看情境只在來源有明確資料時填寫。`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 3000 }
    })
  });
  if (!response.ok) {
    const error = new Error(`Gemini/Google 搜尋服務回應 ${response.status}；未產生推薦結果。`);
    error.status = response.status === 401 || response.status === 403 ? 503 : 502;
    throw error;
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('\n') || '';
  const result = parseJson(text);
  const groundedUrls = new Set(getGroundedUrls(data));
  const candidates = (Array.isArray(result.candidates) ? result.candidates : []).map((person, index) => {
    const sourceUrls = (Array.isArray(person.sourceUrls) ? person.sourceUrls : []).filter(url => groundedUrls.has(url));
    return {
      id: index + 1,
      name: String(person.name || '').trim(),
      category: String(person.category || '人物'),
      appearance: Array.isArray(person.appearance) ? person.appearance : [],
      personality: Array.isArray(person.personality) ? person.personality : [],
      genres: Array.isArray(person.genres) ? person.genres : [],
      performance: Array.isArray(person.performance) ? person.performance : [],
      experience: String(person.experience || ''),
      viewing: person.viewing && typeof person.viewing === 'object' ? person.viewing : {},
      description: String(person.description || ''),
      works: Array.isArray(person.works) ? person.works.filter(work => work && typeof work.title === 'string').map(work => ({
        title: work.title,
        type: String(work.type || ''),
        year: String(work.year || ''),
        url: groundedUrls.has(work.url) ? work.url : ''
      })) : [],
      evidence: { sourceStatus: sourceUrls.length ? 'search-grounded' : 'unverified', sourceUrls, note: sourceUrls.length ? '本次 Gemini Google 搜尋提供的來源；請開啟來源自行核對，非人工查證。' : '沒有可與本次搜尋 grounding 資料核對的來源。' }
    };
  }).filter(person => person.name && person.evidence.sourceUrls.length > 0);

  if (candidates.length === 0) {
    const error = new Error('人物搜尋沒有找到附有可核對公開來源的人物；未以虛構資料補足。');
    error.status = 404;
    throw error;
  }
  return { summary: String(result.summary || '已完成有來源的人物搜尋。'), recommendationReason: String(result.recommendationReason || '推薦依據本次搜尋資料及六維度規則計分。'), candidates };
}

function buildRanking(preferences, candidates) {
  const weights = getWeights(preferences);
  return candidates.map(person => {
    const dimensions = getDimensionScores(preferences, person);
    const score = Math.round(dimensions.reduce((sum, item, index) => sum + item.score * weights[index] / 100, 0) * 10) / 10;
    return {
      rank: 0, name: person.name, category: person.category, score,
      description: person.description, personId: person.id, dimensions,
      works: person.works, sourceStatus: person.evidence.sourceStatus,
      evidence: person.evidence,
      bestMatches: dimensions.filter(item => item.score >= 80).map(item => item.name),
      gaps: dimensions.filter(item => item.score < 50).map(item => item.name)
    };
  }).sort((a, b) => b.score - a.score).slice(0, 5).map((person, index) => ({ ...person, rank: index + 1 }));
}

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'healthy', geminiConfigured: Boolean(GEMINI_API_KEY), model: GEMINI_MODEL, searchGrounding: Boolean(GEMINI_API_KEY) });
});

app.post('/api/recommendations', async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ ok: false, error: '請提供有效的偏好資料。' });
    const analysis = await searchAndAnalyze(req.body);
    const ranking = buildRanking(req.body, analysis.candidates);
    return res.json({ ok: true, summary: analysis.summary, recommendationReason: analysis.recommendationReason, geminiEnabled: true, searchPerformed: true, ranking });
  } catch (error) {
    const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600 ? error.status : 502;
    return res.status(status).json({ ok: false, serviceEnabled: Boolean(GEMINI_API_KEY), error: error.message || '適配分析服務暫時無法使用。' });
  }
});

app.use(express.static(path.join(__dirname, '.')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => {
  console.log(`[MatchLens] Server running at http://localhost:${PORT}`);
  if (!GEMINI_API_KEY) console.log('[MatchLens] Gemini AI 適配分析服務尚未啟用：請在伺服器環境設定 GEMINI_API_KEY。');
});
