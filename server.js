const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const CANDIDATES = [
  {
    id: 1,
    name: '林知遠',
    category: '演員',
    appearance: ['清新自然', '優雅知性'],
    personality: ['溫柔親切', '沉穩內斂'],
    genres: ['愛情', '劇情'],
    performance: ['自然寫實', '情感細膩'],
    experience: '發展中演員',
    viewing: {
      platform: ['串流平台'],
      duration: ['30～60 分鐘', '60～120 分鐘'],
      quality: ['Full HD', '4K 高畫質']
    },
    description: '擅長細膩情感與自然演出的示範演員。',
    evidence: {
      sourceStatus: 'demo',
      note: '此為課堂專題示範資料，僅作為本地規則式比對使用，不代表真實人物。',
      verifiedAt: '2026-11-13',
      sourceUrls: ['https://example.com/demo-matchlens-profile']
    },
    works: [
      { title: '示範作品 A', type: '影集', year: '2025', url: 'https://example.com/demo-work-a' },
      { title: '示範作品 B', type: '電影', year: '2024', url: 'https://example.com/demo-work-b' }
    ]
  },
  {
    id: 2,
    name: '陳宇辰',
    category: '演員',
    appearance: ['陽光活潑', '個性時尚'],
    personality: ['幽默風趣', '熱情活潑'],
    genres: ['喜劇', '動作'],
    performance: ['幽默誇張', '感染力強'],
    experience: '新生代演員',
    viewing: {
      platform: ['免費影音平台', '串流平台'],
      duration: ['30 分鐘以內', '30～60 分鐘'],
      quality: ['Full HD']
    },
    description: '擅長活潑角色與喜劇表現的示範演員。',
    evidence: {
      sourceStatus: 'demo',
      note: '此為課堂專題示範資料，僅作為本地規則式比對使用，不代表真實人物。',
      verifiedAt: '2026-11-13',
      sourceUrls: ['https://example.com/demo-matchlens-profile']
    },
    works: [
      { title: '示範作品 C', type: '影集', year: '2025', url: 'https://example.com/demo-work-c' },
      { title: '示範作品 D', type: '電影', year: '2024', url: 'https://example.com/demo-work-d' }
    ]
  },
  {
    id: 3,
    name: '周以安',
    category: '演員',
    appearance: ['成熟穩重', '優雅知性'],
    personality: ['自信獨立', '沉穩內斂'],
    genres: ['懸疑', '劇情'],
    performance: ['自然寫實', '風格多變'],
    experience: '資深演員',
    viewing: {
      platform: ['電影院', '串流平台'],
      duration: ['60～120 分鐘', '120 分鐘以上'],
      quality: ['4K 高畫質']
    },
    description: '擅長懸疑及劇情類作品的示範演員。',
    evidence: {
      sourceStatus: 'demo',
      note: '此為課堂專題示範資料，僅作為本地規則式比對使用，不代表真實人物。',
      verifiedAt: '2026-11-13',
      sourceUrls: ['https://example.com/demo-matchlens-profile']
    },
    works: [
      { title: '示範作品 E', type: '影集', year: '2025', url: 'https://example.com/demo-work-e' },
      { title: '示範作品 F', type: '戲劇', year: '2023', url: 'https://example.com/demo-work-f' }
    ]
  },
  {
    id: 4,
    name: '許晨曦',
    category: '演員',
    appearance: ['清新自然', '陽光活潑'],
    personality: ['熱情活潑', '溫柔親切'],
    genres: ['愛情', '喜劇', '動畫'],
    performance: ['感染力強', '情感細膩'],
    experience: '新生代演員',
    viewing: {
      platform: ['免費影音平台', '串流平台'],
      duration: ['30 分鐘以內', '30～60 分鐘'],
      quality: ['一般畫質即可', 'Full HD']
    },
    description: '擅長輕鬆故事與溫暖角色的示範演員。',
    evidence: {
      sourceStatus: 'demo',
      note: '此為課堂專題示範資料，僅作為本地規則式比對使用，不代表真實人物。',
      verifiedAt: '2026-11-13',
      sourceUrls: ['https://example.com/demo-matchlens-profile']
    },
    works: [
      { title: '示範作品 G', type: '影集', year: '2025', url: 'https://example.com/demo-work-g' },
      { title: '示範作品 H', type: '動畫', year: '2024', url: 'https://example.com/demo-work-h' }
    ]
  },
  {
    id: 5,
    name: '張承翰',
    category: '演員',
    appearance: ['成熟穩重', '個性時尚'],
    personality: ['自信獨立', '幽默風趣'],
    genres: ['動作', '科幻', '懸疑'],
    performance: ['感染力強', '風格多變'],
    experience: '發展中演員',
    viewing: {
      platform: ['電影院', '串流平台'],
      duration: ['60～120 分鐘', '120 分鐘以上'],
      quality: ['4K 高畫質']
    },
    description: '擅長科幻與動作題材的示範演員。',
    evidence: {
      sourceStatus: 'demo',
      note: '此為課堂專題示範資料，僅作為本地規則式比對使用，不代表真實人物。',
      verifiedAt: '2026-11-13',
      sourceUrls: ['https://example.com/demo-matchlens-profile']
    },
    works: [
      { title: '示範作品 I', type: '電影', year: '2025', url: 'https://example.com/demo-work-i' },
      { title: '示範作品 J', type: '影集', year: '2024', url: 'https://example.com/demo-work-j' }
    ]
  },
  {
    id: 6,
    name: '葉思妤',
    category: '演員',
    appearance: ['清新自然', '優雅知性'],
    personality: ['溫柔親切', '自信獨立'],
    genres: ['紀錄片', '劇情', '愛情'],
    performance: ['自然寫實', '情感細膩'],
    experience: '資深演員',
    viewing: {
      platform: ['串流平台', '電視'],
      duration: ['60～120 分鐘'],
      quality: ['Full HD', '4K 高畫質']
    },
    description: '擅長寫實敘事與細膩情感表現的示範演員。',
    evidence: {
      sourceStatus: 'demo',
      note: '此為課堂專題示範資料，僅作為本地規則式比對使用，不代表真實人物。',
      verifiedAt: '2026-11-13',
      sourceUrls: ['https://example.com/demo-matchlens-profile']
    },
    works: [
      { title: '示範作品 K', type: '紀錄片', year: '2024', url: 'https://example.com/demo-work-k' },
      { title: '示範作品 L', type: '劇情', year: '2023', url: 'https://example.com/demo-work-l' }
    ]
  }
];

