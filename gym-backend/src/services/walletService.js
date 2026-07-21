import mongoose from 'mongoose'
import Transaction from '../models/Transaction.js'
import Wallet from '../models/Wallet.js'
import User from '../models/User.js'
import MonthlyWithdrawalLimit from '../models/MonthlyWithdrawalLimit.js'
import AppError from '../utils/appError.js'
import { createLedgerPair } from './ledgerService.js'

export const getOrCreateWallet = async (userId, session = null) => {
    const existing = await Wallet.findOne({ userId }).session(session)
    if (existing) return existing
    return Wallet.create([{ userId }], { session }).then((docs) => docs[0])
}

export const getWalletByUser = async (userId) => {
    return Wallet.findOne({ userId })
}

export const applyWalletTransaction = async ({
    userId,
    amount,
    type,
    provider,
    source,
    description,
    referenceId,
    status = 'completed',
    metadata = {},
    idempotencyKey,
    session = null,
}) => {
    const transactionAmount = typeof amount === 'string' ? Number(amount) : amount

    if (!userId) throw new AppError('User wallet transaction requires userId', 400)
    if (!type) throw new AppError('Transaction type is required', 400)
    if (typeof transactionAmount !== 'number' || Number.isNaN(transactionAmount)) {
        throw new AppError('Transaction amount must be a number', 400)
    }

    if (idempotencyKey) {
        const existingTransaction = await Transaction.findOne({ userId, idempotencyKey }).session(session)
        if (existingTransaction) {
            return { wallet: await getOrCreateWallet(userId, session), transaction: existingTransaction }
        }
    }

    // ATOMIC: use findOneAndUpdate with $inc to prevent race condition
    // The $gte guard ensures balance never goes negative, even under concurrent requests
    let wallet
    let balanceBefore
    let balanceAfter

    if (transactionAmount >= 0) {
        // Deposit: atomic increment, create wallet if not exists
        wallet = await Wallet.findOneAndUpdate(
            { userId },
            { $inc: { balance: transactionAmount } },
            { new: true, session },
        )
        if (!wallet) {
            // Wallet doesn't exist yet - create with initial balance directly (saves one round-trip)
            [wallet] = await Wallet.create([{ userId, balance: transactionAmount }], { session })
            balanceBefore = 0
            balanceAfter = transactionAmount
        } else {
            balanceBefore = wallet.balance - transactionAmount
            balanceAfter = wallet.balance
        }
    } else {
        // Withdrawal: atomic decrement with guard
        const absAmount = -transactionAmount
        wallet = await Wallet.findOneAndUpdate(
            { userId, balance: { $gte: absAmount }, status: 'active' },
            { $inc: { balance: -absAmount } },
            { new: true, session },
        )
        if (!wallet) {
            // Check if wallet exists but insufficient balance or not active
            const existing = await Wallet.findOne({ userId }).session(session)
            if (!existing) {
                throw new AppError('Wallet not found', 404)
            }
            if (existing.status !== 'active') {
                throw new AppError('Wallet is not active', 400)
            }
            throw new AppError('Insufficient wallet balance', 400)
        }
        balanceBefore = wallet.balance + absAmount
        balanceAfter = wallet.balance
    }

    const transaction = await Transaction.create(
        [
            {
                userId,
                walletId: wallet._id,
                type,
                provider,
                source,
                description,
                amount: transactionAmount,
                balanceBefore,
                balanceAfter,
                referenceId,
                status,
                metadata,
                idempotencyKey,
            },
        ],
        { session },
    )

    const walletAccount = `wallet:${userId}`

    if (transactionAmount >= 0) {
        const gatewayAccount = provider ? `gateway:${provider.toLowerCase()}` : 'system:deposit'
        await createLedgerPair({
            transactionId: transaction[0]._id,
            amount: transactionAmount,
            debitAccount: gatewayAccount,
            creditAccount: walletAccount,
            description: description || `Deposit via ${provider || 'system'}`,
            session,
        })
    } else {
        const destinationAccount = source ? `system:${source.toLowerCase()}` : 'system:payment'
        await createLedgerPair({
            transactionId: transaction[0]._id,
            amount: -transactionAmount,
            debitAccount: walletAccount,
            creditAccount: destinationAccount,
            description: description || `Payment via ${provider || 'wallet'}`,
            session,
        })
    }

    return { wallet, transaction: transaction[0] }
}

export const getWalletTransactions = async (userId, query = {}) => {
    const filter = { userId, ...query }
    return Transaction.find(filter).sort({ createdAt: -1 })
}

export const getWalletById = async (walletId) => {
    return Wallet.findById(walletId)
}

