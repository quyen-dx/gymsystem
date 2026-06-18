export const inferNutritionGoal = ({ query = '', classifierResult = {}, normalizeForIntent }) => {
  const normalized = normalizeForIntent(query)
  const entityGoal = classifierResult.entities?.goal
  if (/\b(truoc buoi tap|truoc tap|pre workout|pre-workout|before training)\b/.test(normalized)) return 'pre_workout'
  if (/\b(sau buoi tap|sau tap|post workout|post-workout|after training)\b/.test(normalized)) return 'post_workout'
  if (entityGoal === 'fat_loss' || entityGoal === 'muscle_gain' || entityGoal === 'weight_gain') return entityGoal
  if (/\b(tang co|muscle gain|bulk)\b/.test(normalized)) return 'muscle_gain'
  if (/\b(giam can|giam mo|fat loss|weight loss|lean)\b/.test(normalized)) return 'fat_loss'
  if (/\b(tang can)\b/.test(normalized)) return 'weight_gain'
  return 'healthy'
}

const nutritionTitle = (goal, lang) => {
  if (lang === 'en') {
    return {
      pre_workout: 'BEFORE TRAINING',
      post_workout: 'AFTER TRAINING',
      muscle_gain: 'MUSCLE GAIN NUTRITION',
      fat_loss: 'FAT LOSS NUTRITION',
      weight_gain: 'WEIGHT GAIN NUTRITION',
      healthy: 'HEALTHY NUTRITION',
    }[goal] || 'NUTRITION'
  }
  return {
    pre_workout: 'TRƯỚC BUỔI TẬP',
    post_workout: 'SAU BUỔI TẬP',
    muscle_gain: 'DINH DƯỠNG TĂNG CƠ',
    fat_loss: 'DINH DƯỠNG GIẢM MỠ',
    weight_gain: 'DINH DƯỠNG TĂNG CÂN',
    healthy: 'DINH DƯỠNG HEALTHY',
  }[goal] || 'DINH DƯỠNG'
}

