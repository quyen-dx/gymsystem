import { runAIWithFallback } from '../services/aiFallbackService.js'
import { recordAiAudit } from '../services/aiAuditService.js'
import { constitutionalReview } from '../services/constitutionalReviewer.js'
import { chooseRecommendedPlan } from '../services/dbResponder.js'
import { buildFaqPolicyAnswer } from '../services/faqPolicySearchService.js'
import { buildNavigationAnswer, resolveNavigation } from '../services/navigationResolver.js'
import { buildCheckinSummaryResponse, buildEmptyDataResponse, buildPlanListResponse, buildPlanRecommendResponse, buildPlanSpecializationOverviewResponse, buildPtListResponse, buildWorkoutAdviceResponse, makeIntroduction, shouldUsePlanSpecializationOverview } from '../services/naturalResponseBuilder.js'
import { buildGoalAnswer, buildNutritionAnswer, buildWorkoutDomainAnswer, buildBookingAnswer } from '../services/domainAnswerBuilders.js'
import { buildContextualSuggestions } from '../services/contextualSuggestions.js'
import { naturalResponseRewrite } from '../services/naturalResponseRewrite.js'
import { AI_DOC_FILES, loadAiDoc, getRelevantAiDocs, logAiDocsLoaded } from '../services/aiDocsService.js'
import { runGymTool } from '../tools/gymTools.js'
import { SEPARATOR, bulletList, formatDaysText, formatEmailText, formatPriceText, safeText, titleText } from '../services/render/renderTextUtils.js'
import { agentMemory } from './agentMemory.js'
import { optimizeQuery } from './queryOptimizer.js'
import { reasonQuery } from './queryReasoner.js'
import { perfStart, perfEnd, perfLog } from '../services/perfLogger.js'

const CONSTITUTION_DOC = loadAiDoc(AI_DOC_FILES.constitution)

const CONSTITUTION_TEXT = CONSTITUTION_DOC.loaded && CONSTITUTION_DOC.content
  ? `\n\n=== GymPro Constitution ===\n${CONSTITUTION_DOC.content}\n=== End of Constitution ===\n`
  : ''

const ANSWER_SYSTEM_PROMPT = `${CONSTITUTION_TEXT}You are GymPro AI — a fitness assistant for a Vietnamese gym.
Your job: synthesize a natural, conversational answer using the tool data provided.

Rules:
- Answer in Vietnamese unless the user wrote in English
- Use the REAL data from the tool results — never make up prices, names, or numbers
- Be concise but helpful (3-6 sentences)
- If there are multiple plans/PTs, list them with key details
- If recommending, explain WHY with data (price, rating, specialty match)
- End with a follow-up question to continue the conversation
- Do NOT mention that you used tools or that this is tool data
- Speak naturally as a helpful gym assistant`

const buildLLMAnswer = async ({ query, analysis, plans, pts, memberships, smartRec, memory, lang }) => {
  const dataSections = []
  const subject = analysis?.subject || 'general'
  if (subject === 'plan' || subject === 'membership') {
    if (Array.isArray(plans) && plans.length > 0) {
      dataSections.push(`Available plans (${plans.length}):\n${plans.slice(0, 5).map((p) => `- ${p.nameVi || p.nameEn || p.name}: ${(p.price || 0).toLocaleString()}₫ / ${p.durationDays || 0} ngày`).join('\n')}`)
    }
    if (smartRec?.recommendedPlan) {
      const rp = smartRec.recommendedPlan
      dataSections.push(`Recommended plan: ${rp.nameVi || rp.nameEn || rp.name} (${(rp.price || 0).toLocaleString()}₫). Reason: ${smartRec.reason || 'best match for user needs'}`)
    }
  }
  if (subject === 'pt') {
    if (Array.isArray(pts) && pts.length > 0) {
      dataSections.push(`Available PTs (${pts.length}):\n${pts.slice(0, 5).map((pt) => `- ${pt.name}: chuyên môn ${(pt.specialties || []).slice(0, 3).join(', ')}, rating ${pt.rating || 0}/5`).join('\n')}`)
    }
  }
  if (subject === 'membership') {
    if (memberships) dataSections.push(`User membership: found=${!!memberships.found}`)
  }
  if (memory?.lastSubject) {
    dataSections.push(`Previous: ${memory.lastSubject}/${memory.lastAction || ''}`)
  }

  const guide = getRelevantAiDocs({
    subject,
    action: analysis?.action || '',
    intent: analysis?.intent || '',
    responseType: analysis?.responseType || '',
    purpose: 'render',
    files: [AI_DOC_FILES.render],
    maxChars: 2000,
  })

  const userPrompt = `Q: "${query}"\nSubject: ${subject}, action: ${analysis?.action || ''}\n${guide.content ? `Guide: ${guide.content}\n` : ''}Data:\n${dataSections.join('\n') || 'none'}\nAnswer naturally in ${lang === 'en' ? 'English' : 'Vietnamese'}.`

  try {
    const result = await runAIWithFallback({
      systemPrompt: ANSWER_SYSTEM_PROMPT,
      userMessage: userPrompt,
    }, { temperature: 0.3, maxTokens: 600, timeoutMs: 8000 })
    const text = (result.text || '').trim()
    if (text.length > 20) return text
  } catch {
    // LLM unavailable, fall through to pattern builder
  }
  return null
}

const extractPTNameFromQuery = (query) => {
  const n = normalizeQuery(query)
  // Match patterns: "pt <name>", "trainer <name>", "huan luyen vien <name>"
  const match = n.match(/\b(pt|trainer|huan luyen vien)\s+(.+)/i)
  if (match) {
    const name = match[2]
      .split(/\b(?:dang|hien|nhan|co|bao nhieu|neu|thi|dung|đang|hiện|nhận|có|bao nhiêu|nếu|thì|đừng)\b|\?/i)[0]
      .replace(/\b(chi tiet|thong tin|ve|la|nay|kia|do|day)\b/gi, '')
      .trim()
    if (name && name.length > 1) return name
  }
  // Fallback: last word after "ve" + "pt" pattern
  const veMatch = n.match(/\bve\s+pt\s+(.+)/i)
  if (veMatch) {
    const name = veMatch[1]
      .split(/\b(?:dang|hien|nhan|co|bao nhieu|neu|thi|dung|đang|hiện|nhận|có|bao nhiêu|nếu|thì|đừng)\b|\?/i)[0]
      .replace(/\b(chi tiet|thong tin)\b/gi, '')
      .trim()
    if (name && name.length > 1) return name
  }
  return null
}

const normalizeQuery = (text = '') => text
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'd')
  .toLowerCase()
  .trim()

const isOtherPersonSensitiveQuery = (query = '') => {
  const n = normalizeQuery(query)
  const sensitive = /\b(email|e mail|so dien thoai|phone|lien he|thong tin ca nhan|tai khoan|profile|ho so|mat khau|password)\b/.test(n)
  const otherPerson = /\b(nguoi khac|member khac|user khac|hoi vien khac|thanh vien|thanh vien khac|khach hang khac|cua thanh vien|cua member|cua user|anh do|chi do|nguoi do|other user|another user)\b/.test(n)
  return sensitive && otherPerson
}

const hasAnyToolData = (toolResults) => {
  if (!toolResults || toolResults.length === 0) return false
  return toolResults.some((r) => {
    if (!r || r.error) return false
    if (Array.isArray(r) && r.length > 0) return true
    if (r && typeof r === 'object' && Object.keys(r).length > 0) return true
    return false
  })
}

const extractMentionedPlan = (query, plans) => {
  if (!plans || plans.length === 0) return null
  const n = normalizeQuery(query)
  for (const plan of plans) {
    const names = [plan.nameVi, plan.nameEn, plan.slug, plan.code, ...(plan.aliases || [])].filter(Boolean).map((s) => normalizeQuery(s))
    for (const name of names) {
      if (name && n.includes(name)) return plan
    }
  }
  return null
}

const findPlanByName = (planName, plans) => {
  if (!planName || !Array.isArray(plans)) return null
  const target = normalizeQuery(planName)
  return plans.find((plan) => {
    const names = [plan.nameVi, plan.nameEn, plan.name, plan.slug, plan.code, ...(plan.aliases || [])]
      .filter(Boolean)
      .map((value) => normalizeQuery(value))
    return names.some((name) => name && (name === target || name.includes(target) || target.includes(name)))
  }) || null
}

const buildPlanNotFoundResponse = (planName, lang = 'vi') => {
  const name = safeText(planName, lang === 'en' ? 'that plan' : 'gói này')
  return lang === 'en'
    ? `GymPro does not currently have data for the "${name}" membership plan.`
    : `Hiện GymPro chưa tìm thấy dữ liệu gói "${name}".`
}

