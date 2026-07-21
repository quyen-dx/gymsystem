import { expireStaleReservations, checkLowStock } from '../services/inventoryService.js'
import { createNotification } from '../services/notificationService.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import logger from '../config/logger.js'

const LOW_STOCK_DEBOUNCE_MS = 60 * 60 * 1000
const lastLowStockAlert = new Map()

export const runInventoryReservationJob = async () => {
  try {
    const expiredCount = await expireStaleReservations()
    if (expiredCount > 0) {
      logger.info(`[InventoryJob] Released ${expiredCount} expired reservations`)
    }
  } catch (err) {
    logger.error('[InventoryJob] Failed to expire reservations:', err.message)
  }

  try {
    const lowStockItems = await checkLowStock()
    const now = Date.now()

    for (const item of lowStockItems) {
      if (!item.sellerId) continue

      const key = String(item.id)
      const lastAlert = lastLowStockAlert.get(key)
      if (lastAlert && (now - lastAlert) < LOW_STOCK_DEBOUNCE_MS) continue

      lastLowStockAlert.set(key, now)

      const title = 'Cảnh báo tồn kho thấp'
      const content = `Sản phẩm "${item.name}" sắp hết hàng (còn ${item.stock} sản phẩm). Vui lòng nhập thêm hàng.`

      try {
        await createNotification({
          receiverId: item.sellerId,
          notificationType: NOTIFICATION_TYPES.OTHER,
          title,
          content,
          relatedId: item.id,
          relatedType: item.type === 'variant' ? 'ProductVariant' : 'Product',
          priority: 'medium',
        })
      } catch (_) {
        // notification delivery failure is non-blocking
      }
    }
  } catch (err) {
    logger.error('[InventoryJob] Failed to check low stock:', err.message)
  }
}
