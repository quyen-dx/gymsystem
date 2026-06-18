import { SEPARATOR, bulletList, compactList, formatDaysText, formatEmailText, formatPriceText, safeText, titleText } from './render/renderTextUtils.js'

// Natural Response Builder
// Generates conversational responses from structured data.
// Handles empty data gracefully, provides follow-up-friendly answers.

const normalizeLanguage = (language) => language === 'en' ? 'en' : 'vi'

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
  const header = lang === 'en' ? 'Here are the current membership plans at GymPro:' : 'Đây là các gói tập hiện có tại GymPro:'

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
    lines.push('', lang === 'en' ? `... and ${remaining} more plan(s)` : `... và ${remaining} gói khác`)
  }

  lines.push('', lang === 'en' ? 'Which plan interests you? I can help you decide.' : 'Bạn muốn xem chi tiết gói nào? Mình sẽ phân tích giúp bạn.')
  return lines.join('\n')
}

export const buildPlanRecommendResponse = ({ plan, reason, alternatives, userProfile, lang = 'vi' }) => {
  const name = planName(plan, lang)
  if (!name) {
    return lang === 'en'
      ? 'Based on your needs, I recommend checking out our plans to find the best fit.'
      : 'Dựa trên nhu cầu của bạn, mình nghĩ bạn nên xem qua các gói tập để chọn gói phù hợp nhất.'
  }
  const price = fmtPrice(plan.price, lang)
  const duration = fmtDays(plan.durationDays, lang)
  const features = (lang === 'en' ? (plan.featuresEn || plan.featuresVi || []) : (plan.featuresVi || plan.featuresEn || []))
    .filter(Boolean).map((f) => f.trim()).slice(0, 6)

  const lines = []
  lines.push(titleText(name))
  if (price) lines.push('', `${lang === 'en' ? 'Price' : 'Giá'}: ${price}`)
  if (duration) lines.push(`${lang === 'en' ? 'Duration' : 'Thời hạn'}: ${duration}`)
  if (features.length > 0) lines.push('', lang === 'en' ? 'Benefits:' : 'Quyền lợi:', '', ...bulletList(features))
  if (reason) lines.push('', lang === 'en' ? `Why? ${reason}` : `Lý do: ${reason}`)

  if (Array.isArray(alternatives) && alternatives.length > 0) {
    const alts = alternatives.slice(0, 2)
    lines.push('', lang === 'en' ? 'Also consider:' : 'Ngoài ra bạn cũng có thể xem:')
    alts.forEach((alt, i) => {
      const an = planName(alt, lang)
      const ap = fmtPrice(alt.price, lang)
      const ad = fmtDays(alt.durationDays, lang)
      lines.push(`${i + 1}. ${titleText(an)}`)
      if (ap) lines.push(`${lang === 'en' ? 'Price' : 'Giá'}: ${ap}`)
      if (ad) lines.push(`${lang === 'en' ? 'Duration' : 'Thời hạn'}: ${ad}`)
    })
  }

  lines.push('', lang === 'en' ? 'What do you think? I can also recommend a PT or product to go with it.' : 'Bạn thấy sao? Mình có thể gợi ý thêm PT hoặc sản phẩm đi kèm nếu cần.')
  return lines.join('\n')
}

export const buildWorkoutAdviceResponse = ({ plan, stats, lang = 'vi' }) => {
  if (lang === 'en') {
    let text = 'Here is what I can tell about your training:'
    if (stats) {
      text += `\n\nYou have completed **${stats.totalWorkouts || 0}** workouts recently.`
      if (stats.frequencyPerWeek) text += ` That is about **${stats.frequencyPerWeek} sessions** per week.`
      if (stats.currentStreak > 0) text += ` You are on a **${stats.currentStreak}-day streak** — keep it up!`
    }
    if (plan) {
      text += `\n\nFor a structured plan, consider following a routine that matches your goal.`
    }
    text += '\n\nWould you like me to generate a personalized workout plan?'
    return text
  }

  let text = 'Dưới đây là những gì mình thấy từ quá trình tập của bạn:'
  if (stats) {
    text += `\n\nBạn đã tập **${stats.totalWorkouts || 0}** buổi gần đây.`
    if (stats.frequencyPerWeek) text += ` Trung bình **${stats.frequencyPerWeek} buổi/tuần**.`
    if (stats.currentStreak > 0) text += ` Bạn đang duy trì chuỗi **${stats.currentStreak} ngày liên tiếp** — cố gắng giữ nhé!`
  }
  if (plan) {
    text += `\n\nNếu muốn có giáo án cụ thể, mình có thể tạo một lịch tập phù hợp với mục tiêu của bạn.`
  }
  text += '\n\nBạn muốn mình tạo giáo án tập luyện riêng cho bạn không?'
  return text
}

