import { SEPARATOR, bulletList, formatDaysText, formatPriceText, safeText, titleText } from '../render/renderTextUtils.js'

export const formatPlanCatalogText = ({ intro, items = [], plans = [], includeFeatures = true, lang = 'vi', getPlanName }) => {
  const sourceItems = Array.isArray(items) && items.length > 0 ? items : plans
  const list = (Array.isArray(sourceItems) ? sourceItems : []).filter(Boolean)
  const emptyLabel = lang === 'en' ? 'Not updated' : 'Chưa cập nhật'
  const labels = lang === 'en'
    ? { plan: 'Plan', price: 'Price', duration: 'Duration', benefits: 'Benefits', days: 'days' }
    : { plan: 'Tên gói', price: 'Giá', duration: 'Thời hạn', benefits: 'Quyền lợi', days: 'ngày' }
  const formatPrice = (value) => formatPriceText(value, lang, emptyLabel)
  const formatDuration = (value) => formatDaysText(value, lang, emptyLabel)
  const formatBenefitsInline = (plan) => {
    if (!includeFeatures) return ''
    const features = (lang === 'en'
      ? (plan.featuresEn || plan.featuresVi || [])
      : (plan.featuresVi || plan.featuresEn || []))
      .filter((feature) => typeof feature === 'string' && feature.trim())
      .map((feature) => feature.trim())
      .slice(0, 6)
    const label = labels.benefits
    if (features.length === 0) return [label + ':', '', `• ${emptyLabel}`]
    return [label + ':', '', ...bulletList(features)]
  }

  const total = list.length
  const limit = 5
  const shown = list.slice(0, limit)

  const header = intro || (lang === 'en'
    ? `GymPro currently has ${total} active membership plan(s):`
    : `GymPro hiện có ${total} gói tập đang hoạt động:`)

  const lines = [header]

  shown.forEach((plan, idx) => {
    const name = safeText(getPlanName(plan, lang), emptyLabel)
    const priceText = formatPrice(plan.price)
    const durationText = formatDuration(plan.durationDays)
    const benefitsInline = formatBenefitsInline(plan)

    // Line 1: numbered name
    lines.push('', `${idx + 1}. ${titleText(name)}`)
    lines.push('', `${labels.price}: ${priceText}`)
    lines.push(`${labels.duration}: ${durationText}`)
    if (benefitsInline) lines.push('', ...benefitsInline)
    // Separator
    if (idx < shown.length - 1) lines.push('', SEPARATOR)
  })

  if (total > limit) {
    const remaining = total - limit
    lines.push('', lang === 'en' ? `... and ${remaining} more plan(s)` : `... và ${remaining} gói khác`)
  }

  return lines.join('\n').trim()
}

export const buildTextOnlyPlanPayload = ({ answer, suggestionsIntent = 'membership_info', lang = 'vi', getDomainSuggestions }) => ({
  type: 'text_advice',
  answer,
  recommendedPlan: null,
  plans: [],
  cards: [],
  planPayload: null,
  suggestions: getDomainSuggestions(suggestionsIntent, lang),
})

export const buildPlanDetailPayload = ({ plan, query, lang = 'vi', getPlanName, getDomainSuggestions }) => {
  const pName = getPlanName(plan, lang)
  const features = lang === 'en' ? (plan.featuresEn || plan.featuresVi || []) : (plan.featuresVi || plan.featuresEn || [])
  const price = formatPriceText(plan.price, lang, lang === 'en' ? 'Not updated' : 'Chưa cập nhật')
  const duration = formatDaysText(plan.durationDays, lang, lang === 'en' ? 'Not updated' : 'Chưa cập nhật')
  const description = safeText(lang === 'en' ? (plan.descriptionEn || plan.descriptionVi) : (plan.descriptionVi || plan.descriptionEn))
  const lines = [
    titleText(pName),
    '',
    `${lang === 'en' ? 'Price' : 'Giá'}: ${price}`,
    '',
    `${lang === 'en' ? 'Duration' : 'Thời hạn'}: ${duration}`,
  ]
  if (features.length) lines.push('', lang === 'en' ? 'Benefits:' : 'Quyền lợi:', '', ...bulletList(features.slice(0, 6)))
  if (description) lines.push('', lang === 'en' ? 'Description:' : 'Mô tả:', '', description)
  return {
    type: 'plan_detail',
    answer: lines.join('\n'),
    recommendedPlan: null,
    plans: [],
    cards: [plan],
    planPayload: { type: 'plan_detail', plan },
    suggestions: getDomainSuggestions('membership_info', lang),
  }
}

export const buildPlanListAnswer = ({ plans, lang = 'vi', getPlanName, getDomainSuggestions, intro, items, includeFeatures = true }) => (
  buildTextOnlyPlanPayload({
    answer: formatPlanCatalogText({ intro, items, plans, includeFeatures, lang, getPlanName }),
    lang,
    getDomainSuggestions,
  })
)

