export const normalizeLanguage = (language) => language === 'en' ? 'en' : 'vi'

export const detectAnswerLanguage = (userMessage = '', appLanguage = 'vi') => {
  const fallback = normalizeLanguage(appLanguage)
  const text = String(userMessage || '').trim()
  if (!text) return fallback

  const lower = text.toLowerCase()
  if (/^(what|how|why|when|where|which|who|is|are|does|do|can|should)\b/i.test(lower)) return 'en'
  const hasVietnameseDiacritics = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(lower)
  if (hasVietnameseDiacritics) return 'vi'

  const tokens = lower
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  if (tokens.length < 2) return fallback

  const englishWords = new Set([
    'which', 'what', 'how', 'why', 'when', 'where', 'who',
    'plan', 'plans', 'membership', 'price', 'cost', 'cheap', 'cheapest', 'affordable',
    'choose', 'should', 'need', 'do', 'does', 'can', 'compare', 'recommend',
    'personal', 'trainer', 'pt', 'workout', 'training', 'schedule', 'booking',
    'refund', 'policy', 'product', 'products', 'best', 'suitable',
    'include', 'includes', 'budget', 'student', 'train', 'times', 'week', 'month',
  ])
  const vietnameseWords = new Set([
    'toi', 'minh', 'ban', 'nen', 'chon', 'goi', 'gia', 're', 'nhat',
    'so', 'sanh', 'tap', 'lich', 'dat', 'pt', 'can', 'khong', 'co',
    'bao', 'nhieu', 'thanh', 'toan', 'chinh', 'sach', 'hoan', 'tien',
    'san', 'pham', 'phu', 'hop', 'tu', 'van', 'dang', 'ky',
  ])

  const englishScore = tokens.reduce((score, token) => score + (englishWords.has(token) ? 1 : 0), 0)
  const vietnameseScore = tokens.reduce((score, token) => score + (vietnameseWords.has(token) ? 1 : 0), 0)

  if (englishScore >= 2 && englishScore >= vietnameseScore) return 'en'
  if (vietnameseScore >= 2 && vietnameseScore >= englishScore) return 'vi'
  return fallback
}

export const normalizeForIntent = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'd')
  .toLowerCase()

const stripJsonFence = (text) => String(text || '')
  .trim()
  .replace(/^```(?:json)?\s*/i, '')
  .replace(/\s*```$/i, '')
  .trim()

const extractJsonObjectString = (text = '') => {
  const source = String(text || '')
  for (let start = source.indexOf('{'); start !== -1; start = source.indexOf('{', start + 1)) {
    let depth = 0
    let inString = false
    let escaped = false
    for (let index = start; index < source.length; index += 1) {
      const char = source[index]
      if (inString) {
        if (escaped) {
          escaped = false
        } else if (char === '\\') {
          escaped = true
        } else if (char === '"') {
          inString = false
        }
        continue
      }
      if (char === '"') {
        inString = true
      } else if (char === '{') {
        depth += 1
      } else if (char === '}') {
        depth -= 1
        if (depth === 0) {
          const candidate = source.slice(start, index + 1)
          try {
            JSON.parse(candidate)
            return candidate
          } catch {
            break
          }
        }
      }
    }
  }
  return ''
}

