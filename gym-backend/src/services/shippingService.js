import Shipping from '../models/Shipping.js'
import Order from '../models/Order.js'
import AppError from '../utils/appError.js'
import { calculateOrderShipping } from './orderService.js'
import { createShipmentGHN, getTrackingInfoGHN } from './ghnService.js'

export const getShipping = async (orderId) => {
  return Shipping.findOne({ orderId })
}

export const createShipping = async ({ orderId, shippingFee, estimatedDays, estimatedDeliveryDate, address, session }) => {
  const data = {
    orderId,
    shippingFee,
    estimatedDays,
    estimatedDeliveryDate: estimatedDeliveryDate instanceof Date
      ? estimatedDeliveryDate
      : new Date(Date.now() + (estimatedDays || 3) * 24 * 60 * 60 * 1000),
    trackingStatus: 'CHỜ XÁC NHẬN',
    address,
  }

  if (session) {
    const [doc] = await Shipping.create([data], { session })
    return doc
  }
  return Shipping.create(data)
}

export const calculateShipping = async ({ items, address, totalWeight }) => {
  return calculateOrderShipping({ items: items || [], address, totalWeight: totalWeight || 0 })
}

export const requestShipment = async ({ orderId, shippingId, items, address }) => {
  const shipping = await Shipping.findById(shippingId)
  if (!shipping) throw new AppError('Không tìm thấy thông tin vận chuyển', 404)

  try {
    const result = await createShipmentGHN({
      orderId,
      items,
      address,
      shippingFee: shipping.shippingFee,
    })

    if (result && result.trackingCode) {
      shipping.carrier = 'ghn'
      await shipping.save()
      await Order.updateOne({ _id: orderId }, { $set: { trackingCode: result.trackingCode } })
    }

    return result
  } catch (error) {
    return { isMock: true, error: error.message }
  }
}

export const getTrackingInfo = async (orderId) => {
  const shipping = await Shipping.findOne({ orderId }).lean()
  if (!shipping) throw new AppError('Không tìm thấy thông tin vận chuyển', 404)

  const order = await Order.findById(orderId).select('trackingCode').lean()

  let ghnTracking = null
  if (order?.trackingCode && shipping.carrier === 'ghn') {
    try {
      ghnTracking = await getTrackingInfoGHN(order.trackingCode)
    } catch (_) {
      // GHN tracking unavailable, fall back to local data
    }
  }

  return {
    ...shipping,
    ghnTracking: ghnTracking || null,
  }
}
