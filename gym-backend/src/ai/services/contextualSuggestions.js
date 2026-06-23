const normalizeLanguage = (language) => language === 'en' ? 'en' : 'vi'

const normalizeText = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'd')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim()

const uniqueLimit = (items = [], query = '', limit = 4) => {
  const current = normalizeText(query)
  const seen = new Set()
  return items
    .filter((item) => typeof item === 'string' && item.trim())
    .map((item) => item.trim())
    .filter((item) => {
      const key = normalizeText(item)
      if (!key || key === current || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, limit)
}

const vi = {
  checkin: [
    'Tôi đã check-in bao nhiêu lần tuần này?',
    'Lần check-in gần nhất của tôi?',
    'Chuỗi điểm danh hiện tại là bao nhiêu ngày?',
    'Tôi đã tập bao nhiêu buổi tháng này?',
  ],
  checkinNoData: [
    'Cách check-in tại phòng gym?',
    'Tôi check-in hôm nay ở đâu?',
    'Làm sao để bắt đầu chuỗi điểm danh?',
    'Tôi nên đặt mục tiêu bao nhiêu buổi mỗi tuần?',
  ],
  membership: [
    'Gói tập của tôi còn bao nhiêu ngày?',
    'Khi nào gói tập hết hạn?',
    'Tôi có thể gia hạn gói tập không?',
    'Quyền lợi của gói hiện tại là gì?',
  ],
  membershipPlan: [
    'Gói này có phù hợp với mục tiêu của tôi không?',
    'So sánh gói này với các gói khác?',
    'Gói nào tiết kiệm nhất?',
    'Tôi đăng ký gói này như thế nào?',
  ],
  nutrition: [
    'Tôi cần bao nhiêu protein mỗi ngày?',
    'Thực đơn tăng cơ cho người mới?',
    'Tôi nên ăn trước khi tập gì?',
    'Tôi nên ăn sau khi tập gì?',
  ],
  nutritionFatLoss: [
    'Thực đơn giảm cân 1 ngày?',
    'Tôi nên ăn bao nhiêu calo để giảm mỡ?',
    'Trước khi tập nên ăn gì khi giảm cân?',
    'Tôi cần bao nhiêu protein khi giảm cân?',
  ],
  workout: [
    'Lên lịch tập 4 buổi mỗi tuần?',
    'Tôi nên tập gì hôm nay?',
    'Tôi nên tập cardio bao nhiêu buổi?',
    'Làm sao theo dõi tiến độ tập luyện?',
  ],
  progress: [
    'Cân nặng thay đổi trong 30 ngày qua?',
    'Tiến độ giảm mỡ hiện tại?',
    'Tôi có đang đạt mục tiêu không?',
    'Thống kê cơ thể mới nhất?',
  ],
  pt: [
    'PT nào phù hợp với mục tiêu của tôi?',
    'PT đó có lịch rảnh không?',
    'Tôi muốn đặt lịch PT thì làm sao?',
    'So sánh các PT hiện có?',
  ],
  booking: [
    'Tôi có lịch tập hôm nay không?',
    'Lịch chờ xác nhận ở đâu?',
    'Tôi muốn hủy lịch tập đã đặt?',
    'Buổi PT tiếp theo của tôi khi nào?',
  ],
  product: [
    'Sản phẩm nào hỗ trợ tăng cơ?',
    'Whey Protein giá bao nhiêu?',
    'Sản phẩm nào phù hợp giảm cân?',
    'Đơn hàng của tôi ở đâu?',
  ],
  policy: [
    'Có hoàn tiền không?',
    'Có thể hủy lịch không?',
    'Chính sách bảo mật ở đâu?',
    'Quy định thanh toán thế nào?',
  ],
  goal: [
    'Tôi nên đặt mục tiêu gì?',
    'Tôi muốn giảm mỡ thì bắt đầu thế nào?',
    'Tôi muốn tăng cơ thì cần làm gì?',
    'Làm sao theo dõi mục tiêu tập luyện?',
  ],
  account: [
    'Đổi mật khẩu ở đâu?',
    'Cập nhật hồ sơ cá nhân ở đâu?',
    'Quên mật khẩu thì làm thế nào?',
    'Đổi email ở đâu?',
  ],
  general: [
    'Tiến độ tập luyện của tôi thế nào?',
    'Gói tập của tôi còn bao nhiêu ngày?',
    'Tôi có lịch tập hôm nay không?',
    'Tôi nên tập gì hôm nay?',
  ],
}

const en = {
  checkin: ['How many times did I check in this week?', 'What was my latest check-in?', 'What is my current attendance streak?', 'How many sessions did I train this month?'],
  checkinNoData: ['How do I check in at the gym?', 'Where do I check in today?', 'How do I start an attendance streak?', 'How many sessions should I target each week?'],
  membership: ['How many days are left on my plan?', 'When does my plan expire?', 'Can I renew my plan?', 'What benefits does my current plan include?'],
  membershipPlan: ['Does this plan fit my goal?', 'Compare this plan with other plans?', 'Which plan is the most economical?', 'How do I register for this plan?'],
  nutrition: ['How much protein do I need per day?', 'Muscle-gain meal plan for beginners?', 'What should I eat before training?', 'What should I eat after training?'],
  nutritionFatLoss: ['Create a 1-day fat-loss meal plan?', 'How many calories should I eat to lose fat?', 'What should I eat before training for fat loss?', 'How much protein do I need while cutting?'],
  workout: ['Build a 4-day weekly workout plan?', 'What should I train today?', 'How many cardio sessions should I do?', 'How do I track training progress?'],
  progress: ['How did my weight change in the last 30 days?', 'What is my current fat-loss progress?', 'Am I on track with my goal?', 'Show my latest body stats?'],
  pt: ['Which PT fits my goal?', 'Does that PT have available slots?', 'How do I book a PT?', 'Compare available PTs?'],
  booking: ['Do I have a session today?', 'Where are pending bookings?', 'I want to cancel a booked session?', 'When is my next PT session?'],
  product: ['Which products support muscle gain?', 'How much is Whey Protein?', 'Which products fit fat loss?', 'Where is my order?'],
  policy: ['Is refund available?', 'Can I cancel a booking?', 'Where is the privacy policy?', 'What are the payment rules?'],
  goal: ['What goal should I set?', 'How should I start fat loss?', 'What should I do for muscle gain?', 'How do I track my training goal?'],
  account: ['Where do I change my password?', 'Where do I update my profile?', 'What if I forgot my password?', 'Where do I change my email?'],
  general: ['How is my training progress?', 'How many days are left on my plan?', 'Do I have a session today?', 'What should I train today?'],
}

const inferKey = ({ intent = '', subject = '', responseType = '', answer = '', toolData = {} }) => {
  const text = normalizeText([intent, subject, responseType, answer].join(' '))
  const checkinStats = toolData?.checkinStats || toolData?.checkin?.checkinStats || toolData?.checkin
  if (text.includes('checkin') || text.includes('diem danh') || text.includes('attendance')) {
    const total = Number(checkinStats?.totalFetched ?? checkinStats?.last30Days ?? checkinStats?.thisMonth ?? 0)
    return total > 0 || !/chua co du lieu|no .*data/.test(text) ? 'checkin' : 'checkinNoData'
  }
  if (text.includes('nutrition') || text.includes('an gi') || text.includes('protein') || text.includes('thuc don')) {
    return /giam mo|giam can|fat loss|lose fat/.test(text) ? 'nutritionFatLoss' : 'nutrition'
  }
  if (text.includes('membership') || text.includes('plan') || text.includes('goi')) {
    return /detail|list|recommend|compare|gia|quyen loi/.test(text) ? 'membershipPlan' : 'membership'
  }
  if (text.includes('progress') || text.includes('tien do') || text.includes('can nang') || text.includes('giam duoc')) return 'progress'
  if (text.includes('workout') || text.includes('tap luyen') || text.includes('bai tap')) return 'workout'
  if (text.includes('pt') || text.includes('trainer')) return 'pt'
  if (text.includes('booking') || text.includes('lich')) return 'booking'
  if (text.includes('product') || text.includes('shop') || text.includes('whey') || text.includes('san pham')) return 'product'
  if (text.includes('policy') || text.includes('faq') || text.includes('chinh sach')) return 'policy'
  if (text.includes('goal') || text.includes('muc tieu')) return 'goal'
  if (text.includes('account') || text.includes('profile') || text.includes('mat khau') || text.includes('email')) return 'account'
  return 'general'
}

export const buildContextualSuggestions = ({
  query = '',
  intent = '',
  subject = '',
  responseType = '',
  answer = '',
  toolData = {},
  payload = {},
  language = 'vi',
  limit = 4,
} = {}) => {
  const lang = normalizeLanguage(language)
  const set = lang === 'en' ? en : vi
  const key = inferKey({
    intent,
    subject,
    responseType,
    answer,
    toolData: {
      ...(toolData || {}),
      ...(payload?.data || {}),
      checkinStats: toolData?.checkinStats || payload?.checkinStats || payload?.data?.checkinStats,
    },
  })
  return uniqueLimit(set[key] || set.general, query, limit)
}

export const __contextualSuggestionsTestHooks = {
  normalizeText,
  inferKey,
}
