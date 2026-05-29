import mongoose from 'mongoose'
import Transaction from '../models/Transaction.js'
import Wallet from '../models/Wallet.js'
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

export const createDepositTransaction = async (req, res, next) => {
    try {
        const { amount, bankId } = req.body
        if (!amount || amount < 10000 || amount > 50000000) {
            throw new AppError('Số tiền không hợp lệ (10.000đ - 50.000.000đ)', 400)
        }

        const wallet = await getOrCreateWallet(req.user._id)
        const transferContent = `NAPTIEN${req.user._id.toString().slice(-8).toUpperCase()}`
        const expiredAt = new Date(Date.now() + 15 * 60 * 1000)

        const transaction = await Transaction.create({
            userId: req.user._id,
            walletId: wallet._id,
            type: 'deposit',
            amount: Number(amount),
            balanceBefore: wallet.balance,
            balanceAfter: wallet.balance,
            status: 'pending',
            expiredAt,
            metadata: { bankId, transferContent },
        })

        return res.status(201).json({
            success: true,
            data: {
                transactionId: transaction._id,
                transferContent,
                expiredAt: expiredAt.toISOString(),
            },
        })
    } catch (error) {
        next(error)
    }
}

export const confirmDeposit = async (req, res, next) => {
    try {
        const { transactionId } = req.body
        if (!transactionId) {
            throw new AppError('transactionId là bắt buộc', 400)
        }

        const session = await mongoose.startSession()
        session.startTransaction()

        try {
            const transaction = await Transaction.findById(transactionId).session(session)
            if (!transaction) {
                throw new AppError('Giao dịch không tìm thấy', 404)
            }
            if (transaction.userId.toString() !== req.user._id.toString()) {
                throw new AppError('Không có quyền xác nhận giao dịch này', 403)
            }
            if (transaction.status !== 'pending') {
                throw new AppError('Giao dịch đã được xử lý', 400)
            }
            if (transaction.expiredAt && transaction.expiredAt < new Date()) {
                throw new AppError('Giao dịch đã hết hạn', 400)
            }

            const wallet = await Wallet.findOne({ userId: req.user._id }).session(session)
            if (!wallet) {
                throw new AppError('Ví không tìm thấy', 404)
            }

            const balanceBefore = wallet.balance
            wallet.balance += transaction.amount
            await wallet.save({ session })

            transaction.status = 'completed'
            transaction.completedAt = new Date()
            transaction.balanceBefore = balanceBefore
            transaction.balanceAfter = wallet.balance
            await transaction.save({ session })

            await session.commitTransaction()

            return res.json({
                success: true,
                newBalance: wallet.balance,
            })
        } catch (error) {
            await session.abortTransaction()
            throw error
        } finally {
            session.endSession()
        }
    } catch (error) {
        next(error)
    }
}

export const cancelDeposit = async (req, res, next) => {
    try {
        const { transactionId } = req.params
        const transaction = await Transaction.findById(transactionId)
        if (!transaction) {
            throw new AppError('Giao dịch không tìm thấy', 404)
        }
        if (transaction.userId.toString() !== req.user._id.toString()) {
            throw new AppError('Không có quyền hủy giao dịch này', 403)
        }
        if (transaction.status !== 'pending') {
            throw new AppError('Chỉ có thể hủy giao dịch đang chờ', 400)
        }

        transaction.status = 'cancelled'
        await transaction.save()

        return res.json({ success: true })
    } catch (error) {
        next(error)
    }
}
