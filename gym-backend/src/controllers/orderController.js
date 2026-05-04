import { getDefaultAddress } from '../services/addressService.js'
import { calculateOrderShipping, createOrder, getOrderById, getOrdersBySeller, getOrdersByUser, getSellerOrderById, getShippingByOrder, hideOrderForUser, updateSellerOrderStatus } from '../services/orderService.js'

export const checkoutOrder = async (req, res, next) => {
    try {
        const { items, address: requestAddress, paymentReference } = req.body
        let address = requestAddress

        if (!address) {
            address = await getDefaultAddress(req.user._id)
        }

        if (!address) {
            throw new Error('Vui lòng thêm địa chỉ giao hàng trước khi thanh toán')
        }

        const orders = await createOrder({
            userId: req.user._id,
            items,
            address,
            paymentReference,
        })
        return res.status(201).json({ success: true, data: orders, order: orders[0] })
    } catch (error) {
        next(error)
    }
}

export const calculateShippingController = async (req, res, next) => {
    try {
        const { address, totalWeight, items } = req.body
        if (!address) {
            return res.status(400).json({ success: false, message: 'Address is required to calculate shipping' })
        }

        const shippingInfo = await calculateOrderShipping({
            items: items || [],
            address,
            totalWeight: totalWeight || 0,
        })
        
        return res.json({ success: true, data: shippingInfo })
    } catch (error) {
        next(error)
    }
}

export const getOrder = async (req, res, next) => {
    try {
        const order = await getOrderById(req.params.id)
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' })
        }

        const isOwner = order.userId.toString() === req.user._id.toString()
        const isSeller = order.items.some((item) => item.sellerId.toString() === req.user._id.toString())

        if (!isOwner && !isSeller && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Không có quyền truy cập đơn hàng' })
        }

        return res.json({ success: true, data: order })
    } catch (error) {
        next(error)
    }
}

export const getMyOrders = async (req, res, next) => {
    try {
        const orders = await getOrdersByUser(req.user._id)
        return res.json({ success: true, data: orders })
    } catch (error) {
        next(error)
    }
}

export const getSellerOrders = async (req, res, next) => {
    try {
        const orders = await getOrdersBySeller(req.user._id)
        return res.json({ success: true, data: orders })
    } catch (error) {
        next(error)
    }
}

export const deleteMyOrderHistory = async (req, res, next) => {
    try {
        await hideOrderForUser(req.params.id, req.user._id)
        return res.json({ success: true })
    } catch (error) {
        next(error)
    }
}

export const getSellerOrder = async (req, res, next) => {
    try {
        const order = await getSellerOrderById(req.params.id, req.user._id)
        if (!order) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng của shop' })
        }
        return res.json({ success: true, data: order })
    } catch (error) {
        next(error)
    }
}

export const updateSellerOrderStatusController = async (req, res, next) => {
    try {
        const order = await updateSellerOrderStatus({
            orderId: req.params.id,
            sellerId: req.user._id,
            status: req.body?.status,
        })
        return res.json({ success: true, data: order })
    } catch (error) {
        next(error)
    }
}

export const trackOrder = async (req, res, next) => {
    try {
        const order = await getOrderById(req.params.id)
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' })
        }

        const isOwner = order.userId.toString() === req.user._id.toString()
        const isSeller = order.items.some((item) => item.sellerId.toString() === req.user._id.toString())

        if (!isOwner && !isSeller && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Không có quyền truy cập thông tin vận chuyển' })
        }

        const shipping = await getShippingByOrder(req.params.id)
        if (!shipping) {
            return res.status(404).json({ success: false, message: 'Shipping information not found' })
        }

        return res.json({ success: true, data: shipping })
    } catch (error) {
        next(error)
    }
}