const neutralValues = new Set([
  '沒有特別偏好',
  '沒有特別要求',
  '皆可',
  '無限制',
  '不拘',
  '不限資歷',
  '不限平台',
  '不限片長',
  '作品類型不限'
]);

function isNeutral(value) {
  return typeof value === 'string' && neutralValues.has(value);
}

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

function getDimensionScores(preferences, person) {
  const viewing = preferences.viewing || {};
  const personViewing = person.viewing || {};
  const viewingScore = (
    matchSingle(viewing.platform, personViewing.platform) +
    matchSingle(viewing.duration, personViewing.duration) +
    matchSingle(viewing.quality, personViewing.quality)
  ) / 3;

  return [
    { name: '外型風格', score: matchSingle(preferences.appearance, person.appearance) },
    { name: '氣質人設', score: matchSingle(preferences.personality, person.personality) },
    { name: '作品類型', score: matchMultiple(preferences.genres, person.genres) },
    { name: '表演風格', score: matchSingle(preferences.performance, person.performance) },
    { name: '資歷區間', score: matchSingle(preferences.experience, person.experience) },
    { name: '觀看情境', score: Math.round(viewingScore) }
  ];
}

function getWeights(preferences) {
  const names = ['外型風格', '氣質人設', '作品類型', '表演風格', '資歷區間', '觀看情境'];
  const savedWeights = Array.isArray(preferences.weights) ? preferences.weights : [];
  const items = names.map((name, index) => savedWeights.find(item => item && item.name === name) || savedWeights[index]);
  const rawScores = items.map(item => Number(item?.score));
  const hasValidRawScores = rawScores.every(value => Number.isFinite(value) && value > 0);
  const source = hasValidRawScores ? rawScores : items.map(item => Number(item?.percentage));
  const validSource = source.every(value => Number.isFinite(value) && value >= 0);
  const total = source.reduce((sum, value) => sum + value, 0);

  if (!validSource || total <= 0) return names.map(() => 100 / names.length);
  return source.map(value => (value / total) * 100);
}

