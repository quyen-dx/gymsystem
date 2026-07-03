import { SEPARATOR, bulletList, compactList, formatDaysText, formatEmailText, formatPriceText, safeText, titleText } from './render/renderTextUtils.js'

// Natural Response Builder
// Generates conversational responses from structured data.
// Handles empty data gracefully, provides follow-up-friendly answers.

const normalizeLanguage = (language) => language === 'en' ? 'en' : 'vi'
const normalizeText = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'd')
  .toLowerCase()
  .trim()

const planName = (plan, lang = 'vi') => {
  if (!plan) return ''
  return lang === 'en'
    ? (plan.nameEn || plan.nameVi || plan.name || '')
    : (plan.nameVi || plan.nameEn || plan.name || '')
}

const fmtPrice = (price, lang = 'vi') => {
  return formatPriceText(price, lang)
}

const fmtDays = (days, lang = 'vi') => {
  return formatDaysText(days, lang)
}

const greetTime = (lang = 'vi') => {
  const hour = new Date().getHours()
  if (lang === 'en') {
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }
  if (hour < 12) return 'Chào buổi sáng'
  if (hour < 18) return 'Chào buổi chiều'
  return 'Chào buổi tối'
}

export const buildPlanListResponse = ({ plans, lang = 'vi' }) => {
  if (!plans || plans.length === 0) {
    return lang === 'en'
      ? 'GymPro currently does not have membership plans available for display.'
      : 'Hiện tại GymPro chưa có gói tập nào để hiển thị.'
  }
  const total = plans.length
  const limit = 5
  const shown = plans.slice(0, limit)
  const header = lang === 'en'
    ? `GymPro currently has ${total} active membership plan(s). Here are the details:`
    : `GymPro hiện đang có ${total} gói tập cho bạn lựa chọn. Đây là thông tin chi tiết:`

  const lines = [header]

  shown.forEach((plan, i) => {
    const name = planName(plan, lang)
    const price = fmtPrice(plan.price, lang)
    const duration = fmtDays(plan.durationDays, lang)
    const features = (lang === 'en' ? (plan.featuresEn || plan.featuresVi || []) : (plan.featuresVi || plan.featuresEn || []))
      .filter(Boolean).map((f) => f.trim()).slice(0, 6)
    lines.push('', `${i + 1}. ${titleText(name)}`)
    if (price) lines.push('', `${lang === 'en' ? 'Price' : 'Giá'}: ${price}`)
    if (duration) lines.push(`${lang === 'en' ? 'Duration' : 'Thời hạn'}: ${duration}`)
    if (features.length > 0) lines.push('', lang === 'en' ? 'Benefits:' : 'Quyền lợi:', '', ...bulletList(features))
    if (i < shown.length - 1) lines.push('', SEPARATOR)
  })

  if (total > limit) {
    const remaining = total - limit
    lines.push('', lang === 'en' ? `... and ${remaining} more plan(s)` : `... và ${remaining} gói tập khác`)
  }

  lines.push('', lang === 'en' ? 'Which plan catches your eye? I can help you compare and pick the best fit.' : 'Bạn thấy gói nào ổn? Mình sẽ phân tích chi tiết và tư vấn gói phù hợp nhất với bạn.')
  return lines.join('\n')
}

