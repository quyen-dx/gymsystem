import { runAIWithFallback } from '../services/aiFallbackService.js'
import { recordAiAudit } from '../services/aiAuditService.js'
import { chooseRecommendedPlan } from '../services/dbResponder.js'
import { buildEmptyDataResponse, buildPlanListResponse, buildPlanRecommendResponse, buildPtListResponse, buildWorkoutAdviceResponse, makeIntroduction } from '../services/naturalResponseBuilder.js'
import { getReasoningGuide } from '../services/reasoningGuideService.js'
import { runGymTool } from '../tools/gymTools.js'
import { SEPARATOR, bulletList, formatEmailText, formatPriceText, safeText, titleText } from '../services/render/renderTextUtils.js'
import { agentMemory } from './agentMemory.js'
import { optimizeQuery } from './queryOptimizer.js'
import { reasonQuery } from './queryReasoner.js'
import { perfStart, perfEnd, perfLog } from '../services/perfLogger.js'

const ANSWER_SYSTEM_PROMPT = `You are GymPro AI — a fitness assistant for a Vietnamese gym.
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

  const guide = getReasoningGuide({ subject, sections: ['Response Rule', 'Safety Rule'], maxChars: 2000 })

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
    const name = match[2].replace(/\b(chi tiet|thong tin|ve|la|nay|kia|do|day)\b/gi, '').trim()
    if (name && name.length > 1) return name
  }
  // Fallback: last word after "ve" + "pt" pattern
  const veMatch = n.match(/\bve\s+pt\s+(.+)/i)
  if (veMatch) {
    const name = veMatch[1].replace(/\b(chi tiet|thong tin)\b/gi, '').trim()
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

const buildDirectToolAnswer = ({ query, optimizer, toolResults, memory, lang }) => {
  const n = normalizeQuery(query)
  const plans = toolResults.getAvailablePlans?.plans || []
  const pts = toolResults.getAvailablePTs?.pts || []
  const products = toolResults.getRecommendedProducts?.products || []

  if (optimizer.subject === 'plan') {
    if (plans.length === 0) return { answer: buildEmptyDataResponse({ subject: 'plan', lang }), responseType: 'text_advice', payload: { type: 'text_advice', plans: [] } }
    if (/\b(dat nhat|cao nhat|expensive|highest)\b/.test(n)) {
      const plan = pickMostExpensivePlan(plans)
      return {
        answer: buildPlanRecommendResponse({ plan, reason: lang === 'en' ? 'This is the highest-priced active plan in GymPro data.' : 'Đây là gói có giá cao nhất trong dữ liệu GymPro hiện tại.', alternatives: plans.filter((p) => String(p.id || p._id) !== String(plan?.id || plan?._id)).slice(0, 2), lang }),
        responseType: 'plan_recommend',
        payload: { type: 'plan_recommend', recommendedPlan: plan, plans },
        mentionedPlan: plan,
      }
    }
    if (/\b(re nhat|it tien nhat|thap nhat|cheapest|lowest)\b/.test(n)) {
      const plan = pickCheapestPlan(plans)
      return {
        answer: buildPlanRecommendResponse({ plan, reason: lang === 'en' ? 'This is the lowest-priced active plan in GymPro data.' : 'Đây là gói có giá thấp nhất trong dữ liệu GymPro hiện tại.', alternatives: plans.filter((p) => String(p.id || p._id) !== String(plan?.id || plan?._id)).slice(0, 2), lang }),
        responseType: 'plan_recommend',
        payload: { type: 'plan_recommend', recommendedPlan: plan, plans },
        mentionedPlan: plan,
      }
    }
    const target = optimizer.targetEntity?.id
      ? plans.find((p) => String(p.id || p._id) === String(optimizer.targetEntity.id))
      : extractMentionedPlan(query, plans)
    if (optimizer.action === 'detail' && target) {
      return {
        answer: buildPlanRecommendResponse({ plan: target, lang }),
        responseType: 'plan_detail',
        payload: { type: 'plan_detail', plans, cards: [target] },
        mentionedPlan: target,
      }
    }
    if (optimizer.action === 'detail' && !target) {
      return {
        answer: buildPlanClarification(plans, lang),
        responseType: 'text_advice',
        payload: { type: 'text_advice', plans },
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
      : /\b(rating cao nhat|danh gia cao nhat|gioi nhat)\b/.test(n)
        ? pickTopRatedPT(ptItems)
        : optimizer.action === 'detail'
          ? ptItems[0]
          : null
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

  return null
}

const buildAgentAnswer = async ({
  plan, query, plans, memberships, pts, workoutData, smartRec, targetPlan, memory, lang, hasBudget, hasFrequency, goal, subject, action,
}) => {
  const n = normalizeQuery(query)
  const introMatch = /\b(gympro|ban la ai|who are you|gioi thieu)\b/.test(n)
  if (introMatch) return makeIntroduction(lang)

  if (subject === 'plan' || (subject === 'workout' && action === 'list')) {
    if ((countPlanFromQuery(query) || action === 'list') && plans && plans.length > 0) {
      return buildPlanListResponse({ plans, lang })
    }
    if (plans && plans.length > 0) {
      if (isCheapestIntent(query) || (action === 'compare' && targetPlan)) {
        const cheapest = pickCheapestPlan(plans)
        if (cheapest) {
          const reason = lang === 'en'
            ? `At ${(cheapest.price || 0).toLocaleString()}₫, this is the most affordable option.`
            : `Với giá ${(cheapest.price || 0).toLocaleString()}₫, đây là lựa chọn tiết kiệm nhất.`
          return buildPlanRecommendResponse({ plan: cheapest, reason, alternatives: plans.filter((p) => p._id !== cheapest._id).slice(0, 2), lang })
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
        const name = lang === 'en' ? (targetPlan.nameEn || targetPlan.nameVi) : (targetPlan.nameVi || targetPlan.nameEn)
        return buildPlanRecommendResponse({ plan: targetPlan, lang })
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
    if (plans && plans.length > 0 && hasFrequency) {
      return buildPlanListResponse({ plans, lang })
    }
  }

  if (subject === 'pt') {
    if (pts && pts.length > 0) {
      return buildPtListResponse({ pts, lang })
    }
    return buildEmptyDataResponse({ subject: 'pt', lang })
  }

  return null
}

export const gymProAgent = async ({ query, userMessage, user, conversationContext, language = 'vi', memory: inputMemory }) => {
  const startedAt = Date.now()
  perfStart('gympro_agent_total')
  const lang = language === 'en' ? 'en' : 'vi'
  const queryText = query || userMessage || ''
  const userId = String(user?._id || user?.id || '')
  const conversationId = conversationContext?.conversationId || conversationContext?.sessionId || 'default'

  const memory = inputMemory || agentMemory.get(userId, conversationId)
  const n = normalizeQuery(queryText)

  const introPattern = /\b(gympro|ban la ai|who are you|gioi thieu|introduce)\b/
  if (introPattern.test(n)) {
    agentMemory.update(userId, conversationId, { lastSubject: 'general', lastAction: 'introduce', lastQuery: queryText, lastAnswer: makeIntroduction(lang) })
    const audit = buildAudit({ source: 'local_fallback', usedTools: [], aiUsed: false, startedAt })
    return withAudit({
      answer: makeIntroduction(lang),
      usedTools: [],
      responseType: 'text_advice',
      payload: { type: 'text_advice' },
      suggestions: lang === 'en' ? ['Show plans', 'Find a PT', 'Check my progress'] : ['Xem gói tập', 'Tìm PT', 'Kiểm tra tiến độ'],
      memoryUpdate: { lastSubject: 'general', lastAction: 'introduce' },
      confidence: 1,
      shouldUseLegacyRouter: false,
    }, audit)
  }

  perfStart('gympro_optimizer')
  const optimizer = optimizeQuery({ query: queryText, memory })
  perfEnd('gympro_optimizer')
  if (optimizer.directTool && optimizer.shouldUseAI === false) {
    const toolResults = {}
    try {
      perfStart('gympro_direct_tool')
      const result = await runGymTool(optimizer.directTool, optimizer.args || {}, { userId })
      perfEnd('gympro_direct_tool')
      toolResults[optimizer.directTool] = result
      const direct = buildDirectToolAnswer({ query: queryText, optimizer, toolResults, memory, lang })
      if (direct?.answer) {
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
        const audit = buildAudit({ source: optimizer.reason === 'memory_entity_follow_up' ? 'memory' : 'tool', optimizer, usedTools: [optimizer.directTool], aiUsed: false, startedAt })
        return withAudit({
          answer: direct.answer,
          usedTools: [optimizer.directTool],
          responseType: direct.responseType,
          payload: direct.payload,
          suggestions: lang === 'en' ? ['Show details', 'Compare options', 'Recommend for me'] : ['Xem chi tiết', 'So sánh lựa chọn', 'Gợi ý cho tôi'],
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
  console.log('[GYM_PRO_AGENT] analysis:', queryText, '→', analysis.subject, '/', analysis.action, 'confidence:', analysis.confidence, 'source:', analysis.source, 'tools:', analysis.needsTools)

  if (!analysis.subject && !analysis.isFollowUp) {
    const audit = buildAudit({ source: 'ai_reasoning', optimizer, usedTools: [], aiUsed: true, startedAt })
    return withAudit({
      answer: null, usedTools: [], responseType: null, payload: null, suggestions: [],
      memoryUpdate: null, confidence: analysis.confidence, shouldUseLegacyRouter: true,
    }, audit)
  }

  const toolResults = {}
  let hasError = false
  const context = { userId }

  if (analysis.needsTools.length > 0) {
    perfStart('gympro_tools')
    for (const toolName of analysis.needsTools) {
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
    : (findPlanByName(analysis.entities?.mentionedPlan, plans) || extractMentionedPlan(queryText, plans))

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
      suggestions: lang === 'en' ? ['Show all plans', 'Recommend for me'] : ['Xem tất cả gói', 'Gợi ý cho tôi'],
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
      responseType: 'text_advice',
      payload: { type: 'text_advice', plans },
      suggestions: lang === 'en' ? ['Which plan fits my budget?', 'Show all plans'] : ['Gói nào phù hợp ngân sách?', 'Xem tất cả gói'],
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
      if (!selectedPT) {
        // Fallback to first PT
        selectedPT = ptItems[0]
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
      suggestions: lang === 'en' ? ['Book a session', 'Compare plans', 'Check my progress'] : ['Đặt lịch PT', 'So sánh gói tập', 'Kiểm tra tiến độ'],
      memoryUpdate: { lastSubject: 'pt', lastAction: analysis.action, lastMentionedPTName: selectedPT?.name || null },
      confidence: analysis.confidence,
      shouldUseLegacyRouter: false,
    }, audit)
  }

  const hasData = hasAnyToolData(Object.values(toolResults))
  if (!hasData && !hasError) {
    const audit = buildAudit({ source: 'tool', optimizer, usedTools: analysis.needsTools, aiUsed: analysis.source === 'llm', startedAt })
    return withAudit({
      answer: null, usedTools: analysis.needsTools, responseType: null, payload: null, suggestions: [],
      memoryUpdate: null, confidence: analysis.confidence * 0.5, shouldUseLegacyRouter: true,
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
  return withAudit({
    answer,
    usedTools: analysis.needsTools,
    responseType: analysis.subject === 'plan' && analysis.action === 'list' ? 'plan_list' : 'text_advice',
    payload: { type: analysis.subject === 'plan' && analysis.action === 'list' ? 'plan_list' : 'text_advice', plans, data: toolResults },
    suggestions: lang === 'en'
      ? ['Compare plans', 'Find a PT', 'Check my progress']
      : ['So sánh gói tập', 'Tìm PT', 'Kiểm tra tiến độ'],
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
