import { renderPlans, renderPTs, renderMembership, renderBookings, renderProducts, renderCheckinStats } from './contextBuilder.js'
import { logValidator, logFallback } from './aiLogService.js'

const MAX_RETRIES = 2

const _normalize = (str) => String(str || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .toLowerCase()
  .trim()

const _expandNameVariants = (nameVi, nameEn) => {
  const variants = []
  const vi = _normalize(nameVi || '')
  const en = _normalize(nameEn || '')
  if (vi) {
    variants.push(vi)
    // Also try without "goi " prefix
    if (vi.startsWith('goi ')) variants.push(vi.slice(4))
  }
  if (en && en !== vi) variants.push(en)
  return variants
}

const extractToolCounts = (toolResults) => {
  const counts = {}
  if (toolResults?.getAvailablePlans?.plans) {
    counts.plans = toolResults.getAvailablePlans.plans.length
    counts.planNames = toolResults.getAvailablePlans.plans.flatMap(p => _expandNameVariants(p.nameVi, p.nameEn || p.name))
    counts.planPrices = toolResults.getAvailablePlans.plans.map(p => p.price)
  }
  if (toolResults?.getAvailablePTs?.pts) {
    counts.pts = toolResults.getAvailablePTs.pts.length
    counts.ptNames = toolResults.getAvailablePTs.pts.map(p => _normalize(p.fullName || p.name || ''))
    counts.ptSpecializations = toolResults.getAvailablePTs.pts.flatMap(p => Array.isArray(p.specialties) ? p.specialties.map(s => _normalize(s)) : [_normalize(p.specialties || '')]).filter(Boolean)
  }
  if (toolResults?.getMembershipInfo) {
    const info = toolResults.getMembershipInfo
    counts.membershipFound = info.hasActiveMembership === true
    const membership = info.currentMembership
    if (membership) {
      counts.membershipStatus = membership.status
      counts.membershipPlanName = _normalize(membership.planName || '')
      counts.membershipRemaining = membership.remainingDays
      counts.membershipStartDate = membership.startDate
      counts.membershipEndDate = membership.endDate
    } else {
      counts.membershipFound = false
    }
  }
  if (toolResults?.getUpcomingBookings?.bookings) {
    counts.bookings = toolResults.getUpcomingBookings.bookings.length
    counts.bookingPTNames = [...new Set(toolResults.getUpcomingBookings.bookings.map(b => _normalize(b.ptName || b.pt?.fullName || b.pt?.name || '')).filter(Boolean))]
  }
  if (toolResults?.getRecommendedProducts?.products) {
    counts.products = toolResults.getRecommendedProducts.products.length
    counts.productNames = toolResults.getRecommendedProducts.products.flatMap(p => {
      const n = _normalize(p.name || '')
      return n ? [n, ...(n.includes(' ') ? n.split(' ') : [])] : []
    })
  }
  if (toolResults?.getCheckinStats?.stats) {
    counts.checkinTotal = toolResults.getCheckinStats.stats.total
    counts.checkinStreak = toolResults.getCheckinStats.stats.streak
  }
  return counts
}

const normalizeForValidation = (text) => {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()
    .replace(/[.,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const countOccurrencesInText = (text, searchTerms) => {
  const normalized = normalizeForValidation(text)
  let count = 0
  for (const term of searchTerms) {
    if (!term) continue
    if (normalized.includes(term)) count++
  }
  return count
}



const extractNumberMentions = (text) => {
  const normalized = normalizeForValidation(text)
  const numbers = []
  const patterns = [
    /\b(\d+)\s*(?:goi|plan|pt|trainer|huan luyen vien|san pham|product|booking|lich|buoi|lan|ngay)\b/g,
    /\b(?:co|co tong cong|co tat ca|co ca thay|chi con|con)\s*(\d+)/g,
    /\b(\d+)\s*(?:goi tap|membership plans|trainers|san pham|products|bookings)\b/gi,
  ]
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(normalized)) !== null) {
      numbers.push(parseInt(match[1], 10))
    }
  }
  return numbers
}

export const validateResponse = ({ answer, toolResults, query, lang = 'vi' }) => {
  if (!answer || typeof answer !== 'string' || answer.trim().length === 0) {
    return { valid: false, reason: 'empty_answer', fallback: null }
  }

  const counts = extractToolCounts(toolResults || {})
  const answerText = String(answer)

  // 1. Validate plan count
  if (counts.plans !== undefined && counts.plans > 0) {
    const mentioned = extractNumberMentions(answerText)
    const planMentions = mentioned.filter(n => n > 0)
    if (planMentions.length > 0) {
      const maxMentioned = Math.max(...planMentions)
      if (maxMentioned < counts.plans) {
        return {
          valid: false,
          reason: `plan_count_mismatch: LLM mentions ~${maxMentioned}, actual=${counts.plans}`,
          fallback: null,
        }
      }
    }
  }

  // 2. Validate PT count
  if (counts.pts !== undefined && counts.pts > 0) {
    const mentioned = extractNumberMentions(answerText)
    const ptMentions = mentioned.filter(n => n > 0)
    if (ptMentions.length > 0) {
      const maxMentioned = Math.max(...ptMentions)
      if (maxMentioned < counts.pts) {
        return {
          valid: false,
          reason: `pt_count_mismatch: LLM mentions ~${maxMentioned}, actual=${counts.pts}`,
          fallback: null,
        }
      }
    }
  }

  // 3. Validate PT names — when count is mentioned, check names are real
  if (counts.ptNames && counts.ptNames.length > 0) {
    const mentioned = extractNumberMentions(answerText)
    const ptMentions = mentioned.filter(n => n > 0)
    if (ptMentions.length > 0) {
      const found = countOccurrencesInText(answerText, counts.ptNames)
      if (found === 0) {
        return {
          valid: false,
          reason: `pt_names_not_found: LLM mentioned count but no known PT names`,
          fallback: null,
        }
      }
    }
  }

  // 4. Validate plan names — when count is mentioned, check names are real
  if (counts.planNames && counts.planNames.length > 0) {
    const mentioned = extractNumberMentions(answerText)
    const planMentions = mentioned.filter(n => n > 0)
    if (planMentions.length > 0) {
      const found = countOccurrencesInText(answerText, counts.planNames)
      if (found === 0) {
        return {
          valid: false,
          reason: `plan_names_not_found: LLM mentioned count but no known plan names`,
          fallback: null,
        }
      }
    }
  }

  // 5. Validate membership status (strict)
  if (counts.membershipFound !== undefined) {
    if (counts.membershipFound) {
      const activeLabels = ['dang hoat dong', 'active', 'con han', 'con hieu luc', 'dang ky', 'dang su dung', 'con thoi han']
      const expiredLabels = ['het han', 'da het han', 'expired', 'khong con hieu luc', 'da ket thuc']
      const hasActive = activeLabels.some(label => normalizeForValidation(answerText).includes(label))
      const hasExpired = expiredLabels.some(label => normalizeForValidation(answerText).includes(label))
      if (counts.membershipStatus === 'active' && !hasActive && !hasExpired) {
        return {
          valid: false,
          reason: `membership_active_not_mentioned: LLM did not confirm active membership`,
          fallback: null,
        }
      }
      if (counts.membershipStatus === 'expired' && !hasExpired) {
        return {
          valid: false,
          reason: `membership_expired_not_mentioned: LLM did not mention expired status`,
          fallback: null,
        }
      }
    } else {
      const noMembershipLabels = ['chua co goi', 'khong co goi', 'chua dang ky', 'chua co membership', 'chua mua', 'chua co']
      const hasNoMembership = noMembershipLabels.some(label => normalizeForValidation(answerText).includes(label))
      if (!hasNoMembership) {
        return {
          valid: false,
          reason: `membership_not_found_but_LLM_does_not_mention`,
          fallback: null,
        }
      }
    }
  }

  // 6. Validate product count
  if (counts.products !== undefined && counts.products > 0) {
    const mentioned = extractNumberMentions(answerText)
    const productMentions = mentioned.filter(n => n > 0)
    if (productMentions.length > 0) {
      const maxMentioned = Math.max(...productMentions)
      if (maxMentioned < counts.products) {
        return {
          valid: false,
          reason: `product_count_mismatch: LLM mentions ~${maxMentioned}, actual=${counts.products}`,
          fallback: null,
        }
      }
    }
  }

  // 7. Validate product names — when count is mentioned, check names are real
  if (counts.productNames && counts.productNames.length > 0 && counts.productNames.length <= 10) {
    const mentioned = extractNumberMentions(answerText)
    const productMentions = mentioned.filter(n => n > 0)
    if (productMentions.length > 0) {
      const found = countOccurrencesInText(answerText, counts.productNames)
      if (found === 0) {
        return {
          valid: false,
          reason: `product_names_not_found: LLM mentioned count but no known product names`,
          fallback: null,
        }
      }
    }
  }

  // 8. Validate booking count
  if (counts.bookings !== undefined && counts.bookings > 0) {
    const mentioned = extractNumberMentions(answerText)
    const bookingMentions = mentioned.filter(n => n > 0)
    if (bookingMentions.length > 0) {
      const maxMentioned = Math.max(...bookingMentions)
      if (maxMentioned < counts.bookings) {
        return {
          valid: false,
          reason: `booking_count_mismatch: LLM mentions ~${maxMentioned}, actual=${counts.bookings}`,
          fallback: null,
        }
      }
    }
  }

  // 9. Validate booking PT names — when count is mentioned, check names are real
  if (counts.bookingPTNames && counts.bookingPTNames.length > 0) {
    const mentioned = extractNumberMentions(answerText)
    const bookingMentions = mentioned.filter(n => n > 0)
    if (bookingMentions.length > 0) {
      const found = countOccurrencesInText(answerText, counts.bookingPTNames)
      if (found === 0) {
        return {
          valid: false,
          reason: `booking_pt_names_not_found: LLM mentioned count but no known booking PT names`,
          fallback: null,
        }
      }
    }
  }

  return { valid: true }
}

export const buildFallbackAnswer = ({ toolResults, query, lang = 'vi' }) => {
  const sections = []
  const counts = extractToolCounts(toolResults || {})

  if (toolResults?.getAvailablePlans?.plans) {
    const text = renderPlans(toolResults.getAvailablePlans.plans, lang)
    if (text) sections.push(text)
  }

  if (toolResults?.getAvailablePTs?.pts) {
    const text = renderPTs(toolResults.getAvailablePTs.pts, lang)
    if (text) sections.push(text)
  }

  if (toolResults?.getMembershipInfo) {
    const text = renderMembership(toolResults.getMembershipInfo, lang)
    if (text) sections.push(text)
  }

  if (toolResults?.getUpcomingBookings?.bookings) {
    const text = renderBookings(toolResults.getUpcomingBookings.bookings, lang)
    if (text) sections.push(text)
  }

  if (toolResults?.getRecommendedProducts?.products) {
    const text = renderProducts(toolResults.getRecommendedProducts.products, lang)
    if (text) sections.push(text)
  }

  if (toolResults?.getCheckinStats?.stats) {
    const text = renderCheckinStats(toolResults.getCheckinStats.stats, lang)
    if (text) sections.push(text)
  }

  if (sections.length === 0) {
    return lang === 'en' ? 'I could not find the data you requested in our system.' : 'Mình không tìm thấy dữ liệu bạn yêu cầu trong hệ thống.'
  }

  return sections.join('\n\n')
}

const buildRegeneratePrompt = ({ answer, validation, toolResults, query, lang }) => {
  const field = validation.reason.includes('plan_count') ? 'số lượng gói tập' :
    validation.reason.includes('pt_count') ? 'số lượng PT' :
    validation.reason.includes('pt_name') ? 'tên PT' :
    validation.reason.includes('plan_name') ? 'tên gói tập' :
    validation.reason.includes('membership') ? 'trạng thái membership' :
    validation.reason.includes('product_count') ? 'số lượng sản phẩm' :
    validation.reason.includes('product_name') ? 'tên sản phẩm' :
    validation.reason.includes('booking_count') ? 'số lượng booking' :
    validation.reason.includes('booking_pt') ? 'tên PT trong booking' :
    'dữ liệu'

  return `Câu trả lời trước của bạn có lỗi về ${field}.

Câu hỏi gốc: "${query}"

Dữ liệu thực tế:
${buildFallbackAnswer({ toolResults, query, lang })}

Yêu cầu: Hãy trả lời câu hỏi dựa trên dữ liệu trên. KHÔNG được thêm thông tin không có trong dữ liệu. KHÔNG được bịa số liệu. Trả lời bằng ${lang === 'en' ? 'English' : 'tiếng Việt'}.`
}

export const validateWithRetry = async ({ answer, toolResults, query, lang = 'vi', regenerateFn }) => {
  if (!validateResponse) {
    throw new Error('validateResponse is not defined')
  }

  let currentAnswer = answer
  let retries = 0
  let lastValidation

  while (retries <= MAX_RETRIES) {
    const validation = validateResponse({ answer: currentAnswer, toolResults, query, lang })
    lastValidation = validation
    if (validation.valid) {
      if (retries > 0) {
        logValidator('validateWithRetry', { valid: true, retryCount: retries, reason: validation.reason })
      }
      return { answer: currentAnswer, valid: true, regenerated: retries > 0 }
    }

    logValidator('validateWithRetry', { valid: false, retryCount: retries, reason: validation.reason })

    if (retries >= MAX_RETRIES) {
      logFallback('validator', 'max retries reached', { retries: MAX_RETRIES, reason: validation.reason })
      break
    }

    if (typeof regenerateFn !== 'function') {
      logFallback('validator', 'no regenerate function provided', { reason: validation.reason })
      break
    }

    const regeneratePrompt = buildRegeneratePrompt({ answer: currentAnswer, validation, toolResults, query, lang })
    const newAnswer = await regenerateFn({ answer: currentAnswer, validation, toolResults, query, lang, regeneratePrompt })

    if (!newAnswer || newAnswer === currentAnswer) {
      logFallback('validator', 'regeneration produced no new answer', { reason: validation.reason })
      break
    }

    currentAnswer = newAnswer
    retries++
  }

  const fallback = buildFallbackAnswer({ toolResults, query, lang })
  logFallback('validator', `using fallback answer`, { reason: lastValidation?.reason || 'unknown', fallbackLength: (fallback || '').length })
  return { answer: fallback, valid: false, regenerated: retries > 0, reason: lastValidation?.reason }
}