export const buildPlanSpecializationOverviewResponse = ({ plans, lang = 'vi' }) => {
  if (!Array.isArray(plans) || plans.length === 0) {
    return lang === 'en'
      ? 'GymPro currently does not have membership plans available for display.'
      : 'Hiện tại GymPro chưa có gói tập nào để hiển thị.'
  }

  const allSpecializations = plans
    .flatMap((plan) => Array.isArray(plan?.applicableSpecializations) ? plan.applicableSpecializations : [])
    .map((name) => String(name || '').trim())
    .filter(Boolean)
  const uniqueSpecializations = [...new Set(allSpecializations)]

  if (uniqueSpecializations.length <= 1) {
    return buildPlanListResponse({ plans, lang })
  }

  const lines = []
  if (lang === 'en') {
    lines.push('GymPro currently has the following training specializations:')
    lines.push('', ...bulletList(uniqueSpecializations))
    lines.push('', 'Which specialization would you like to view first? I will show all plans in that specialization.')
  } else {
    lines.push('GymPro hiện có các chuyên môn tập luyện sau:')
    lines.push('', ...bulletList(uniqueSpecializations))
    lines.push('', 'Bạn muốn xem gói thuộc chuyên môn nào trước? Mình sẽ hiển thị đầy đủ các gói của chuyên môn đó.')
  }
  return lines.join('\n')
}

export const shouldUsePlanSpecializationOverview = ({ plans, query = '' }) => {
  if (!Array.isArray(plans) || plans.length === 0) return false
  const uniqueSpecializations = new Set(
    plans
      .flatMap((plan) => Array.isArray(plan?.applicableSpecializations) ? plan.applicableSpecializations : [])
      .map((name) => normalizeText(name))
      .filter(Boolean),
  )
  if (uniqueSpecializations.size < 2) return false

  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return false

  const isGenericPlanAsk = /\b(co|hien co|gom|danh sach|bao nhieu)\b/.test(normalizedQuery)
    && /\b(goi|goi tap|membership|plan)\b/.test(normalizedQuery)
    && !/\b(gia|re|dat|so sanh|compare|chi tiet|detail|vip|pro|basic|renew|gia han)\b/.test(normalizedQuery)
  const isSuggestWhichPlan = /\b(nen chon goi nao|chon goi nao|goi nao phu hop|which plan)\b/.test(normalizedQuery)

  return isGenericPlanAsk || isSuggestWhichPlan
}

export const buildPlanRecommendResponse = ({ plan, reason, alternatives, userProfile, lang = 'vi' }) => {
  const name = planName(plan, lang)
  if (!name) {
    return lang === 'en'
      ? 'Based on your needs, I think you should check out our plans to find the best fit.'
      : 'Dựa trên nhu cầu của bạn, mình nghĩ bạn nên xem qua các gói tập để chọn gói phù hợp nhất.'
  }
  const price = fmtPrice(plan.price, lang)
  const duration = fmtDays(plan.durationDays, lang)
  const features = (lang === 'en' ? (plan.featuresEn || plan.featuresVi || []) : (plan.featuresVi || plan.featuresEn || []))
    .filter(Boolean).map((f) => f.trim()).slice(0, 6)

  const lines = []
  lines.push(lang === 'en' ? `I recommend the **${name}** plan for you.` : `Mình gợi ý gói **${name}** cho bạn.`)
  if (reason) lines.push('', lang === 'en' ? `Because: ${reason}` : `Vì: ${reason}`)
  lines.push('')
  if (price) lines.push(`${lang === 'en' ? 'Price' : 'Giá'}: ${price}`)
  if (duration) lines.push(`${lang === 'en' ? 'Duration' : 'Thời hạn'}: ${duration}`)
  if (features.length > 0) lines.push('', lang === 'en' ? 'Benefits:' : 'Quyền lợi:', '', ...bulletList(features))

  if (Array.isArray(alternatives) && alternatives.length > 0) {
    const alts = alternatives.slice(0, 2)
    lines.push('', lang === 'en' ? 'You might also consider:' : 'Ngoài ra bạn cũng có thể tham khảo:')
    alts.forEach((alt, i) => {
      const an = planName(alt, lang)
      const ap = fmtPrice(alt.price, lang)
      const ad = fmtDays(alt.durationDays, lang)
      lines.push(`${i + 1}. ${titleText(an)}`)
      if (ap) lines.push(`${lang === 'en' ? 'Price' : 'Giá'}: ${ap}`)
      if (ad) lines.push(`${lang === 'en' ? 'Duration' : 'Thời hạn'}: ${ad}`)
    })
  }

  lines.push('', lang === 'en' ? 'What do you think? I can also recommend a PT or products to go with it if you like.' : 'Bạn thấy sao? Nếu cần, mình có thể gợi ý thêm PT hoặc sản phẩm đi kèm phù hợp.')
  return lines.join('\n')
}