export const buildGenericNutritionAnswer = ({ query, classifierResult = {}, toolData = {}, language, deps }) => {
  const { normalizeLanguage, normalizeForIntent } = deps
  const lang = normalizeLanguage(language)
  const goal = inferNutritionGoal({ query, classifierResult, normalizeForIntent })
  const isPreWorkout = goal === 'pre_workout'
  const isPostWorkout = goal === 'post_workout'
  const products = (toolData.products || []).filter(Boolean).slice(0, 3)
  const webSummary = toolData.webSearchNutrition?.context
    ? (lang === 'en' ? 'I also checked general nutrition references for this answer.' : 'Mình cũng đã đối chiếu thêm nguồn dinh dưỡng tổng quát.')
    : ''
  const productLine = products.length > 0
    ? (lang === 'en'
      ? `GymPro shop has related options such as ${products.map((p) => p.name || p.nameVi || p.nameEn).filter(Boolean).join(', ')}.`
      : `Trong shop GymPro có một số lựa chọn liên quan như ${products.map((p) => p.nameVi || p.name || p.nameEn).filter(Boolean).join(', ')}.`)
    : ''

  const defaultNutritionSummary = lang === 'en'
    ? 'Build meals around lean protein, fiber-rich vegetables, and carbs that match your training goal.'
    : 'Bạn nên xây bữa ăn quanh protein nạc, rau nhiều chất xơ và lượng tinh bột phù hợp với mục tiêu.'
  const summaryMap = {
    fat_loss: lang === 'en'
      ? 'For fat loss, use a mild calorie deficit, prioritize protein, vegetables, and controlled carbs.'
      : 'Để giảm cân/giảm mỡ, bạn nên ăn theo hướng thâm hụt calo nhẹ, ưu tiên protein, rau xanh và tinh bột vừa phải.',
    muscle_gain: lang === 'en'
      ? 'For muscle gain, prioritize enough protein, quality carbs around training, and consistent total calories.'
      : 'Để tăng cơ, bạn nên ưu tiên đủ protein, tinh bột tốt quanh buổi tập và tổng năng lượng ổn định.',
    weight_gain: lang === 'en'
      ? 'For healthy weight gain, increase calories gradually with protein, complex carbs, and healthy fats.'
      : 'Để tăng cân lành mạnh, hãy tăng calo từ từ bằng protein, tinh bột phức và chất béo tốt.',
    pre_workout: lang === 'en'
      ? 'Before training, eat something light and easy to digest, with moderate carbs and a little protein for workout energy.'
      : 'Trước buổi tập bạn nên ăn nhẹ, dễ tiêu, ưu tiên carb vừa phải và một ít protein để có năng lượng khi tập.',
    post_workout: lang === 'en'
      ? 'After training, prioritize protein plus carbs to support muscle repair and replenish energy.'
      : 'Sau buổi tập bạn nên ưu tiên protein kèm tinh bột vừa phải để hỗ trợ phục hồi cơ và nạp lại năng lượng.',
    healthy: lang === 'en'
      ? 'For a healthy diet, build meals around protein, fiber-rich vegetables, and minimally processed carbs.'
      : 'Để ăn uống healthy, hãy xây bữa ăn quanh protein, rau nhiều chất xơ và tinh bột ít chế biến.',
  }
  const summary = String(classifierResult.summary || classifierResult.conclusion || '').trim()
    || summaryMap[goal]
    || defaultNutritionSummary

  const foods = isPreWorkout
    ? ['Chuối, yến mạch hoặc bánh mì nguyên cám', 'Sữa chua không đường hoặc 1 quả trứng', 'Ăn trước tập khoảng 60-90 phút nếu là bữa nhẹ']
    : isPostWorkout
      ? ['Ức gà, cá, trứng, đậu phụ hoặc whey/protein nếu thiếu protein', 'Cơm, khoai lang, chuối hoặc yến mạch để bù năng lượng', 'Rau xanh và nước để hỗ trợ phục hồi']
    : goal === 'muscle_gain'
    ? ['Ức gà, cá, trứng, thịt nạc, đậu phụ', 'Cơm, khoai lang, yến mạch, gạo lứt', 'Sữa chua Hy Lạp, whey/protein nếu thiếu protein']
    : ['Ức gà, cá, trứng, đậu phụ', 'Rau xanh, bông cải, dưa leo, salad', 'Khoai lang, yến mạch, gạo lứt với khẩu phần vừa phải']
  const limit = ['Nước ngọt và trà sữa nhiều đường', 'Đồ chiên/rán nhiều dầu', 'Bánh kẹo, snack, rượu bia']
  const meals = isPreWorkout
    ? ['Trước tập 60-90 phút: chuối + sữa chua không đường', 'Nếu tập sát giờ: 1 quả chuối hoặc ít yến mạch', 'Sau tập: bổ sung bữa có protein nếu bữa chính còn xa']
    : isPostWorkout
      ? ['Sau tập: cơm/khoai + ức gà/cá/đậu phụ + rau', 'Nếu chưa ăn bữa chính: sữa/protein + chuối', 'Tối: protein nạc + rau + tinh bột vừa phải']
    : goal === 'muscle_gain'
    ? ['Sáng: yến mạch + sữa chua/ trứng', 'Trưa: cơm + ức gà/cá + rau', 'Sau tập: sữa/protein + chuối hoặc bữa chính có protein', 'Tối: thịt nạc/đậu phụ + tinh bột vừa đủ + rau']
    : ['Sáng: yến mạch + trứng', 'Trưa: cơm gạo lứt + ức gà + rau', 'Tối: cá/đậu phụ + rau + ít tinh bột']

  const answer = lang === 'en'
    ? [
        nutritionTitle(goal, lang),
        '',
        summary || '',
        '',
        'What to eat:',
        '',
        ...foods.map((item) => `• ${item}`),
        '',
        'Limit:',
        '',
        ...limit.map((item) => `• ${item}`),
        '',
        'Sample day:',
        '',
        ...meals.map((item) => `• ${item}`),
        '',
        `Personalization note: ${productLine || 'Tell me your height, weight, schedule, and food preferences for a more precise meal plan.'}`,
        webSummary ? `\n${webSummary}` : '',
      ].join('\n').replace(/\n{3,}/g, '\n\n').trim()
    : [
        nutritionTitle(goal, lang),
        '',
        summary || '',
        '',
        'Nên ăn:',
        '',
        ...foods.map((item) => `• ${item}`),
        '',
        'Nên hạn chế:',
        '',
        ...limit.map((item) => `• ${item}`),
        '',
        'Gợi ý 1 ngày:',
        '',
        ...meals.map((item) => `• ${item}`),
        '',
        `Lưu ý cá nhân hóa: ${productLine || 'Bạn cho mình chiều cao, cân nặng, lịch tập và món không ăn được để mình gợi ý thực đơn sát hơn.'}`,
        webSummary ? `\n${webSummary}` : '',
      ].join('\n').replace(/\n{3,}/g, '\n\n').trim()

  return {
    type: 'nutrition_advice',
    answer,
    data: toolData,
    cards: [],
    plans: [],
    recommendedPlan: null,
    planPayload: null,
    suggestions: lang === 'en'
      ? ['Build a 1-day meal plan', 'What should I eat before training?', 'How much protein do I need?']
      : ['Lên thực đơn 1 ngày cho tôi', 'Trước buổi tập nên ăn gì?', 'Tôi cần bao nhiêu protein?'],
    mode: 'gym',
    provider: 'generic_safe_answer',
    model: 'local',
    metadata: {
      intent: classifierResult.intent || 'nutrition_advice',
      answeredBy: 'generic_safe_answer',
      route: 'GENERIC_NUTRITION_ANSWER',
      usedFallback: true,
      classifier: classifierResult,
    },
  }
}