const formatPlanDetailResponse = (plan, lang = 'vi') => {
  const name = lang === 'en'
    ? (plan?.nameEn || plan?.nameVi || plan?.name)
    : (plan?.nameVi || plan?.nameEn || plan?.name)
  const price = formatPriceText(plan?.price, lang, lang === 'en' ? 'Not updated' : 'Chưa cập nhật')
  const duration = formatDaysText(plan?.durationDays, lang, lang === 'en' ? 'Not updated' : 'Chưa cập nhật')
  const features = (lang === 'en' ? (plan?.featuresEn || plan?.featuresVi || []) : (plan?.featuresVi || plan?.featuresEn || []))
    .filter((feature) => typeof feature === 'string' && feature.trim())
    .map((feature) => feature.trim())
    .slice(0, 6)
  const description = safeText(lang === 'en' ? (plan?.descriptionEn || plan?.descriptionVi || plan?.description) : (plan?.descriptionVi || plan?.descriptionEn || plan?.description))
  const lines = [titleText(name || (lang === 'en' ? 'Membership plan' : 'Gói tập'))]
  lines.push('', `${lang === 'en' ? 'Price' : 'Giá'}: ${price}`)
  lines.push(`${lang === 'en' ? 'Duration' : 'Thời hạn'}: ${duration}`)
  if (features.length > 0) lines.push('', lang === 'en' ? 'Benefits:' : 'Quyền lợi:', '', ...bulletList(features))
  if (description) lines.push('', lang === 'en' ? 'Description:' : 'Mô tả:', '', description)
  return lines.join('\n')
}

const buildPtNotFoundResponse = (ptName, lang = 'vi') => {
  const name = safeText(ptName, lang === 'en' ? 'that PT' : 'PT này')
  return lang === 'en'
    ? `GymPro does not currently have data for PT "${name}".`
    : `Hiện GymPro chưa tìm thấy dữ liệu PT "${name}". Bạn có muốn xem danh sách PT hiện có không?`
}

const buildPlanClarification = (plans = [], lang = 'vi') => {
  const names = (Array.isArray(plans) ? plans : [])
    .map((plan) => lang === 'en' ? (plan.nameEn || plan.nameVi || plan.name) : (plan.nameVi || plan.nameEn || plan.name))
    .filter(Boolean)
  if (names.length === 0) {
    return lang === 'en' ? 'Which plan would you like to ask about?' : 'Bạn muốn hỏi về gói nào?'
  }
  return lang === 'en'
    ? `Which plan would you like to view: ${names.join(', ')}?`
    : `Bạn muốn xem gói nào: ${names.join(', ')}?`
}

const countPlanFromQuery = (query) => {
  const n = normalizeQuery(query)
  return /\b(co may|co bao nhieu|how many)\b/.test(n) && /\b(goi|plan)\b/.test(n)
}

const isCheapestIntent = (query) => {
  const n = normalizeQuery(query)
  return /\b(re nhat|it tien nhat|tiet kiem|cheapest|gia re|it chi phi|chi it)\b/.test(n)
}

const isComparisonIntent = (query) => {
  const n = normalizeQuery(query)
  return /\b(so sanh|khac|vs|versus|compare)\b/.test(n)
}

const isNavigationLocationIntent = (query) => {
  const n = normalizeQuery(query)
  return /\b(o dau|vao dau|bam cho nao|mo trang nao|trang nao|duong dan|lam sao de vao|cach thao tac)\b/.test(n)
}

const isPTDetailIntent = (query) => {
  const n = normalizeQuery(query)
  return /\b(chi tiet|thong tin|profile|ho so|gioi thieu|detail|details|about)\b/.test(n)
    && /\b(pt|trainer|coach|hlv|huan luyen vien)\b/.test(n)
}

const formatPTDetailResponse = (pt, lang = 'vi') => {
  const specialties = Array.isArray(pt?.specialties) ? pt.specialties.filter(Boolean) : []
  const email = formatEmailText(pt?.email)
  const lines = [titleText(pt?.name || 'PT')]
  if (pt?.phone || email) lines.push('', lang === 'en' ? 'Contact information' : 'Thông tin liên hệ')
  if (pt?.phone) lines.push('', `${lang === 'en' ? 'Phone' : 'SĐT'}: ${pt.phone}`)
  if (email) lines.push('', `Email: ${email}`)
  if (pt?.experienceYears) lines.push('', lang === 'en' ? 'Experience' : 'Kinh nghiệm', '', lang === 'en' ? `${pt.experienceYears} year(s)` : `${pt.experienceYears} năm`)
  if (Number.isFinite(Number(pt?.totalStudents))) lines.push('', lang === 'en' ? 'Current students' : 'Học viên đang nhận', '', `${Number(pt.totalStudents)}`)
  if (specialties.length > 0) {
    lines.push('', lang === 'en' ? 'Expertise' : 'Chuyên môn', '', ...bulletList(specialties))
  }
  if (pt?.bio) lines.push('', lang === 'en' ? 'Bio' : 'Giới thiệu', '', safeText(pt.bio))
  if (pt?.rating) lines.push('', lang === 'en' ? 'Rating' : 'Đánh giá', '', `${pt.rating}/5${pt.reviewCount ? ` (${pt.reviewCount} đánh giá)` : ''}`)
  if (pt?.schedule) lines.push('', lang === 'en' ? 'This week schedule' : 'Lịch làm việc tuần này', '', safeText(pt.schedule))
  return lines.join('\n')
}

const pickCheapestPlan = (plans) => {
  if (!plans || plans.length === 0) return null
  return [...plans].sort((a, b) => (a.price || 0) - (b.price || 0))[0]
}

const pickMostExpensivePlan = (plans) => {
  if (!plans || plans.length === 0) return null
  return [...plans].sort((a, b) => (b.price || 0) - (a.price || 0))[0]
}

const pickTopRatedPT = (pts) => {
  if (!pts || pts.length === 0) return null
  return [...pts].sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0))[0]
}

const buildAudit = ({ source, optimizer, usedTools = [], aiUsed = false, startedAt }) => ({
  source,
  sources: [source].filter(Boolean),
  optimizer: optimizer ? {
    shouldUseAI: optimizer.shouldUseAI,
    directTool: optimizer.directTool,
    reason: optimizer.reason,
    confidence: optimizer.confidence,
  } : null,
  usedTools,
  aiUsed,
  latencyMs: startedAt ? Date.now() - startedAt : undefined,
})

const withAudit = (response, audit) => {
  recordAiAudit(audit)
  perfEnd('gympro_agent_total')
  return { ...response, audit }
}

const makeSuggestions = ({ query, answer, intent, subject, responseType, payload, toolData, lang }) => buildContextualSuggestions({
  query,
  answer,
  intent,
  subject,
  responseType,
  payload,
  toolData,
  language: lang,
})

const NAVIGATION_SUBJECTS = ['account', 'faq', 'policy', 'navigation', 'booking', 'checkin', 'health', 'workout', 'order', 'forgot_password', 'product', 'payment', 'feedback', 'membership', 'plan']