export const buildWorkoutAdviceResponse = ({ plan, stats, lang = 'vi' }) => {
  if (lang === 'en') {
    let text = 'Here is what I can see from your training:'
    if (stats) {
      text += `\n\nYou have completed **${stats.totalWorkouts || 0}** workouts recently.`
      if (stats.frequencyPerWeek) text += ` That works out to about **${stats.frequencyPerWeek} sessions** per week, which is a good baseline.`
      if (stats.currentStreak > 0) text += ` You are on a **${stats.currentStreak}-day streak** — keep it up!`
    }
    if (plan) {
      text += `\n\nIf you want a more structured routine, I can build a workout plan that matches your specific goals and schedule.`
    }
    text += '\n\nWould you like me to create a personalized workout plan for you?'
    return text
  }

  let text = 'Mình xem thử dữ liệu tập luyện của bạn nhé:'
  if (stats) {
    text += `\n\nBạn đã tập **${stats.totalWorkouts || 0}** buổi trong thời gian gần đây.`
    if (stats.frequencyPerWeek) text += ` Trung bình khoảng **${stats.frequencyPerWeek} buổi/tuần** — đó là một nền tảng tốt để phát triển.`
    if (stats.currentStreak > 0) text += ` Bạn đang duy trì chuỗi **${stats.currentStreak} ngày liên tiếp** — cố gắng giữ vững phong độ nhé!`
  }
  if (plan) {
    text += `\n\nNếu muốn có một giáo án cụ thể hơn, mình hoàn toàn có thể thiết kế lịch tập phù hợp với mục tiêu và lịch rảnh của bạn.`
  }
  text += '\n\nBạn muốn mình tạo giáo án tập luyện riêng cho bạn không?'
  return text
}

export const buildMembershipInfoResponse = ({ membership, lang = 'vi' }) => {
  if (!membership || (membership.hasOwnProperty('found') && !membership.found)) {
    return lang === 'en'
      ? 'You currently do not have an active membership. Would you like to see our available plans?'
      : 'Hiện tại bạn chưa có gói tập nào đang hoạt động. Bạn muốn xem qua các gói tập của GymPro không?'
  }
  const plan = membership
  const name = membership.planName || membership.planNameVi || membership.nameVi || membership.nameEn || membership.name || ''
  const days = membership.remainingDays ?? 0
  const price = membership.planPrice ? fmtPrice(membership.planPrice, lang) : ''
  const duration = membership.planDurationDays ? fmtDays(membership.planDurationDays, lang) : ''
  const features = Array.isArray(membership.planFeaturesVi || membership.planFeaturesEn)
    ? (lang === 'en' ? (membership.planFeaturesEn || membership.planFeaturesVi) : (membership.planFeaturesVi || membership.planFeaturesEn))
    : []
  const topFeatures = (features || []).filter(Boolean).slice(0, 6)

  const lines = []
  if (lang === 'en') {
    lines.push(`You are currently on the **${name}** plan.`)
    if (price) lines.push(`Price: ${price}`)
    if (duration) lines.push(`Duration: ${duration}`)
    if (topFeatures.length > 0) lines.push('', 'Benefits:', '', ...bulletList(topFeatures))
    if (days > 0) lines.push(``)
    lines.push(`You have **${days} days** remaining on your plan.`)
    if (days <= 30 && days > 0) lines.push('It is almost time to renew — you can do that in the My Membership section.')
    else if (days > 30) lines.push('No rush — you still have plenty of time before it expires.')
    else lines.push('Your membership has ended. Would you like to renew?')
    return lines.join('\n')
  }

  lines.push(`Bạn đang sử dụng gói **${name}**.`)
  if (price) lines.push(`Giá: ${price}`)
  if (duration) lines.push(`Thời hạn: ${duration}`)
  if (topFeatures.length > 0) lines.push('', 'Quyền lợi:', '', ...bulletList(topFeatures))
  if (days > 0) {
    lines.push(`Gói tập của bạn còn **${days} ngày** sử dụng.`)
    if (days <= 30) lines.push('Sắp hết hạn rồi, bạn có thể gia hạn trong mục Gói tập của tôi bất cứ lúc nào.')
    else lines.push('Còn khá dài, bạn chưa cần gia hạn vội đâu.')
  } else {
    lines.push('Gói của bạn đã hết hạn. Bạn muốn gia hạn không?')
  }
  return lines.join('\n')
}

