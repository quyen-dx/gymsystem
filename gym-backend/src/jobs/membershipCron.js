import Membership from '../models/Membership.js'
import MembershipPeriod from '../models/MembershipPeriod.js'
import Notification, { NOTIFICATION_TYPES } from '../models/Notification.js'
import { lazyActivatePendingPeriods } from '../services/membershipService.js'
import { createNotification } from '../services/notificationService.js'

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000
const EXPIRE_SOON_DAYS = 7
const EXPIRE_TODAY_HOURS = 24

const now = () => new Date()

// 1) Kích hoạt kỳ PENDING đã đến ngày bắt đầu cho mọi membership (không đợi member mở app)
export const activateDueMembershipPeriods = async () => {
  const dueMembershipIds = await MembershipPeriod.distinct('membershipId', {
    status: 'PENDING',
    startDate: { $lte: now() },
  })

  let activated = 0
  for (const membershipId of dueMembershipIds) {
    try {
      const membership = await Membership.findById(membershipId).select('memberId status')
      if (!membership || !['active', 'expired'].includes(membership.status)) continue
      await lazyActivatePendingPeriods({ memberId: membership.memberId })
      activated += 1
    } catch (error) {
      console.error(`[membershipCron] Không thể kích hoạt kỳ của membership ${membershipId}:`, error.message)
    }
  }
  return activated
}

// 2) Nhắc nhở gói sắp hết hạn (7 ngày / 1 ngày) — tránh trùng lặp bằng cách kiểm tra notification đã gửi
export const runExpiryNotifications = async () => {
  const nowMs = Date.now()
  const in7Days = new Date(nowMs + EXPIRE_SOON_DAYS * 24 * 60 * 60 * 1000)
  const in24h = new Date(nowMs + EXPIRE_TODAY_HOURS * 60 * 60 * 1000)

  const activePeriods = await MembershipPeriod.find({
    status: 'ACTIVE',
    endDate: { $gte: now(), $lte: in7Days },
  })
    .populate('membershipId', 'memberId')
    .lean()

  let sent = 0
  for (const period of activePeriods) {
    const membership = period.membershipId
    if (!membership?.memberId) continue

    const daysLeft = Math.ceil((new Date(period.endDate).getTime() - nowMs) / (24 * 60 * 60 * 1000))
    const notificationType = daysLeft <= 1 ? NOTIFICATION_TYPES.MEMBERSHIP_EXPIRING_1D : NOTIFICATION_TYPES.MEMBERSHIP_EXPIRING_7D
    const alreadySent = await Notification.exists({
      receiverId: membership.memberId,
      notificationType,
      relatedId: period._id,
      deletedAt: null,
    })
    if (alreadySent) continue

    try {
      await createNotification({
        receiverId: membership.memberId,
        receiverRole: 'member',
        notificationType,
        title: daysLeft <= 1 ? 'Gói tập sắp hết hạn' : 'Gói tập sắp hết hạn',
        content: daysLeft <= 1
          ? 'Gói tập của bạn sắp hết hạn trong 1 ngày. Hãy gia hạn để không bị gián đoạn.'
          : `Gói tập của bạn còn ${daysLeft} ngày nữa sẽ hết hạn. Hãy gia hạn để không bị gián đoạn.`,
        relatedId: period._id,
        relatedType: 'MembershipPeriod',
        redirectUrl: '/my-membership/renew',
        createdBy: 'System',
      })
      sent += 1
    } catch (error) {
      console.error(`[membershipCron] Không thể gửi nhắc hết hạn cho ${membership.memberId}:`, error.message)
    }
  }
  return sent
}

export const runMembershipCron = async () => {
  const activated = await activateDueMembershipPeriods()
  const sent = await runExpiryNotifications()
  if (activated > 0 || sent > 0) {
    console.log(`[membershipCron] Kích hoạt ${activated} kỳ, gửi ${sent} nhắc hết hạn.`)
  }
  return { activated, sent }
}

export const startMembershipCron = () => {
  runMembershipCron().catch((error) => console.error('[membershipCron] Lỗi chạy job:', error.message))
  return setInterval(() => {
    runMembershipCron().catch((error) => console.error('[membershipCron] Lỗi chạy job:', error.message))
  }, CHECK_INTERVAL_MS)
}