const buildDirectToolAnswer = async ({ query, optimizer, toolResults, memory, lang, userRole }) => {
  const n = normalizeQuery(query)
  const plans = toolResults.getAvailablePlans?.plans || []
  const pts = toolResults.getAvailablePTs?.pts || []
  const products = toolResults.getRecommendedProducts?.products || []
  const faqSearch = toolResults.searchFaqs || null
  const policySearch = toolResults.searchPolicies || null

  if (optimizer.subject === 'goal') {
    return {
      answer: buildGoalAnswer({ intent: optimizer.intent, goal: optimizer.goal, lang }),
      responseType: 'text_advice',
      payload: { type: 'text_advice' },
    }
  }

  if (optimizer.subject === 'nutrition') {
    return {
      answer: buildNutritionAnswer({ intent: optimizer.intent, goal: optimizer.goal, lang }),
      responseType: 'text_advice',
      payload: { type: 'text_advice' },
    }
  }

  if (optimizer.subject === 'workout') {
    return {
      answer: buildWorkoutDomainAnswer({ intent: optimizer.intent, goal: optimizer.goal, lang }),
      responseType: 'text_advice',
      payload: { type: 'text_advice' },
    }
  }

  if (optimizer.subject === 'report' && !optimizer.directTool) {
    return {
      answer: lang === 'en'
        ? 'This question requires live GymPro report data. I cannot answer it without a report data source.'
        : 'Câu hỏi này cần dữ liệu báo cáo trực tiếp từ GymPro. Hiện chưa có tool báo cáo phù hợp để lấy dữ liệu nên mình không thể tự tạo số liệu.',
      responseType: 'text_advice',
      payload: { type: 'text_advice' },
    }
  }

  if (optimizer.subject === 'booking' && optimizer.action !== 'navigate' && optimizer.directTool !== 'searchFaqs') {
    return {
      answer: buildBookingAnswer({ intent: optimizer.intent, lang }),
      responseType: 'text_advice',
      payload: { type: 'text_advice', bookings: toolResults.getUpcomingBookings?.bookings || [] },
    }
  }

  if (NAVIGATION_SUBJECTS.includes(optimizer.subject)
    && (optimizer.action === 'navigate' || String(optimizer.intent || '').includes('navigation') || optimizer.directTool === 'searchFaqs' || optimizer.directTool === 'searchPolicies')) {
    const faqPolicyAnswer = buildFaqPolicyAnswer({ faqSearch, policySearch, query, language: lang })
    const hasDbMatch = Boolean(faqSearch?.matched || policySearch?.matched)
    const answer = faqPolicyAnswer
      || (lang === 'en'
        ? 'GymPro does not currently have published FAQ or policy data for this question.'
        : 'Hiện GymPro chưa có FAQ hoặc chính sách đã công bố cho câu hỏi này.')
    const navigation = await resolveNavigation({
      query,
      subject: optimizer.subject,
      action: optimizer.action,
      intent: optimizer.intent || 'navigation',
      userRole,
    })
    const navigationAnswer = buildNavigationAnswer({ navigation, baseAnswer: hasDbMatch || faqPolicyAnswer ? answer : '', lang })
    const responseType = navigationAnswer.links.length > 0 || navigation?.blocked
      ? 'navigation_answer'
      : (optimizer.subject === 'policy' ? 'policy_answer' : 'text_advice')
    return {
      answer: navigationAnswer.answer,
      responseType,
      payload: { type: responseType, faqSearch, policySearch, links: navigationAnswer.links, navigation },
      links: navigationAnswer.links,
      mentionedFaq: faqSearch?.matched || null,
      mentionedPolicy: policySearch?.matched || null,
    }
  }

  if (optimizer.subject === 'plan') {
    if (optimizer.action === 'status' || optimizer.action === 'renew') {
      const membershipData = toolResults.getMembershipInfo
      if (!membershipData?.found) {
        const msg = membershipData?.message || (lang === 'en' ? 'You currently do not have an active membership. Let me show you the available plans.' : 'Bạn chưa có gói tập nào đang hoạt động. Để mình cho bạn xem các gói tập nhé.')
        return {
          answer: msg,
          responseType: 'text_advice',
          payload: { type: 'text_advice' },
          links: [{ label: 'Mở Gói tập', path: '/plans', allowedRoles: ['member'] }],
        }
      }
      const planName = membershipData.planName || ''
      const remainingDays = membershipData.remainingDays ?? 0
      const endDate = membershipData.endDate ? new Date(membershipData.endDate).toLocaleDateString('vi-VN') : ''
      if (optimizer.action === 'renew') {
        const answer = lang === 'en'
          ? `You can renew your **${planName}** plan. It still has ${remainingDays} day(s) left and expires on ${endDate}. Head to My Membership to renew whenever you are ready.`
          : `Bạn có thể gia hạn gói **${planName}** hiện tại. Gói của bạn còn ${remainingDays} ngày nữa và sẽ hết hạn vào ${endDate}. Vào Gói tập của tôi để gia hạn khi bạn sẵn sàng nhé.`
        return {
          answer,
          responseType: 'text_advice',
          payload: { type: 'text_advice', membershipData },
          links: [{ label: 'Mở Gói tập của tôi', path: '/my-membership', allowedRoles: ['member'] }],
        }
      }
      const statusLabel = membershipData.status === 'active' ? 'còn hạn' : membershipData.status === 'expired' ? 'đã hết hạn' : membershipData.status || ''
      const startDate = membershipData.startDate ? new Date(membershipData.startDate).toLocaleDateString('vi-VN') : ''
      const answer = lang === 'en'
        ? `Your current plan is **${planName}** (${membershipData.status}). You have ${remainingDays} day(s) remaining.\nPeriod: ${startDate} → ${endDate}`
        : `Gói tập hiện tại của bạn là **${planName}** (${statusLabel}). Bạn còn ${remainingDays} ngày sử dụng.\nNgày bắt đầu: ${startDate}\nNgày kết thúc: ${endDate}`
      return {
        answer,
        responseType: 'text_advice',
        payload: { type: 'text_advice', membershipData },
      }
    }
    if (plans.length === 0) return { answer: buildEmptyDataResponse({ subject: 'plan', lang }), responseType: 'text_advice', payload: { type: 'text_advice', plans: [] } }
    if (/\b(dat nhat|cao nhat|expensive|highest)\b/.test(n)) {
      const plan = pickMostExpensivePlan(plans)
      const answer = plan
        ? formatPlanDetailResponse(plan, lang)
        : buildEmptyDataResponse({ subject: 'plan', lang })
      return {
        answer,
        responseType: 'text_advice',
        payload: { type: 'text_advice', plans: plan ? [plan] : [] },
        mentionedPlan: plan,
      }
    }
    if (/\b(re nhat|it tien nhat|thap nhat|cheapest|lowest)\b/.test(n)) {
      const plan = pickCheapestPlan(plans)
      const answer = plan
        ? formatPlanDetailResponse(plan, lang)
        : buildEmptyDataResponse({ subject: 'plan', lang })
      return {
        answer,
        responseType: 'text_advice',
        payload: { type: 'text_advice', plans: plan ? [plan] : [] },
        mentionedPlan: plan,
      }
    }
    const target = optimizer.targetEntity?.id
      ? plans.find((p) => String(p.id || p._id) === String(optimizer.targetEntity.id))
      : (findPlanByName(optimizer.targetEntity?.name, plans) || extractMentionedPlan(query, plans))
    if (optimizer.action === 'detail' && target) {
      return {
        answer: formatPlanDetailResponse(target, lang),
        responseType: 'plan_detail',
        payload: { type: 'plan_detail', plans, cards: [target] },
        mentionedPlan: target,
      }
    }
    if (optimizer.action === 'detail' && !target) {
      if (optimizer.targetEntity?.name) {
        return {
          answer: buildPlanNotFoundResponse(optimizer.targetEntity.name, lang),
          responseType: 'text_advice',
          payload: { type: 'text_advice', plans: [] },
        }
      }
      return {
        answer: buildPlanClarification(plans, lang),
        responseType: 'text_advice',
        payload: { type: 'text_advice', plans },
      }
    }
    if (shouldUsePlanSpecializationOverview({ plans, query })) {
      return {
        answer: buildPlanSpecializationOverviewResponse({ plans, lang }),
        responseType: 'text_advice',
        payload: {
          type: 'text_advice',
          planSpecializations: [...new Set(plans.flatMap((plan) => Array.isArray(plan?.applicableSpecializations) ? plan.applicableSpecializations : []).filter(Boolean))],
        },
      }
    }
    return {
      answer: buildPlanListResponse({ plans, lang }),
      responseType: 'plan_list',
      payload: { type: 'plan_list', plans },
    }
  }

  if (optimizer.subject === 'pt') {
    if (pts.length === 0) return { answer: buildEmptyDataResponse({ subject: 'pt', lang }), responseType: 'text_advice', payload: { type: 'text_advice', pts: [] } }
    const ptItems = pts.map((pt) => ({
      id: pt.id || pt._id || '',
      name: pt.name || '',
      avatar: pt.avatar || '',
      phone: pt.phone || '',
      email: pt.email || '',
      specialty: (pt.specialties || []).join(', '),
      specialties: pt.specialties || [],
      experienceYears: pt.experienceYears || 0,
      rating: pt.rating || 0,
      bio: pt.bio || '',
      reviewCount: pt.reviewCount || 0,
      latestReviews: pt.latestReviews || [],
      schedule: pt.schedule || '',
      scheduleRaw: pt.scheduleRaw || [],
    }))
    const selectedPT = optimizer.targetEntity?.id
      ? ptItems.find((pt) => String(pt.id) === String(optimizer.targetEntity.id))
      : optimizer.targetEntity?.name
        ? ptItems.find((pt) => normalizeQuery(pt.name) === normalizeQuery(optimizer.targetEntity.name))
        : /\b(rating cao nhat|danh gia cao nhat|gioi nhat)\b/.test(n)
        ? pickTopRatedPT(ptItems)
        : optimizer.action === 'detail'
          ? null
          : null
    if (optimizer.action === 'detail' && !selectedPT && optimizer.targetEntity?.name) {
      return {
        answer: buildPtNotFoundResponse(optimizer.targetEntity.name, lang),
        responseType: 'text_advice',
        payload: { type: 'text_advice', pts: [] },
      }
    }
    return {
      answer: selectedPT ? formatPTDetailResponse(selectedPT, lang) : buildPtListResponse({ pts: ptItems, lang }),
      responseType: selectedPT ? 'pt_detail' : 'pt_list',
      payload: { type: selectedPT ? 'pt_detail' : 'pt_list', pts: ptItems, cards: selectedPT ? [selectedPT] : [] },
      mentionedPT: selectedPT || ptItems[0],
      listedPTs: ptItems,
    }
  }

  if (optimizer.subject === 'product') {
    const answer = products.length > 0
      ? `${lang === 'en' ? `GymPro currently has ${products.length} matching product(s):` : `GymPro hiện có ${products.length} sản phẩm phù hợp:`}\n\n${products.slice(0, 5).map((p) => {
        const lines = [titleText(p.name || 'Product'), '', `${lang === 'en' ? 'Price' : 'Giá'}: ${formatPriceText(p.price, lang, lang === 'en' ? 'Not updated' : 'Chưa cập nhật')}`]
        const description = safeText(p.description)
        if (description) lines.push('', lang === 'en' ? 'Description:' : 'Mô tả:', '', description)
        return lines.join('\n')
      }).join(`\n\n${SEPARATOR}\n\n`)}`
      : (lang === 'en' ? 'GymPro does not currently have matching product data.' : 'Hiện GymPro chưa có dữ liệu sản phẩm phù hợp.')
    return {
      answer,
      responseType: 'product_list',
      payload: { type: 'product_list', products },
      listedProducts: products,
      mentionedProduct: products[0] || null,
    }
  }

  if (optimizer.subject === 'checkin') {
    const stats = toolResults.getCheckinStats?.stats
    if (!stats || stats.total === 0) {
      const msg = lang === 'en'
        ? 'You have not checked in yet. Time to start your gym journey — every session counts!'
        : 'Bạn chưa điểm danh lần nào. Ghé phòng tập và điểm danh để mình theo dõi tiến độ giúp bạn nhé!'
      return {
        answer: msg,
        responseType: 'text_advice',
        payload: { type: 'text_advice' },
      }
    }
    const isWeekQuery = /\b(tuan nay|tuan)\b/.test(n)
    const isMonthQuery = /\b(thang nay|thang)\b/.test(n)
    const isLastQuery = /\b(gan nhat|gan day|cuoi cung)\b/.test(n)
    const isStreakQuery = /\b(chuoi|streak|lien tiep|hom nay)\b/.test(n)
    let answer
    if (isWeekQuery) answer = lang === 'en' ? `This week you have checked in **${stats.thisWeek} time(s)**. Keep it going!` : `Tuần này bạn đã điểm danh **${stats.thisWeek} lần**. Cố gắng duy trì đều đặn nhé!`
    else if (isMonthQuery) answer = lang === 'en' ? `This month you have checked in **${stats.thisMonth} time(s)**. Consistency is paying off!` : `Tháng này bạn đã điểm danh **${stats.thisMonth} lần**. Duy trì tốt lắm!`
    else if (isLastQuery && stats.lastCheckin) answer = lang === 'en' ? `Your last check-in was at **${new Date(stats.lastCheckin).toLocaleString('vi-VN')}**. Hope you had a great session!` : `Lần điểm danh gần nhất của bạn là lúc **${new Date(stats.lastCheckin).toLocaleString('vi-VN')}**. Chúc bạn có buổi tập tốt nhé!`
    else if (isStreakQuery) {
      const todayChecked = stats.todayCheckinTime ? (lang === 'en' ? 'You checked in today — awesome! ' : 'Bạn đã điểm danh hôm nay rồi — tuyệt! ') : ''
      answer = lang === 'en' ? `${todayChecked}Your current streak is **${stats.streak} day(s)**. Keep the momentum going!` : `${todayChecked}Chuỗi điểm danh hiện tại của bạn là **${stats.streak} ngày**. Cố gắng giữ vững nhé!`
    } else answer = buildCheckinSummaryResponse({ stats, lang })
    return {
      answer,
      responseType: 'checkin_summary',
      payload: { type: 'checkin_summary', checkinStats: stats },
    }
  }

  return null
}

