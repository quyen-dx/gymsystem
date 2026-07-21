import crypto from 'crypto'
import Order from '../models/Order.js'
import Shipping from '../models/Shipping.js'
import logger from '../config/logger.js'

const GHN_WEBHOOK_SIGNATURE_HEADER = 'x-ghn-signature'

const verifySignature = (rawBody) => {
  const secret = process.env.GHN_WEBHOOK_SECRET
  if (!secret) return true

  const receivedSig = rawBody.headers?.[GHN_WEBHOOK_SIGNATURE_HEADER] || ''
  if (!receivedSig) return false

  try {
    const expected = crypto.createHmac('sha256', secret).update(rawBody.string).digest('hex')

    const sigBuf = Buffer.from(receivedSig, 'hex')
    const expBuf = Buffer.from(expected, 'hex')

    if (sigBuf.length !== expBuf.length) return false

    return crypto.timingSafeEqual(sigBuf, expBuf)
  } catch (_) {
    return false
  }
}

const statusMap = {
  picking: 'ĐANG GIAO HÀNG',
  picked: 'ĐANG GIAO HÀNG',
  storing: 'ĐANG GIAO HÀNG',
  transporting: 'ĐANG GIAO HÀNG',
  sorting: 'ĐANG GIAO HÀNG',
  delivering: 'ĐANG GIAO HÀNG',
  delivered: 'GIAO THÀNH CÔNG',
  delivery_fail: 'ĐANG GIAO HÀNG',
  waiting_to_return: 'ĐANG GIAO HÀNG',
  returning: 'ĐANG GIAO HÀNG',
  returned: 'ĐÃ HỦY',
  canceled: 'ĐÃ HỦY',
}

const handler = async (req, res) => {
  let rawBody
  try {
    rawBody = {
      string: req.body.toString('utf-8'),
      buffer: req.body,
      headers: req.headers,
    }
  } catch (_) {
    logger.warn('[GHN Webhook] Failed to read raw body')
    return res.status(400).json({ success: false, message: 'Cannot read body' })
  }

  if (!verifySignature(rawBody)) {
    logger.warn('[GHN Webhook] Invalid signature')
    return res.status(401).json({ success: false, message: 'Invalid signature' })
  }

  try {
    let payload
    try {
      payload = JSON.parse(rawBody.string)
    } catch (_) {
      return res.status(400).json({ success: false, message: 'Invalid JSON payload' })
    }

    const OrderCode = payload.OrderCode
    const Status = payload.Status

    if (!OrderCode) {
      return res.status(400).json({ success: false, message: 'Missing OrderCode' })
    }

    const mappedStatus = statusMap[Status] || null
    if (!mappedStatus) {
      return res.status(200).json({ success: true, message: 'Status not mapped, ignored' })
    }

    const order = await Order.findOne({ trackingCode: String(OrderCode) })
    if (!order) {
      logger.warn(`[GHN Webhook] Order not found for tracking code: ${OrderCode}`)
      return res.status(404).json({ success: false, message: 'Order not found' })
    }

    if (mappedStatus === 'GIAO THÀNH CÔNG' && order.status !== 'GIAO THÀNH CÔNG') {
      order.status = 'GIAO THÀNH CÔNG'
      order.inventoryDeducted = true
      await order.save()
    }

    if (mappedStatus === 'ĐÃ HỦY' && !['ĐÃ HỦY', 'GIAO THÀNH CÔNG', 'ĐANG HOÀN TRẢ', 'ĐÃ HOÀN TRẢ', 'ĐÃ HOÀN TIỀN'].includes(order.status)) {
      order.status = 'ĐÃ HỦY'
      order.cancelledAt = new Date()
      await order.save()
    }

    await Shipping.updateOne(
      { orderId: order._id },
      { $set: { trackingStatus: mappedStatus } },
    )

    logger.info(`[GHN Webhook] Updated order ${order._id} to ${mappedStatus}`)
    return res.status(200).json({ success: true })
  } catch (error) {
    logger.error('[GHN Webhook] Error processing webhook:', error.message)
    return res.status(500).json({ success: false, message: 'Internal server error' })
  }
}

export default handler