export const transferWalletBalance = async ({
    fromUserId,
    toUserId,
    amount,
    description,
    referenceId,
    session = null,
}) => {
    const transferAmount = typeof amount === 'string' ? Number(amount) : amount

    if (!fromUserId || !toUserId) {
        throw new AppError('Transfer requires fromUserId and toUserId', 400)
    }
    if (fromUserId === toUserId) {
        throw new AppError('Cannot transfer to the same user', 400)
    }
    if (typeof transferAmount !== 'number' || Number.isNaN(transferAmount) || transferAmount <= 0) {
        throw new AppError('Transfer amount must be a positive number', 400)
    }

    const sessionLocal = session || await mongoose.startSession()
    let startedTransaction = false
    try {
        if (!session) {
            sessionLocal.startTransaction()
            startedTransaction = true
        }

        const fromWallet = await getOrCreateWallet(fromUserId, sessionLocal)
        const toWallet = await getOrCreateWallet(toUserId, sessionLocal)

        if (fromWallet.balance < transferAmount) {
            throw new AppError('Insufficient balance for transfer', 400)
        }

        if (fromWallet.status !== 'active') {
            throw new AppError('Wallet is not active', 400)
        }

        const fromBalanceBefore = fromWallet.balance
        fromWallet.balance -= transferAmount
        await fromWallet.save({ session: sessionLocal })

        const toBalanceBefore = toWallet.balance
        toWallet.balance += amount
        await toWallet.save({ session: sessionLocal })

        const debitTransaction = await Transaction.create(
            [
                {
                    userId: fromUserId,
                    walletId: fromWallet._id,
                    type: 'transfer',
                    provider: 'wallet',
                    source: 'transfer',
                    description: description || `Transfer to ${toUserId}`,
                    amount: -transferAmount,
                    balanceBefore: fromBalanceBefore,
                    balanceAfter: fromWallet.balance,
                    referenceId,
                    status: 'completed',
                    metadata: { toUserId },
                },
            ],
            { session: sessionLocal },
        )

        const creditTransaction = await Transaction.create(
            [
                {
                    userId: toUserId,
                    walletId: toWallet._id,
                    type: 'transfer',
                    provider: 'wallet',
                    source: 'transfer',
                    description: description || `Transfer from ${fromUserId}`,
                    amount: transferAmount,
                    balanceBefore: toBalanceBefore,
                    balanceAfter: toWallet.balance,
                    referenceId,
                    status: 'completed',
                    metadata: { fromUserId },
                },
            ],
            { session: sessionLocal },
        )

        if (startedTransaction) {
            await sessionLocal.commitTransaction()
        }

        await createLedgerPair({
            transactionId: debitTransaction[0]._id,
            amount: transferAmount,
            debitAccount: `wallet:${fromUserId}`,
            creditAccount: `wallet:${toUserId}`,
            description: description || `Transfer from ${fromUserId} to ${toUserId}`,
            session: session,
        })

        return {
            fromWallet,
            toWallet,
            debitTransaction: debitTransaction[0],
            creditTransaction: creditTransaction[0],
        }
    } catch (error) {
        if (startedTransaction) {
            await sessionLocal.abortTransaction()
        }
        throw error
    } finally {
        if (!session) {
            sessionLocal.endSession()
        }
    }
}

const MAX_WITHDRAWAL_PER_TXN = 10_000_000
const MAX_WITHDRAWAL_PER_MONTH = 50_000_000

export const holdBalance = async ({ userId, amount, reason, idempotencyKey, session }) => {
    const holdAmount = typeof amount === 'string' ? Number(amount) : amount

    if (!userId) throw new AppError('User wallet operation requires userId', 400)
    if (typeof holdAmount !== 'number' || Number.isNaN(holdAmount) || holdAmount <= 0) {
        throw new AppError('Hold amount must be a positive number', 400)
    }

    if (idempotencyKey) {
        const existing = await Transaction.findOne({ userId, idempotencyKey }).session(session)
        if (existing) {
            return { wallet: await getOrCreateWallet(userId, session), transaction: existing }
        }
    }

    const wallet = await Wallet.findOneAndUpdate(
        { userId, balance: { $gte: holdAmount }, status: 'active' },
        { $inc: { balance: -holdAmount, heldBalance: holdAmount } },
        { new: true, session },
    )

    if (!wallet) {
        const existing = await Wallet.findOne({ userId }).session(session)
        if (!existing) throw new AppError('Wallet not found', 404)
        if (existing.status !== 'active') throw new AppError('Wallet is not active', 400)
        throw new AppError('Insufficient wallet balance', 400)
    }

    const balanceBefore = wallet.balance + holdAmount
    const transaction = await Transaction.create(
        [
            {
                userId,
                walletId: wallet._id,
                type: 'hold',
                provider: 'wallet',
                source: 'hold',
                description: reason || 'Balance hold',
                amount: -holdAmount,
                balanceBefore,
                balanceAfter: wallet.balance,
                status: 'completed',
                metadata: { reason, heldBalanceAfter: wallet.heldBalance },
                idempotencyKey,
            },
        ],
        { session },
    )

    await createLedgerPair({
        transactionId: transaction[0]._id,
        amount: holdAmount,
        debitAccount: `wallet:available:${userId}`,
        creditAccount: `wallet:held:${userId}`,
        description: reason || 'Balance hold',
        session,
    })

    return { wallet, transaction: transaction[0] }
}

