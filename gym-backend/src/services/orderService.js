import mongoose from 'mongoose'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import Shop from '../models/Shop.js'
import Shipping from '../models/Shipping.js'
import DiscountCode from '../models/DiscountCode.js'
import AppError from '../utils/appError.js'
import { applyWalletTransaction, getOrCreateWallet } from './walletService.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'
import { generateOrderNumber } from './orderNumberService.js'

const PLATFORM_FEE_RATE = Number(process.env.PLATFORM_FEE_RATE || 0.02)
export const ORDER_STATUSES = ['CHỜ XÁC NHẬN', 'ĐANG GIAO HÀNG', 'GIAO THÀNH CÔNG', 'ĐÃ HỦY', 'ĐANG HOÀN TRẢ', 'ĐÃ HOÀN TRẢ', 'ĐÃ HOÀN TIỀN']
const DELIVERED_STATUS = 'GIAO THÀNH CÔNG'
const CANCELLABLE_STATUSES = ['CHỜ XÁC NHẬN']

import { calculateShippingGHN } from './ghnService.js'

const VALID_TRANSITIONS = {
    'CHỜ XÁC NHẬN': ['ĐANG GIAO HÀNG'],
    'ĐANG GIAO HÀNG': ['GIAO THÀNH CÔNG'],
    'GIAO THÀNH CÔNG': ['ĐANG HOÀN TRẢ'],
    'ĐANG HOÀN TRẢ': ['ĐÃ HOÀN TRẢ'],
    'ĐÃ HOÀN TRẢ': ['ĐÃ HOÀN TIỀN'],
    'ĐÃ HỦY': [],
    'ĐÃ HOÀN TIỀN': [],
}

const buildShippingAddress = (address) => {
    const city = address.city || address.province
    return {
        recipientName: address.recipientName,
        phone: address.phone,
        street: address.street,
        ward: address.ward,
        district: address.district,
        province: city,
        city,
        note: address.note,
    }
}

const getShopAddressForItems = async (items) => {
    const productIds = items.map((item) => item.productId).filter(Boolean)
    if (!productIds.length) return new Map()

    const products = await Product.find({ _id: { $in: productIds } })
        .select('shop_id')
        .populate('shop_id', 'address')

    return products.reduce((map, product) => {
        map.set(product._id.toString(), product.shop_id?.address || null)
        return map
    }, new Map())
}

export const calculateOrderShipping = async ({ items = [], address, totalWeight = 0 }) => {
    if (!Array.isArray(items) || items.length === 0) {
        return calculateShippingGHN({ toAddress: address, totalWeight })
    }

    const addressByProductId = await getShopAddressForItems(items)
    const groups = new Map()
    items.forEach((item) => {
        const productId = item.productId?.toString()
        const fromAddress = addressByProductId.get(productId) || null
        const key = JSON.stringify(fromAddress || { default: true })
        const current = groups.get(key) || { fromAddress, weight: 0 }
        current.weight += Number(item.weight || 0) * Number(item.quantity || 1)
        groups.set(key, current)
    })

    const parts = await Promise.all(
        Array.from(groups.values()).map((group) =>
            calculateShippingGHN({
                fromAddress: group.fromAddress,
                toAddress: address,
                totalWeight: group.weight || totalWeight,
            }),
        ),
    )

    const maxDays = Math.max(...parts.map((part) => Number(part.estimatedDays || 0)), 1)
    const estimatedDeliveryDate = new Date(Date.now() + maxDays * 24 * 60 * 60 * 1000)
    const dd = String(estimatedDeliveryDate.getDate()).padStart(2, '0')
    const mm = String(estimatedDeliveryDate.getMonth() + 1).padStart(2, '0')
    const yyyy = estimatedDeliveryDate.getFullYear()

    return {
        shippingFee: parts.reduce((sum, part) => sum + Number(part.shippingFee || 0), 0),
        estimatedDays: maxDays,
        estimatedDeliveryDate: `${dd}/${mm}/${yyyy}`,
        packages: parts,
        isMock: parts.some((part) => part.isMock),
    }
}

export const calculateCheckoutDiscount = async ({ code, subtotal, shippingFee }) => {
    const normalizedCode = String(code || '').trim().toUpperCase()
    if (!normalizedCode) return { code: '', amount: 0, type: 'none' }

    const discountCode = await DiscountCode.findOne({ code: normalizedCode, isActive: true }).lean()
    if (!discountCode) throw new AppError('Mã giảm giá không hợp lệ', 400)

    if (discountCode.type === 'free_shipping') {
        return { code: normalizedCode, type: discountCode.type, amount: Math.max(0, Number(shippingFee || 0)) }
    }
    if (discountCode.type === 'shipping_discount') {
        return { code: normalizedCode, type: discountCode.type, amount: Math.min(Number(discountCode.amount || 0), Number(shippingFee || 0)) }
    }

    return { code: normalizedCode, type: discountCode.type, amount: Math.min(Number(discountCode.amount || 0), Number(subtotal || 0)) }
}

