import mongoose from 'mongoose'
import OrderReturn from '../models/OrderReturn.js'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import AppError from '../utils/appError.js'
import { applyWalletTransaction, getOrCreateWallet } from './walletService.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'

const RETURN_WINDOW_DAYS = 7

export const requestReturn = async ({ orderId, userId, items, reason }) => {
    if (!Array.isArray(items) || items.length === 0) {
        throw new AppError('Return must include at least one item', 400)
    }

    const order = await Order.findOne({
        _id: orderId,
        userId,
        status: 'GIAO THÀNH CÔNG',
    }).lean()

    if (!order) {
        throw new AppError('Không tìm thấy đơn hàng đã giao để hoàn trả', 404)
    }

    const deliveredDate = order.updatedAt
    if (!deliveredDate) {
        throw new AppError('Không xác định được ngày giao hàng', 400)
    }

    const daysSinceDelivery = Math.floor((Date.now() - new Date(deliveredDate).getTime()) / (1000 * 60 * 60 * 24))
    if (daysSinceDelivery > RETURN_WINDOW_DAYS) {
        throw new AppError(`Thời gian hoàn trả đã hết (${RETURN_WINDOW_DAYS} ngày kể từ khi nhận hàng)`, 400)
    }

    const existing = await OrderReturn.findOne({ orderId, userId, status: { $ne: 'rejected' } })
    if (existing) {
        throw new AppError('Đơn hàng này đã có yêu cầu hoàn trả đang xử lý', 400)
    }

    const returnItems = []
    let refundAmount = 0

    for (const requestedItem of items) {
        const orderItem = order.items[requestedItem.orderItemIndex]
        if (!orderItem) {
            throw new AppError(`Sản phẩm không tồn tại trong đơn hàng: ${requestedItem.productId}`, 400)
        }

        const qty = Number(requestedItem.quantity || 1)
        if (qty > Number(orderItem.quantity || 1)) {
            throw new AppError(`Số lượng hoàn trả vượt quá số lượng đã mua`, 400)
        }

        const itemRefund = Number(orderItem.price || 0) * qty
        refundAmount += itemRefund

        returnItems.push({
            productId: orderItem.productId,
            variantWeight: String(orderItem.variant?.weight || ''),
            quantity: qty,
            unitPrice: Number(orderItem.price || 0),
            reason: requestedItem.reason || reason || '',
        })
    }

    const shopId = order.shopId
    if (!shopId) {
        throw new AppError('Không xác định được shop của đơn hàng', 400)
    }

    const returnRequest = await OrderReturn.create({
        orderId,
        userId,
        shopId,
        items: returnItems,
        reason: reason || '',
        refundAmount,
    })

    createNotification({
        receiverId: order.items[0]?.sellerId,
        receiverRole: 'seller',
        notificationType: NOTIFICATION_TYPES.REFUND_REQUEST,
        title: 'Yêu cầu hoàn trả mới',
        content: `Khách hàng yêu cầu hoàn trả đơn hàng #${orderId}. Số tiền hoàn: ${refundAmount.toLocaleString('vi-VN')}₫`,
        relatedId: returnRequest._id,
        relatedType: 'OrderReturn',
        redirectUrl: '/seller/returns',
        createdBy: 'System',
    }).catch(err => console.error('Notify requestReturn failed:', err.message))

    return returnRequest
}

