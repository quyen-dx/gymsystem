import mongoose from 'mongoose'
import Transaction from '../models/Transaction.js'
import Wallet from '../models/Wallet.js'
import Payment from '../models/Payment.js'
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

// Keeps the withdrawable ledger in sync when any normal wallet payment spends
// available funds. Non-withdrawable credit is consumed first.
export const buildSpendDebitUpdate = (amount) => [
    {
        $set: {
            balance: { $subtract: ['$balance', amount] },
            withdrawableBalance: {
                $max: [
                    0,
                    {
                        $subtract: [
                            { $ifNull: ['$withdrawableBalance', 0] },
                            {
                                $max: [
                                    0,
                                    {
                                        $subtract: [
                                            amount,
                                            {
                                                $max: [
                                                    0,
                                                    { $subtract: ['$balance', { $ifNull: ['$withdrawableBalance', 0] }] },
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        },
    },
]

const calculateWithdrawableDebit = ({ balance, withdrawableBalance, amount }) => {
    const available = Math.max(0, Number(balance) || 0)
    const withdrawable = Math.max(0, Number(withdrawableBalance) || 0)
    const nonWithdrawable = Math.max(0, available - withdrawable)
    return Math.min(withdrawable, Math.max(0, Number(amount) - nonWithdrawable))
}

// Giữ phần tiền ví của checkout kết hợp ví + VNPay. Việc giữ tiền và tạo
// Payment phải chạy trong cùng transaction ở caller.
export const reserveWalletForPayment = async ({ userId, walletId, amount, session }) => {
    const reservedAmount = Math.max(0, Number(amount) || 0)
    const wallet = await Wallet.findOne({ _id: walletId, userId }).session(session)
    if (!wallet) throw new AppError('Không tìm thấy ví thanh toán', 404)
    if (reservedAmount === 0) {
        return { wallet, balanceBefore: Number(wallet.balance || 0), balanceAfter: Number(wallet.balance || 0), withdrawableReserved: 0 }
    }

    const balanceBefore = Number(wallet.balance || 0)
    const withdrawableReserved = calculateWithdrawableDebit({
        balance: wallet.balance,
        withdrawableBalance: wallet.withdrawableBalance,
        amount: reservedAmount,
    })
    const reserved = await Wallet.findOneAndUpdate(
        { _id: wallet._id, userId, balance: { $gte: reservedAmount } },
        [
            ...buildSpendDebitUpdate(reservedAmount),
            { $set: { checkoutReservedBalance: { $add: [{ $ifNull: ['$checkoutReservedBalance', 0] }, reservedAmount] } } },
        ],
        { new: true, session, updatePipeline: true },
    )
    if (!reserved) throw new AppError('Số dư ví không đủ để giữ cho giao dịch thanh toán', 400)
    return { wallet: reserved, balanceBefore, balanceAfter: Number(reserved.balance || 0), withdrawableReserved }
}

// Chuyển khoản giữ chỗ thành khoản đã chi khi thanh toán ngoài ví thành công.
export const consumeWalletPaymentReservation = async ({ userId, walletId, amount, session }) => {
    const reservedAmount = Math.max(0, Number(amount) || 0)
    if (reservedAmount === 0) return Wallet.findOne({ _id: walletId, userId }).session(session)
    const wallet = await Wallet.findOneAndUpdate(
        { _id: walletId, userId, checkoutReservedBalance: { $gte: reservedAmount } },
        { $inc: { checkoutReservedBalance: -reservedAmount } },
        { new: true, session },
    )
    if (!wallet) throw new AppError('Khoản tiền giữ cho giao dịch không còn hợp lệ', 409)
    return wallet
}

// Hoàn khoản giữ chỗ khi VNPay thất bại/hết hạn. Hàm idempotent để return,
// IPN và job hết hạn có thể gọi độc lập mà không hoàn tiền hai lần.
export const releaseWalletPaymentReservation = async ({ paymentId, reason = 'payment_failed', session: externalSession = null }) => {
    const ownsSession = !externalSession
    const session = externalSession || await mongoose.startSession()
    try {
        if (ownsSession) session.startTransaction()
        const payment = await Payment.findById(paymentId).session(session)
        const meta = payment?.metadata || {}
        const amount = Math.max(0, Number(meta.walletReservedAmount || 0))
        if (!payment || amount === 0 || meta.walletReservationStatus !== 'HELD') {
            if (ownsSession) await session.commitTransaction()
            return { released: false }
        }

        const withdrawableAmount = Math.max(0, Number(meta.walletWithdrawableReserved || 0))
        const wallet = await Wallet.findOneAndUpdate(
            { _id: payment.walletId, userId: payment.userId, checkoutReservedBalance: { $gte: amount } },
            { $inc: { balance: amount, checkoutReservedBalance: -amount, withdrawableBalance: withdrawableAmount } },
            { new: true, session },
        )
        if (!wallet) throw new AppError('Không thể hoàn khoản tiền giữ của giao dịch', 409)

        payment.metadata = {
            ...meta,
            walletReservationStatus: 'RELEASED',
            walletReservationReleasedAt: new Date(),
            walletReservationReleaseReason: reason,
        }
        await payment.save({ session })
        if (ownsSession) await session.commitTransaction()
        return { released: true, wallet }
    } catch (error) {
        if (ownsSession) await session.abortTransaction()
        throw error
    } finally {
        if (ownsSession) session.endSession()
    }
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
    withdrawableAmount = 0,
    session = null,
}) => {
    const transactionAmount = typeof amount === 'string' ? Number(amount) : amount

    if (!userId) throw new AppError('User wallet transaction requires userId', 400)
    if (!type) throw new AppError('Transaction type is required', 400)
    if (typeof transactionAmount !== 'number' || Number.isNaN(transactionAmount)) {
        throw new AppError('Transaction amount must be a number', 400)
    }
    if (typeof withdrawableAmount !== 'number' || Number.isNaN(withdrawableAmount) || withdrawableAmount < 0) {
        throw new AppError('Withdrawable amount must be a non-negative number', 400)
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
            { $inc: { balance: transactionAmount, ...(withdrawableAmount ? { withdrawableBalance: withdrawableAmount } : {}) } },
            { new: true, session },
        )
        if (!wallet) {
            // Wallet doesn't exist yet - create with initial balance directly (saves one round-trip)
            [wallet] = await Wallet.create([{ userId, balance: transactionAmount, withdrawableBalance: withdrawableAmount }], { session })
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
            // Consume non-withdrawable credit (bonus/compensation) first.
            // The aggregation update is evaluated by MongoDB on the same
            // document as the balance guard, so concurrent payments cannot
            // leave a withdrawable amount that has already been spent.
            buildSpendDebitUpdate(absAmount),
            { new: true, session, updatePipeline: true },
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