function buildRanking(preferences) {
  const weights = getWeights(preferences);
  const ranked = CANDIDATES.map(person => {
    const dimensions = getDimensionScores(preferences, person);
    const total = dimensions.reduce((sum, item, index) => sum + (item.score * weights[index]) / 100, 0);
    return {
      person,
      dimensions,
      total: Math.round(total * 10) / 10,
      sourceStatus: person.evidence?.sourceStatus || 'demo'
    };
  }).sort((a, b) => b.total - a.total);

  return ranked.slice(0, 3).map((item, index) => ({
    rank: index + 1,
    name: item.person.name,
    category: item.person.category,
    score: item.total,
    description: item.person.description,
    personId: item.person.id,
    dimensions: item.dimensions,
    works: item.person.works || [],
    sourceStatus: item.sourceStatus,
    evidence: item.person.evidence || { sourceStatus: 'demo', note: '無可驗證公開資料' },
    bestMatches: item.dimensions
      .filter(d => d.score >= 80)
      .map(d => d.name),
    gaps: item.dimensions
      .filter(d => d.score < 50)
      .map(d => d.name)
  }));
}

async function callGemini(preferences, ranking) {
  if (!GEMINI_API_KEY) {
    return {
      enabled: false,
      summary: 'Gemini 未啟用：未設定 GEMINI_API_KEY，已退回本地規則式推薦結果。',
      recommendationReason: '本地規則式計分已完成，推薦結果依六維度權重排序。'
    };
  }

  const prompt = `
你是一位嚴格的資料性推薦助理。僅以提供的資料為基礎生成推薦理由，不要編造人物、作品或公開資料。

使用者偏好：
${JSON.stringify(preferences, null, 2)}

候選名單：
${JSON.stringify(ranking, null, 2)}

任務：
1. 若資料是示範資料，明確寫出「此為示範資料，未驗證為真實公開人物」。
2. 若缺乏證據，寫出「資料不足」。
3. 只輸出簡短、清楚的 JSON 物件，格式：
{
  "summary": "...",
  "recommendationReason": "...",
  "keyStrengths": ["..."],
  "dataLimit": "..."
}
`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: '你是一位有證據意識的推薦助理，必須避免捏造資料與公開人物事實。只基於提供內容回答，不可編造。' }]
      },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 800 }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text).join('\n') || '{}';

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    parsed = {
      summary: 'Gemini 生成結果已取得，但回傳格式非 JSON；已回退為本地規則式說明。',
      recommendationReason: text.slice(0, 300),
      keyStrengths: ['已處理推薦邏輯'],
      dataLimit: 'Gemini 回傳格式需為 JSON，請檢查實際回答內容。'
    };
  }

  return {
    enabled: true,
    summary: parsed.summary || 'Gemini 已補充說明。',
    recommendationReason: parsed.recommendationReason || 'Gemini 未提供有效推薦理由。',
    keyStrengths: parsed.keyStrengths || [],
    dataLimit: parsed.dataLimit || '資料來源需經公開驗證後才可納入正式標籤。'
  };
}

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    status: 'healthy',
    geminiConfigured: Boolean(GEMINI_API_KEY),
    model: GEMINI_MODEL,
    demoMode: true
  });
});

app.post('/api/recommendations', async (req, res) => {
  try {
    const preferences = req.body || {};
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: '請提供有效的偏好資料。' });
    }

    const ranking = buildRanking(preferences);

    const ai = await callGemini(preferences, ranking).catch(error => ({
      enabled: false,
      summary: 'Gemini 調用失敗，已回退為本地推薦結果。',
      recommendationReason: error.message || 'Gemini API 呼叫失敗。',
      keyStrengths: [],
      dataLimit: '請確認 GEMINI_API_KEY、GEMINI_MODEL 及網路連線狀態。'
    }));

    const response = {
      ok: true,
      summary: ai.summary || '已完成六維度推薦。',
      recommendationReason: ai.recommendationReason || '已依六維度權重排序。',
      dataLimit: ai.dataLimit || '目前為示範資料模式，資料需另行驗證。',
      geminiEnabled: ai.enabled,
      ranking,
      sources: ranking.map(item => ({
        name: item.name,
        status: item.sourceStatus || 'demo',
        note: item.evidence?.note || '示範資料，尚未驗證為真實公開人物。',
        urls: item.evidence?.sourceUrls || [],
        works: item.works || []
      }))
    };

    return res.json(response);
  } catch (error) {
    console.error('Recommendation error:', error);
    return res.status(500).json({
      ok: false,
      error: '推薦生成失敗，請稍後再試。',
      detail: error.message || 'Unknown error'
    });
  }
});

app.use(express.static(path.join(__dirname, '.')));

app.get('*', (req, res) => {
  const indexFile = path.join(__dirname, 'index.html');
  res.sendFile(indexFile);
});

app.listen(PORT, () => {
  console.log(`[MatchLens] Server running at http://localhost:${PORT}`);
  if (!GEMINI_API_KEY) {
    console.log('[MatchLens] GEMINI_API_KEY 未設定：將以本地規則式推薦模式運作。');
  }
});
