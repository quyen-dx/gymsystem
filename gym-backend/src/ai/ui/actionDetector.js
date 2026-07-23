/**
 * Single source of truth: valid member routes from App.tsx.
 * Every action route MUST exist in this set or it is discarded.
 */
const VALID_MEMBER_ROUTES = new Set([
  '/account/profile',
  '/',
  '/dashboard',
  '/deposit',
  '/checkout',
  '/orders',
  '/track/:id',
  '/store',
  '/store/:storeId',
  '/plans',
  '/my-membership',
  '/my-membership/cancel-request',
  '/my-membership/renew',
  '/cart',
  '/product/:id',
  '/booking',
  '/booking/:ptId',
  '/workout',
  '/checkin',
  '/checkin/scan',
  '/checkin/sessions',
  '/notifications',
  '/feedback',
  '/my-feedback',
  '/my-activity',
  '/help',
  '/policies',
])

/**
 * Feature → valid member route.
 * All routes validated against VALID_MEMBER_ROUTES.
 */
const FEATURE_ROUTES = {
  deposit:     { route: '/deposit',        icon: 'wallet',    label: 'Nạp tiền' },
  plans:       { route: '/plans',           icon: 'document',  label: 'Xem gói tập' },
  membership:  { route: '/my-membership',   icon: 'id-card',   label: 'Hội viên của tôi' },
  booking:     { route: '/booking',         icon: 'calendar',  label: 'Đặt lịch tập' },
  store:       { route: '/store',           icon: 'shop',      label: 'Cửa hàng' },
  notifications:{ route: '/notifications',  icon: 'bell',      label: 'Thông báo' },
  workout:     { route: '/workout',         icon: 'dumbbell',  label: 'Kế hoạch tập' },
  help:        { route: '/help',            icon: 'info',      label: 'Trợ giúp' },
  policies:    { route: '/policies',        icon: 'shield',    label: 'Chính sách' },
  orders:      { route: '/orders',          icon: 'package',   label: 'Đơn hàng' },
  cart:        { route: '/cart',            icon: 'cart',      label: 'Giỏ hàng' },
  activity:    { route: '/my-activity',     icon: 'chart',     label: 'Hoạt động' },
  feedback:    { route: '/feedback',        icon: 'message',   label: 'Phản hồi' },
  profile:     { route: '/account/profile', icon: 'user',      label: 'Tài khoản' },
  dashboard:   { route: '/dashboard',       icon: 'home',      label: 'Bảng tin' },
  checkin:     { route: '/checkin',         icon: 'scan',      label: 'Check-in' },
}

// --- self-check: all routes must exist in VALID_MEMBER_ROUTES ---
for (const [key, entry] of Object.entries(FEATURE_ROUTES)) {
  if (!VALID_MEMBER_ROUTES.has(entry.route)) {
    console.error(`[actionDetector] INVALID route for "${key}": "${entry.route}" is NOT in App.tsx member routes.`)
  }
}

const KEYWORD_TRIGGERS = {
  deposit:        ['ví', 'số dư', 'nạp tiền', 'wallet', 'nạp', 'thanh toán', 'deposit'],
  plans:          ['gói tập', 'đăng ký gói', 'plans', 'gói', 'plan', 'loại gói'],
  membership:     ['hội viên', 'gia hạn', 'membership', 'thẻ hội viên', 'thẻ thành viên'],
  booking:        ['đặt lịch', 'đặt lịch tập', 'booking', 'lịch tập', 'đăng ký buổi tập', 'lịch pt'],
  store:          ['cửa hàng', 'mua', 'sản phẩm', 'shop', 'thực phẩm bổ sung', 'store'],
  notifications:  ['thông báo', 'notifications', 'tin nhắn', 'notification'],
  workout:        ['kế hoạch tập', 'workout', 'bài tập', 'luyện tập', 'chương trình tập'],
  help:           ['trợ giúp', 'help', 'hỗ trợ', 'hướng dẫn', 'faq'],
  policies:       ['chính sách', 'policies', 'điều khoản', 'quy định', 'policy'],
  orders:         ['đơn hàng', 'orders', 'lịch sử mua', 'theo dõi đơn'],
  cart:           ['giỏ hàng', 'cart', 'thanh toán giỏ'],
  activity:       ['hoạt động', 'activity', 'lịch sử tập', 'lịch sử hoạt động'],
  feedback:       ['phản hồi', 'feedback', 'góp ý', 'đánh giá'],
  profile:        ['tài khoản', 'profile', 'thông tin cá nhân', 'account'],
  dashboard:      ['bảng tin', 'dashboard', 'tổng quan'],
  checkin:        ['check-in', 'checkin', 'điểm danh', 'quét mã'],
}

export function detectActions(toolResult, llmText) {
  const triggered = new Set()

  // From tool result: only high-confidence signals
  if (toolResult) {
    const hasBalance = toolResult.balance !== undefined && !toolResult.error
    const hasMembership = toolResult.currentMembership || toolResult.statusType || toolResult.planName
    const hasBookings = toolResult.bookings && !toolResult.error
    const hasNotificationCount = toolResult.count !== undefined && !toolResult.error && !toolResult.bookings

    if (hasBalance) triggered.add('deposit')
    if (hasMembership) triggered.add('membership')
    if (hasBookings) triggered.add('booking')
    if (hasNotificationCount) triggered.add('notifications')
  }

  // From LLM text keywords
  if (llmText && typeof llmText === 'string') {
    const lower = llmText.toLowerCase()
    for (const [key, keywords] of Object.entries(KEYWORD_TRIGGERS)) {
      if (triggered.has(key)) continue
      if (keywords.some(kw => lower.includes(kw))) {
        triggered.add(key)
      }
    }
  }

  const actions = []
  for (const key of triggered) {
    const entry = FEATURE_ROUTES[key]
    if (!entry) continue

    // Validate route exists in member routes
    if (!VALID_MEMBER_ROUTES.has(entry.route)) {
      console.warn(`[actionDetector] Discarding action "${key}": route "${entry.route}" not in App.tsx member routes`)
      continue
    }

    actions.push({
      label: entry.label,
      route: entry.route,
      icon: entry.icon,
      variant: 'secondary',
    })
  }

  return actions
}
