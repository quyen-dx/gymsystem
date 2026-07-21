import { expireStaleReservations } from '../services/inventoryService.js'
import Product from '../models/Product.js'
import InventoryReservation from '../models/InventoryReservation.js'
import logger from '../config/logger.js'

export const runInventoryReleaseJob = async () => {
  try {
    const expiredReservations = await InventoryReservation.find({
      status: 'expired',
      inventoryRestored: { $ne: true },
    }).lean()

    for (const reservation of expiredReservations) {
      const product = await Product.findById(reservation.productId)
      if (!product) continue

      if (Array.isArray(product.weightVariants) && product.weightVariants.length > 0 && reservation.variantId) {
        const variant = await Product.findById(reservation.variantId)
        if (variant) {
          await Product.findByIdAndUpdate(reservation.variantId, {
            $inc: { stock: reservation.quantity },
          })
        }
      } else {
        await Product.findByIdAndUpdate(reservation.productId, {
          $inc: { stock: reservation.quantity },
        })
      }

      await InventoryReservation.updateOne(
        { _id: reservation._id },
        { $set: { inventoryRestored: true } },
      )
    }

    const staleCount = await expireStaleReservations()
    if (staleCount > 0) {
      logger.info(`[InventoryReleaseJob] Marked ${staleCount} reservations as expired`)
    }
  } catch (error) {
    logger.error('[InventoryReleaseJob] Failed:', error.message)
  }
}
