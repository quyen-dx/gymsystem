import mongoose from 'mongoose'
import Stripe from 'stripe'
import Transaction from '../models/Transaction.js'
import Wallet from '../models/Wallet.js'
import { applyWalletTransaction, getOrCreateWallet, getWalletTransactions, transferWalletBalance } from '../services/walletService.js'
import AppError from '../utils/appError.js'

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null
const FALLBACK_USD_TO_VND_RATE = 25000
const EXCHANGE_RATE_CACHE_TTL = 10 * 60 * 1000
const MIN_STRIPE_AMOUNT_USD = 0.5
const DEPOSIT_BONUS_TIERS = [
    { threshold: 70000000, rate: 0.03 },
    { threshold: 15000000, rate: 0.02 },
]
let exchangeRateCache = { rate: null, expiresAt: 0, source: 'fallback' }

const calculateDepositCredit = (amount) => {
    const depositAmount = Number(amount)
    const bonusRate = DEPOSIT_BONUS_TIERS.find((tier) => depositAmount >= tier.threshold)?.rate || 0
    const bonusAmount = Math.round(depositAmount * bonusRate)
    return {
        originalAmount: depositAmount,
        bonusAmount,
        bonusRate,
        creditedAmount: depositAmount + bonusAmount,
    }
}

const getUsdToVndRate = async () => {
    if (exchangeRateCache.rate && exchangeRateCache.expiresAt > Date.now()) {
        return { rate: exchangeRateCache.rate, source: exchangeRateCache.source }
    }

    const apiKey = process.env.EXCHANGE_RATE_API_KEY
    if (!apiKey) return { rate: FALLBACK_USD_TO_VND_RATE, source: 'fallback' }

    try {
        const response = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`)
        if (!response.ok) throw new Error(`Exchange rate API returned ${response.status}`)

        const data = await response.json()
        const rate = Number(data?.conversion_rates?.VND)
        if (!rate || Number.isNaN(rate)) throw new Error('Missing USD/VND rate')

        exchangeRateCache = { rate, expiresAt: Date.now() + EXCHANGE_RATE_CACHE_TTL, source: 'api' }
        return { rate, source: 'api' }
    } catch (error) {
        console.error('Không thể lấy tỷ giá USD/VND:', error.message)
        return {
            rate: exchangeRateCache.rate || FALLBACK_USD_TO_VND_RATE,
            source: exchangeRateCache.rate ? exchangeRateCache.source : 'fallback',
        }
    }
}

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
        if (!amount || amount < 10000 || amount > 100000000) {
            throw new AppError('Số tiền không hợp lệ (10.000đ - 100.000.000đ)', 400)
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

export const createStripePaymentIntent = async (req, res, next) => {
    try {
        if (!stripe) {
            throw new AppError('Stripe chưa được cấu hình', 500)
        }

        const { rate: exchangeRate, source: exchangeRateSource } = await getUsdToVndRate()
        const amountUsd = Number(req.body.amountUsd)
        const amount = amountUsd > 0 ? Math.round(amountUsd * exchangeRate) : Number(req.body.amount)
        if (!amount || amount < 10000 || amount > 100000000) {
            throw new AppError('Số tiền không hợp lệ (10.000đ - 100.000.000đ)', 400)
        }

        const stripeAmount = Math.round((amountUsd > 0 ? amountUsd : amount / exchangeRate) * 100)
        if (stripeAmount < MIN_STRIPE_AMOUNT_USD * 100) {
            throw new AppError(`Số tiền thanh toán thẻ tối thiểu là ${MIN_STRIPE_AMOUNT_USD} USD`, 400)
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: stripeAmount,
            currency: 'usd',
            metadata: {
                userId: req.user._id.toString(),
                walletAmountVnd: String(amount),
                stripeAmountUsd: String(stripeAmount / 100),
                exchangeRate: String(exchangeRate),
                exchangeRateSource,
            },
        })

        return res.json({
            clientSecret: paymentIntent.client_secret,
            stripeAmount,
            stripeCurrency: 'usd',
            exchangeRate,
            exchangeRateSource,
            walletAmountVnd: amount,
        })
    } catch (error) {
        next(error)
    }
}

export const getStripeExchangeRate = async (_req, res, next) => {
    try {
        const { rate, source } = await getUsdToVndRate()
        return res.json({ success: true, data: { base: 'USD', target: 'VND', rate, source } })
    } catch (error) {
        next(error)
    }
}

export const handleStripeWebhook = async (req, res, next) => {
    try {
        if (!stripe) {
            throw new AppError('Stripe chưa được cấu hình', 500)
        }

        const signature = req.headers['stripe-signature']
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
        let event

        if (webhookSecret) {
            event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret)
        } else {
            const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body)
            event = JSON.parse(rawBody)
        }

        if (event.type === 'payment_intent.succeeded') {
            const paymentIntent = event.data.object
            const userId = paymentIntent.metadata?.userId
            const amount = Number(paymentIntent.metadata?.walletAmountVnd || 0)
            const depositCredit = calculateDepositCredit(amount)

            if (userId && amount > 0) {
                await applyWalletTransaction({
                    userId,
                    amount: depositCredit.creditedAmount,
                    type: 'deposit',
                    provider: 'stripe',
                    source: 'card',
                    description: 'Stripe card deposit',
                    referenceId: paymentIntent.id,
                    status: 'completed',
                    metadata: {
                        stripePaymentIntentId: paymentIntent.id,
                        paymentMethod: paymentIntent.payment_method,
                        stripeAmount: paymentIntent.amount_received || paymentIntent.amount,
                        stripeCurrency: paymentIntent.currency,
                        exchangeRate: paymentIntent.metadata?.exchangeRate,
                        originalAmount: depositCredit.originalAmount,
                        bonusAmount: depositCredit.bonusAmount,
                        bonusRate: depositCredit.bonusRate,
                    },
                    idempotencyKey: paymentIntent.id,
                })
            }
        }

        return res.json({ received: true })
    } catch (error) {
        if (error.type === 'StripeSignatureVerificationError') {
            return res.status(400).json({ success: false, message: `Webhook Error: ${error.message}` })
        }
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
            const depositCredit = calculateDepositCredit(transaction.amount)
            wallet.balance += depositCredit.creditedAmount
            await wallet.save({ session })

            transaction.status = 'completed'
            transaction.completedAt = new Date()
            transaction.amount = depositCredit.creditedAmount
            transaction.balanceBefore = balanceBefore
            transaction.balanceAfter = wallet.balance
            transaction.metadata = {
                ...(transaction.metadata || {}),
                originalAmount: depositCredit.originalAmount,
                bonusAmount: depositCredit.bonusAmount,
                bonusRate: depositCredit.bonusRate,
            }
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
