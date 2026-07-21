import MembershipCycle from '../models/MembershipCycle.js'
import { createNotification } from '../services/notificationService.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import logger from '../config/logger.js'

const SEVEN_DAYS = 7
const ONE_DAY = 1

export const runMembershipExpiryRemindersJob = async () => {
  const now = new Date()
  const sevenDaysFromNow = new Date(now)
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + SEVEN_DAYS)
  sevenDaysFromNow.setHours(23, 59, 59, 999)

  const oneDayFromNow = new Date(now)
  oneDayFromNow.setDate(oneDayFromNow.getDate() + ONE_DAY)
  oneDayFromNow.setHours(23, 59, 59, 999)

  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)

  try {
    const sevenDayCycles = await MembershipCycle.find({
      status: 'active',
      expiresAt: {
        $gte: new Date(sevenDaysFromNow.getFullYear(), sevenDaysFromNow.getMonth(), sevenDaysFromNow.getDate()),
        $lt: new Date(sevenDaysFromNow.getFullYear(), sevenDaysFromNow.getMonth(), sevenDaysFromNow.getDate() + 1),
      },
    }).select('memberId').lean()

    for (const cycle of sevenDayCycles) {
      createNotification({
        receiverId: cycle.memberId,
        receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.MEMBERSHIP_EXPIRING_7D,
        title: 'Gói tập sắp hết hạn (7 ngày)',
        content: 'Gói tập của bạn sẽ hết hạn trong 7 ngày. Vui lòng gia hạn để không bị gián đoạn.',
        priority: 'high',
        sendEmail: true,
        sendSms: true,
      }).catch(err => logger.error('Expiry 7d notification failed', { error: err.message }))
    }

    const oneDayCycles = await MembershipCycle.find({
      status: 'active',
      expiresAt: {
        $gte: new Date(oneDayFromNow.getFullYear(), oneDayFromNow.getMonth(), oneDayFromNow.getDate()),
        $lt: new Date(oneDayFromNow.getFullYear(), oneDayFromNow.getMonth(), oneDayFromNow.getDate() + 1),
      },
    }).select('memberId').lean()

    for (const cycle of oneDayCycles) {
      createNotification({
        receiverId: cycle.memberId,
        receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.MEMBERSHIP_EXPIRING_1D,
        title: 'Gói tập sắp hết hạn (1 ngày)',
        content: 'Gói tập của bạn sẽ hết hạn vào ngày mai. Gia hạn ngay để không bị gián đoạn!',
        priority: 'high',
        sendEmail: true,
        sendSms: true,
      }).catch(err => logger.error('Expiry 1d notification failed', { error: err.message }))
    }

    const expiredResult = await MembershipCycle.updateMany(
      {
        status: 'active',
        expiresAt: { $lte: todayEnd },
      },
      { $set: { status: 'completed' } },
    )

    if (expiredResult.modifiedCount > 0) {
      logger.info(`Completed ${expiredResult.modifiedCount} expired membership cycles`)
    }

    const expiredCycles = await MembershipCycle.find({
      status: 'completed',
      updatedAt: { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
    }).select('memberId').lean()

    for (const cycle of expiredCycles) {
      createNotification({
        receiverId: cycle.memberId,
        receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.MEMBERSHIP_EXPIRED,
        title: 'Gói tập đã hết hạn',
        content: 'Gói tập của bạn đã hết hạn. Vui lòng đăng ký gói mới để tiếp tục tập luyện.',
        priority: 'high',
        sendEmail: true,
      }).catch(err => logger.error('Expired notification failed', { error: err.message }))
    }

    logger.info('membershipExpiryRemindersJob completed', {
      sevenDay: sevenDayCycles.length,
      oneDay: oneDayCycles.length,
      completed: expiredResult.modifiedCount,
      expiredNotif: expiredCycles.length,
    })
  } catch (err) {
    logger.error('membershipExpiryRemindersJob failed', { error: err.message })
  }
}
