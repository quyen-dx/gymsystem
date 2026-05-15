import { createMembership as createMembershipService } from '../services/membershipService.js'

export const createMembership = async (req, res, next) => {
    try {
        const { planId } = req.body
        if (!planId) {
            return res.status(400).json({ message: 'planId là bắt buộc' })
        }

        const payload = await createMembershipService({ userId: req.user._id, planId })
        return res.status(201).json({ message: 'Đăng ký membership thành công', data: payload })
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ message: error.message })
        }
        return next(error)
    }
}