const buildAgentAnswer = async ({
  plan, query, plans, memberships, pts, workoutData, smartRec, targetPlan, memory, lang, hasBudget, hasFrequency, goal, subject, action,
}) => {
  const n = normalizeQuery(query)
  const introMatch = /\b(ban la ai|who are you|gioi thieu)\b/.test(n)
  if (introMatch) return makeIntroduction(lang)

  if (subject === 'plan' || (subject === 'workout' && action === 'list')) {
    if ((countPlanFromQuery(query) || action === 'list') && plans && plans.length > 0) {
      if (shouldUsePlanSpecializationOverview({ plans, query })) {
        return buildPlanSpecializationOverviewResponse({ plans, lang })
      }
      return buildPlanListResponse({ plans, lang })
    }
    if (plans && plans.length > 0) {
      if (isCheapestIntent(query)) {
        const cheapest = pickCheapestPlan(plans)
        if (cheapest) {
          return formatPlanDetailResponse(cheapest, lang)
        }
      }
      if (action === 'recommend' || hasBudget || hasFrequency || goal) {
        if (smartRec?.recommendedPlan) {
          return buildPlanRecommendResponse({ plan: smartRec.recommendedPlan, reason: smartRec.reason, alternatives: smartRec.alternatives?.slice(0, 2), lang })
        }
        const chosen = chooseRecommendedPlan(plans, query)
        if (chosen) {
          return buildPlanRecommendResponse({ plan: chosen, alternatives: plans.filter((p) => p._id !== chosen._id).slice(0, 2), lang })
        }
      }
      if (targetPlan) {
        return formatPlanDetailResponse(targetPlan, lang)
      }
      if (shouldUsePlanSpecializationOverview({ plans, query })) {
        return buildPlanSpecializationOverviewResponse({ plans, lang })
      }
      return buildPlanListResponse({ plans, lang })
    }
    if (!plans || plans.length === 0) {
      return buildEmptyDataResponse({ subject: 'plan', lang })
    }
  }

  if (subject === 'workout') {
    if (workoutData && !workoutData.error) {
      return buildWorkoutAdviceResponse({ stats: workoutData, lang })
    }
    return buildWorkoutDomainAnswer({ intent: plan?.intent || 'workout_advice', goal, lang })
  }

  if (subject === 'pt') {
    if (pts && pts.length > 0) {
      return buildPtListResponse({ pts, lang })
    }
    return buildEmptyDataResponse({ subject: 'pt', lang })
  }

  return null
}

const enforceFallbackBan = (analysis, fallbackKey) => {
  const banned = analysis?.forbiddenFallbacks || []
  if (banned.length === 0) return false
  return banned.some((b) => fallbackKey.includes(b))
}

const roleCanAccess = (user, requiredRole) => {
  if (!user) return false
  const role = String(user.role || '').toLowerCase()
  if (requiredRole === 'admin') return role === 'admin' || role === 'super_admin'
  if (requiredRole === 'staff') return role === 'staff' || role === 'admin' || role === 'super_admin'
  if (requiredRole === 'pt') return role === 'pt'
  return true
}

const checkPermission = ({ user, analysis, query }) => {
  const normalizedQuery = normalizeQuery(query)
  const isReportIntent = ['report', 'report_data', 'revenue_data', 'report_navigation', 'revenue_navigation'].includes(analysis?.intent)
  const asksCredentialDisclosure = /\b(mat khau ma hoa|password hash|password|hash|token|jwt|secret|api key|cookie)\b/.test(normalizedQuery)
    && /\b(xem|liet ke|cho xem|dua|tra|doan|guess|list|show|reveal|admin)\b/.test(normalizedQuery)
  if (asksCredentialDisclosure) {
    return { allowed: false, message: 'Tài khoản hiện tại không có quyền xem dữ liệu này.' }
  }

  if (!analysis?.needsPermissionCheck) return { allowed: true }

  const role = String(user?.role || 'member').toLowerCase()

  if (isReportIntent && isNavigationLocationIntent(query) && /\b(doanh thu|revenue)\b/.test(normalizedQuery) && !['admin', 'super_admin', 'seller'].includes(role)) {
    return { allowed: false, message: 'Tài khoản hiện tại không có quyền xem doanh thu.' }
  }

  if (isReportIntent && !['admin', 'super_admin', 'seller'].includes(role)) {
    return { allowed: false, message: 'Tài khoản hiện tại không có quyền xem dữ liệu này.' }
  }

  if (isReportIntent && /admin|super_admin/i.test(query) && !['admin', 'super_admin'].includes(role)) {
    return { allowed: false, message: 'Tài khoản hiện tại không có quyền xem dữ liệu này.' }
  }

  return { allowed: true }
}

