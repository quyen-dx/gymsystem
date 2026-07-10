const buildHeader = (title, lang) => {
  const width = 60
  const pad = Math.max(0, width - title.length - 2)
  const left = Math.floor(pad / 2)
  const right = pad - left
  return `\n${'='.repeat(width)}\n${' '.repeat(left)}${title}${' '.repeat(right)}\n${'='.repeat(width)}`
}

import { logContextBuilder } from './aiLogService.js'

const formatMoney = (amount) => {
  if (amount == null) return 'Chưa cập nhật'
  return `${Number(amount).toLocaleString('vi-VN')}₫`
}

const formatDate = (date) => {
  if (!date) return 'Chưa cập nhật'
  try {
    return new Date(date).toLocaleDateString('vi-VN')
  } catch {
    return 'Chưa cập nhật'
  }
}

/* ============================================================
   MEMBERSHIP / PROFILE
   ============================================================ */

export const renderMemberProfile = (profile = {}, lang = 'vi') => {
  if (!profile || Object.keys(profile).length === 0) return ''
  logContextBuilder('memberProfile', { sectionsCount: 1, totalChars: JSON.stringify(profile).length })
  const name = profile.fullName || profile.displayName || profile.name || ''
  const email = profile.email || ''
  const phone = profile.phone || ''
  const role = profile.role || 'member'
  const memberCode = profile.memberCode || ''
  const lines = [buildHeader('Thông tin hội viên', lang)]
  if (name) lines.push(`Họ tên: ${name}`)
  if (memberCode) lines.push(`Mã hội viên: ${memberCode}`)
  if (email) lines.push(`Email: ${email}`)
  if (phone) lines.push(`SĐT: ${phone}`)
  lines.push(`Vai trò: ${role}`)
  return lines.join('\n')
}

export const renderMembership = (membership = {}, lang = 'vi') => {
  if (!membership) return ''
  const lines = []

  if (!membership.hasActiveMembership || !membership.currentMembership) {
    lines.push('Hiện tại bạn chưa có gói tập đang hoạt động.')
  } else {
    const cm = membership.currentMembership
    lines.push(buildHeader('Gói tập hiện tại', lang))
    if (cm.planName) lines.push(`Tên gói: ${cm.planName}`)
    if (cm.startDate) lines.push(`Ngày bắt đầu: ${formatDate(cm.startDate)}`)
    if (cm.endDate) lines.push(`Ngày kết thúc: ${formatDate(cm.endDate)}`)
    if (cm.remainingDays != null) lines.push(`Còn lại: ${cm.remainingDays} ngày`)
    lines.push(`Trạng thái: Đang hoạt động`)
  }

  if (Array.isArray(membership.pendingRenewals) && membership.pendingRenewals.length > 0) {
    if (lines.length > 0) lines.push('')
    lines.push(`--- Gia hạn đang chờ ---`)
    for (const p of membership.pendingRenewals) {
      lines.push(`- ${p.planName || 'Gói tập'}: bắt đầu ${formatDate(p.startDate)}, kết thúc ${formatDate(p.endDate)}`)
    }
  }

  if (Array.isArray(membership.cancelRequests) && membership.cancelRequests.length > 0) {
    if (lines.length > 0) lines.push('')
    lines.push(`--- Đang chờ hủy / hoàn tiền ---`)
    for (const p of membership.cancelRequests) {
      lines.push(`- ${p.planName || 'Gói tập'}: ${p.status === 'REFUND_PENDING' ? 'đang chờ hoàn tiền' : 'đang chờ hủy'}, kết thúc ${formatDate(p.endDate)}`)
    }
  }

  return lines.join('\n')
}

/* ============================================================
   PLANS
   ============================================================ */

export const renderPlans = (plans = [], lang = 'vi') => {
  if (!Array.isArray(plans) || plans.length === 0) return ''
  logContextBuilder('plans', { count: plans.length })
  const lines = [buildHeader(`Danh sách gói tập (${plans.length} gói)`, lang)]
  plans.forEach((p, i) => {
    const name = p.nameVi || p.nameEn || p.name || `Gói ${i + 1}`
    lines.push('')
    lines.push(`${i + 1}. ${name}`)
    lines.push(`   Giá: ${formatMoney(p.price)}`)
    lines.push(`   Thời hạn: ${p.durationDays || 0} ngày`)
    if (p.duration) lines.push(`   Thời hạn: ${p.duration}`)
    const features = p.featuresVi || p.featuresEn || p.features || []
    if (features.length > 0) {
      lines.push(`   Quyền lợi: ${features.join(', ')}`)
    }
    if (p.color) lines.push(`   Màu sắc: ${p.color}`)
  })
  return lines.join('\n')
}

