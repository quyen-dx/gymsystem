import { applyWalletTransaction, getOrCreateWallet, getWalletTransactions, transferWalletBalance } from '../services/walletService.js'
import AppError from '../utils/appError.js'

export const getMyWallet = async (req, res, next) => {
    try {
        const wallet = await getOrCreateWallet(req.user._id)
        return res.json({ success: true, data: wallet })
    } catch (error) {
        next(error)
    }
}

export const getMyWalletTransactions = async (req, res, next) => {
    try {
        const transactions = await getWalletTransactions(req.user._id)
        return res.json({ success: true, data: transactions })
    } catch (error) {
        next(error)
    }
}

export const fakeDeposit = async (req, res, next) => {
    try {
        if (process.env.NODE_ENV === 'production' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Fake deposit chỉ dùng trong môi trường phát triển hoặc admin' })
        }

        const { userId, amount } = req.body
        if (!userId || typeof amount !== 'number' || amount <= 0) {
            throw new AppError('userId và amount hợp lệ là bắt buộc', 400)
        }

        const result = await applyWalletTransaction({
            userId,
            amount: Number(amount),
            type: 'deposit',
            provider: 'system',
            source: 'system',
            description: 'Fake deposit',
            referenceId: `fake_deposit_${Date.now()}`,
            status: 'completed',
            metadata: { source: 'system' },
        })

        return res.status(201).json({ success: true, data: result })
    } catch (error) {
        next(error)
    }
}

export const transferWallet = async (req, res, next) => {
    try {
        const { fromUserId, toUserId, amount } = req.body
        if (!fromUserId || !toUserId || typeof amount !== 'number' || amount <= 0) {
            throw new AppError('fromUserId, toUserId và amount hợp lệ là bắt buộc', 400)
        }

        if (process.env.NODE_ENV === 'production' && req.user.role !== 'admin' && req.user._id.toString() !== fromUserId) {
            return res.status(403).json({ success: false, message: 'Chỉ admin hoặc chủ từ tài khoản mới được chuyển tiền' })
        }

        const result = await transferWalletBalance({
            fromUserId,
            toUserId,
            amount: Number(amount),
            description: `Transfer ${amount} VND from ${fromUserId} to ${toUserId}`,
            referenceId: `transfer_${Date.now()}_${fromUserId}_${toUserId}`,
        })

        return res.json({ success: true, data: result })
    } catch (error) {
        next(error)
    }
}