const mergeConversationMemory = (storedMemory = {}, conversationContext = {}) => {
  const merged = { ...(storedMemory || {}) }
  if (conversationContext?.lastSubject) merged.lastSubject = conversationContext.lastSubject
  if (conversationContext?.lastAction) merged.lastAction = conversationContext.lastAction
  if (conversationContext?.lastIntent) merged.lastIntent = conversationContext.lastIntent
  if (Array.isArray(conversationContext?.lastListedPlans) && conversationContext.lastListedPlans.length > 0) {
    merged.lastListedPlans = conversationContext.lastListedPlans
  }
  if (Array.isArray(conversationContext?.lastListedPTs) && conversationContext.lastListedPTs.length > 0) {
    merged.lastListedPTs = conversationContext.lastListedPTs
  }
  if (conversationContext?.lastMentionedPlan) merged.lastMentionedPlanName = conversationContext.lastMentionedPlan
  if (conversationContext?.lastMentionedPT) merged.lastMentionedPTName = conversationContext.lastMentionedPT
  const active = conversationContext?.activeEntity
  if (active?.type === 'plan') {
    merged.lastSubject = 'plan'
    merged.lastMentionedPlanId = active.id || merged.lastMentionedPlanId
    merged.lastMentionedPlanName = active.name || merged.lastMentionedPlanName
    if (!Array.isArray(merged.lastListedPlans) || merged.lastListedPlans.length === 0) {
      merged.lastListedPlans = [{ id: active.id || '', name: active.name || '', nameVi: active.name || '', position: active.position || 1 }]
    }
  }
  if (active?.type === 'pt') {
    merged.lastSubject = 'pt'
    merged.lastMentionedPTId = active.id || merged.lastMentionedPTId
    merged.lastMentionedPTName = active.name || merged.lastMentionedPTName
    if (!Array.isArray(merged.lastListedPTs) || merged.lastListedPTs.length === 0) {
      merged.lastListedPTs = [{ id: active.id || '', name: active.name || '', position: active.position || 1 }]
    }
  }
  return merged
}

