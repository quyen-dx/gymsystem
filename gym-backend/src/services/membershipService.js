import mongoose from 'mongoose'
import Membership from '../models/Membership.js'
import Plan from '../models/Plan.js'
import User from '../models/User.js'
import { invalidatePersonalContextCache } from './conversationContextCache.js'

const toObjectId = (value, fieldName) => {
    if (!mongoose.Types.ObjectId.isValid(String(value))) {
        const error = new Error(`${fieldName} không hợp lệ`)
        error.statusCode = 400
        throw error
    }
    return new mongoose.Types.ObjectId(value)
}

const calculateRemainingDays = (endDate) => {
    const now = new Date()
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)
    return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
}

const createMembership = async ({ userId, planId }) => {
    const memberId = toObjectId(userId, 'userId')
    const planObjectId = toObjectId(planId, 'planId')

    const user = await User.findById(memberId).lean()
    if (!user) {
        const error = new Error('Không tìm thấy người dùng')
        error.statusCode = 404
        throw error
    }

    const plan = await Plan.findOne({ _id: planObjectId, isActive: true }).lean()
    if (!plan) {
        const error = new Error('Không tìm thấy gói tập hợp lệ')
        error.statusCode = 404
        throw error
    }

    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const existingActive = await Membership.findOne({ memberId, status: 'active' })
        .sort({ endDate: -1 })
        .lean()

    let startDate = new Date(now)

    if (existingActive) {
        if (existingActive.planId?.toString() !== planObjectId.toString()) {
            const error = new Error('Bạn đang có một gói tập active khác. Hãy gia hạn gói hiện tại hoặc đợi hết hạn rồi đăng ký gói mới.')
            error.statusCode = 400
            throw error
        }

        const prevEndDate = new Date(existingActive.endDate)
        prevEndDate.setHours(0, 0, 0, 0)
        prevEndDate.setDate(prevEndDate.getDate() + 1)
        startDate = prevEndDate
    }

    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + Number(plan.durationDays) - 1)
    endDate.setHours(23, 59, 59, 999)

    const membership = await Membership.create({
        memberId,
        planId: planObjectId,
        startDate,
        endDate,
        status: 'active',
    })

    const remainingDays = calculateRemainingDays(endDate)
    invalidatePersonalContextCache(memberId)

    return {
        created: true,
        membership: {
            id: membership._id,
            memberId: membership.memberId,
            planId: membership.planId,
            planNameVi: plan.nameVi,
            planNameEn: plan.nameEn,
            startDate: membership.startDate.toISOString(),
            endDate: membership.endDate.toISOString(),
            durationDays: plan.durationDays,
            status: membership.status,
            price: plan.price,
        },
        remainingDays,
        expiryDate: membership.endDate.toISOString(),
    }
}

export { createMembership }

