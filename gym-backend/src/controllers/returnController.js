import { requestReturn, approveReturn, rejectReturn, getReturns, getReturnById } from '../services/returnService.js'
import Shop from '../models/Shop.js'
import AppError from '../utils/appError.js'

export const requestReturnController = async (req, res, next) => {
    try {
        const { orderId, items, reason } = req.body
        if (!orderId) {
            return res.status(400).json({ success: false, message: 'orderId is required' })
        }
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'items is required' })
        }

        const returnRequest = await requestReturn({
            orderId,
            userId: req.user._id,
            items,
            reason,
        })

        return res.status(201).json({
            success: true,
            data: returnRequest,
            message: 'Yêu cầu hoàn trả đã được gửi',
        })
    } catch (error) {
        next(error)
    }
}

export const listMyReturns = async (req, res, next) => {
    try {
        const returns = await getReturns({ userId: req.user._id })
        return res.json({ success: true, data: returns })
    } catch (error) {
        next(error)
    }
}

export const getReturn = async (req, res, next) => {
    try {
        const returnRequest = await getReturnById(req.params.id)
        if (!returnRequest) {
            return res.status(404).json({ success: false, message: 'Return request not found' })
        }

        const isOwner = returnRequest.userId._id.toString() === req.user._id.toString()
        const shop = await Shop.findOne({ user_id: req.user._id }).select('_id').lean()
        const isSeller = shop && shop._id.toString() === returnRequest.shopId.toString()

        if (!isOwner && !isSeller && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Không có quyền truy cập' })
        }

        return res.json({ success: true, data: returnRequest })
    } catch (error) {
        next(error)
    }
}

export const approveReturnController = async (req, res, next) => {
    try {
        const returnRequest = await approveReturn({
            returnId: req.params.id,
            approverId: req.user._id,
        })

        return res.json({
            success: true,
            data: returnRequest,
            message: 'Yêu cầu hoàn trả đã được chấp nhận',
        })
    } catch (error) {
        next(error)
    }
}

export const rejectReturnController = async (req, res, next) => {
    try {
        const reason = req.body?.reason || ''
        const returnRequest = await rejectReturn({
            returnId: req.params.id,
            approverId: req.user._id,
            reason,
        })

        return res.json({
            success: true,
            data: returnRequest,
            message: 'Yêu cầu hoàn trả đã bị từ chối',
        })
    } catch (error) {
        next(error)
    }
}

export const listSellerReturns = async (req, res, next) => {
    try {
        const shop = await Shop.findOne({ user_id: req.user._id }).select('_id').lean()
        if (!shop) {
            return res.json({ success: true, data: [] })
        }
        const returns = await getReturns({ shopId: shop._id })
        return res.json({ success: true, data: returns })
    } catch (error) {
        next(error)
    }
}
