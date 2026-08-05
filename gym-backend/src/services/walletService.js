import mongoose from 'mongoose'
import Transaction from '../models/Transaction.js'
import Wallet from '../models/Wallet.js'
import AppError from '../utils/appError.js'

/**
 * Xảy ra khi 2 tiến trình đồng thời cùng finalize cùng một idempotencyKey
 * (vd. webhook Stripe và confirm endpoint cùng xử lý 1 PaymentIntent).
 * Caller nên abort transaction (để rollback $inc wallet) rồi trả về trạng thái alreadyPaid.
 */
export class IdempotencyConflictError extends AppError {
    constructor(userId, idempotencyKey) {
        super('Duplicate idempotency key detected, transaction already processed', 409)
        this.userId = userId
        this.idempotencyKey = idempotencyKey
        this.code = 11000
        this.isIdempotencyConflict = true
    }
}

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
    paymentId = null,
    currency = 'VND',
    exchangeRate = null,
    paymentMethod = null,
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
            return {
                wallet: await getOrCreateWallet(userId, session),
                transaction: existingTransaction,
                idempotent: true,
            }
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
            { userId, balance: { $gte: absAmount } },
            { $inc: { balance: -absAmount } },
            { new: true, session },
        )
        if (!wallet) {
            // Check if wallet exists but insufficient balance
            const existing = await Wallet.findOne({ userId }).session(session)
            if (!existing) {
                throw new AppError('Wallet not found', 404)
            }
            throw new AppError('Insufficient wallet balance', 400)
        }
        balanceBefore = wallet.balance + absAmount
        balanceAfter = wallet.balance
    }

    let transaction
    try {
        ;[transaction] = await Transaction.create(
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
                    paymentId,
                    currency,
                    exchangeRate,
                    paymentMethod,
                    metadata,
                    idempotencyKey,
                },
            ],
            { session },
        )
    } catch (error) {
        // Unique index (userId, idempotencyKey): một tiến trình khác đã tạo txn cho key này
        // (webhook Stripe vs confirm endpoint race). $inc wallet nằm trong cùng session →
        // caller abort để rollback, không được credit 2 lần.
        if (error?.code === 11000 && idempotencyKey) {
            throw new IdempotencyConflictError(userId, idempotencyKey)
        }
        throw error
    }

    return { wallet, transaction, idempotent: false }
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