export const createOrder = async ({ userId, items, address, paymentReference, discountCode }) => {
    if (!userId || !Array.isArray(items) || items.length === 0) {
        throw new AppError('Order must include at least one item', 400)
    }
    if (!address || !address.recipientName || !address.phone || !address.street || !address.district || !(address.city || address.province)) {
        throw new AppError('Shipping address is incomplete', 400)
    }

    const productIds = items.map((item) => item.productId).filter(Boolean)
    const products = await Product.find({ _id: { $in: productIds } })
        .select('name image images price shop_id')
        .populate('shop_id', 'user_id name')
        .lean()
    const productById = products.reduce((map, product) => {
        map.set(product._id.toString(), product)
        return map
    }, new Map())

    const orderItems = items.map((item) => {
        const product = productById.get(item.productId?.toString())
        if (!product) {
            throw new AppError('Sản phẩm trong đơn hàng không tồn tại', 400)
        }

        const price = Number(item.price)
        const quantity = Number(item.quantity)
        const variantWeight = String(item.variant?.weight || item.weight || '').trim()
        let weight = variantWeight || 0

        if (typeof weight === 'string') {
            const normalized = weight.trim().toLowerCase()
            if (normalized.endsWith('kg')) {
                weight = Number(normalized.replace(/kg$/, '').trim())
            } else if (normalized.endsWith('g')) {
                weight = Number(normalized.replace(/g$/, '').trim()) / 1000
            } else {
                weight = Number(normalized)
            }
        } else {
            weight = Number(weight)
        }

        if (typeof price !== 'number' || Number.isNaN(price) || price < 0) {
            throw new AppError('Order item price must be a valid number', 400)
        }
        if (typeof quantity !== 'number' || Number.isNaN(quantity) || quantity <= 0) {
            throw new AppError('Order item quantity must be a positive number', 400)
        }
        if (typeof weight !== 'number' || Number.isNaN(weight) || weight < 0) {
            weight = 0
        }

        return {
            productId: item.productId,
            sellerId: item.sellerId || product.shop_id?.user_id,
            shopId: product.shop_id?._id,
            shopName: product.shop_id?.name || 'Shop',
            name: product.name,
            productName: product.name,
            productImage: item.productImage || product.image || product.images?.[0] || '',
            quantity,
            price,
            weight,
            variant: {
                weight: variantWeight,
            },
            total: price * quantity,
        }
    })

    const groups = new Map()
    orderItems.forEach((item) => {
        if (!item.shopId) throw new AppError('Sản phẩm chưa thuộc shop hợp lệ', 400)
        const key = item.shopId.toString()
        const group = groups.get(key) || {
            shopId: item.shopId,
            shopName: item.shopName,
            sellerId: item.sellerId,
            items: [],
        }
        group.items.push(item)
        groups.set(key, group)
    })

    const orderGroups = await Promise.all(Array.from(groups.values()).map(async (group) => {
        const subtotal = group.items.reduce((sum, item) => sum + item.total, 0)
        const totalWeight = group.items.reduce((sum, item) => sum + item.weight * item.quantity, 0)
        const shippingInfo = await calculateOrderShipping({ items: group.items, address, totalWeight })
        return {
            ...group,
            subtotal,
            shippingInfo,
            grandTotal: subtotal + shippingInfo.shippingFee,
        }
    }))

    const subtotal = orderGroups.reduce((sum, group) => sum + group.subtotal, 0)
    const shippingFee = orderGroups.reduce((sum, group) => sum + group.shippingInfo.shippingFee, 0)
    const discount = await calculateCheckoutDiscount({ code: discountCode, subtotal, shippingFee })
    const grandTotal = Math.max(0, subtotal + shippingFee - discount.amount)

    const session = await mongoose.startSession()
    try {
        session.startTransaction()

        // BR-SHP-001: Atomic inventory reservation using direct stock decrement.
        // The Product schema uses a single `stock` field (no qty_available / qty_reserved split).
        // Reservation is modeled as stock → stock - qty at checkout, stock + qty on cancel/return.
        // The atomic $gte guard below prevents negative inventory and concurrent oversell.
        for (const item of orderItems) {
            const product = await Product.findById(item.productId).session(session)
            if (!product) {
                throw new AppError(`Sản phẩm ${item.name} không còn tồn tại`, 400)
            }

            const quantity = item.quantity
            const variantWeight = String(item.variant?.weight || '').trim()

            if (Array.isArray(product.weightVariants) && product.weightVariants.length > 0) {
                const variantQty = Number(quantity || 0)
                if (variantWeight === '') {
                    throw new AppError(`Vui lòng chọn biến thể cho sản phẩm ${product.name}`, 400)
                }

                const updated = await Product.findOneAndUpdate(
                    {
                        _id: item.productId,
                        'weightVariants': {
                            $elemMatch: {
                                label: variantWeight,
                                stock: { $gte: variantQty },
                            },
                        },
                    },
                    { $inc: { 'weightVariants.$.stock': -variantQty } },
                    { new: true, session },
                )
                if (!updated) {
                    throw new AppError(`Tồn kho không đủ cho ${product.name} (${variantWeight})`, 400)
                }
            } else {
                const updated = await Product.findOneAndUpdate(
                    { _id: item.productId, stock: { $gte: quantity } },
                    { $inc: { stock: -quantity } },
                    { new: true, session },
                )
                if (!updated) {
                    throw new AppError(`Tồn kho không đủ cho ${product.name}`, 400)
                }
            }
        }

        const idempotencyKey = paymentReference ? `order_${paymentReference}` : `order_${Date.now()}`
        const { wallet } = await applyWalletTransaction({
            userId,
            amount: -grandTotal,
            type: 'payment',
            provider: 'wallet',
            referenceId: paymentReference || idempotencyKey,
            status: 'completed',
            metadata: {
                items: orderItems,
                shippingFee,
                discountCode: discount.code,
                discountAmount: discount.amount,
            },
            idempotencyKey,
            session,
        })

        const createdOrders = []
        let allocatedDiscount = 0
        for (const group of orderGroups) {
            const isLastGroup = group === orderGroups[orderGroups.length - 1]
            const groupBaseTotal = subtotal + shippingFee
            const groupShare = groupBaseTotal > 0 ? (group.subtotal + group.shippingInfo.shippingFee) / groupBaseTotal : 0
            const groupDiscount = isLastGroup ? discount.amount - allocatedDiscount : Math.round(discount.amount * groupShare)
            allocatedDiscount += groupDiscount
            const groupTotal = Math.max(0, group.subtotal + group.shippingInfo.shippingFee - groupDiscount)

            const order = await Order.create(
                [{
                    userId,
                    shopId: group.shopId,
                    items: group.items,
                    orderNumber: await generateOrderNumber(),
                    totalAmount: groupTotal,
                    totalPrice: Math.max(0, group.subtotal - Math.min(group.subtotal, groupDiscount)),
                    shippingFee: group.shippingInfo.shippingFee,
                    address: buildShippingAddress(address),
                    status: 'CHỜ XÁC NHẬN',
                    paymentStatus: 'paid',
                    paymentReference,
                    discountCode: discount.code,
                    discountAmount: groupDiscount,
                }],
                { session },
            )

            const shipping = await Shipping.create(
                [{
                    orderId: order[0]._id,
                    shippingFee: group.shippingInfo.shippingFee,
                    estimatedDays: group.shippingInfo.estimatedDays,
                    estimatedDeliveryDate: new Date(Date.now() + group.shippingInfo.estimatedDays * 24 * 60 * 60 * 1000),
                    trackingStatus: 'CHỜ XÁC NHẬN',
                    address: buildShippingAddress(address),
                }],
                { session },
            )

            order[0].shippingId = shipping[0]._id
            await order[0].save({ session })
            createdOrders.push(order[0])

            const groupSubtotalDiscount = Math.min(group.subtotal, groupDiscount)
            const payoutBase = Math.max(0, group.subtotal - groupSubtotalDiscount)
            const payoutAmount = Math.max(0, payoutBase * (1 - PLATFORM_FEE_RATE))

            order[0].sellerEscrowAmount = payoutAmount
            order[0].escrowReleased = false
            await order[0].save({ session })
        }

        await session.commitTransaction()

        createNotification({
          receiverId: userId,
          receiverRole: 'member',
          notificationType: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
          title: 'Đặt hàng thành công',
          content: 'Đơn hàng của bạn đã được đặt thành công.',
          relatedId: createdOrders[0]._id,
          relatedType: 'Order',
          redirectUrl: '/my-orders',
          createdBy: 'System',
        }).catch(err => console.error('Notify checkoutOrder failed:', err.message))

        return createdOrders
    } catch (error) {
        await session.abortTransaction()
        throw error
    } finally {
        session.endSession()
    }
}