/* ============================================================
   TRAINER (PT)
   ============================================================ */

export const renderPTs = (pts = [], lang = 'vi') => {
  if (!Array.isArray(pts) || pts.length === 0) return ''
  logContextBuilder('pts', { count: pts.length })
  const lines = [buildHeader(`Danh sách Huấn luyện viên (PT) (${pts.length} PT)`, lang)]
  pts.forEach((pt, i) => {
    const name = pt.fullName || pt.name || `PT ${i + 1}`
    lines.push('')
    lines.push(`PT ${i + 1}: ${name}`)
    if (pt.specialties && pt.specialties.length > 0) {
      lines.push(`   Chuyên môn: ${pt.specialties.join(', ')}`)
    }
    if (pt.rating) lines.push(`   Đánh giá: ${pt.rating}/5${pt.reviewCount ? ` (${pt.reviewCount} đánh giá)` : ''}`)
    if (pt.experienceYears) lines.push(`   Kinh nghiệm: ${pt.experienceYears} năm`)
    if (pt.totalStudents) lines.push(`   Học viên: ${pt.totalStudents}`)
    if (pt.schedule) lines.push(`   Lịch: ${pt.schedule}`)
    if (pt.phone) lines.push(`   SĐT: ${pt.phone}`)
    if (pt.email) lines.push(`   Email: ${pt.email}`)
  })
  return lines.join('\n')
}

/* ============================================================
   BOOKING
   ============================================================ */

export const renderBookings = (bookings = [], lang = 'vi') => {
  if (!Array.isArray(bookings) || bookings.length === 0) return ''
  logContextBuilder('bookings', { count: bookings.length })
  const lines = [buildHeader(`Lịch đặt (${bookings.length} lịch)`, lang)]
  bookings.forEach((b, i) => {
    const ptName = b.ptName || b.ptId?.fullName || b.ptId?.name || ''
    const date = formatDate(b.date)
    const slot = b.slot || ''
    const statusLabels = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', completed: 'Hoàn thành', cancelled: 'Đã hủy' }
    const status = statusLabels[b.status] || b.status || ''
    lines.push(`  ${i + 1}. ${date} ${slot ? `- ${slot}` : ''}${ptName ? ` - PT: ${ptName}` : ''}${status ? ` [${status}]` : ''}`)
    if (b.note) lines.push(`     Ghi chú: ${b.note}`)
  })
  return lines.join('\n')
}

/* ============================================================
   WALLET
   ============================================================ */

export const renderWallet = (wallet = {}, lang = 'vi') => {
  if (!wallet || wallet.balance == null) return ''
  const lines = [buildHeader('Ví GymPro', lang)]
  lines.push(`Số dư: ${formatMoney(wallet.balance)}`)
  if (wallet.currency) lines.push(`Loại tiền: ${wallet.currency}`)
  if (wallet.updatedAt) lines.push(`Cập nhật: ${formatDate(wallet.updatedAt)}`)
  return lines.join('\n')
}

/* ============================================================
   PROGRESS / CHECK-IN
   ============================================================ */

export const renderCheckinStats = (stats = {}, lang = 'vi') => {
  if (!stats || stats.total == null) return ''
  logContextBuilder('checkinStats', { fields: Object.keys(stats).length })
  const lines = [buildHeader('Thống kê điểm danh', lang)]
  lines.push(`Tổng số lần: ${stats.total}`)
  if (stats.thisMonth != null) lines.push(`Tháng này: ${stats.thisMonth} lần`)
  if (stats.thisWeek != null) lines.push(`Tuần này: ${stats.thisWeek} lần`)
  if (stats.last30Days != null) lines.push(`30 ngày qua: ${stats.last30Days} lần`)
  if (stats.streak != null) lines.push(`Streak hiện tại: ${stats.streak} ngày`)
  if (stats.lastCheckin) lines.push(`Lần cuối: ${formatDate(stats.lastCheckin)}`)
  return lines.join('\n')
}

export const renderProgressActivities = (activities = [], lang = 'vi') => {
  if (!Array.isArray(activities) || activities.length === 0) return ''
  const lines = [buildHeader('Tiến độ', lang)]
  activities.forEach((a) => {
    const title = a.title || a.name || ''
    const date = formatDate(a.date || a.createdAt)
    const value = a.value || a.result || a.description || ''
    if (title) lines.push(`  ${title}${date ? ` (${date})` : ''}${value ? `: ${value}` : ''}`)
  })
  return lines.join('\n')
}