export const buildMembershipInfoResponse = ({ membership, lang = 'vi' }) => {
  if (!membership || (membership.hasOwnProperty('found') && !membership.found)) {
    return lang === 'en'
      ? 'You currently do not have an active membership. Would you like to see our available plans?'
      : 'Hiện tại bạn chưa có gói tập nào đang hoạt động. Bạn muốn xem các gói tập của GymPro không?'
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
    if (days > 0) lines.push(`You have **${days} days** remaining.`)
    else lines.push('Your membership has ended. Would you like to renew?')
    return lines.join('\n')
  }

  lines.push(`Bạn đang sử dụng gói **${name}**.`)
  if (price) lines.push(`Giá: ${price}`)
  if (duration) lines.push(`Thời hạn: ${duration}`)
  if (topFeatures.length > 0) lines.push('', 'Quyền lợi:', '', ...bulletList(topFeatures))
  if (days > 0) lines.push(`Còn **${days} ngày** nữa là hết hạn.`)
  else lines.push('Gói của bạn đã hết hạn. Bạn muốn gia hạn không?')
  return lines.join('\n')
}

export const buildCheckinSummaryResponse = ({ stats, lang = 'vi' }) => {
  const count = stats?.thisMonth ?? stats?.last30Days ?? stats?.checkinCount ?? stats?.total ?? 0
  if (lang === 'en') {
    if (count === 0) return 'You have not checked in recently. Time to hit the gym!'
    let text = `You have checked in **${count} times** in the last 30 days.`
    if (stats?.streak) text += ` Current streak: **${stats.streak} days**.`
    if (count >= 12) text += ' Great consistency!'
    else if (count >= 6) text += ' Not bad, but try to increase your frequency.'
    else text += ' Try to come more regularly — consistency is key!'
    return text
  }
  if (count === 0) return 'Bạn chưa điểm danh gần đây. Đến phòng tập ngay thôi!'
  let text = `Bạn đã điểm danh **${count} lần** trong 30 ngày qua.`
  if (stats?.streak) text += ` Chuỗi hiện tại: **${stats.streak} ngày**.`
  if (count >= 12) text += ' Rất đều đặn! Tiếp tục phát huy nhé.'
  else if (count >= 6) text += ' Cũng khá ổn, nhưng hãy cố gắng tăng tần suất hơn.'
  else text += ' Hãy cố gắng đến phòng thường xuyên hơn nhé — chìa khóa là sự đều đặn!'
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
    ? `GymPro currently has ${total} active trainer(s):`
    : `GymPro hiện có ${total} huấn luyện viên đang hoạt động:`

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
    lines.push('', lang === 'en' ? `... and ${remaining} more trainer(s)` : `... và ${remaining} PT khác`)
  }

  lines.push('', lang === 'en' ? 'Which trainer would you like to view in detail or book with?' : 'Bạn muốn xem chi tiết PT nào?')

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
    plan: 'Bạn muốn mình cho xem các gói tập của GymPro không?',
    workout: 'Mình chưa có dữ liệu tập luyện của bạn. Bạn mới bắt đầu tập à? Mình có thể giúp bạn lên lịch.',
    checkin: 'Chưa có dữ liệu điểm danh. Hãy thử điểm danh ở phòng tập nhé!',
    health: 'Chưa có chỉ số sức khỏe nào. Bạn muốn ghi lại cân nặng hoặc số đo không?',
    pt: 'Mình chưa có thông tin PT. Bạn muốn xem gợi ý gói tập không?',
    booking: 'Bạn chưa có lịch đặt nào. Muốn đặt lịch với PT không?',
    shop: 'Chưa có dữ liệu sản phẩm. Bạn thử hỏi lại sau nhé.',
  }
  return suggestions[subject] || 'Mình chưa có dữ liệu để trả lời câu hỏi này.'
}

export const makeIntroduction = (lang = 'vi') => {
  if (lang === 'en') {
    return 'Hey there! I am GymPro AI — your personal fitness assistant.\n\nI can help you with:\n• Membership plans and pricing\n• PT booking and recommendations\n• Workout analysis and plans\n• Health tracking\n• Product recommendations\n\nWhat can I help you with today?'
  }
  return 'Chào bạn! Mình là GymPro AI — trợ lý tập luyện cá nhân của bạn.\n\nMình có thể giúp bạn:\n• Tư vấn gói tập và giá\n• Đặt lịch và gợi ý PT\n• Phân tích tập luyện và tạo giáo án\n• Theo dõi sức khỏe\n• Gợi ý sản phẩm\n\nBạn cần mình hỗ trợ gì hôm nay?'
}
