import Notification from '../models/Notification.js'
import logger from '../config/logger.js'

export const runNotificationCleanupJob = async () => {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  try {
    const softDeletedCount = await Notification.deleteMany({
      deletedAt: { $ne: null, $lte: ninetyDaysAgo },
    })

    const expiredCount = await Notification.deleteMany({
      expiresAt: { $ne: null, $lte: new Date() },
    })

    if (softDeletedCount.deletedCount > 0 || expiredCount.deletedCount > 0) {
      logger.info('notificationCleanupJob completed', {
        softDeleted: softDeletedCount.deletedCount,
        expired: expiredCount.deletedCount,
      })
    }
  } catch (err) {
    logger.error('notificationCleanupJob failed', { error: err.message })
  }
}