export const getOrderById = async (orderId, userId) => {
    const filter = userId ? { _id: orderId, userId } : { _id: orderId }
    return Order.findOne(filter)
        .populate('items.productId', 'name image images')
        .populate('userId', 'name fullName phone email')
        .populate('shopId', 'name avatar user_id')
}

export const getOrdersByUser = async (userId) => {
    return Order.find({ userId, hiddenForUser: { $ne: true } })
        .populate('items.productId', 'name image images')
        .populate('shopId', 'name avatar')
        .sort({ createdAt: -1 })
}

export const hideOrderForUser = async (orderId, userId) => {
    const order = await Order.findOneAndUpdate(
        { _id: orderId, userId },
        { hiddenForUser: true, hiddenForUserAt: new Date() },
        { new: true },
    )
    if (!order) {
        throw new AppError('Không tìm thấy đơn hàng', 404)
    }
    return order
}

export const getOrdersBySeller = async (sellerId) => {
    const shop = await Shop.findOne({ user_id: sellerId }).select('_id').lean()
    if (!shop) return []

    return Order.find({ shopId: shop._id })
        .populate('items.productId', 'name image images')
        .populate('userId', 'name fullName phone email')
        .populate('shopId', 'name avatar')
        .sort({ createdAt: -1 })
}