export const normalizeSourceMetadata = (source = {}) => {
  if (!source || typeof source !== 'object') return null
  const rawUrl = source.url || source.sourceUrl || source.link || source.href
  const url = typeof rawUrl === 'string' ? rawUrl.trim() : ''
  if (!url) return null
  let domain = typeof (source.domain || source.sourceDomain) === 'string'
    ? String(source.domain || source.sourceDomain).trim()
    : ''
  if (!domain) {
    try {
      domain = new URL(url).hostname.replace(/^www\./, '')
    } catch {
      domain = ''
    }
  }
  const title = String(source.title || source.sourceTitle || source.name || domain || url).trim()
  const favicon = typeof source.favicon === 'string' && source.favicon.trim()
    ? source.favicon.trim()
    : (domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32` : '')
  return {
    title,
    url,
    domain,
    favicon,
    sourceTitle: title,
    sourceUrl: url,
    sourceDomain: domain,
  }
}

export const normalizeSourceList = (sources = []) => {
  const seen = new Set()
  return (Array.isArray(sources) ? sources : [])
    .map(normalizeSourceMetadata)
    .filter(Boolean)
    .filter((source) => {
      const key = source.url.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 4)
}

export const getNutritionWebSources = (toolData = {}) => normalizeSourceList(
  Array.isArray(toolData.webSearchNutrition?.sources)
    ? toolData.webSearchNutrition.sources
    : (toolData.webSearchNutrition?.results || [])
)

export const selectUsedNutritionSources = ({ aiSources = [], toolSources = [] } = {}) => {
  const availableSources = normalizeSourceList(toolSources)
  if (availableSources.length === 0) return []
  const availableByUrl = new Map(availableSources.map((source) => [source.url.toLowerCase(), source]))
  const used = []
  const seen = new Set()
  normalizeSourceList(aiSources).forEach((source) => {
    const key = source.url.toLowerCase()
    const matched = availableByUrl.get(key)
    if (!matched || seen.has(key)) return
    seen.add(key)
    used.push({
      ...matched,
      title: source.title || matched.title,
      sourceTitle: source.sourceTitle || source.title || matched.title,
    })
  })
  return used.slice(0, 4)
}