export const releaseBalance = async ({ userId, amount, reason, session }) => {
    const releaseAmount = typeof amount === 'string' ? Number(amount) : amount

    if (!userId) throw new AppError('User wallet operation requires userId', 400)
    if (typeof releaseAmount !== 'number' || Number.isNaN(releaseAmount) || releaseAmount <= 0) {
        throw new AppError('Release amount must be a positive number', 400)
    }

    const wallet = await Wallet.findOneAndUpdate(
        { userId, heldBalance: { $gte: releaseAmount } },
        { $inc: { heldBalance: -releaseAmount, balance: releaseAmount } },
        { new: true, session },
    )

    if (!wallet) {
        const existing = await Wallet.findOne({ userId }).session(session)
        if (!existing) throw new AppError('Wallet not found', 404)
        throw new AppError('Insufficient held balance', 400)
    }

    const transaction = await Transaction.create(
        [
            {
                userId,
                walletId: wallet._id,
                type: 'release',
                provider: 'wallet',
                source: 'release',
                description: reason || 'Balance release',
                amount: releaseAmount,
                balanceBefore: wallet.balance - releaseAmount,
                balanceAfter: wallet.balance,
                status: 'completed',
                metadata: { reason, heldBalanceBefore: wallet.heldBalance + releaseAmount, heldBalanceAfter: wallet.heldBalance },
            },
        ],
        { session },
    )

    await createLedgerPair({
        transactionId: transaction[0]._id,
        amount: releaseAmount,
        debitAccount: `wallet:held:${userId}`,
        creditAccount: `wallet:available:${userId}`,
        description: reason || 'Balance release',
        session,
    })

    return { wallet, transaction: transaction[0] }
}

export const freezeWallet = async ({ userId, reason }) => {
    const wallet = await Wallet.findOneAndUpdate(
        { userId, status: 'active' },
        { $set: { status: 'frozen' } },
        { new: true },
    )

    if (!wallet) {
        const existing = await Wallet.findOne({ userId })
        if (!existing) throw new AppError('Wallet not found', 404)
        throw new AppError('Wallet is already frozen or closed', 400)
    }

    return wallet
}

export const unfreezeWallet = async ({ userId }) => {
    const wallet = await Wallet.findOneAndUpdate(
        { userId, status: 'frozen' },
        { $set: { status: 'active' } },
        { new: true },
    )

    if (!wallet) {
        const existing = await Wallet.findOne({ userId })
        if (!existing) throw new AppError('Wallet not found', 404)
        throw new AppError('Wallet is not frozen', 400)
    }

    return wallet
}