export const getSellerOrderById = async (orderId, sellerId) => {
    const shop = await Shop.findOne({ user_id: sellerId }).select('_id').lean()
    if (!shop) return null

    return Order.findOne({ _id: orderId, shopId: shop._id })
        .populate('items.productId', 'name image images')
        .populate('userId', 'name fullName phone email')
        .populate('shopId', 'name avatar')
}

export const getShippingByOrder = async (orderId) => {
    return Shipping.findOne({ orderId })
}

export const updateSellerOrderStatus = async ({ orderId, sellerId, status }) => {
    if (!ORDER_STATUSES.includes(status)) {
        throw new AppError('Trạng thái đơn hàng không hợp lệ', 400)
    }

    const shop = await Shop.findOne({ user_id: sellerId }).select('_id').lean()
    if (!shop) {
        throw new AppError('Không tìm thấy shop của seller', 404)
    }

    const session = await mongoose.startSession()
    try {
        session.startTransaction()

        const order = await Order.findOne({ _id: orderId, shopId: shop._id }).session(session)
        if (!order) {
            throw new AppError('Không tìm thấy đơn hàng của shop', 404)
        }

        const allowedTargets = VALID_TRANSITIONS[order.status] || []
        if (!allowedTargets.includes(status)) {
            throw new AppError(`Không thể chuyển trạng thái từ ${order.status} sang ${status}`, 400)
        }

        if (status === DELIVERED_STATUS) {
            order.inventoryDeducted = true
        }

        order.status = status
        await order.save({ session })

        const shipping = await Shipping.findOne({ orderId }).session(session)
        if (shipping) {
            shipping.trackingStatus = status
            await shipping.save({ session })
        }

        await session.commitTransaction()

        createNotification({
          receiverId: order.userId,
          receiverRole: 'member',
          notificationType: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
          title: 'Đơn hàng cập nhật trạng thái',
          content: `Đơn hàng của bạn đã được cập nhật: ${status}`,
          relatedId: order._id,
          relatedType: 'Order',
          redirectUrl: '/my-orders',
          createdBy: 'Staff',
        }).catch(err => console.error('Notify order status failed:', err.message))
    } catch (error) {
        await session.abortTransaction()
        throw error
    } finally {
        session.endSession()
    }

    return Order.findById(orderId)
        .populate('items.productId', 'name image images')
        .populate('userId', 'name fullName phone email')
        .populate('shopId', 'name avatar')
}

