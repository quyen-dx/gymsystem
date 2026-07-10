// factExtractor.js
// Minimal fact extraction utilities for FACT LOCK.
// Extracts factual entities from text so layers after database/tool
// cannot inject new facts that were not in the original answer.

export const extractFacts = (text = '') => {
  const rawMatches = (pattern) => [...text.matchAll(pattern)].map(m => m[0].trim()).filter(Boolean)

  const PLAN_STOP = ['giá', 'có', 'với', 'là', 'bao', 'sẽ', 'được', 'này', 'kia', 'nào', 'và', 'hoặc', 'hướng']
  let planNames = rawMatches(/[Gg]ói\s+(?:[A-ZÀ-Ỹa-zà-ỹ0-9][\wÀ-ỹà-ỹ]*\s*){1,4}/g)
    .map(n => {
      // Truncate at first stop word
      const firstStop = PLAN_STOP.reduce((idx, w) => {
        const i = n.toLowerCase().indexOf(w)
        return i > 0 && (idx === -1 || i < idx) ? i : idx
      }, -1)
      return firstStop > 0 ? n.slice(0, firstStop).trim() : n
    })
    .filter(Boolean)
    .filter(n => !PLAN_STOP.some(w => n.toLowerCase() === w)) // remove if only stop word remains

  const PT_STOP = ['hướng', 'dẫn', 'có', 'đang', 'sẽ', 'đã', 'vừa', 'này', 'kia', 'nào', 'xin', 'cho', 'giúp']
  let ptNames = rawMatches(/PT\s+[A-ZÀ-Ỹ][\wÀ-ỹ]*(?:\s+[A-ZÀ-Ỹ][\wÀ-ỹ]*){0,3}/g)
    .map(n => {
      const firstStop = PT_STOP.reduce((idx, w) => {
        const i = n.toLowerCase().indexOf(w)
        return i > 0 && (idx === -1 || i < idx) ? i : idx
      }, -1)
      return firstStop > 0 ? n.slice(0, firstStop).trim() : n
    })
    .filter(Boolean)

  return {
    numbers: [...new Set((text.match(/\b\d+\b/g) || []))],
    prices: (text.match(/\d[\d.,]*(?:đ|₫|vnd|vnđ)/gi) || []),
    planNames: [...new Set(planNames)],
    ptNames: [...new Set(ptNames)],
    dates: (text.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g) || []),
    durations: (text.match(/\b\d+\s*(?:ngày|tháng|năm|buổi|lần)\b/gi) || []),
  }
}

export const hasNewFacts = (originalFacts, newFacts) => {
  // For names, comparison is case-insensitive
  const normalize = (key, values) => {
    if (key === 'planNames' || key === 'ptNames') {
      return values.map(v => v.toLowerCase())
    }
    return values
  }

  for (const [key, newValues] of Object.entries(newFacts)) {
    const origValues = normalize(key, originalFacts[key] || [])
    const newNorm = normalize(key, newValues)
    for (const val of newNorm) {
      if (!origValues.includes(val)) {
        return true
      }
    }
  }
  return false
}
