import mongoose from 'mongoose'
import cron from 'node-cron'
import Membership from '../models/Membership.js'
import User from '../models/User.js'
import Plan from '../models/Plan.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'
import { sendRenewalReminderEmail } from './emailService.js'

const REMINDER_DAYS = [7, 1]

const createInAppNotification = async ({ userId, title, content, notificationType }) => {
  try {
    await createNotification({
      receiverId: userId,
      receiverRole: 'member',
      notificationType,
      title,
      content,
      createdBy: 'System',
      sendEmail: false,
    })
  } catch (error) {
    console.error('Tạo thông báo trong app thất bại:', error.message)
  }
}

const calculateDaysUntilExpiry = (endDate) => {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
}

const sendReminderForMembership = async (membership, daysLeft) => {
  const user = await User.findById(membership.memberId).lean()
  if (!user) return

  let planName = 'gói tập'
  if (membership.planId) {
    if (typeof membership.planId === 'object') {
      planName = membership.planId.nameVi || membership.planId.nameEn || 'gói tập'
    } else {
      const plan = await Plan.findById(membership.planId).lean().catch(() => null)
      if (plan) planName = plan.nameVi || plan.nameEn || 'gói tập'
    }
  }

  await createInAppNotification({
    userId: user._id,
    title: 'Gói tập sắp hết hạn',
    content: `Gói tập "${planName}" của bạn sẽ hết hạn sau ${daysLeft} ngày. Hãy gia hạn để tiếp tục tập luyện!`,
    notificationType: daysLeft === 7 ? NOTIFICATION_TYPES.MEMBERSHIP_EXPIRING_7D : NOTIFICATION_TYPES.MEMBERSHIP_EXPIRING_1D,
  })

  if (user.email) {
    sendRenewalReminderEmail({
      toEmail: user.email,
      userName: user.fullName || user.name || user.email,
      planName,
      endDate: membership.endDate,
      daysLeft,
    }).catch((e) => console.error('Gửi email nhắc hết hạn thất bại:', e.message))
  }

  // Đánh dấu đã gửi reminder cho ngày này
  await Membership.findByIdAndUpdate(membership._id, {
    $addToSet: { remindersSent: daysLeft },
  })
}

const checkAndSendReminders = async (membership) => {
  if (!membership || membership.status !== 'active') return

  const daysLeft = calculateDaysUntilExpiry(membership.endDate)
  const alreadySent = membership.remindersSent || []

  for (const targetDays of REMINDER_DAYS) {
    if (daysLeft === targetDays && !alreadySent.includes(targetDays)) {
      await sendReminderForMembership(membership, targetDays)
    }
  }
}

export const startMembershipReminderScheduler = () => {
  // Real-time: Change Stream theo dõi Membership collection
  try {
    const changeStream = Membership.watch([], { fullDocument: 'updateLookup' })
    changeStream.on('change', async (change) => {
      if (['insert', 'update', 'replace'].includes(change.operationType)) {
        const doc = change.fullDocument
        if (doc) {
          // Dùng lean để tránh vòng lặp không cần thiết
          const membership = await Membership.findById(doc._id).lean()
          if (membership) checkAndSendReminders(membership)
        }
      }
    })
    changeStream.on('error', (error) => {
      console.error('[ChangeStream] Lỗi:', error.message)
    })
    console.log('[Scheduler] Đã khởi tạo Change Stream real-time cho Membership')
  } catch (error) {
    console.error('[ChangeStream] Không thể tạo Change Stream (cần replica set):', error.message)
  }

  // Fallback: chạy mỗi 1 phút để quét các membership còn sót
  cron.schedule('* * * * *', async () => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    for (const daysLeft of REMINDER_DAYS) {
      const targetDate = new Date(now)
      targetDate.setDate(targetDate.getDate() + daysLeft)
      targetDate.setHours(23, 59, 59, 999)
      const startOfTargetDay = new Date(targetDate)
      startOfTargetDay.setHours(0, 0, 0, 0)

      const memberships = await Membership.find({
        status: 'active',
        endDate: { $gte: startOfTargetDay, $lte: targetDate },
        remindersSent: { $ne: daysLeft },
      }).lean()

      for (const membership of memberships) {
        await sendReminderForMembership(membership, daysLeft)
      }

      if (memberships.length > 0) {
        console.log(`[Scheduler] Đã gửi nhắc nhở cho ${memberships.length} gói tập còn ${daysLeft} ngày`)
      }
    }
  })

  console.log('[Scheduler] Đã khởi tạo lịch nhắc hết hạn gói tập')
}