export const buildCheckinSummaryResponse = ({ stats, lang = 'vi' }) => {
  const count = stats?.thisMonth ?? stats?.last30Days ?? stats?.checkinCount ?? stats?.total ?? 0
  if (lang === 'en') {
    if (count === 0) return 'You have not checked in recently. Time to hit the gym!'
    let text = `You have checked in **${count} times** in the last 30 days.`
    if (stats?.streak) text += ` Current streak: **${stats.streak} days**.`
    if (count >= 12) text += ' That is great consistency — keep it going!'
    else if (count >= 6) text += ' Solid effort, but try bumping up your frequency a bit to see faster progress.'
    else text += ' Try to come more regularly — consistency is the real secret to getting results!'
    return text
  }
  if (count === 0) return 'Bạn chưa điểm danh gần đây. Ghé phòng tập ngay thôi, đừng để đứt mạch tập luyện nhé!'
  let text = `Bạn đã điểm danh **${count} lần** trong 30 ngày qua.`
  if (stats?.streak) text += ` Chuỗi hiện tại: **${stats.streak} ngày** — cố gắng duy trì nhé!`
  if (count >= 12) text += ' Tần suất rất tốt, tiếp tục phát huy!'
  else if (count >= 6) text += ' Cũng khá ổn rồi, nhưng nếu tăng thêm một chút nữa thì kết quả sẽ rõ rệt hơn đấy.'
  else text += ' Hãy cố gắng đến phòng thường xuyên hơn nhé — tập đều đặn mới thấy được sự thay đổi!'
  return text
}

export const buildPtListResponse = ({ pts, lang = 'vi' }) => {
  if (!pts || pts.length === 0) {
    return lang === 'en'
      ? 'There are no trainers available at the moment. Please check back later.'
      : 'Hiện tại chưa có PT nào khả dụng. Bạn quay lại sau nhé.'
  }
  const getSpecialties = (pt) => Array.isArray(pt?.specialties)
    ? pt.specialties.map((item) => String(item || '').trim()).filter(Boolean)
    : String(pt?.specialty || pt?.specialties || '').split(',').map((item) => item.trim()).filter(Boolean)

  const formatExperience = (pt) => {
    const years = Number(pt?.experienceYears || 0)
    if (!years) return ''
    return lang === 'en' ? `${years} year(s)` : `${years} năm`
  }

  const total = pts.length
  const limit = 5
  const shown = pts.slice(0, limit)

  const header = lang === 'en'
    ? `We have ${total} experienced trainer(s) ready to help you. Here is who we have:`
    : `GymPro đang có ${total} huấn luyện viên giàu kinh nghiệm. Đây là danh sách:`

  const lines = [header]

  shown.forEach((pt, index) => {
    const specialties = getSpecialties(pt)
    const email = String(pt.email || '').trim()
    const phone = String(pt.phone || '').trim()
    const schedule = String(pt.schedule || '').trim()

    lines.push('', `${index + 1}. ${titleText(pt.name || 'PT')}`)

    if (specialties.length > 0) {
      lines.push('', lang === 'en' ? 'Expertise:' : 'Chuyên môn:', compactList(specialties))
    }

    const emailLink = formatEmailText(email)
    if (phone || emailLink) {
      lines.push('', lang === 'en' ? 'Contact:' : 'Liên hệ:')
      if (phone) lines.push(`${lang === 'en' ? 'Phone' : 'SĐT'}: ${phone}`)
      if (emailLink) lines.push(`Email: ${emailLink}`)
    }

    if (schedule) lines.push(`${lang === 'en' ? 'Schedule:' : 'Lịch:'} ${schedule}`)

    if (index < shown.length - 1) lines.push('', SEPARATOR)
  })

  if (total > limit) {
    const remaining = total - limit
    lines.push('', lang === 'en' ? `... and ${remaining} more trainer(s)` : `... và ${remaining} PT khác nữa`)
  }

  lines.push('', lang === 'en' ? 'Would you like to know more about any of them or book a session?' : 'Bạn muốn tìm hiểu thêm về PT nào không? Mình sẽ giúp bạn đặt lịch nếu cần.')

  return lines.join('\n')
}