export const gymProAgent = async ({ query, userMessage, user, conversationContext, language = 'vi', memory: inputMemory }) => {
  const startedAt = Date.now()
  perfStart('gympro_agent_total')
  const lang = language === 'en' ? 'en' : 'vi'
  const queryText = query || userMessage || ''
  const userId = String(user?._id || user?.id || '')
  const conversationId = conversationContext?.conversationId || conversationContext?.sessionId || 'default'

  const memory = inputMemory || mergeConversationMemory(agentMemory.get(userId, conversationId), conversationContext)
  const n = normalizeQuery(queryText)

  if (isOtherPersonSensitiveQuery(queryText)) {
    const answer = lang === 'en'
      ? "I can't provide another user's personal account information."
      : 'Mình không thể cung cấp thông tin cá nhân của người dùng khác để bảo vệ quyền riêng tư.'
    const audit = buildAudit({ source: 'local_fallback', usedTools: [], aiUsed: false, startedAt })
    return withAudit({
      answer,
      usedTools: [],
      responseType: 'text_advice',
      payload: { type: 'text_advice' },
      suggestions: [],
      memoryUpdate: null,
      confidence: 1,
      shouldUseLegacyRouter: false,
    }, audit)
  }

  const introPattern = /\b(ban la ai|who are you|gioi thieu|introduce)\b/
  if (introPattern.test(n)) {
    agentMemory.update(userId, conversationId, { lastSubject: 'general', lastAction: 'introduce', lastQuery: queryText, lastAnswer: makeIntroduction(lang) })
    const audit = buildAudit({ source: 'local_fallback', usedTools: [], aiUsed: false, startedAt })
    return withAudit({
      answer: makeIntroduction(lang),
      usedTools: [],
      responseType: 'text_advice',
      payload: { type: 'text_advice' },
      suggestions: makeSuggestions({
        query: queryText,
        answer: makeIntroduction(lang),
        intent: 'general_chat',
        subject: 'general',
        responseType: 'text_advice',
        lang,
      }),
      memoryUpdate: { lastSubject: 'general', lastAction: 'introduce' },
      confidence: 1,
      shouldUseLegacyRouter: false,
    }, audit)
  }

  perfStart('gympro_optimizer')
  const optimizer = optimizeQuery({ query: queryText, memory })
  perfEnd('gympro_optimizer')
  if (!optimizer.directTool && optimizer.shouldUseAI === false) {
    const direct = await buildDirectToolAnswer({ query: queryText, optimizer, toolResults: {}, memory, lang, userRole: user?.role || 'member' })
    if (direct?.answer) {
      const memoryPatch = {
        lastSubject: optimizer.subject,
        lastAction: optimizer.action,
        lastIntent: optimizer.intent,
        lastQuery: queryText,
        lastAnswer: direct.answer,
        lastUsedTools: [],
      }
      agentMemory.update(userId, conversationId, memoryPatch)
      const audit = buildAudit({ source: 'domain_router', optimizer, usedTools: [], aiUsed: false, startedAt })
      return withAudit({
        answer: direct.answer,
        usedTools: [],
        responseType: direct.responseType,
        payload: direct.payload,
        links: direct.links || direct.payload?.links || [],
        suggestions: makeSuggestions({
          query: queryText,
          answer: direct.answer,
          intent: optimizer.intent,
          subject: optimizer.domainSubject || optimizer.subject,
          responseType: direct.responseType,
          payload: direct.payload,
          lang,
        }),
        memoryUpdate: memoryPatch,
        confidence: optimizer.confidence,
        shouldUseLegacyRouter: false,
      }, audit)
    }
  }
  if (optimizer.directTool && optimizer.shouldUseAI === false) {
    const toolResults = {}
    try {
      perfStart('gympro_direct_tool')
      const result = await runGymTool(optimizer.directTool, optimizer.args || {}, { userId })
      perfEnd('gympro_direct_tool')
      toolResults[optimizer.directTool] = result
      const direct = await buildDirectToolAnswer({ query: queryText, optimizer, toolResults, memory, lang, userRole: user?.role || 'member' })
      if (direct?.answer) {
        direct.answer = await constitutionalReview({
          query: queryText,
          answer: direct.answer,
          subject: optimizer.subject,
          analysis: {
            subject: optimizer.subject,
            action: optimizer.action,
            intent: optimizer.intent,
            entityName: optimizer.targetEntity?.name || '',
            needsDatabase: true,
            needsPermissionCheck: false,
            requiredTools: [optimizer.directTool],
            forbiddenFallbacks: optimizer.intent === 'membership_detail' ? ['membership_recommendation', 'faq', 'navigation'] : [],
            currentUserRole: user?.role || 'member',
          },
          toolData: {
            plansCount: toolResults.getAvailablePlans?.plans?.length,
            ptsCount: toolResults.getAvailablePTs?.pts?.length,
            productsCount: toolResults.getRecommendedProducts?.products?.length,
          },
          lang,
        })
        const memoryPatch = {
          lastSubject: optimizer.subject,
          lastAction: optimizer.action,
          lastIntent: optimizer.intent,
          lastQuery: queryText,
          lastAnswer: direct.answer,
          lastUsedTools: [optimizer.directTool],
          lastMentionedPlanId: direct.mentionedPlan?.id || direct.mentionedPlan?._id || memory.lastMentionedPlanId,
          lastMentionedPlanName: direct.mentionedPlan ? (lang === 'en' ? (direct.mentionedPlan.nameEn || direct.mentionedPlan.nameVi || direct.mentionedPlan.name) : (direct.mentionedPlan.nameVi || direct.mentionedPlan.nameEn || direct.mentionedPlan.name)) : memory.lastMentionedPlanName,
          lastMentionedPlan: direct.mentionedPlan || memory.lastMentionedPlan,
          lastMentionedPTId: direct.mentionedPT?.id || direct.mentionedPT?._id || memory.lastMentionedPTId,
          lastMentionedPTName: direct.mentionedPT?.name || memory.lastMentionedPTName,
          lastMentionedPT: direct.mentionedPT || memory.lastMentionedPT,
          lastMentionedProductId: direct.mentionedProduct?.id || direct.mentionedProduct?._id || memory.lastMentionedProductId,
          lastMentionedProductName: direct.mentionedProduct?.name || memory.lastMentionedProductName,
          lastMentionedProduct: direct.mentionedProduct || memory.lastMentionedProduct,
          lastListedPlans: optimizer.subject === 'plan' ? (toolResults.getAvailablePlans?.plans || []) : memory.lastListedPlans,
          lastListedPTs: optimizer.subject === 'pt' ? (direct.listedPTs || toolResults.getAvailablePTs?.pts || []) : memory.lastListedPTs,
          lastListedProducts: optimizer.subject === 'product' ? (direct.listedProducts || []) : memory.lastListedProducts,
        }
        agentMemory.update(userId, conversationId, memoryPatch)
        direct.answer = await naturalResponseRewrite({ answer: direct.answer, query: queryText, subject: optimizer.domainSubject || optimizer.subject, lang })
        const audit = buildAudit({ source: optimizer.reason === 'memory_entity_follow_up' ? 'memory' : 'tool', optimizer, usedTools: [optimizer.directTool], aiUsed: false, startedAt })
        return withAudit({
          answer: direct.answer,
          usedTools: [optimizer.directTool],
          responseType: direct.responseType,
          payload: direct.payload,
          links: direct.links || direct.payload?.links || [],
          suggestions: makeSuggestions({
            query: queryText,
            answer: direct.answer,
            intent: optimizer.intent,
            subject: optimizer.domainSubject || optimizer.subject,
            responseType: direct.responseType,
            payload: direct.payload,
            toolData: toolResults,
            lang,
          }),
          memoryUpdate: memoryPatch,
          confidence: optimizer.confidence,
          shouldUseLegacyRouter: false,
        }, audit)
      }
    } catch (err) {
      console.log('[QUERY_OPTIMIZER] direct tool failed, falling back to reasoner:', err.message)
    }
  }

  perfStart('gympro_reasoner')
  const analysis = await reasonQuery({ query: queryText, memory, conversationContext, language: lang })
  perfEnd('gympro_reasoner')
  const analysisTools = Array.isArray(analysis.requiredTools) ? analysis.requiredTools : (Array.isArray(analysis.needsTools) ? analysis.needsTools : [])
  analysis.requiredTools = analysisTools
  analysis.needsTools = analysisTools
  analysis.entities = analysis.entities || { budget: null, goal: null, frequencyPerWeek: null, mentionedPlan: null, mentionedPT: null }
  console.log('[GYM_PRO_AGENT] analysis:', 'intent=', analysis.intent, 'subject=', analysis.subject, 'action=', analysis.action, 'tools=', analysisTools.join(','), 'permissionCheck=', Boolean(analysis.needsPermissionCheck), 'confidence=', analysis.confidence)
  logAiDocsLoaded({
    docsInfo: getRelevantAiDocs({
      subject: analysis.subject || 'core',
      action: analysis.action || '',
      intent: analysis.intent || '',
      responseType: analysis.responseType || '',
      purpose: 'agent',
      maxChars: 3500,
    }),
  })

  if (!analysis.subject && !analysis.isFollowUp) {
    const audit = buildAudit({ source: 'ai_reasoning', optimizer, usedTools: [], aiUsed: true, startedAt })
    return withAudit({
      answer: null, usedTools: [], responseType: null, payload: null, suggestions: [],
      memoryUpdate: null, confidence: analysis.confidence, shouldUseLegacyRouter: true,
    }, audit)
  }

  const permissionResult = checkPermission({ user, analysis, query: queryText })
  console.log('[GYM_PRO_AGENT] permissionResult:', permissionResult.allowed ? 'allowed' : 'denied')
  if (!permissionResult.allowed) {
    const audit = buildAudit({ source: 'permission', optimizer, usedTools: [], aiUsed: analysis.source === 'llm', startedAt })
    return withAudit({
      answer: permissionResult.message,
      usedTools: [],
      responseType: 'text_advice',
      payload: { type: 'text_advice' },
      suggestions: makeSuggestions({
        query: queryText,
        answer,
        intent: analysis.intent,
        subject: analysis.subject,
        responseType: 'text_advice',
        payload: { type: 'text_advice', plans: [] },
        lang,
      }),
      memoryUpdate: null,
      confidence: 1,
      shouldUseLegacyRouter: false,
    }, audit)
  }

  if (['report', 'report_data', 'revenue_data'].includes(analysis.intent) && analysis.needsPermissionCheck && analysisTools.length === 0) {
    const answer = lang === 'en'
      ? 'This question requires live GymPro report data. I cannot skip the database, and the required report tools are not available here.'
      : 'Câu hỏi này cần dữ liệu báo cáo trực tiếp từ GymPro. Mình không thể bỏ qua database, và hiện chưa có tool báo cáo phù hợp để lấy dữ liệu.'
    const audit = buildAudit({ source: 'permission', optimizer, usedTools: [], aiUsed: analysis.source === 'llm', startedAt })
    return withAudit({
      answer,
      usedTools: [],
      responseType: 'text_advice',
      payload: { type: 'text_advice' },
      suggestions: [],
      memoryUpdate: null,
      confidence: analysis.confidence,
      shouldUseLegacyRouter: false,
    }, audit)
  }

  if (['report', 'report_navigation', 'revenue_navigation'].includes(analysis.intent) && isNavigationLocationIntent(queryText)) {
    const navigation = await resolveNavigation({
      query: queryText,
      subject: 'report',
      action: 'find_location',
      intent: /\b(doanh thu|revenue)\b/.test(normalizeQuery(queryText)) ? 'revenue_navigation' : 'report_navigation',
      userRole: user?.role || 'member',
    })
    const navigationAnswer = buildNavigationAnswer({ navigation, lang })
    const audit = buildAudit({ source: 'navigation', optimizer, usedTools: [], aiUsed: analysis.source === 'llm', startedAt })
    return withAudit({
      answer: navigationAnswer.answer,
      usedTools: [],
      responseType: 'navigation_answer',
      payload: { type: 'navigation_answer', links: navigationAnswer.links, navigation },
      links: navigationAnswer.links,
      suggestions: [],
      memoryUpdate: { lastSubject: 'navigation', lastAction: 'find_location' },
      confidence: analysis.confidence,
      shouldUseLegacyRouter: false,
    }, audit)
  }

  const toolResults = {}
  let hasError = false
  const context = { userId }

  if (analysisTools.length > 0) {
    perfStart('gympro_tools')
    for (const toolName of analysisTools) {
      try {
        let args = {}
        if (toolName === 'getSmartRecommendations') {
          args = { goal: analysis.entities.goal || memory.lastGoal || 'general_fitness', budget: memory.lastBudget ? `${memory.lastBudget}` : undefined, frequency: memory.lastFrequencyPerWeek ? `${memory.lastFrequencyPerWeek}` : undefined }
        }
        if (toolName === 'getAvailablePTs') {
          const ptName = analysis.entities.mentionedPT || (analysis.source === 'cu_fallback' || analysis.source === 'cu_layer' ? extractPTNameFromQuery(queryText) : null)
          args = { specialization: ptName || analysis.entities.goal || memory.lastGoal || undefined }
        }
        const result = await runGymTool(toolName, args, context)
        toolResults[toolName] = result
      } catch (err) {
        toolResults[toolName] = { error: err.message }
        hasError = true
      }
    }
    perfEnd('gympro_tools')
  }

  const plans = (toolResults.getAvailablePlans?.plans || toolResults.getAvailablePlans || [])
  const memberships = toolResults.getMembershipInfo || null
  const pts = (toolResults.getAvailablePTs?.pts || toolResults.getAvailablePTs || [])
  const workoutData = toolResults.analyzeWorkout || null
  const smartRec = toolResults.getSmartRecommendations || null

  const targetPlan = analysis.followUpTarget
    ? (plans.find((p) => String(p._id || p.id) === String(analysis.followUpTarget.id || analysis.followUpTarget)) || findPlanByName(analysis.followUpTarget.name, plans) || extractMentionedPlan(queryText, plans))
    : (findPlanByName(analysis.entities?.mentionedPlan || analysis.entityName, plans) || extractMentionedPlan(queryText, plans))

  if (analysis.intent === 'membership_detail' && analysis.entityName && plans.length > 0 && !targetPlan) {
    const answer = buildPlanNotFoundResponse(analysis.entityName, lang)
    const audit = buildAudit({ source: 'database', optimizer, usedTools: analysisTools, aiUsed: analysis.source === 'llm', startedAt })
    return withAudit({
      answer,
      usedTools: analysisTools,
      responseType: 'text_advice',
      payload: { type: 'text_advice', plans: [] },
      suggestions: [],
      memoryUpdate: null,
      confidence: analysis.confidence,
      shouldUseLegacyRouter: false,
    }, audit)
  }

  if (analysis.shouldAskClarification && analysis.subject === 'plan' && !targetPlan) {
    const answer = buildPlanClarification(plans, lang)
    agentMemory.update(userId, conversationId, {
      lastSubject: 'plan',
      lastAction: 'clarify',
      lastQuery: queryText,
      lastAnswer: answer,
      lastListedPlans: plans.slice(0, 12),
      lastUsedTools: analysis.needsTools,
    })
    const audit = buildAudit({ source: 'semantic_router', optimizer, usedTools: analysis.needsTools, aiUsed: analysis.source === 'llm', startedAt })
    return withAudit({
      answer,
      usedTools: analysis.needsTools,
      responseType: 'text_advice',
      payload: { type: 'text_advice', plans },
      suggestions: makeSuggestions({
        query: queryText,
        answer,
        intent: analysis.intent,
        subject: analysis.subject,
        responseType: 'text_advice',
        payload: { type: 'text_advice', plans },
        lang,
      }),
      memoryUpdate: { lastSubject: 'plan', lastAction: 'clarify', lastListedPlans: plans.slice(0, 12) },
      confidence: analysis.confidence,
      shouldUseLegacyRouter: false,
    }, audit)
  }

  if (isComparisonIntent(queryText) && targetPlan && targetPlan._id && plans.length > 1) {
    const others = plans.filter((p) => p._id !== targetPlan._id)
    const comparisonText = lang === 'en'
      ? `Here is how **${targetPlan.nameEn || targetPlan.nameVi}** compares to other plans:\n\n${others.map((p) => `- **${p.nameEn || p.nameVi}**: ${(p.price || 0).toLocaleString()}₫ / ${p.durationDays || 0} days`).join('\n')}`
      : `Đây là so sánh **${targetPlan.nameVi || targetPlan.nameEn}** với các gói khác:\n\n${others.map((p) => `- **${p.nameVi || p.nameEn}**: ${(p.price || 0).toLocaleString()}₫ / ${p.durationDays || 0} ngày`).join('\n')}`
    agentMemory.update(userId, conversationId, { lastSubject: 'plan', lastAction: 'compare', lastQuery: queryText, lastAnswer: comparisonText, lastUsedTools: analysis.needsTools, lastMentionedPlanId: targetPlan._id, lastMentionedPlanName: lang === 'en' ? (targetPlan.nameEn || targetPlan.nameVi) : (targetPlan.nameVi || targetPlan.nameEn) })
    const audit = buildAudit({ source: 'database', optimizer, usedTools: analysis.needsTools, aiUsed: analysis.source === 'llm', startedAt })
    return withAudit({
      answer: comparisonText,
      usedTools: analysis.needsTools,
      responseType: 'plan_compare',
      payload: { type: 'plan_compare_all', plans },
      suggestions: makeSuggestions({
        query: queryText,
        answer: comparisonText,
        intent: analysis.intent,
        subject: analysis.subject,
        responseType: 'plan_compare',
        payload: { type: 'plan_compare_all', plans },
        lang,
      }),
      memoryUpdate: { lastSubject: 'plan', lastAction: 'compare', lastMentionedPlanId: targetPlan._id, lastMentionedPlanName: lang === 'en' ? (targetPlan.nameEn || targetPlan.nameVi) : (targetPlan.nameVi || targetPlan.nameEn) },
      confidence: 0.85,
      shouldUseLegacyRouter: false,
    }, audit)
  }

  // PT queries use text-first rendering. Detail mode may include a small avatar block.
  if (analysis.subject === 'pt' && pts.length > 0) {
    const ptItems = pts.map((pt) => ({
      id: pt.id || pt._id || '',
      name: pt.name || '',
      avatar: pt.avatar || '',
      phone: pt.phone || '',
      email: pt.email || '',
      specialty: (pt.specialties || []).join(', '),
      specialties: pt.specialties || [],
      experienceYears: pt.experienceYears || 0,
      rating: pt.rating || 0,
      bio: pt.bio || '',
      reviewCount: pt.reviewCount || 0,
      latestReviews: pt.latestReviews || [],
      schedule: pt.schedule || '',
      scheduleRaw: pt.scheduleRaw || [],
    }))

    // NEW: Determine detail mode from action='detail' OR isPTDetailIntent OR analysis.followUpTarget.type='pt'
    const detailMode = analysis.action === 'detail' || isPTDetailIntent(queryText) || (analysis.followUpTarget?.type === 'pt')
    let selectedPT = null

    if (detailMode) {
      if (analysis.followUpTarget?.id) {
        // Use resolved PT ID from follow-up
        selectedPT = ptItems.find((p) => String(p.id) === String(analysis.followUpTarget.id))
      }
      if (!selectedPT && (analysis.entities?.mentionedPT || analysis.entityName)) {
        const requestedName = normalizeQuery(analysis.entities?.mentionedPT || analysis.entityName)
        selectedPT = ptItems.find((p) => normalizeQuery(p.name) === requestedName)
      }
      if (!selectedPT) {
        const requestedName = analysis.entities?.mentionedPT || analysis.entityName
        if (requestedName) {
          const answer = buildPtNotFoundResponse(requestedName, lang)
          const audit = buildAudit({ source: 'database', optimizer, usedTools: analysisTools, aiUsed: analysis.source === 'llm', startedAt })
          return withAudit({
            answer,
            usedTools: analysisTools,
            responseType: 'text_advice',
            payload: { type: 'text_advice', pts: [] },
            suggestions: makeSuggestions({
              query: queryText,
              answer,
              intent: analysis.intent,
              subject: analysis.subject,
              responseType: 'text_advice',
              payload: { type: 'text_advice', pts: [] },
              lang,
            }),
            memoryUpdate: null,
            confidence: analysis.confidence,
            shouldUseLegacyRouter: false,
          }, audit)
        }
      }
    }

    const answer = selectedPT
      ? formatPTDetailResponse(selectedPT, lang)
      : buildPtListResponse({ pts: ptItems, lang })

    agentMemory.update(userId, conversationId, {
      lastSubject: 'pt',
      lastAction: analysis.action,
      lastQuery: queryText,
      lastAnswer: answer,
      lastMentionedPTName: selectedPT?.name || pts[0]?.name || null,
      lastMentionedPTId: selectedPT?.id || pts[0]?.id || null,
      lastUsedTools: analysis.needsTools,
      lastListedPTs: ptItems, // NEW: Save all PTs for follow-up resolution
    })

    const audit = buildAudit({ source: analysis.source === 'llm' ? 'ai_reasoning' : 'tool', optimizer, usedTools: analysis.needsTools, aiUsed: analysis.source === 'llm', startedAt })
    return withAudit({
      answer,
      usedTools: analysis.needsTools,
      responseType: selectedPT ? 'pt_detail' : 'pt_list',
      payload: { type: selectedPT ? 'pt_detail' : 'pt_list', pts: ptItems, cards: selectedPT ? [selectedPT] : [] },
      suggestions: makeSuggestions({
        query: queryText,
        answer,
        intent: analysis.intent,
        subject: analysis.subject,
        responseType: selectedPT ? 'pt_detail' : 'pt_list',
        payload: { type: selectedPT ? 'pt_detail' : 'pt_list', pts: ptItems, cards: selectedPT ? [selectedPT] : [] },
        lang,
      }),
      memoryUpdate: { lastSubject: 'pt', lastAction: analysis.action, lastMentionedPTName: selectedPT?.name || null },
      confidence: analysis.confidence,
      shouldUseLegacyRouter: false,
    }, audit)
  }

  if (analysis.subject === 'checkin') {
    const stats = toolResults.getCheckinStats?.stats
    if (!stats || stats.total === 0) {
      const msg = lang === 'en'
        ? 'You have not checked in yet. Time to start your gym journey — every session counts!'
        : 'Bạn chưa điểm danh lần nào. Ghé phòng tập và điểm danh để mình theo dõi tiến độ giúp bạn nhé!'
      const audit = buildAudit({ source: 'tool', optimizer, usedTools: analysisTools, aiUsed: analysis.source === 'llm', startedAt })
      return withAudit({
        answer: msg,
        usedTools: analysisTools,
        responseType: 'text_advice',
        payload: { type: 'text_advice' },
        suggestions: makeSuggestions({ query: queryText, answer: msg, intent: analysis.intent, subject: analysis.subject, responseType: 'text_advice', payload: { type: 'text_advice' }, lang }),
        memoryUpdate: { lastSubject: 'checkin', lastAction: analysis.action },
        confidence: analysis.confidence,
        shouldUseLegacyRouter: false,
      }, audit)
    }
    const isWeekQuery = /\b(tuan nay|tuan)\b/.test(normalizeQuery(queryText))
    const isMonthQuery = /\b(thang nay|thang)\b/.test(normalizeQuery(queryText))
    const isLastQuery = /\b(gan nhat|gan day|cuoi cung)\b/.test(normalizeQuery(queryText))
    const isStreakQuery = /\b(chuoi|streak|lien tiep|hom nay)\b/.test(normalizeQuery(queryText))
    let answer
    if (isWeekQuery) answer = lang === 'en' ? `This week you have checked in **${stats.thisWeek} time(s)**. Keep it going!` : `Tuần này bạn đã điểm danh **${stats.thisWeek} lần**. Cố gắng duy trì đều đặn nhé!`
    else if (isMonthQuery) answer = lang === 'en' ? `This month you have checked in **${stats.thisMonth} time(s)**. Consistency is paying off!` : `Tháng này bạn đã điểm danh **${stats.thisMonth} lần**. Duy trì tốt lắm!`
    else if (isLastQuery && stats.lastCheckin) answer = lang === 'en' ? `Your last check-in was at **${new Date(stats.lastCheckin).toLocaleString('vi-VN')}**. Hope you had a great session!` : `Lần điểm danh gần nhất của bạn là lúc **${new Date(stats.lastCheckin).toLocaleString('vi-VN')}**. Chúc bạn có buổi tập tốt nhé!`
    else if (isStreakQuery) {
      const todayChecked = stats.todayCheckinTime ? (lang === 'en' ? 'You checked in today — awesome! ' : 'Bạn đã điểm danh hôm nay rồi — tuyệt! ') : ''
      answer = lang === 'en' ? `${todayChecked}Your current streak is **${stats.streak} day(s)**. Keep the momentum going!` : `${todayChecked}Chuỗi điểm danh hiện tại của bạn là **${stats.streak} ngày**. Cố gắng giữ vững nhé!`
    } else answer = buildCheckinSummaryResponse({ stats, lang })
    answer = await naturalResponseRewrite({ answer, query: queryText, subject: 'checkin', lang })
    const audit = buildAudit({ source: 'tool', optimizer, usedTools: analysisTools, aiUsed: analysis.source === 'llm', startedAt })
    return withAudit({
      answer,
      usedTools: analysisTools,
      responseType: 'checkin_summary',
      payload: { type: 'checkin_summary', checkinStats: stats },
      suggestions: makeSuggestions({ query: queryText, answer, intent: analysis.intent, subject: analysis.subject, responseType: 'checkin_summary', payload: { type: 'checkin_summary', checkinStats: stats }, toolData: toolResults, lang }),
      memoryUpdate: { lastSubject: 'checkin', lastAction: analysis.action },
      confidence: analysis.confidence,
      shouldUseLegacyRouter: false,
    }, audit)
  }

  const hasData = hasAnyToolData(Object.values(toolResults))
  if (!hasData && !hasError && analysis.needsDatabase) {
    const audit = buildAudit({ source: 'tool', optimizer, usedTools: analysisTools, aiUsed: analysis.source === 'llm', startedAt })
    const emptyAnswer = buildEmptyDataResponse({ subject: analysis.subject, lang })
    return withAudit({
      answer: emptyAnswer,
      usedTools: analysisTools,
      responseType: 'text_advice',
      payload: { type: 'text_advice' },
      suggestions: makeSuggestions({
        query: queryText,
        answer: emptyAnswer,
        intent: analysis.intent,
        subject: analysis.subject,
        responseType: 'text_advice',
        payload: { type: 'text_advice' },
        toolData: toolResults,
        lang,
      }),
      memoryUpdate: null,
      confidence: analysis.confidence,
      shouldUseLegacyRouter: false,
    }, audit)
  }

  if (hasError && analysis.needsDatabase) {
    const answer = lang === 'en'
      ? 'I cannot retrieve the required GymPro data right now.'
      : 'Hiện mình chưa lấy được dữ liệu cần thiết từ GymPro.'
    const audit = buildAudit({ source: 'tool_error', optimizer, usedTools: analysisTools, aiUsed: analysis.source === 'llm', startedAt })
    return withAudit({
      answer,
      usedTools: analysisTools,
      responseType: 'text_advice',
      payload: { type: 'text_advice' },
      suggestions: [],
      memoryUpdate: null,
      confidence: analysis.confidence * 0.6,
      shouldUseLegacyRouter: false,
    }, audit)
  }

  perfStart('gympro_llm_answer')
  let answer = await buildLLMAnswer({
    query: queryText, analysis, plans, pts, memberships, smartRec, memory, lang,
  })
  perfEnd('gympro_llm_answer')
  if (!answer) {
    answer = await buildAgentAnswer({
      plan: analysis, query: queryText, plans, memberships, pts, workoutData, smartRec, targetPlan, memory, lang,
      hasBudget: Boolean(analysis.entities.budget || memory.lastBudget),
      hasFrequency: Boolean(analysis.entities.frequencyPerWeek || memory.lastFrequencyPerWeek),
      goal: analysis.entities.goal || memory.lastGoal,
      subject: analysis.subject,
      action: analysis.action,
    })
  }

  if (answer) {
    const toolDataForReview = {
      plansCount: plans?.length,
      ptsCount: pts?.length,
      hasMemberships: !!memberships,
      hasSmartRec: !!smartRec,
    }
    answer = await constitutionalReview({
      query: queryText,
      answer,
      subject: analysis.subject,
      analysis,
      currentUserRole: user?.role || 'member',
      toolData: toolDataForReview,
      lang,
    })
    answer = await naturalResponseRewrite({ answer, query: queryText, subject: analysis.subject, lang })
  }

  if (!answer) {
    const audit = buildAudit({ source: 'local_fallback', optimizer, usedTools: analysis.needsTools, aiUsed: analysis.source === 'llm', startedAt })
    return withAudit({
      answer: null, usedTools: analysis.needsTools, responseType: null, payload: null, suggestions: [],
      memoryUpdate: null, confidence: analysis.confidence * 0.4, shouldUseLegacyRouter: true,
    }, audit)
  }

  let mentionedPlanId = targetPlan?._id || null
  let mentionedPlanName = targetPlan ? (lang === 'en' ? (targetPlan.nameEn || targetPlan.nameVi) : (targetPlan.nameVi || targetPlan.nameEn)) : null
  if (!mentionedPlanId && smartRec?.recommendedPlan?._id) {
    mentionedPlanId = smartRec.recommendedPlan._id
    mentionedPlanName = lang === 'en' ? (smartRec.recommendedPlan.nameEn || smartRec.recommendedPlan.nameVi) : (smartRec.recommendedPlan.nameVi || smartRec.recommendedPlan.nameEn)
  }

  const mentionedPTId = pts?.[0]?._id || null
  const mentionedPTName = pts?.[0]?.name || null

  // NEW: Save listed plans for follow-up resolution
  const listedPlans = analysis.subject === 'plan' && plans.length > 0 ? plans.slice(0, 12) : memory?.lastListedPlans || []
  const listedPTs = analysis.subject === 'pt' && pts.length > 0 ? pts.slice(0, 12) : memory?.lastListedPTs || []

  agentMemory.update(userId, conversationId, {
    lastSubject: analysis.subject,
    lastAction: analysis.action,
    lastQuery: queryText,
    lastAnswer: answer,
    lastGoal: analysis.entities.goal || memory.lastGoal,
    lastBudget: memory.lastBudget,
    lastFrequencyPerWeek: analysis.entities.frequencyPerWeek || memory.lastFrequencyPerWeek,
    lastMentionedPlanId: mentionedPlanId,
    lastMentionedPlanName: mentionedPlanName,
    lastMentionedPTId: mentionedPTId,
    lastMentionedPTName: mentionedPTName,
    lastUsedTools: analysis.needsTools,
    lastRecommendation: answer,
    lastListedPlans: listedPlans, // NEW
    lastListedPTs: listedPTs, // NEW
  })

  const audit = buildAudit({ source: smartRec ? 'smart_recommend' : analysis.source === 'llm' ? 'ai_reasoning' : 'tool', optimizer, usedTools: analysis.needsTools, aiUsed: analysis.source === 'llm', startedAt })
  const shouldOverviewPlanFirst = analysis.subject === 'plan'
    && analysis.action === 'list'
    && shouldUsePlanSpecializationOverview({ plans, query: queryText })

  return withAudit({
    answer,
    usedTools: analysis.needsTools,
    responseType: analysis.subject === 'plan' && analysis.action === 'list' && !shouldOverviewPlanFirst ? 'plan_list' : 'text_advice',
    payload: shouldOverviewPlanFirst
      ? {
        type: 'text_advice',
        planSpecializations: [...new Set(plans.flatMap((plan) => Array.isArray(plan?.applicableSpecializations) ? plan.applicableSpecializations : []).filter(Boolean))],
        data: toolResults,
      }
      : { type: analysis.subject === 'plan' && analysis.action === 'list' ? 'plan_list' : 'text_advice', plans, data: toolResults },
    suggestions: makeSuggestions({
      query: queryText,
      answer,
      intent: analysis.intent,
      subject: analysis.subject,
        responseType: analysis.subject === 'plan' && analysis.action === 'list' && !shouldOverviewPlanFirst ? 'plan_list' : 'text_advice',
        payload: shouldOverviewPlanFirst
          ? {
            type: 'text_advice',
            planSpecializations: [...new Set(plans.flatMap((plan) => Array.isArray(plan?.applicableSpecializations) ? plan.applicableSpecializations : []).filter(Boolean))],
            data: toolResults,
          }
          : { type: analysis.subject === 'plan' && analysis.action === 'list' ? 'plan_list' : 'text_advice', plans, data: toolResults },
      toolData: {
        ...toolResults,
        checkinStats: toolResults.getCheckinStats?.stats || toolResults.checkinStats || toolResults.checkin?.checkinStats,
      },
      lang,
    }),
    memoryUpdate: {
      lastSubject: analysis.subject,
      lastAction: analysis.action,
      lastMentionedPlanId: mentionedPlanId,
      lastMentionedPlanName: mentionedPlanName,
      lastListedPlans: listedPlans, // NEW
      lastListedPTs: listedPTs, // NEW
    },
    confidence: analysis.confidence,
    shouldUseLegacyRouter: false,
  }, audit)
}

export const __gymProAgentTestHooks = {
  buildDirectToolAnswer,
  checkPermission,
  buildPlanNotFoundResponse,
  buildPtNotFoundResponse,
}