export const cancelOrder = async ({ orderId, userId, reason }) => {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
        const order = await Order.findOne({ _id: orderId, userId }).session(session)
        if (!order) {
            throw new AppError('Không tìm thấy đơn hàng', 404)
        }
        if (!CANCELLABLE_STATUSES.includes(order.status)) {
            throw new AppError('Đơn hàng không thể hủy ở trạng thái hiện tại', 400)
        }

        for (const item of order.items) {
            const quantity = Number(item.quantity || 0)
            const variantWeight = String(item.variant?.weight || '').trim()
            const product = await Product.findById(item.productId).session(session)
            if (!product) continue

            if (Array.isArray(product.weightVariants) && product.weightVariants.length > 0 && variantWeight) {
                await Product.findOneAndUpdate(
                    {
                        _id: item.productId,
                        'weightVariants.label': variantWeight,
                    },
                    { $inc: { 'weightVariants.$.stock': quantity } },
                    { session },
                )
            } else {
                await Product.findByIdAndUpdate(
                    item.productId,
                    { $inc: { stock: quantity } },
                    { session },
                )
            }
        }

        if (order.sellerEscrowAmount > 0 && !order.escrowReleased) {
            const shop = await Shop.findById(order.shopId).lean().session(session)
            const sellerId = shop?.user_id
            if (sellerId) {
                const refundAmount = order.totalAmount
                await getOrCreateWallet(userId, session)
                await applyWalletTransaction({
                    userId,
                    amount: refundAmount,
                    type: 'refund',
                    provider: 'marketplace',
                    referenceId: `cancel_${orderId}_${userId}`,
                    status: 'completed',
                    metadata: { orderId, reason, escrowRefund: true },
                    idempotencyKey: `cancel_refund_${orderId}_${userId}`,
                    session,
                })
            }
        }

        order.status = 'ĐÃ HỦY'
        order.cancelledAt = new Date()
        order.cancellationReason = reason || ''
        order.paymentStatus = 'refunded'

        await Shipping.updateMany({ orderId }, { trackingStatus: 'ĐÃ HỦY' }, { session })

        await order.save({ session })
        await session.commitTransaction()

        createNotification({
            receiverId: userId,
            receiverRole: 'member',
            notificationType: NOTIFICATION_TYPES.REFUND_APPROVED,
            title: 'Đơn hàng đã hủy',
            content: `Đơn hàng của bạn đã được hủy và hoàn tiền. ${reason ? `Lý do: ${reason}` : ''}`,
            relatedId: order._id,
            relatedType: 'Order',
            redirectUrl: '/my-orders',
            createdBy: 'System',
        }).catch(err => console.error('Notify cancelOrder failed:', err.message))

        return order
    } catch (error) {
        await session.abortTransaction()
        throw error
    } finally {
        session.endSession()
    }
}

export const confirmDelivery = async ({ orderId, userId }) => {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
        const order = await Order.findOne({
            _id: orderId,
            userId,
            status: DELIVERED_STATUS,
            confirmedByBuyer: false,
        }).session(session)

        if (!order) {
            throw new AppError('Không tìm thấy đơn hàng để xác nhận', 404)
        }

        let sellerId = null
        const shop = await Shop.findById(order.shopId).lean().session(session)
        sellerId = shop?.user_id || null

        order.confirmedByBuyer = true
        order.confirmedAt = new Date()
        await order.save({ session })

        if (order.sellerEscrowAmount > 0 && !order.escrowReleased) {
            if (sellerId) {
                await getOrCreateWallet(sellerId, session)
                await applyWalletTransaction({
                    userId: sellerId,
                    amount: order.sellerEscrowAmount,
                    type: 'payout',
                    provider: 'marketplace',
                    referenceId: `payout_${orderId}_${sellerId}`,
                    status: 'completed',
                    metadata: {
                        orderId,
                        items: order.items.map(i => ({
                            productId: i.productId,
                            quantity: i.quantity,
                            price: i.price,
                        })),
                        feeRate: PLATFORM_FEE_RATE,
                    },
                    idempotencyKey: `payout_${orderId}_${sellerId}`,
                    session,
                })
                order.escrowReleased = true
                await order.save({ session })
            }
        }

        await session.commitTransaction()

        if (sellerId) {
            createNotification({
                receiverId: sellerId,
                receiverRole: 'seller',
                notificationType: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
                title: 'Đã nhận thanh toán',
                content: 'Người mua đã xác nhận nhận hàng. Tiền đã được chuyển vào ví của bạn.',
                relatedId: order._id,
                relatedType: 'Order',
                redirectUrl: '/seller/orders',
                createdBy: 'System',
            }).catch(err => console.error('Notify confirmDelivery seller failed:', err.message))
        }
        createNotification({
            receiverId: userId,
            receiverRole: 'member',
            notificationType: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
            title: 'Xác nhận đã nhận hàng',
            content: 'Bạn đã xác nhận nhận hàng thành công.',
            relatedId: order._id,
            relatedType: 'Order',
            redirectUrl: '/my-orders',
            createdBy: 'System',
        }).catch(err => console.error('Notify confirmDelivery buyer failed:', err.message))

        return order
    } catch (error) {
        await session.abortTransaction()
        throw error
    } finally {
        session.endSession()
    }
}