export const cleanAiOutput = (raw, { expectedJson = false, fallbackAnswer = '' } = {}) => {
  const fallback = fallbackAnswer || ''
  const withoutThinking = String(raw || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/^```[a-z0-9_-]*\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  const withoutFence = stripJsonFence(withoutThinking)
  if (expectedJson) {
    const json = extractJsonObjectString(withoutFence)
    return json || withoutFence || fallback
  }
  return withoutFence || fallback
}

export const normalizeFinalAnswerText = (value = '') => String(value || '')
  .replace(/\r\n/g, '\n')
  .replace(/<think>[\s\S]*?<\/think>/gi, '')
  .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
  .replace(/^```[a-z0-9_-]*\s*/i, '')
  .replace(/\s*```$/i, '')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n[ \t]+/g, '\n')
  .replace(/[ \t]{2,}/g, ' ')
  .replace(/GymPro(?=[A-Za-zÀ-ỹ0-9])/g, 'GymPro ')
  .replace(/Gói(?=VIP|Cơ|Co|Nâng|Nang)/g, 'Gói ')
  .replace(/chưa(?=có|ghi|xử)/g, 'chưa ')
  .replace(/dữ(?=liệu)/g, 'dữ ')
  .replace(/cá(?=nhân)/g, 'cá ')
  .trim()

const LEGACY_PARSE_FAILURE_ANSWERS = new Set([
  'Mình chưa xử lý được câu trả lời này, bạn hỏi lại ngắn hơn giúp mình nhé.',
  'Sorry, I could not process this answer. Please try asking again more briefly.',
])

export const getParseFailureAnswer = (language = 'vi') => normalizeLanguage(language) === 'en'
  ? 'I do not have enough verified GymPro data to answer that directly yet.'
  : 'Mình chưa có đủ dữ liệu GymPro đã xác thực để trả lời trực tiếp câu này.'

export const answerIsParseFailure = (answer = '', language = 'vi') => (
  normalizeFinalAnswerText(answer) === getParseFailureAnswer(language)
  || LEGACY_PARSE_FAILURE_ANSWERS.has(normalizeFinalAnswerText(answer))
)

export const parseAiJsonPayload = (text, fallbackAnswer = '') => {
  const raw = String(text || '')
  const cleaned = cleanAiOutput(raw, { expectedJson: true, fallbackAnswer })
  if (!raw) return { answer: fallbackAnswer, suggestions: [] }

  const candidates = [
    cleaned,
    stripJsonFence(cleaned),
    extractJsonObjectString(raw),
    extractJsonObjectString(cleaned),
  ].filter(Boolean)

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue
      const answerValue = [parsed.answer, parsed.content, parsed.message, parsed.text]
        .find((value) => typeof value === 'string' && value.trim())
      return {
        ...parsed,
        answer: answerValue ? cleanAiOutput(answerValue).trim() : cleanAiOutput(fallbackAnswer || raw).trim(),
        suggestions: Array.isArray(parsed.suggestions)
          ? parsed.suggestions
            .filter((item) => typeof item === 'string' && item.trim())
            .map((item) => item.trim())
            .slice(0, 4)
          : [],
      }
    } catch {}
  }

  return {
    type: 'text_advice',
    answer: normalizeFinalAnswerText(cleanAiOutput(raw, { fallbackAnswer: fallbackAnswer || raw })),
    suggestions: [],
  }
}

export const removeRepeatedSuggestions = (suggestions, query) => {
  const normalizedQuery = normalizeForIntent(query).trim()
  const seen = new Set()
  return (Array.isArray(suggestions) ? suggestions : [])
    .filter((item) => typeof item === 'string' && item.trim())
    .map((item) => item.trim())
    .filter((item) => {
      const normalized = normalizeForIntent(item).trim()
      if (!normalized || normalized === normalizedQuery || seen.has(normalized)) return false
      seen.add(normalized)
      return true
    })
    .slice(0, 4)
}

const RESPONSE_TYPES = new Set([
  'text_advice',
  'unclear_question',
  'plan_list',
  'plan_detail',
  'plan_recommend',
  'plan_compare',
  'plan_compare_two',
  'plan_compare_all',
  'schedule_info',
  'checkin_summary',
  'pt_list',
  'pt_detail',
  'pt_advice',
  'pt_advice_no_data',
  'pt_availability',
  'booking_list',
  'booking_suggestion',
  'health_advice',
  'nutrition_advice',
  'nutrition_advice_with_sources',
  'workout_advice',
  'workout_progress',
  'health_summary',
  'product_list',
  'product_recommend',
  'notification_list',
  'policy_answer',
  'policy_refund',
  'policy_privacy',
  'policy_payment',
  'admin_dashboard',
  'report_summary',
  'action_result',
  'smart_recommend',
  'workout_analyzer',
])

export const normalizeResponseType = (type, classifierIntent) => {
  if (RESPONSE_TYPES.has(type)) return type
  if (type === 'trainer_list') return 'pt_list'
  if (classifierIntent === 'checkin_info') return 'checkin_summary'
  if (classifierIntent === 'checkin_summary') return 'checkin_summary'
  if (classifierIntent === 'checkin_goal') return 'checkin_summary'
  if (classifierIntent === 'pt_info') return 'pt_list'
  if (classifierIntent === 'pt_availability') return 'booking_suggestion'
  if (classifierIntent === 'pt_advice') return 'pt_list'
  if (classifierIntent === 'booking_info') return 'booking_list'
  if (classifierIntent === 'booking_action') return 'booking_suggestion'
  if (classifierIntent === 'workout_info') return 'workout_advice'
  if (classifierIntent === 'workout_advice') return 'workout_advice'
  if (classifierIntent === 'workout_analyze') return 'workout_analyzer'
  if (classifierIntent === 'nutrition_advice' || classifierIntent === 'nutrition_info') return 'nutrition_advice'
  if (classifierIntent === 'health_info' || classifierIntent === 'health_advice') return 'health_summary'
  if (classifierIntent === 'shop_info') return 'product_list'
  if (classifierIntent === 'shop_advice') return 'product_recommend'
  if (classifierIntent === 'notification_info') return 'notification_list'
  if (classifierIntent === 'policy_faq' || classifierIntent === 'policy_refund' || classifierIntent === 'policy_privacy' || classifierIntent === 'policy_payment' || classifierIntent === 'policy_terms' || classifierIntent === 'faq_answer') return 'policy_answer'
  if (classifierIntent === 'admin_report') return 'report_summary'
  if (classifierIntent === 'theme_action' || classifierIntent === 'feedback_action') return 'action_result'
  if (classifierIntent === 'plan_comparison') return 'plan_recommend'
  if (classifierIntent === 'cheapest_long_term_plan') return 'plan_recommend'
  if (classifierIntent === 'unclear_question') return 'unclear_question'
  return 'text_advice'
}

export const buildGenericSafeAnswer = ({
  query,
  classifierResult = {},
  toolData = {},
  language,
  reason = 'safe_fallback',
  deps = {},
}) => {
  const {
    inferSubjectFromIntent,
    buildGenericWorkoutAdviceAnswer,
    buildGenericNutritionAnswer,
    buildGenericMembershipAnswer,
    buildGenericPlanAnswer,
    buildGenericPTAnswer,
    buildGenericHealthAnswer,
  } = deps
  const subject = classifierResult.subject || inferSubjectFromIntent(classifierResult.intent || '')
  const intent = classifierResult.intent || ''
  const action = classifierResult.action || ''
  let payload = null

  if (subject === 'workout' || intent.startsWith('workout_')) {
    payload = buildGenericWorkoutAdviceAnswer({ query, classifierResult, toolData, language })
  } else if (subject === 'nutrition' || intent.startsWith('nutrition_')) {
    payload = buildGenericNutritionAnswer({ query, classifierResult, toolData, language })
  } else if (subject === 'membership' || action === 'current') {
    payload = buildGenericMembershipAnswer({ classifierResult, toolData, language })
  } else if (subject === 'plan' || intent.startsWith('membership_') || intent === 'plan_comparison' || intent === 'cheapest_long_term_plan') {
    payload = buildGenericPlanAnswer({ classifierResult, toolData, language })
  } else if (subject === 'trainer' || subject === 'pt' || intent.startsWith('pt_')) {
    payload = buildGenericPTAnswer({ classifierResult, toolData, language })
  } else if (subject === 'health' || intent.startsWith('health_')) {
    payload = buildGenericHealthAnswer({ classifierResult, toolData, language })
  }

  if (!payload) return null
  return {
    ...payload,
    metadata: {
      ...(payload.metadata || {}),
      subject,
      action,
      safeFallbackReason: reason,
    },
  }
}
