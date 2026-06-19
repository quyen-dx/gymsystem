import { AI_DOC_FILES, getRelevantAiDocs, logAiDocsLoaded } from './aiDocsService.js'
import { isFeatureEnabled } from '../../services/systemSettingsService.js'

const normalize = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'd')
  .toLowerCase()
  .replace(/[^a-z0-9\s/]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const uniq = (items = []) => [...new Set(items.filter(Boolean))]

export const ROLE_GROUPS = {
  member: ['member'],
  pt: ['pt'],
  staff: ['staff'],
  admin: ['admin', 'super_admin'],
  seller: ['seller'],
}

const roleAliases = {
  user: 'member',
  trainer: 'pt',
  super_admin: 'admin',
}

export const normalizeRole = (role = 'member') => {
  const normalized = normalize(role).replace(/\s+/g, '_')
  return roleAliases[normalized] || normalized || 'member'
}

const route = ({ label, path, subject, description, roles, requiresAuth = true, featureFlag = null, aliases = [] }) => ({
  label,
  path,
  subject,
  description,
  requiresAuth,
  allowedRoles: roles,
  featureFlag,
  aliases,
})

export const NAVIGATION_ROUTES = [
  route({ label: 'Trang chủ', path: '/', subject: 'home', description: 'Trang chính của GymPro', roles: ['member'], requiresAuth: false, aliases: ['trang chu', 'home'] }),
  route({ label: 'AI Chat', path: '/ai-chat', subject: 'ai', description: 'Trợ lý AI GymPro', roles: ['member'], aliases: ['ai chat', 'tro ly'] }),
  route({ label: 'Nạp tiền', path: '/deposit', subject: 'payment', description: 'Nạp tiền vào ví hoặc tài khoản', roles: ['member'], aliases: ['nap tien', 'vi', 'deposit'] }),
  route({ label: 'Cửa hàng', path: '/store', subject: 'product', description: 'Mua sản phẩm như whey và phụ kiện', roles: ['member'], requiresAuth: false, aliases: ['mua', 'whey', 'store', 'cua hang', 'san pham'] }),
  route({ label: 'Giỏ hàng', path: '/cart', subject: 'cart', description: 'Xem giỏ hàng', roles: ['member'], requiresAuth: false, aliases: ['gio hang', 'cart'] }),
  route({ label: 'Thanh toán', path: '/checkout', subject: 'payment', description: 'Thanh toán đơn hàng', roles: ['member'], aliases: ['checkout', 'thanh toan don hang'] }),
  route({ label: 'Đơn hàng', path: '/orders', subject: 'order', description: 'Xem lịch sử đơn hàng', roles: ['member'], aliases: ['don hang', 'order', 'lich su don hang'] }),
  route({ label: 'Theo dõi đơn hàng', path: '/track/:id', subject: 'order', description: 'Theo dõi trạng thái đơn hàng', roles: ['member'], requiresAuth: false, aliases: ['theo doi don', 'track'] }),
  route({ label: 'Đặt lịch PT', path: '/booking', subject: 'booking', description: 'Xem PT và đặt lịch tập', roles: ['member'], featureFlag: 'pt.memberBookingEnabled', aliases: ['dat lich', 'lich pt', 'xem lich', 'booking', 'pt'] }),
  route({ label: 'Sức khỏe', path: '/health', subject: 'health', description: 'Xem chỉ số và nhật ký sức khỏe', roles: ['member'], aliases: ['suc khoe', 'health', 'bmi', 'can nang'] }),
  route({ label: 'Lộ trình tập', path: '/workout', subject: 'workout', description: 'Xem lộ trình và bài tập', roles: ['member'], aliases: ['lo trinh', 'bai tap', 'workout'] }),
  route({ label: 'Check-in', path: '/checkin', subject: 'checkin', description: 'Check-in tại phòng gym', roles: ['member'], aliases: ['check in', 'checkin', 'diem danh', 'qr'] }),
  route({ label: 'Gửi phản hồi', path: '/feedback', subject: 'feedback', description: 'Gửi phản hồi cho GymPro', roles: ['member'], aliases: ['gui phan hoi', 'feedback'] }),
  route({ label: 'Phản hồi của tôi', path: '/my-feedback', subject: 'feedback', description: 'Xem phản hồi đã gửi', roles: ['member'], aliases: ['phan hoi cua toi', 'my feedback'] }),
  route({ label: 'Hoạt động của tôi', path: '/my-activity', subject: 'activity', description: 'Xem hoạt động gần đây', roles: ['member'], aliases: ['hoat dong', 'activity'] }),
  route({ label: 'Hồ sơ cá nhân', path: '/account/profile', subject: 'account', description: 'Hồ sơ, tài khoản và bảo mật', roles: ['member', 'pt', 'staff', 'admin', 'seller'], aliases: ['tai khoan', 'ho so', 'profile', 'bao mat', 'doi mat khau', 'email', 'avatar'] }),
  route({ label: 'FAQ', path: '/help', subject: 'faq', description: 'Xem câu hỏi thường gặp', roles: ['member'], requiresAuth: false, aliases: ['faq', 'help', 'tro giup', 'huong dan'] }),
  route({ label: 'Chính sách', path: '/policies', subject: 'policy', description: 'Xem chính sách và điều khoản', roles: ['member'], requiresAuth: false, aliases: ['chinh sach', 'dieu khoan', 'hoan tien', 'bao mat', 'policy'] }),
  route({ label: 'Đăng nhập', path: '/login', subject: 'auth', description: 'Đăng nhập tài khoản', roles: ['member'], requiresAuth: false, aliases: ['dang nhap', 'login'] }),
  route({ label: 'Đăng ký', path: '/register', subject: 'auth', description: 'Tạo tài khoản mới', roles: ['member'], requiresAuth: false, aliases: ['dang ky', 'register'] }),
  route({ label: 'Quên mật khẩu', path: '/forgot-password', subject: 'forgot_password', description: 'Nhận OTP và đặt lại mật khẩu', roles: ['member'], requiresAuth: false, aliases: ['quen mat khau', 'reset password', 'otp'] }),

  route({ label: 'Lịch PT', path: '/pt/schedule', subject: 'schedule', description: 'Xem lịch dạy của PT', roles: ['pt'], aliases: ['lich cua toi', 'lich day', 'schedule'] }),
  route({ label: 'Lịch chờ xác nhận', path: '/pt/schedule/pending', subject: 'schedule', description: 'Xem lịch đang chờ xác nhận', roles: ['pt'], aliases: ['lich cho xac nhan', 'pending'] }),
  route({ label: 'Học viên của tôi', path: '/pt/clients', subject: 'pt_clients', description: 'Xem danh sách học viên PT phụ trách', roles: ['pt'], aliases: ['hoc vien', 'clients'] }),
  route({ label: 'Lộ trình quản lý', path: '/pt/workouts', subject: 'workout', description: 'Quản lý lộ trình tập cho học viên', roles: ['pt'], aliases: ['lo trinh toi quan ly', 'workouts'] }),

  route({ label: 'Quét QR check-in', path: '/staff/checkin', subject: 'checkin', description: 'Check-in hội viên tại quầy', roles: ['staff'], aliases: ['quet qr', 'staff checkin', 'diem danh'] }),
  route({ label: 'Danh sách hội viên', path: '/staff/members', subject: 'members', description: 'Xem và hỗ trợ hội viên', roles: ['staff'], aliases: ['hoi vien', 'members'] }),
  route({ label: 'Thanh toán', path: '/staff/payments', subject: 'payment', description: 'Xem và xử lý thanh toán', roles: ['staff'], aliases: ['thanh toan', 'payments'] }),
  route({ label: 'Thông báo', path: '/staff/notifications', subject: 'notifications', description: 'Xem thông báo nội bộ', roles: ['staff'], aliases: ['thong bao', 'notifications'] }),

  route({ label: 'Bảng quản trị', path: '/admin', subject: 'admin', description: 'Trang tổng quan quản trị', roles: ['admin'], aliases: ['admin', 'quan tri'] }),
  route({ label: 'Quản lý gói tập', path: '/admin/plans', subject: 'membership', description: 'Tạo và quản lý gói tập', roles: ['admin'], aliases: ['quan ly goi tap', 'plans'] }),
  route({ label: 'Quản lý người dùng', path: '/admin/users', subject: 'users', description: 'Quản lý tài khoản người dùng', roles: ['admin'], aliases: ['quan ly nguoi dung', 'users'] }),
  route({ label: 'Quản lý hội viên', path: '/admin/members', subject: 'members', description: 'Quản lý hội viên', roles: ['admin'], aliases: ['quan ly hoi vien', 'members'] }),
  route({ label: 'Quản lý PT', path: '/admin/trainers', subject: 'pt', description: 'Quản lý huấn luyện viên', roles: ['admin'], aliases: ['quan ly pt', 'quan ly trainer', 'trainers'] }),
  route({ label: 'Báo cáo', path: '/admin/reports', subject: 'reports', description: 'Xem báo cáo hệ thống', roles: ['admin'], aliases: ['bao cao', 'reports'] }),
  route({ label: 'Quản lý check-in', path: '/admin/checkin', subject: 'checkin', description: 'Xem dữ liệu check-in', roles: ['admin'], aliases: ['quan ly checkin'] }),
  route({ label: 'Quản lý FAQ', path: '/admin/faqs', subject: 'faq', description: 'Xem và quản lý FAQ', roles: ['admin'], aliases: ['quan ly faq', 'faqs'] }),
  route({ label: 'Tạo FAQ', path: '/admin/faqs/create', subject: 'faq', description: 'Tạo FAQ mới', roles: ['admin'], aliases: ['tao faq'] }),
  route({ label: 'Quản lý chính sách', path: '/admin/policies', subject: 'policy', description: 'Xem và quản lý chính sách', roles: ['admin'], aliases: ['quan ly chinh sach', 'policies'] }),
  route({ label: 'Tạo chính sách', path: '/admin/policies/create', subject: 'policy', description: 'Tạo chính sách mới', roles: ['admin'], aliases: ['tao chinh sach'] }),
  route({ label: 'Cài đặt hệ thống', path: '/admin/system-settings', subject: 'system', description: 'Quản lý cấu hình hệ thống', roles: ['admin'], aliases: ['cai dat he thong', 'system settings'] }),

  route({ label: 'Sản phẩm của tôi', path: '/seller/products', subject: 'product', description: 'Quản lý sản phẩm của shop', roles: ['seller'], aliases: ['san pham cua toi', 'seller products'] }),
  route({ label: 'Thêm sản phẩm', path: '/seller/products/create', subject: 'product', description: 'Tạo sản phẩm mới', roles: ['seller'], aliases: ['them san pham', 'create product'] }),
  route({ label: 'Đơn hàng shop', path: '/seller/orders', subject: 'order', description: 'Xem đơn hàng của shop', roles: ['seller'], aliases: ['don hang shop', 'seller orders'] }),
  route({ label: 'Shop của tôi', path: '/seller/shop', subject: 'shop', description: 'Xem cửa hàng người bán', roles: ['seller'], aliases: ['shop cua toi'] }),
  route({ label: 'Doanh thu', path: '/seller/revenue', subject: 'revenue', description: 'Xem doanh thu người bán', roles: ['seller'], aliases: ['doanh thu', 'revenue'] }),
]

const roleCanAccess = (routeItem, role) => routeItem.allowedRoles.includes(normalizeRole(role))

const isAdminTarget = (text) => ['admin', 'quan tri', 'quan ly'].some((term) => text.includes(term))

const roleLabel = {
  member: 'hội viên',
  pt: 'huấn luyện viên',
  staff: 'nhân viên',
  admin: 'quản trị viên',
  seller: 'người bán',
}

const hasNavigationCue = (text = '') => /\b(o dau|vao dau|bam cho nao|mo trang nao|trang nao|duong dan|lam sao de vao|cach thao tac|open page|where|which page)\b/.test(text)
const hasBlockedDataCue = (text = '') => /\b(gia|price|cost|quyen loi|benefit|bao nhieu|so luong|doanh thu|revenue|hoi vien|member count|report|bao cao)\b/.test(text)
const hasRouteCue = (text = '') => /\b(dat lich|lich|checkin|check in|doi mat khau|quen mat khau|don hang|suc khoe|lo trinh|faq|help|chinh sach|mua|whey|store|admin|quan ly|them san pham|qr|profile|ho so|nap tien|thanh toan)\b/.test(text)
const hasShopRevenueCue = (text = '') => /\b(shop|seller|nguoi ban|cua hang|san pham|don hang shop|shop cua toi)\b/.test(text)
const isAllowedNavigationRequest = ({ text, subject, action, intent }) => {
  const normalized = normalize(`${subject} ${action} ${intent}`)
  if (/\b(find_location|open_page|how_to_use_ui|navigate|navigation|account_navigation|booking_navigation|checkin_navigation|payment_navigation|order_navigation|policy_navigation|faq_navigation|support_navigation)\b/.test(normalized)) return true
  if (hasNavigationCue(text) && /\b(doanh thu|revenue)\b/.test(text)) return true
  if (hasBlockedDataCue(text)) return false
  if (hasNavigationCue(text)) return true
  if (hasRouteCue(text)) return true
  return false
}

const blockedNavigation = ({ reason, docsInfo, message = '' }) => ({
  label: '',
  path: '',
  description: '',
  requiresAuth: false,
  allowedRoles: [],
  featureFlag: null,
  blocked: true,
  reason,
  message,
  docsInfo,
})

const featureEnabled = async (routeItem, featureFlags) => {
  if (!routeItem?.featureFlag) return true
  if (featureFlags && Object.prototype.hasOwnProperty.call(featureFlags, routeItem.featureFlag)) {
    return featureFlags[routeItem.featureFlag] !== false
  }
  try {
    return await isFeatureEnabled(routeItem.featureFlag)
  } catch {
    return true
  }
}

const scoreRoute = ({ routeItem, query, subject, action, intent, userRole }) => {
  const text = normalize(`${query} ${subject} ${action} ${intent}`)
  const routeText = normalize([
    routeItem.label,
    routeItem.path,
    routeItem.subject,
    routeItem.description,
    ...routeItem.aliases,
  ].join(' '))
  const tokens = uniq(text.split(' ').filter((token) => token.length >= 2))
  let score = 0

  if (normalize(routeItem.subject) === normalize(subject)) score += 45
  if (routeText.includes(normalize(intent))) score += 12
  if (roleCanAccess(routeItem, userRole)) score += 18
  if (!roleCanAccess(routeItem, userRole)) score -= 25
  if (routeItem.path === '/booking' && text.includes('lich') && !text.includes('don hang') && !text.includes('hoa don')) score += 60
  if (routeItem.path === '/booking' && normalizeRole(userRole) !== 'member') score -= 70
  if (routeItem.path === '/pt/schedule' && normalizeRole(userRole) === 'pt' && text.includes('lich')) score += 90
  if (routeItem.path === '/pt/schedule/pending' && normalizeRole(userRole) === 'pt' && (text.includes('cho xac nhan') || text.includes('pending'))) score += 95
  if (routeItem.path === '/pt/clients' && normalizeRole(userRole) === 'pt' && (text.includes('hoc vien') || text.includes('client'))) score += 95
  if (routeItem.path === '/pt/workouts' && normalizeRole(userRole) === 'pt' && text.includes('lo trinh')) score += 95
  if (routeItem.path === '/staff/checkin' && normalizeRole(userRole) === 'staff' && (text.includes('qr') || text.includes('checkin') || text.includes('check in'))) score += 95
  if (routeItem.path === '/seller/orders' && normalizeRole(userRole) === 'seller' && (text.includes('don hang') || text.includes('order'))) score += 95
  if (routeItem.path === '/orders' && (text.includes('don hang') || text.includes('order'))) score += 70
  if (routeItem.path === '/orders' && text.includes('lich') && !text.includes('don hang')) score -= 35
  if (routeItem.path === '/account/profile' && (text.includes('mat khau') || text.includes('tai khoan') || text.includes('ho so'))) score += 70
  if (routeItem.path === '/forgot-password' && text.includes('quen mat khau')) score += 80
  if (routeItem.path === '/policies' && (text.includes('chinh sach') || text.includes('hoan tien') || text.includes('dieu khoan'))) score += 70
  if (routeItem.path === '/store' && (text.includes('mua') || text.includes('whey') || text.includes('cua hang'))) score += 70

  for (const token of tokens) {
    if (routeText.includes(token)) score += token.length >= 4 ? 8 : 3
  }

  return score
}

const pickFallbackRoute = ({ query, subject, userRole }) => {
  const role = normalizeRole(userRole)
  const text = normalize(`${query} ${subject}`)
  if (role === 'member' && (text.includes('pt') || text.includes('trainer') || text.includes('lich'))) {
    return NAVIGATION_ROUTES.find((item) => item.path === '/booking')
  }
  if (text.includes('policy') || text.includes('chinh sach') || text.includes('hoan tien') || text.includes('dieu khoan')) {
    return NAVIGATION_ROUTES.find((item) => item.path === '/policies')
  }
  if (text.includes('faq') || text.includes('help') || text.includes('huong dan')) {
    return NAVIGATION_ROUTES.find((item) => item.path === '/help')
  }
  return NAVIGATION_ROUTES.find((item) => item.path === '/account/profile' && roleCanAccess(item, role))
}

export const resolveNavigation = async ({
  query = '',
  subject = '',
  action = '',
  intent = '',
  userRole = 'member',
  featureFlags,
  logDocs = true,
} = {}) => {
  const role = normalizeRole(userRole)
  const docsInfo = getRelevantAiDocs({
    subject: subject || 'navigation',
    action,
    intent: intent || 'navigation',
    purpose: 'navigation',
    files: [AI_DOC_FILES.navigation],
    maxChars: 3000,
  })
  if (logDocs) logAiDocsLoaded({ docsInfo })

  const text = normalize(`${query} ${subject} ${action} ${intent}`)

  if (!isAllowedNavigationRequest({ text, subject, action, intent })) {
    return blockedNavigation({ reason: 'not_navigation_intent', docsInfo })
  }

  if (/\b(doanh thu|revenue)\b/.test(text)) {
    if (role === 'admin') {
      const reports = NAVIGATION_ROUTES.find((item) => item.path === '/admin/reports')
      return { ...reports, blocked: false, docsInfo }
    }
    if (role === 'seller' && hasShopRevenueCue(text)) {
      const sellerRevenue = NAVIGATION_ROUTES.find((item) => item.path === '/seller/revenue')
      return { ...sellerRevenue, blocked: false, docsInfo }
    }
    return blockedNavigation({
      reason: 'role_denied',
      docsInfo,
      message: 'Tài khoản hiện tại không có quyền xem doanh thu.',
    })
  }

  const scopedRoutes = NAVIGATION_ROUTES
    .map((routeItem) => ({ routeItem, score: scoreRoute({ routeItem, query, subject, action, intent, userRole: role }) }))
    .sort((a, b) => b.score - a.score)

  const best = scopedRoutes[0]?.score > 0 ? scopedRoutes[0].routeItem : pickFallbackRoute({ query, subject, userRole: role })
  const requestedRestrictedArea = isAdminTarget(text) || text.includes('staff') || text.includes('seller') || text.includes('/admin')
  const canAccessBest = best ? roleCanAccess(best, role) : false

  if (!best) {
    return blockedNavigation({ reason: 'not_found', docsInfo })
  }

  if (requestedRestrictedArea && !['admin', 'staff', 'seller'].includes(role)) {
    const alternative = pickFallbackRoute({ query, subject: 'booking', userRole: role })
    return {
      label: '',
      path: '',
      description: '',
      requiresAuth: false,
      allowedRoles: [],
      featureFlag: null,
      blocked: true,
      reason: 'role_denied',
      alternative: alternative && roleCanAccess(alternative, role) ? alternative : null,
      docsInfo,
    }
  }

  if (!canAccessBest || (requestedRestrictedArea && !roleCanAccess(best, role))) {
    const alternative = pickFallbackRoute({ query, subject: role === 'member' ? 'booking' : 'account', userRole: role })
    return {
      label: '',
      path: '',
      description: '',
      requiresAuth: false,
      allowedRoles: best?.allowedRoles || [],
      featureFlag: null,
      blocked: true,
      reason: 'role_denied',
      requestedRole: best?.allowedRoles?.[0] || null,
      alternative: alternative && roleCanAccess(alternative, role) ? alternative : null,
      docsInfo,
    }
  }

  const enabled = await featureEnabled(best, featureFlags)
  if (!enabled) {
    return {
      ...best,
      blocked: true,
      reason: 'feature_disabled',
      docsInfo,
    }
  }

  return {
    ...best,
    blocked: false,
    docsInfo,
  }
}

export const buildNavigationAnswer = ({ navigation, baseAnswer = '', lang = 'vi' } = {}) => {
  if (!navigation) return { answer: baseAnswer, links: [] }
  if (navigation.blocked && navigation.message) {
    return {
      answer: navigation.message,
      links: [],
    }
  }
  if (navigation.blocked && navigation.reason === 'not_navigation_intent') {
    return {
      answer: baseAnswer || (lang === 'en'
        ? 'This question needs GymPro data, not a navigation route.'
        : 'Câu hỏi này cần dữ liệu GymPro, không phải đường dẫn thao tác.'),
      links: [],
    }
  }
  if (navigation.blocked && navigation.reason === 'feature_disabled') {
    return {
      answer: lang === 'en'
        ? 'This feature is currently disabled in GymPro.'
        : 'Chức năng này hiện đang bị tắt trong hệ thống.',
      links: [],
    }
  }
  if (navigation.blocked && navigation.reason === 'role_denied') {
    const fallback = navigation.alternative
    const requestedRoleLabel = roleLabel[navigation.requestedRole] || 'vai trò phù hợp'
    const answer = lang === 'en'
      ? `This page is only available for ${requestedRoleLabel}.${fallback ? ` With your account, you can use ${fallback.label} instead.` : ''}`
      : `Trang này chỉ dành cho ${requestedRoleLabel}.${fallback ? ` Với tài khoản hiện tại, bạn có thể dùng ${fallback.label}.` : ''}`
    return {
      answer,
      links: fallback ? [{ label: `Mở ${fallback.label}`, path: fallback.path, allowedRoles: fallback.allowedRoles, featureFlag: fallback.featureFlag }] : [],
    }
  }

  const intro = baseAnswer || (lang === 'en'
    ? `Open ${navigation.label} to continue.`
    : `Bạn vào ${navigation.label} để thực hiện thao tác này.`)
  return {
    answer: intro,
    links: [{ label: `Mở ${navigation.label}`, path: navigation.path, allowedRoles: navigation.allowedRoles, featureFlag: navigation.featureFlag }],
  }
}

export const __navigationResolverTestHooks = {
  normalize,
  scoreRoute,
  pickFallbackRoute,
}
