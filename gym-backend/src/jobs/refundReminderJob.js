/**
 * Daily job: check for members with pending refund eligibility.
 *
 * Days since purchasedAt (with activatedAt == null && refundEligible == true):
 *   Day 5 → send "Còn 2 ngày" notification + email
 *   Day 6 → send "Còn 1 ngày" notification + email
 *   Day 7 → expire refund (refundEligible=false, refundExpiredAt=now) + send notification + email
 *
 * Uses `refundReminderSent` field to avoid duplicate sends.
 */

import MembershipCycle from '../models/MembershipCycle.js'
import User from '../models/User.js'
import Plan from '../models/Plan.js'
import { createNotification } from '../services/notificationService.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'

const DAY_MS = 24 * 60 * 60 * 1000

async function sendRefundEmail(user, planName, subject, body) {
  if (!user?.email) return
  try {
    const { sendEmail } = await import('../services/emailService.js')
    // Use generic email sending if available
    if (typeof sendEmail === 'function') {
      await sendEmail({
        to: user.email,
        subject,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px"><h2>${subject}</h2><p>${body.replace(/\n/g, '<br>')}</p></div>`,
      })
    }
  } catch (e) {
    console.error('[refundReminderJob] Email failed:', e.message)
  }
}

export async function runRefundReminderJob() {
  console.log('[refundReminderJob] Starting...')

  // Find cycles that haven't been activated yet but are still refund-eligible.
  // BUG FIXED: Previously queried `status: 'active'` + `activatedAt: null` which is a contradictory state
  // (activatedAt is set when status transitions to 'active').
  // The correct statuses for pending activation are:
  // - pending_initial_activation: newly purchased, waiting for first check-in/benefit
  // - pending_renewal_activation: renewed, waiting for previous cycle to expire
  const candidates = await MembershipCycle.find({
    status: { $in: ['pending_initial_activation', 'pending_renewal_activation'] },
    activatedAt: null,
    refundEligible: true,
    purchasedAt: { $ne: null },
  }).populate('currentPlanId', 'nameVi nameEn durationDays').lean()

  const now = Date.now()

  for (const cycle of candidates) {
    const purchasedAt = new Date(cycle.purchasedAt).getTime()
    const daysSince = Math.floor((now - purchasedAt) / DAY_MS)
    const remindKey = `refundReminderDay${daysSince}`

    // Skip if already sent for this day
    if (cycle.refundReminderSent?.includes?.(daysSince)) continue

    const member = await User.findById(cycle.memberId).select('name fullName email').lean()
    if (!member) continue
    const mName = member.fullName || member.name || 'Hội viên'
    const planName = cycle.currentPlanId?.nameVi || cycle.currentPlanId?.nameEn || 'gói tập'

    if (daysSince === 5) {
      const title = 'Còn 2 ngày để giữ quyền hoàn tiền'
      const content = `Bạn chưa kích hoạt gói tập. Sau 2 ngày nữa quyền hoàn tiền sẽ hết hiệu lực nếu bạn chưa gửi yêu cầu hủy gói.`
      await createNotification({
        receiverId: cycle.memberId, receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.REFUND_REMINDER,
        title, content, redirectUrl: '/my-membership', createdBy: 'System',
      })
      await sendRefundEmail(member, planName, title, content)
      await MembershipCycle.updateOne(
        { _id: cycle._id },
        { $push: { refundReminderSent: daysSince } },
      )
      console.log(`  [Day 5] Notified ${mName} (${cycle.memberId})`)
    }

    if (daysSince === 6) {
      const title = 'Còn 1 ngày để giữ quyền hoàn tiền'
      const content = `Ngày mai là thời hạn cuối cùng để yêu cầu hoàn tiền nếu bạn chưa kích hoạt gói tập.`
      await createNotification({
        receiverId: cycle.memberId, receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.REFUND_REMINDER,
        title, content, redirectUrl: '/my-membership', createdBy: 'System',
      })
      await sendRefundEmail(member, planName, title, content)
      await MembershipCycle.updateOne(
        { _id: cycle._id },
        { $push: { refundReminderSent: daysSince } },
      )
      console.log(`  [Day 6] Notified ${mName} (${cycle.memberId})`)
    }

    if (daysSince >= 7) {
      const title = 'Quyền hoàn tiền đã hết hiệu lực'
      const content = `Đã quá 07 ngày kể từ ngày đăng ký nên quyền hoàn tiền của bạn đã hết hiệu lực.\n\nBạn vẫn có thể check-in để kích hoạt và sử dụng gói tập bất cứ lúc nào.`
      await createNotification({
        receiverId: cycle.memberId, receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.REFUND_EXPIRED,
        title, content, redirectUrl: '/my-membership', createdBy: 'System',
      })
      await sendRefundEmail(member, planName, title, content)
      await MembershipCycle.updateOne(
        { _id: cycle._id },
        { $set: { refundEligible: false, refundExpiredAt: new Date() } },
      )
      console.log(`  [Day 7+] Expired refund for ${mName} (${cycle.memberId})`)
    }
  }

  console.log('[refundReminderJob] Done.')
}
