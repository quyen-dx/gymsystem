// knowledgeBuilder.js
// AI Search pipeline with DETERMINISTIC knowledge extraction.
// No LLM is used for parsing. LLM only rewrites already-structured knowledge.
// Architecture: Search → Fetch → Chunk → Rank → Extract (deterministic) → Validate → Writer

import { searchWeb } from '../../services/webSearchService.js'

// ════════════════════════════════════════════════════════════════
// CACHE
// ════════════════════════════════════════════════════════════════

const CACHE_TTL_MS = 60 * 60 * 1000
const cache = new Map()

const getCached = (key) => {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > CACHE_TTL_MS) { cache.delete(key); return null }
  return entry.data
}

const setCached = (key, data) => { cache.set(key, { data, ts: Date.now() }) }

// ════════════════════════════════════════════════════════════════
// FOOD DICTIONARY
// ════════════════════════════════════════════════════════════════

const FOOD_DICT = [
  // Protein / thịt cá
  'thịt gà', 'ức gà', 'cánh gà', 'thịt bò', 'thịt heo', 'thịt lợn', 'thịt nạc', 'thịt ba chỉ',
  'cá hồi', 'cá ngừ', 'cá basa', 'cá lóc', 'cá thu', 'cá mòi', 'cá trích',
  'tôm', 'mực', 'nghêu', 'sò', 'hàu',
  'trứng', 'lòng trắng trứng', 'lòng đỏ trứng',
  'đậu phụ', 'đậu hũ', 'tempeh', 'đậu nành', 'sữa đậu nành',
  // Sữa và chế phẩm
  'sữa tươi', 'sữa nguyên kem', 'sữa không đường', 'sữa chua', 'sữa chua hy lạp', 'phô mai', 'bơ sữa',
  // Tinh bột
  'gạo lứt', 'gạo trắng', 'cơm trắng', 'cơm gạo lứt',
  'khoai lang', 'khoai tây', 'khoai môn',
  'yến mạch', 'bánh mì nguyên cám', 'bánh mì trắng', 'bún', 'phở', 'miến', 'mì gạo',
  'ngũ cốc nguyên hạt', 'hạt diêm mạch', 'hạt quinoa',
  // Rau
  'bông cải xanh', 'bông cải trắng', 'cải xanh', 'cải bó xôi', 'cải thìa', 'cải ngồng',
  'rau muống', 'rau cải', 'rau ngót', 'rau dền', 'rau má',
  'xà lách', 'cần tây', 'giá đỗ', 'nấm', 'nấm hương', 'nấm kim châm',
  'cà rốt', 'dưa leo', 'bí đỏ', 'bí xanh', 'ớt chuông',
  'cà chua', 'củ cải', 'su su', 'cải thảo',
  // Trái cây
  'chuối', 'táo', 'xoài', 'nho', 'bơ', 'đu đủ', 'thanh long',
  'cam', 'quýt', 'bưởi', 'dưa hấu', 'dứa', 'kiwi', 'cherry',
  'dâu tây', 'việt quất', 'mâm xôi', 'lựu',
  // Chất béo
  'dầu ô liu', 'dầu dừa', 'dầu mè', 'dầu hạt cải',
  'bơ', 'hạt óc chó', 'hạnh nhân', 'hạt điều', 'hạt chia', 'hạt lanh',
  'hạt bí', 'hạt hướng dương', 'bơ đậu phộng', 'mè', 'vừng',
  // Đồ uống
  'nước lọc', 'nước ép cam', 'trà xanh', 'cà phê đen',
]

const FOOD_SET = new Set(FOOD_DICT.map(f => f.toLowerCase()))

// ════════════════════════════════════════════════════════════════
// CONTENT EXTRACTION
// ════════════════════════════════════════════════════════════════