/* ============================================================
   HEALTH
   ============================================================ */

export const renderHealthMetrics = (metrics = [], lang = 'vi') => {
  if (!Array.isArray(metrics) || metrics.length === 0) return ''
  const lines = [buildHeader('Chỉ số sức khỏe', lang)]
  metrics.forEach((m) => {
    const title = m.title || m.name || ''
    const value = m.value || m.result || ''
    const date = formatDate(m.date || m.createdAt)
    if (title) lines.push(`  ${title}: ${value}${date ? ` (${date})` : ''}`)
  })
  return lines.join('\n')
}

export const renderHealthProfile = (healthInfo = {}, lang = 'vi') => {
  if (!healthInfo || Object.keys(healthInfo).length === 0) return ''
  const lines = [buildHeader('Hồ sơ sức khỏe', lang)]
  if (healthInfo.height) lines.push(`Chiều cao: ${healthInfo.height} cm`)
  if (healthInfo.weight) lines.push(`Cân nặng: ${healthInfo.weight} kg`)
  if (healthInfo.height && healthInfo.weight) {
    const bmi = (healthInfo.weight / ((healthInfo.height / 100) ** 2)).toFixed(1)
    lines.push(`BMI: ${bmi}`)
  }
  if (healthInfo.goals && healthInfo.goals.length > 0) {
    lines.push(`Mục tiêu: ${healthInfo.goals.join(', ')}`)
  }
  if (healthInfo.activityLevel) lines.push(`Mức độ vận động: ${healthInfo.activityLevel}`)
  if (healthInfo.notes) lines.push(`Ghi chú: ${healthInfo.notes}`)
  return lines.join('\n')
}

/* ============================================================
   WORKOUT / FITNESS
   ============================================================ */

export const renderWorkoutActivities = (activities = [], lang = 'vi') => {
  if (!Array.isArray(activities) || activities.length === 0) return ''
  const lines = [buildHeader('Hoạt động tập luyện', lang)]
  activities.forEach((a) => {
    const title = a.title || a.name || a.exercise || ''
    const date = formatDate(a.date || a.createdAt)
    const duration = a.duration ? `${a.duration} phút` : ''
    const notes = a.notes || a.description || ''
    if (title) lines.push(`  ${title}${date ? ` (${date})` : ''}${duration ? ` - ${duration}` : ''}`)
    if (notes) lines.push(`    ${notes}`)
  })
  return lines.join('\n')
}

/* ============================================================
   PRODUCTS
   ============================================================ */

export const renderProducts = (products = [], lang = 'vi') => {
  if (!Array.isArray(products) || products.length === 0) return ''
  const lines = [buildHeader(`Sản phẩm (${products.length} sản phẩm)`, lang)]
  products.forEach((p, i) => {
    lines.push(`  ${i + 1}. ${p.name}`)
    lines.push(`     Giá: ${formatMoney(p.price)}`)
    if (p.category) lines.push(`     Danh mục: ${p.category}`)
    if (p.stock != null) lines.push(`     Tồn kho: ${p.stock}`)
    if (p.rating) lines.push(`     Đánh giá: ${p.rating}/5`)
  })
  return lines.join('\n')
}

/* ============================================================
   NOTIFICATIONS
   ============================================================ */

export const renderNotifications = (notifications = [], lang = 'vi') => {
  if (!Array.isArray(notifications) || notifications.length === 0) return ''
  const lines = [buildHeader('Thông báo', lang)]
  notifications.forEach((n) => {
    const title = n.title || n.message || ''
    const date = formatDate(n.createdAt || n.date)
    if (title) lines.push(`  ${title}${date ? ` (${date})` : ''}`)
  })
  return lines.join('\n')
}

/* ============================================================
   ORDERS
   ============================================================ */

export const renderOrders = (orders = [], lang = 'vi') => {
  if (!Array.isArray(orders) || orders.length === 0) return ''
  const lines = [buildHeader(`Đơn hàng (${orders.length} đơn)`, lang)]
  orders.forEach((o) => {
    const id = o._id || o.id || ''
    const shortId = String(id).slice(-8)
    const total = formatMoney(o.totalAmount || o.total || o.amount)
    const date = formatDate(o.createdAt || o.date)
    const statusLabels = { pending: 'Chờ xử lý', confirmed: 'Đã xác nhận', shipped: 'Đã giao', delivered: 'Đã nhận', cancelled: 'Đã hủy' }
    const status = statusLabels[o.status] || o.status || ''
    lines.push(`  ${shortId}${date ? ` - ${date}` : ''} - ${total}${status ? ` [${status}]` : ''}`)
  })
  return lines.join('\n')
}