export const requestWithdrawal = async ({ userId, amount, bankInfo, idempotencyKey }) => {
    const withdrawalAmount = typeof amount === 'string' ? Number(amount) : amount

    if (!userId) throw new AppError('User wallet operation requires userId', 400)
    if (typeof withdrawalAmount !== 'number' || Number.isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
        throw new AppError('Withdrawal amount must be a positive number', 400)
    }

    const user = await User.findById(userId).lean()
    if (!user) throw new AppError('User not found', 404)
    if (!user.isVerified) throw new AppError('Identity verification required for withdrawals', 403)

    if (withdrawalAmount > MAX_WITHDRAWAL_PER_TXN) {
        throw new AppError(`Maximum withdrawal per transaction is ${MAX_WITHDRAWAL_PER_TXN.toLocaleString('vi-VN')} VND`, 400)
    }

    if (idempotencyKey) {
        const existingWithdrawal = await Transaction.findOne({
            userId,
            idempotencyKey,
            type: 'withdrawal',
        })
        if (existingWithdrawal) {
            const wallet = await getOrCreateWallet(userId)
            return { wallet, transaction: existingWithdrawal }
        }
    }

    const session = await mongoose.startSession()
    session.startTransaction()

    try {
        const now = new Date()
        const monthKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`

        const limitDoc = await MonthlyWithdrawalLimit.attemptReserve({
            userId: new mongoose.Types.ObjectId(userId),
            month: monthKey,
            amount: withdrawalAmount,
            session,
        })

        if (!limitDoc) {
            throw new AppError(`Monthly withdrawal limit of ${MAX_WITHDRAWAL_PER_MONTH.toLocaleString('vi-VN')} VND exceeded`, 400)
        }

        const holdKey = idempotencyKey ? `hold_${idempotencyKey}` : undefined

        const { wallet, transaction: holdTxn } = await holdBalance({
            userId,
            amount: withdrawalAmount,
            reason: 'withdrawal',
            idempotencyKey: holdKey,
            session,
        })

        const [withdrawalTransaction] = await Transaction.create(
            [
                {
                    userId,
                    walletId: wallet._id,
                    type: 'withdrawal',
                    provider: 'wallet',
                    source: 'withdrawal',
                    description: `Withdrawal request for ${withdrawalAmount.toLocaleString('vi-VN')} VND`,
                    amount: -withdrawalAmount,
                    balanceBefore: wallet.balance + withdrawalAmount,
                    balanceAfter: wallet.balance,
                    status: 'pending',
                    metadata: {
                        bankInfo,
                        holdTransactionId: holdTxn._id,
                        heldBalance: wallet.heldBalance,
                    },
                    idempotencyKey,
                },
            ],
            { session },
        )

        await session.commitTransaction()

        return { wallet, transaction: withdrawalTransaction }
    } catch (error) {
        await session.abortTransaction()

        if (error.code === 11000 && error.keyPattern?.idempotencyKey && idempotencyKey) {
            const existing = await Transaction.findOne({ userId, idempotencyKey, type: 'withdrawal' })
            if (existing) {
                const wallet = await getOrCreateWallet(userId)
                return { wallet, transaction: existing }
            }
        }

        throw error
    } finally {
        session.endSession()
    }
}

export const approveWithdrawal = async ({ transactionId, adminId }) => {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
        const withdrawalTxn = await Transaction.findOneAndUpdate(
            { _id: transactionId, type: 'withdrawal', status: 'pending' },
            { $set: { status: 'approved', completedAt: new Date() } },
            { new: true, session },
        )

        if (!withdrawalTxn) throw new AppError('Pending withdrawal request not found', 404)

        const absAmount = Math.abs(withdrawalTxn.amount)
        const userId = withdrawalTxn.userId

        const wallet = await Wallet.findOneAndUpdate(
            { userId, heldBalance: { $gte: absAmount } },
            { $inc: { heldBalance: -absAmount } },
            { new: true, session },
        )

        if (!wallet) {
            throw new AppError('Withdrawal processing failed: insufficient held balance', 400)
        }

        withdrawalTxn.metadata = { ...withdrawalTxn.metadata, approvedBy: adminId, approvedAt: new Date() }
        await withdrawalTxn.save({ session })

        const transaction = await Transaction.create(
            [
                {
                    userId,
                    walletId: wallet._id,
                    type: 'withdrawal',
                    provider: 'wallet',
                    source: 'withdrawal',
                    description: `Withdrawal approved: ${absAmount.toLocaleString('vi-VN')} VND`,
                    amount: -absAmount,
                    balanceBefore: wallet.balance + absAmount,
                    balanceAfter: wallet.balance,
                    status: 'approved',
                    completedAt: new Date(),
                    metadata: {
                        bankInfo: withdrawalTxn.metadata?.bankInfo,
                        approvedBy: adminId,
                        requestTransactionId: transactionId,
                    },
                },
            ],
            { session },
        )

        await createLedgerPair({
            transactionId: transaction[0]._id,
            amount: absAmount,
            debitAccount: `wallet:held:${userId}`,
            creditAccount: 'system:withdrawal',
            description: `Withdrawal approved for ${absAmount.toLocaleString('vi-VN')} VND`,
            session,
        })

        await session.commitTransaction()

        return { wallet, transaction: transaction[0] }
    } catch (error) {
        await session.abortTransaction()
        throw error
    } finally {
        session.endSession()
    }
}

export const rejectWithdrawal = async ({ transactionId, adminId, reason }) => {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
        const withdrawalTxn = await Transaction.findOneAndUpdate(
            { _id: transactionId, type: 'withdrawal', status: 'pending' },
            { $set: { status: 'rejected' } },
            { new: true, session },
        )

        if (!withdrawalTxn) throw new AppError('Pending withdrawal request not found', 404)

        const absAmount = Math.abs(withdrawalTxn.amount)
        const userId = withdrawalTxn.userId

        const { wallet } = await releaseBalance({
            userId,
            amount: absAmount,
            reason: `Withdrawal rejected: ${reason || 'Admin decision'}`,
            session,
        })

        withdrawalTxn.metadata = {
            ...withdrawalTxn.metadata,
            rejectedBy: adminId,
            rejectedAt: new Date(),
            rejectionReason: reason || 'Admin decision',
        }
        await withdrawalTxn.save({ session })

        await session.commitTransaction()

        return { wallet, transaction: withdrawalTxn }
    } catch (error) {
        await session.abortTransaction()
        throw error
    } finally {
        session.endSession()
    }
}