const cleanHtml = (text) => {
  return text
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// ════════════════════════════════════════════════════════════════
// CHUNKING
// ════════════════════════════════════════════════════════════════

const chunkText = (text, maxWords = 150) => {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  const chunks = []
  let current = [], count = 0
  for (const s of sentences) {
    const wc = s.split(/\s+/).length
    if (count + wc > maxWords && current.length > 0) {
      chunks.push(current.join(' '))
      current = [s]; count = wc
    } else {
      current.push(s); count += wc
    }
  }
  if (current.length > 0) chunks.push(current.join(' '))
  return chunks
}

// ════════════════════════════════════════════════════════════════
// SEMANTIC RANKING (keyword overlap + food signal)
// ════════════════════════════════════════════════════════════════

const rankChunks = (chunks, query) => {
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  const foodSet = new Set(FOOD_DICT)
  return chunks.map((chunk, i) => {
    const lower = chunk.toLowerCase()
    const kwScore = keywords.reduce((s, kw) => s + (lower.includes(kw) ? 1 : 0), 0)
    const foodScore = FOOD_DICT.reduce((s, f) => s + (lower.includes(f) ? 1 : 0), 0)
    const tipScore = (/nên\s+ăn|nên\s+uống|cần\s+bổ sung|tốt\s+cho|giàu\s+/.test(lower) ? 3 : 0)
    return { index: i, chunk, score: kwScore + foodScore * 2 + tipScore }
  }).sort((a, b) => b.score - a.score).slice(0, 5)
}

// ════════════════════════════════════════════════════════════════
// DETERMINISTIC KNOWLEDGE EXTRACTION
// ════════════════════════════════════════════════════════════════

const NAV_STOP = /\b(trang chủ|home|danh mục|menu|bài viết|tin tức|khóa học|dịch vụ|liên hệ|đăng ký|quảng cáo|bình luận|chia sẻ|theo dõi)|^\d+\s*(gam|mg|ml)$/i
const hasNav = (v) => NAV_STOP.test(v) || v.length < 3 || v.length > 150

const extractFoods = (chunks) => {
  const found = new Set()
  const text = chunks.join('\n').toLowerCase()
  for (const food of FOOD_DICT) {
    if (text.includes(food)) found.add(food)
  }
  // Also match food-like words that appear within advisory context
  const advisoryContext = chunks.join(' ')
  const contextWords = advisoryContext.split(/\s+/).filter(w => w.length > 3)
  for (const w of contextWords) {
    if (/gà|cá|thịt|sữa|hạt|đậu|rau|củ|quả|bánh|cháo|canh|súp/.test(w) && !found.has(w)) {
      if (!NAV_STOP.test(w)) found.add(w)
    }
  }
  return [...found].filter(f => !hasNav(f)).slice(0, 20)
}

const extractTips = (chunks) => {
  const patterns = [
    /nên\s+ăn[^.]*\./gi, /nên\s+uống[^.]*\./gi, /nên\s+bổ\s+sun[^.]*\./gi,
    /cần\s+[^.]*protein[^.]*\./gi, /quan\s+trọng[^.]*\./gi,
    /lưu\s+ý[^.]*\./gi, /mẹo[^.]*\./gi, /gợi\s+ý[^.]*\./gi,
    /tốt\s+nhất[^.]*\./gi, /nên\s+tránh[^.]*\./gi, /hạn\s+chế[^.]*\./gi,
    /cách\s+tốt\s+nhất[^.]*\./gi, /để\s+[^.]*cần[^.]*\./gi,
    /không\s+nên[^.]*\./gi,
  ]
  const found = new Set()
  for (const chunk of chunks) {
    for (const p of patterns) {
      const matches = chunk.match(p)
      if (matches) {
        for (const m of matches) {
          const clean = m.replace(/\bnên\s+/g, '').replace(/^cần\s+/g, '').replace(/\.$/, '').trim()
          if (clean && !hasNav(clean)) found.add(clean)
        }
      }
    }
  }
  return [...found].slice(0, 10)
}

const extractAvoid = (chunks) => {
  const patterns = [
    /tránh[^.]*\./gi, /không\s+nên[^.]*\./gi, /hạn\s+chế[^.]*\./gi,
    /né[^.]*\./gi, /giảm[^.]*\./gi,
  ]
  const found = new Set()
  for (const chunk of chunks) {
    for (const p of patterns) {
      const matches = chunk.match(p)
      if (matches) {
        for (const m of matches) {
          const clean = m.replace(/^[-•]\s*/, '').replace(/\.$/, '').trim()
          if (clean && !hasNav(clean)) found.add(clean)
        }
      }
    }
  }
  return [...found].slice(0, 6)
}

const extractKnowledge = (chunks) => ({
  foods: extractFoods(chunks),
  tips: extractTips(chunks),
  avoid: extractAvoid(chunks),
})

// ════════════════════════════════════════════════════════════════
// SEARCH QUERY BUILDER
// ════════════════════════════════════════════════════════════════

const buildSearchQuery = ({ goal, intent } = {}) => {
  if (intent === 'nutrition_pre_workout') return 'best pre workout meal foods before gym fitness nutrition'
  if (intent === 'nutrition_post_workout') return 'best post workout meal recovery nutrition foods'
  if (intent === 'nutrition_macro') return 'daily protein carb fat intake nutrition guide'
  const q = {
    muscle_gain: 'muscle gain foods protein nutrition meal plan bodybuilding',
    fat_loss: 'fat loss weight loss foods healthy eating nutrition',
    weight_gain: 'healthy weight gain high calorie foods nutrition',
    endurance: 'endurance training foods energy nutrition',
  }
  return q[goal] || 'healthy nutrition food guide'
}

// ════════════════════════════════════════════════════════════════
// FAILOVER CHAIN
// ════════════════════════════════════════════════════════════════

const fallbackExtract = (text) => {
  // Keyword-based extraction when semantic ranking produces low scores
  const lower = text.toLowerCase()
  const foods = FOOD_DICT.filter(f => lower.includes(f)).slice(0, 15)
  const tips = []
  const tipMatches = text.match(/[^.]*(?:nên ăn|cần bổ sung|tốt cho|giàu)[^.]*\./gi)
  if (tipMatches) tips.push(...tipMatches.map(m => m.replace(/^[-•]\s*/, '').trim()).filter(t => !hasNav(t)).slice(0, 6))
  return { foods, tips, avoid: [] }
}

// ════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ════════════════════════════════════════════════════════════════

export const getNutritionKnowledge = async ({ goal = null, intent = '', question = '' } = {}) => {
  const queryText = buildSearchQuery({ goal, intent })
  const cacheKey = `det_${intent}_${goal || 'default'}`

  const cached = getCached(cacheKey)
  if (cached) { console.log('[KNOWLEDGE] cache hit'); return { ...cached, source: 'cache' } }

  // STEP 1: Search
  console.log('[SEARCH] Query:', queryText)
  const searchStart = Date.now()
  const searchResult = await searchWeb(queryText, { maxResults: 8, includeRawContent: true })
  const latency = Date.now() - searchStart
  console.log('[SEARCH] URLs:', searchResult.results.length, '| Latency:', latency, 'ms')

  if (!searchResult.used || searchResult.results.length === 0) {
    return { foods: [], tips: [], avoid: [], references: [], source: 'search_failed' }
  }

  // STEP 2: Extract + clean content
  const articles = searchResult.results
    .map(r => ({ text: cleanHtml(r.rawContent || r.content || ''), url: r.url, title: r.title, date: r.publishedDate || '' }))
    .filter(a => a.text.length > 200)
  console.log('[FETCH] Articles:', articles.length)

  if (articles.length === 0) {
    console.log('[KNOWLEDGE] no usable articles, fallback keyword extraction')
    const allText = searchResult.results.map(r => `${r.title}. ${r.content}`).join('\n')
    const fallback = fallbackExtract(allText)
    return { ...fallback, references: [], source: 'keyword_fallback' }
  }

  // STEP 3: Chunk
  const allChunks = articles.flatMap(a => chunkText(a.text))
  console.log('[CHUNK] Total:', allChunks.length)

  // STEP 4: Semantic rank
  const ranked = rankChunks(allChunks, question)
  console.log('[RANK] Selected:', ranked.length, '| Top scores:', ranked.slice(0, 3).map(r => r.score))

  const topChunks = ranked.map(r => r.chunk)
  const references = articles.slice(0, 5).map(a => ({
    title: a.title, url: a.url, publishedDate: a.date,
    domain: new URL(a.url).hostname.replace(/^www\./, ''),
  }))

  // STEP 5: Deterministic extraction (NO LLM)
  let knowledge = extractKnowledge(topChunks)
  console.log('[KNOWLEDGE] Foods:', knowledge.foods.length, '| Tips:', knowledge.tips.length, '| Avoid:', knowledge.avoid.length)

  // Failover: if extraction yields nothing, try on full text
  if (knowledge.foods.length === 0 && knowledge.tips.length === 0) {
    console.log('[KNOWLEDGE] semantic extraction weak, retrying on full text')
    const fullText = allChunks.join('\n')
    knowledge = fallbackExtract(fullText)
    console.log('[KNOWLEDGE] fallback Foods:', knowledge.foods.length, '| Tips:', knowledge.tips.length)
  }

  // Failover 2: last resort — extract single sentences containing food words
  if (knowledge.foods.length === 0) {
    console.log('[KNOWLEDGE] all extractions failed, extracting food-context sentences')
    const sentences = allChunks.join(' ').match(/[^.]*?(?:gà|cá|thịt|trứng|sữa|rau|hạt|đậu|cơm|bánh)[^.]*\./gi)
    if (sentences) {
      const foods = FOOD_DICT.filter(f => sentences.join(' ').toLowerCase().includes(f)).slice(0, 10)
      knowledge = { foods, tips: [], avoid: [], source: 'sentence_fallback' }
      console.log('[KNOWLEDGE] sentence extraction Foods:', foods.length)
    }
  }

  const result = {
    goal,
    foods: [...new Set(knowledge.foods)].filter(f => !hasNav(f)).slice(0, 20),
    tips: [...new Set(knowledge.tips)].filter(t => !hasNav(t)).slice(0, 10),
    avoid: [...new Set(knowledge.avoid)].filter(a => !hasNav(a)).slice(0, 6),
    references,
    source: 'deterministic',
    searchQuery: queryText,
    resultCount: searchResult.results.length,
  }

  // Cache even partial results (don't cache empty)
  if (result.foods.length > 0) {
    setCached(cacheKey, result)
    console.log('[KNOWLEDGE] cached:', cacheKey)
  }

  return result
}

// ════════════════════════════════════════════════════════════════
// MEAL PLAN HELPER
// ════════════════════════════════════════════════════════════════

export const getMealPlanKnowledge = async ({ goal = null } = {}) => {
  const knowledge = await getNutritionKnowledge({ goal, intent: 'nutrition_meal_plan', question: 'daily meal plan' })
  if (knowledge.foods.length > 0) {
    const mid = Math.ceil(knowledge.foods.length / 2)
    return {
      breakfast: knowledge.foods.slice(0, 3),
      lunch: knowledge.foods.slice(0, mid),
      snack: knowledge.foods.slice(mid, mid + 2),
      dinner: knowledge.foods.slice(mid).slice(0, 3),
      note: '',
      references: knowledge.references,
    }
  }
  return { breakfast: [], lunch: [], snack: [], dinner: [], note: '', references: [] }
}