/* ============================================================
   COMBINED BUILDERS
   ============================================================ */

export const buildPlainTextContext = ({
  memberProfile, currentMembership, activePlans, checkinStats,
  upcomingBookings, recentBookings, healthMetrics, healthInfo,
  progressActivities, workoutActivities, notificationActivities,
  orders, pts, products, wallet,
}, lang = 'vi') => {
  const sections = []

  const profileSection = renderMemberProfile(memberProfile, lang)
  if (profileSection) sections.push(profileSection)

  const membershipSection = renderMembership(currentMembership, lang)
  if (membershipSection) sections.push(membershipSection)

  const plansSection = renderPlans(activePlans, lang)
  if (plansSection) sections.push(plansSection)

  const ptsSection = renderPTs(pts, lang)
  if (ptsSection) sections.push(ptsSection)

  const checkinSection = renderCheckinStats(checkinStats, lang)
  if (checkinSection) sections.push(checkinSection)

  const bookingsSection = renderBookings(upcomingBookings, lang)
  if (bookingsSection) sections.push(bookingsSection)

  const recentBookingsSection = renderBookings(recentBookings, lang)
  if (recentBookingsSection) sections.push(recentBookingsSection)

  const walletSection = renderWallet(wallet, lang)
  if (walletSection) sections.push(walletSection)

  const healthSection = renderHealthMetrics(healthMetrics, lang)
  if (healthSection) sections.push(healthSection)

  const healthProfileSection = renderHealthProfile(healthInfo, lang)
  if (healthProfileSection) sections.push(healthProfileSection)

  const progressSection = renderProgressActivities(progressActivities, lang)
  if (progressSection) sections.push(progressSection)

  const workoutSection = renderWorkoutActivities(workoutActivities, lang)
  if (workoutSection) sections.push(workoutSection)

  const productSection = renderProducts(products, lang)
  if (productSection) sections.push(productSection)

  const notificationSection = renderNotifications(notificationActivities, lang)
  if (notificationSection) sections.push(notificationSection)

  const ordersSection = renderOrders(orders, lang)
  if (ordersSection) sections.push(ordersSection)

  return sections.join('\n\n')
}

export const buildContext = (data = {}, lang = 'vi') => {
  const sections = []

  if (data.memberProfile || data.user) {
    const profile = renderMemberProfile(data.memberProfile || data.user, lang)
    if (profile) sections.push(profile)
  }

  if (data.currentMembership || data.membership) {
    const ms = renderMembership(data.currentMembership || data.membership, lang)
    if (ms) sections.push(ms)
  }

  if (data.activePlans || data.plans) {
    const p = renderPlans(data.activePlans || data.plans, lang)
    if (p) sections.push(p)
  }

  if (data.pts || data.trainers) {
    const t = renderPTs(data.pts || data.trainers, lang)
    if (t) sections.push(t)
  }

  if (data.checkinStats || data.checkin) {
    const cs = renderCheckinStats(data.checkinStats || data.checkin, lang)
    if (cs) sections.push(cs)
  }

  if (data.upcomingBookings || data.bookings) {
    const b = renderBookings(data.upcomingBookings || data.bookings, lang)
    if (b) sections.push(b)
  }

  if (data.wallet) {
    const w = renderWallet(data.wallet, lang)
    if (w) sections.push(w)
  }

  if (data.healthMetrics || data.healthInfo) {
    const hm = renderHealthMetrics(data.healthMetrics || [], lang)
    if (hm) sections.push(hm)
    const hp = renderHealthProfile(data.healthInfo || {}, lang)
    if (hp) sections.push(hp)
  }

  if (data.progressActivities || data.progress) {
    const pr = renderProgressActivities(data.progressActivities || data.progress, lang)
    if (pr) sections.push(pr)
  }

  if (data.workoutActivities || data.workouts) {
    const w = renderWorkoutActivities(data.workoutActivities || data.workouts, lang)
    if (w) sections.push(w)
  }

  if (data.products) {
    const pr = renderProducts(data.products, lang)
    if (pr) sections.push(pr)
  }

  if (data.notificationActivities || data.notifications) {
    const n = renderNotifications(data.notificationActivities || data.notifications, lang)
    if (n) sections.push(n)
  }

  if (data.orders) {
    const o = renderOrders(data.orders, lang)
    if (o) sections.push(o)
  }

  return sections.join('\n\n')
}
