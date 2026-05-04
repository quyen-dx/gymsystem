import mongoose from 'mongoose'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import Shop from '../models/Shop.js'
import Shipping from '../models/Shipping.js'
import AppError from '../utils/appError.js'
import { applyWalletTransaction, getOrCreateWallet } from './walletService.js'

const PLATFORM_FEE_RATE = Number(process.env.PLATFORM_FEE_RATE || 0.02)
export const ORDER_STATUSES = ['CHỜ XÁC NHẬN', 'ĐANG GIAO HÀNG', 'GIAO THÀNH CÔNG']
const DELIVERED_STATUS = 'GIAO THÀNH CÔNG'

import { calculateShippingGHN } from './ghnService.js'

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

export const createOrder = async ({ userId, items, address, paymentReference }) => {
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

    const grandTotal = orderGroups.reduce((sum, group) => sum + group.grandTotal, 0)

    const session = await mongoose.startSession()
    try {
        session.startTransaction()
        const { wallet } = await applyWalletTransaction({
            userId,
            amount: -grandTotal,
            type: 'payment',
            provider: 'wallet',
            referenceId: paymentReference || `order_${Date.now()}`,
            status: 'completed',
            metadata: {
                items: orderItems,
                shippingFee: orderGroups.reduce((sum, group) => sum + group.shippingInfo.shippingFee, 0),
            },
            session,
        })

        const createdOrders = []
        for (const group of orderGroups) {
            const order = await Order.create(
                [{
                    userId,
                    shopId: group.shopId,
                    items: group.items,
                    totalAmount: group.subtotal,
                    totalPrice: group.subtotal,
                    shippingFee: group.shippingInfo.shippingFee,
                    address: buildShippingAddress(address),
                    status: 'CHỜ XÁC NHẬN',
                    paymentStatus: 'paid',
                    paymentReference,
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

            const payoutAmount = Math.max(0, group.subtotal * (1 - PLATFORM_FEE_RATE))
            await getOrCreateWallet(group.sellerId, session)
            await applyWalletTransaction({
                userId: group.sellerId,
                amount: payoutAmount,
                type: 'payout',
                provider: 'marketplace',
                referenceId: `payout_${order[0]._id}_${group.sellerId}`,
                status: 'completed',
                metadata: {
                    orderId: order[0]._id,
                    items: group.items,
                    feeRate: PLATFORM_FEE_RATE,
                },
                session,
            })
        }

        await session.commitTransaction()
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
        .populate('userId', 'name phone email')
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
        .populate('userId', 'name phone email')
        .populate('shopId', 'name avatar')
        .sort({ createdAt: -1 })
}

export const getSellerOrderById = async (orderId, sellerId) => {
    const shop = await Shop.findOne({ user_id: sellerId }).select('_id').lean()
    if (!shop) return null

    return Order.findOne({ _id: orderId, shopId: shop._id })
        .populate('items.productId', 'name image images')
        .populate('userId', 'name phone email')
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

        const shouldDeductInventory = status === DELIVERED_STATUS && !order.inventoryDeducted
        if (shouldDeductInventory) {
            for (const item of order.items) {
                const product = await Product.findById(item.productId).session(session)
                if (!product) {
                    console.warn(`Skip inventory deduction, product not found: ${item.productId}`)
                    continue
                }

                const quantity = Number(item.quantity || 0)
                const variantWeight = String(item.variant?.weight || '').trim()
                if (Array.isArray(product.weightVariants) && product.weightVariants.length > 0) {
                    const variant = product.weightVariants.find((entry) => String(entry.label || '').trim() === variantWeight)
                    if (!variant) {
                        throw new AppError(`Không tìm thấy biến thể ${variantWeight} của sản phẩm ${product.name}`, 400)
                    }

                    const nextVariantStock = Number(variant.stock || 0) - quantity
                    if (nextVariantStock < 0) {
                        throw new AppError(`Tồn kho biến thể ${variantWeight} không đủ cho sản phẩm ${product.name}`, 400)
                    }
                    variant.stock = nextVariantStock
                    product.stock = product.weightVariants.reduce((sum, entry) => sum + Number(entry.stock || 0), 0)
                } else {
                    const nextStock = Number(product.stock || 0) - quantity
                    if (nextStock < 0) {
                        throw new AppError(`Tồn kho không đủ cho sản phẩm ${product.name}`, 400)
                    }
                    product.stock = nextStock
                }

                await product.save({ session })
                console.info(`Inventory deducted | order=${order._id} product=${product._id} quantity=${quantity} stock=${product.stock}`)
            }
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
    } catch (error) {
        await session.abortTransaction()
        throw error
    } finally {
        session.endSession()
    }

    return Order.findById(orderId)
        .populate('items.productId', 'name image images')
        .populate('userId', 'name phone email')
        .populate('shopId', 'name avatar')
}