export const buildEmptyDataResponse = ({ subject, hasData, lang = 'vi' }) => {
  if (hasData) return null

  if (lang === 'en') {
    const suggestions = {
      plan: 'Would you like me to show you our available membership plans?',
      workout: 'I do not have workout data yet. Are you new to GymPro? I can help you get started.',
      checkin: 'There is no check-in data available. Try checking in on your next visit!',
      health: 'No health metrics recorded yet. Would you like to log your weight or measurements?',
      pt: 'I do not have trainer information right now. Maybe ask about plan recommendations?',
      booking: 'You have no upcoming bookings. Would you like to book a PT session?',
      shop: 'No product data available. Please ask again later.',
    }
    return suggestions[subject] || 'I do not have enough data to answer that yet.'
  }

  const suggestions = {
    plan: 'Hiện mình chưa có thông tin gói tập. Bạn muốn mình xem thử các gói tập của GymPro không?',
    workout: 'Mình chưa có dữ liệu tập luyện của bạn. Bạn mới bắt đầu tập GymPro à? Mình có thể giúp bạn lên lịch tập thử.',
    checkin: 'Chưa có dữ liệu điểm danh nào cả. Lần tới tới phòng, bạn thử điểm danh nhé — mình sẽ theo dõi tiến độ giúp bạn.',
    health: 'Mình chưa thấy chỉ số sức khỏe nào. Bạn muốn ghi lại cân nặng hoặc số đo để mình theo dõi giúp không?',
    pt: 'Hiện tại mình chưa có thông tin PT. Bạn muốn xem gợi ý gói tập hoặc mình giới thiệu PT phù hợp không?',
    booking: 'Bạn chưa có lịch đặt nào. Cần mình giúp đặt lịch với PT không?',
    shop: 'Mình chưa có dữ liệu sản phẩm. Bạn thử hỏi lại sau nhé, hoặc hỏi về gói tập — mình sẵn sàng tư vấn!',
  }
  return suggestions[subject] || 'Mình chưa có dữ liệu để trả lời câu hỏi này. Bạn muốn hỏi về gói tập, PT hay lịch tập không?'
}

export const makeIntroduction = (lang = 'vi') => {
  if (lang === 'en') {
    return 'Hey there! I am GymPro AI — your personal fitness assistant.\n\nI can help you with:\n• Membership plans and pricing\n• PT booking and recommendations\n• Workout analysis and plans\n• Health tracking\n• Product recommendations\n\nWhat can I help you with today?'
  }
  return 'Chào bạn! Mình là GymPro AI — trợ lý tập luyện cá nhân của bạn.\n\nMình có thể giúp bạn:\n• Tư vấn gói tập và giá\n• Đặt lịch và gợi ý PT\n• Phân tích tập luyện và tạo giáo án\n• Theo dõi sức khỏe\n• Gợi ý sản phẩm\n\nBạn cần mình hỗ trợ gì hôm nay?'
}