export const buildPlanInfoDirectAnswer = ({ query, plans, language, targetBenefit = '', deps }) => {
  const {
    normalizeLanguage,
    normalizeForIntent,
    getDomainSuggestions,
    getPlanName,
    findPlanMentionedInQuery,
    asksPlanBenefitQuestion,
    extractAskedPlanBenefit,
    benefitExistsInFeatures,
  } = deps
  const lang = normalizeLanguage(language)
  const normalized = normalizeForIntent(query)
  if (!Array.isArray(plans) || plans.length === 0) {
    return {
      type: 'text_advice',
      answer: lang === 'en'
        ? 'GymPro currently has no data for this.'
        : 'Hiện GymPro chưa có dữ liệu này.',
      recommendedPlan: null,
      plans: [],
      cards: [],
      planPayload: null,
      suggestions: getDomainSuggestions('membership_info', lang),
    }
  }
  const makeCatalogText = ({ intro, items = plans, includeFeatures = true } = {}) => formatPlanCatalogText({
    intro,
    items,
    plans,
    includeFeatures,
    lang,
    getPlanName,
  })
  const makeTextOnlyPlanPayload = (answer, suggestionsIntent = 'membership_info') => buildTextOnlyPlanPayload({
    answer,
    suggestionsIntent,
    lang,
    getDomainSuggestions,
  })
  const buildPlanClarificationText = () => {
    const names = plans
      .map((plan) => safeText(getPlanName(plan, lang)))
      .filter(Boolean)
    if (names.length === 0) {
      return lang === 'en'
        ? 'Which plan would you like to check?'
        : 'Bạn muốn hỏi về gói nào?'
    }
    return lang === 'en'
      ? `Which plan would you like to check: ${names.join(', ')}?`
      : `Bạn muốn xem gói nào: ${names.join(', ')}?`
  }
  const asksPlanPrice = /\b(gia|bao nhieu tien|price|cost|how much)\b/.test(normalized)
  const asksCheapest = /\b(re nhat|thap nhat|it tien nhat|cheapest|lowest|least expensive)\b/.test(normalized)
  const asksMostExpensive = /\b(dat nhat|cao nhat|expensive|highest)\b/.test(normalized)
  const asksPopular = /\b(pho bien|popular|ban chay|best seller|nhieu nguoi)\b/.test(normalized)
  const asksStudent = /\b(sinh vien|student)\b/.test(normalized)
  const asksPlanDetail = /\b(chi tiet|thong tin|quyen loi|benefit|benefits|detail|details|include|included|co gi)\b/.test(normalized)
  const isListQuery = (() => {
    if (/\b(how many|list|all|tat ca|co may|co bao nhieu|danh sach|liet ke|cac|xem|cho xem|hien thi|show|view)\b/.test(normalized)
      && !asksPlanDetail) return true
    if (/\b(goi tap|membership|goi nao)\b/.test(normalized) && !asksPlanDetail) return true
    return false
  })()
  if (isListQuery) {
    return makeTextOnlyPlanPayload(makeCatalogText({
      intro: lang === 'en'
        ? `GymPro currently has ${plans.length} active membership plan(s):`
        : `GymPro hiện có ${plans.length} gói tập đang hoạt động:`,
    }))
  }
  const isGeneralBenefitQuery = /\b(co .* khong)\b/.test(normalized) && !/\b(goi|goi tap|plan|membership|package)\b/.test(normalized)
  if (isGeneralBenefitQuery) {
    return {
      type: 'text_advice',
      answer: buildPlanClarificationText(),
      recommendedPlan: null,
      plans: [],
      cards: [],
      planPayload: null,
      suggestions: getDomainSuggestions('membership_info', lang),
    }
  }
  // Ưu tiên kiểm tra gói cụ thể trước (nếu query có tên gói)
  const mentionedPlan = findPlanMentionedInQuery(plans, query)
  if (mentionedPlan) {
    const planName = getPlanName(mentionedPlan, lang)
    if (asksPlanBenefitQuestion(query) || targetBenefit) {
      const normalized = normalizeForIntent(query)
      const features = lang === 'en' ? (mentionedPlan.featuresEn || mentionedPlan.featuresVi || []) : (mentionedPlan.featuresVi || mentionedPlan.featuresEn || [])
      const askedBenefit = targetBenefit || extractAskedPlanBenefit(query, lang)
      const asksPool = /\b(ho boi|hồ bơi|pool|xong hoi|xông hơi|sauna)\b/.test(normalized)
      if (asksPool) {
        const hasPoolBenefit = benefitExistsInFeatures(features, askedBenefit)
        return {
          type: 'text_advice',
          answer: hasPoolBenefit
            ? (lang === 'en'
              ? `Yes. GymPro data records a pool/sauna-related benefit for ${planName}.`
              : `Có. Dữ liệu GymPro ghi nhận quyền lợi hồ bơi/xông hơi trong ${planName}.`)
            : (lang === 'en'
              ? `GymPro data does not currently record a pool benefit for ${planName}.`
              : `Hiện dữ liệu GymPro chưa ghi nhận hồ bơi trong quyền lợi ${planName}.`),
          recommendedPlan: null,
          plans: [],
          cards: [],
          suggestions: getDomainSuggestions('membership_info', lang),
          lastBenefitLookup: {
            targetBenefit: askedBenefit,
            previousPlan: planName,
            intent: 'membership_benefit_lookup',
          },
        }
      }
      const hasAskedBenefit = askedBenefit !== (lang === 'en' ? 'that benefit' : 'quyền lợi đó')
        && benefitExistsInFeatures(features, askedBenefit)
      return {
        type: 'text_advice',
        answer: hasAskedBenefit
          ? (lang === 'en'
            ? `Yes. GymPro data records ${askedBenefit} in ${planName}.`
            : `Có. Dữ liệu GymPro ghi nhận ${askedBenefit} trong quyền lợi ${planName}.`)
          : askedBenefit
            ? (lang === 'en'
              ? `GymPro data does not currently record ${askedBenefit} in ${planName}.`
              : `Hiện dữ liệu GymPro chưa ghi nhận ${askedBenefit} trong quyền lợi ${planName}.`)
            : features.length
              ? (lang === 'en'
                ? `${planName} currently records these benefits: ${features.slice(0, 6).join(', ')}.`
                : `${planName} hiện ghi nhận các quyền lợi: ${features.slice(0, 6).join(', ')}.`)
              : (lang === 'en'
                ? `GymPro data does not currently record detailed benefits for ${planName}.`
                : `Hiện dữ liệu GymPro chưa ghi nhận quyền lợi chi tiết cho ${planName}.`),
        recommendedPlan: null,
        plans: [],
        cards: [],
        suggestions: getDomainSuggestions('membership_info', lang),
        lastBenefitLookup: {
          targetBenefit: askedBenefit,
          previousPlan: planName,
          intent: 'membership_benefit_lookup',
        },
      }
    }
    if (asksPlanPrice && !asksPlanDetail) {
      return makeTextOnlyPlanPayload(lang === 'en'
        ? `${planName} currently costs ${(mentionedPlan.price || 0).toLocaleString('en-US')}đ for ${mentionedPlan.durationDays || 0} days.`
        : `${planName} hiện có giá ${(mentionedPlan.price || 0).toLocaleString('vi-VN')}đ cho ${mentionedPlan.durationDays || 0} ngày.`)
    }
    return buildPlanDetailPayload({
      plan: mentionedPlan,
      query,
      lang,
      getPlanName,
      getDomainSuggestions,
    })
  }
  if (asksPlanBenefitQuestion(query)) {
    return {
      type: 'text_advice',
      answer: buildPlanClarificationText(),
      recommendedPlan: null,
      plans: [],
      cards: [],
      planPayload: null,
      suggestions: getDomainSuggestions('membership_info', lang),
    }
  }
  if (asksCheapest || asksMostExpensive || asksPopular || asksStudent || asksPlanPrice) {
    const sortedByPrice = [...plans].sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0))
    const selected = asksCheapest
      ? sortedByPrice.slice(0, 1)
      : asksMostExpensive
        ? sortedByPrice.slice(-1)
        : asksStudent
          ? plans.filter((plan) => /sinh vien|student/i.test([plan.nameVi, plan.nameEn, plan.descriptionVi, plan.descriptionEn, ...(plan.featuresVi || []), ...(plan.featuresEn || [])].filter(Boolean).join(' ')))
          : asksPopular
            ? [...plans].sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0)).slice(0, Math.min(3, plans.length))
            : plans
    const list = selected.length > 0 ? selected : plans
    const intro = asksCheapest
      ? (lang === 'en' ? 'The lowest-priced active plan in GymPro is:' : 'Gói có giá thấp nhất đang hoạt động trong GymPro là:')
      : asksMostExpensive
        ? (lang === 'en' ? 'The highest-priced active plan in GymPro is:' : 'Gói có giá cao nhất đang hoạt động trong GymPro là:')
        : asksStudent
          ? (selected.length > 0
            ? (lang === 'en' ? 'GymPro has these student-related plan option(s):' : 'GymPro có các gói liên quan đến sinh viên sau:')
            : (lang === 'en' ? 'GymPro data does not currently record a dedicated student plan. Current active plans are:' : 'Dữ liệu GymPro hiện chưa ghi nhận gói sinh viên riêng. Các gói đang hoạt động là:'))
          : asksPopular
            ? (lang === 'en' ? 'GymPro can show these notable active plan option(s):' : 'GymPro có thể tham khảo các gói đang hoạt động nổi bật sau:')
            : (lang === 'en' ? `Prices for GymPro active plans:` : 'Giá các gói tập đang hoạt động của GymPro:')
    return makeTextOnlyPlanPayload(makeCatalogText({ intro, items: list, includeFeatures: true }))
  }
  return makeTextOnlyPlanPayload(makeCatalogText())
}
