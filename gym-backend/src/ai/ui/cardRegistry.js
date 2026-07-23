const builders = new Map()

export function register(name, builder) {
  builders.set(name, builder)
}

export function build(name, data) {
  const builder = builders.get(name)
  return builder ? builder(data) : null
}

export function all() {
  return [...builders.entries()]
}

export function getRegistered() {
  return [...builders.keys()]
}

const ICONS = {
  wallet: '💰', membership: '🎫', plan: '📋', booking: '📅',
  notification: '🔔', searchResult: '🔍', generalInfo: '📚',
}

function makeId(type) {
  return `card_${type}_${Date.now()}`
}

function makeActions(type, deeplink) {
  const base = [
    { label: 'Xem chi tiết', type: 'view', path: deeplink },
  ]
  if (type === 'wallet') base.push({ label: 'Nạp tiền', type: 'pay', path: deeplink })
  if (type === 'membership' || type === 'plan') base.push({ label: 'Gia hạn', type: 'renew', path: deeplink })
  if (type === 'booking') base.push({ label: 'Đặt lịch mới', type: 'book', path: deeplink })
  return base.filter(a => a.path)
}

function walletCard(result) {
  if (result.error || result.balance === undefined) return null
  const deeplink = '/wallet'
  return {
    id: makeId('wallet'), type: 'wallet', title: 'Ví GymPro',
    subtitle: `${result.balance.toLocaleString('vi-VN')} VNĐ`,
    icon: ICONS.wallet, status: null,
    data: { balance: result.balance, points: result.points || 0 },
    actions: makeActions('wallet', deeplink), deeplink,
  }
}

function membershipCard(result) {
  if (result.error || !result.currentMembership || !result.statusType) return null
  const m = result.currentMembership
  const deeplink = '/my-membership'
  const days = m?.remainingDays
  const subtitle = m?.planName ? `${m.planName}${days != null ? ' — còn ' + days + ' ngày' : ''}` : ''
  return {
    id: makeId('membership'), type: 'membership', title: 'Gói tập',
    subtitle, icon: ICONS.membership, status: result.statusType,
    data: {
      status: result.statusType,
      planName: m?.planName || '',
      startDate: m?.startDate || '',
      endDate: m?.endDate || '',
      remainingDays: days || 0,
      hasPendingRenewal: (result.pendingRenewals?.length || 0) > 0,
    },
    actions: makeActions('membership', deeplink), deeplink,
  }
}

function planCard(result) {
  if (result.error || !result.planName) return null
  const deeplink = '/my-membership'
  const days = result.remainingDays
  const subtitle = result.planName ? `${result.planName}${days != null ? ' — còn ' + days + ' ngày' : ''}` : ''
  return {
    id: makeId('plan'), type: 'plan', title: 'Thông tin gói tập',
    subtitle, icon: ICONS.plan, status: result.statusType,
    data: {
      status: result.statusType, planName: result.planName || '',
      endDate: result.endDate || '', remainingDays: days || 0,
    },
    actions: makeActions('plan', deeplink), deeplink,
  }
}

function bookingCard(result) {
  if (result.error || !result.bookings || !result.count && result.count !== 0) return null
  const deeplink = '/bookings'
  const upcoming = (result.bookings || []).slice(0, 3)
  return {
    id: makeId('booking'), type: 'booking', title: 'Lịch tập sắp tới',
    subtitle: `${result.count || 0} buổi sắp tới`,
    icon: ICONS.booking, status: upcoming[0]?.status || null,
    data: {
      count: result.count || 0,
      bookings: upcoming.map(b => ({ id: b.id, ptName: b.ptName, date: b.date, slot: b.slot, status: b.status })),
    },
    actions: makeActions('booking', deeplink), deeplink,
  }
}

function notificationCard(result) {
  if (result.error || result.count === undefined || result.bookings) return null
  const deeplink = '/notifications'
  const count = result.count
  return {
    id: makeId('notification'), type: 'notification', title: 'Thông báo',
    subtitle: count > 0 ? `${count} thông báo chưa đọc` : 'Không có thông báo mới',
    icon: ICONS.notification, status: count > 0 ? 'unread' : null,
    data: { unreadCount: count },
    actions: count > 0 ? [{ label: 'Xem thông báo', type: 'view', path: deeplink }] : [],
    deeplink: count > 0 ? deeplink : '',
  }
}

function searchResultCard(result) {
  if (result.error || !result.answer) return null
  return {
    id: makeId('searchResult'), type: 'searchResult', title: 'Kết quả tìm kiếm',
    subtitle: (result.sources?.length || 0) > 0 ? `${result.sources.length} nguồn tham khảo` : '',
    icon: ICONS.searchResult, status: null,
    data: {
      answer: result.answer,
      sources: (result.sources || []).slice(0, 3),
    },
    actions: [], deeplink: '',
  }
}

function generalInfoCard(result) {
  if (!result || !result.success || !result.documents?.length) return null
  return {
    id: makeId('generalInfo'), type: 'generalInfo', title: 'Kiến thức GymPro',
    subtitle: result.documents[0]?.category || '',
    icon: ICONS.generalInfo, status: null,
    data: {
      summary: result.documents[0]?.content?.substring(0, 200) || '',
      sources: result.documents.map(d => ({ title: d.title, category: d.category })),
    },
    actions: [], deeplink: '',
  }
}

register('wallet', walletCard)
register('membership', membershipCard)
register('plan', planCard)
register('booking', bookingCard)
register('notification', notificationCard)
register('searchResult', searchResultCard)
register('generalInfo', generalInfoCard)