export const approveReturn = async ({ returnId, approverId }) => {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
        const returnRequest = await OrderReturn.findOne({
            _id: returnId,
            status: 'requested',
        }).session(session)

        if (!returnRequest) {
            throw new AppError('Không tìm thấy yêu cầu hoàn trả', 404)
        }

        const order = await Order.findOne({ _id: returnRequest.orderId }).session(session)

        for (const item of returnRequest.items) {
            const productId = item.productId
            const quantity = Number(item.quantity || 0)
            const variantWeight = String(item.variantWeight || '')

            if (variantWeight) {
                const result = await Product.findOneAndUpdate(
                    {
                        _id: productId,
                        'weightVariants.label': variantWeight,
                    },
                    { $inc: { 'weightVariants.$.stock': quantity } },
                    { session },
                )
                if (!result) {
                    console.warn(`returnService.approveReturn: variant product ${productId}/${variantWeight} not found during stock restoration`)
                }
            } else {
                const result = await Product.findByIdAndUpdate(
                    productId,
                    { $inc: { stock: quantity } },
                    { session },
                )
                if (!result) {
                    console.warn(`returnService.approveReturn: product ${productId} not found during stock restoration`)
                }
            }
        }

        if (order && !order.escrowReleased) {
            order.sellerEscrowAmount = 0
            order.escrowReleased = true
            await order.save({ session })
        }

        await getOrCreateWallet(returnRequest.userId, session)
        await applyWalletTransaction({
            userId: returnRequest.userId,
            amount: returnRequest.refundAmount,
            type: 'refund',
            provider: 'marketplace',
            referenceId: `return_${returnId}_${returnRequest.userId}`,
            status: 'completed',
            metadata: {
                returnId,
                orderId: returnRequest.orderId,
                items: returnRequest.items.map(i => ({
                    productId: i.productId,
                    quantity: i.quantity,
                })),
            },
            idempotencyKey: `return_refund_${returnId}`,
            session,
        })

        returnRequest.status = 'approved'
        returnRequest.approvedBy = approverId
        returnRequest.approvedAt = new Date()
        await returnRequest.save({ session })

        await session.commitTransaction()

        createNotification({
            receiverId: returnRequest.userId,
            receiverRole: 'member',
            notificationType: NOTIFICATION_TYPES.REFUND_APPROVED,
            title: 'Yêu cầu hoàn trả được chấp nhận',
            content: `Yêu cầu hoàn trả của bạn đã được chấp nhận. Số tiền ${returnRequest.refundAmount.toLocaleString('vi-VN')}₫ đã được hoàn vào ví.`,
            relatedId: returnRequest._id,
            relatedType: 'OrderReturn',
            redirectUrl: '/my-orders',
            createdBy: 'System',
        }).catch(err => console.error('Notify approveReturn failed:', err.message))

        return returnRequest
    } catch (error) {
        await session.abortTransaction()
        throw error
    } finally {
        session.endSession()
    }
}

export const rejectReturn = async ({ returnId, approverId, reason }) => {
    const returnRequest = await OrderReturn.findOne({
        _id: returnId,
        status: 'requested',
    })

    if (!returnRequest) {
        throw new AppError('Không tìm thấy yêu cầu hoàn trả', 404)
    }

    returnRequest.status = 'rejected'
    returnRequest.rejectedBy = approverId
    returnRequest.rejectedAt = new Date()
    returnRequest.rejectionReason = reason || ''
    await returnRequest.save()

    createNotification({
        receiverId: returnRequest.userId,
        receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.REFUND_REQUEST,
        title: 'Yêu cầu hoàn trả bị từ chối',
        content: `Yêu cầu hoàn trả của bạn đã bị từ chối. ${reason ? `Lý do: ${reason}` : ''}`,
        relatedId: returnRequest._id,
        relatedType: 'OrderReturn',
        redirectUrl: '/my-orders',
        createdBy: 'System',
    }).catch(err => console.error('Notify rejectReturn failed:', err.message))

    return returnRequest
}

export const getReturns = async (filter = {}) => {
    return OrderReturn.find(filter)
        .populate('orderId', 'totalAmount status')
        .populate('userId', 'name fullName email')
        .sort({ createdAt: -1 })
}

export const getReturnById = async (returnId) => {
    return OrderReturn.findById(returnId)
        .populate('orderId', 'totalAmount status items')
        .populate('userId', 'name fullName email')
}
