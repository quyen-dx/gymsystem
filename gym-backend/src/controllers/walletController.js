import mongoose from 'mongoose'
import QRCode from 'qrcode'
import Stripe from 'stripe'
import { buildClientUrl, getBackendUrl } from '../config/appUrls.js'
import Payment from '../models/Payment.js'
import Transaction from '../models/Transaction.js'
import User from '../models/User.js'
import Wallet from '../models/Wallet.js'
import Booking from '../models/Booking.js'
import { applyWalletTransaction, getOrCreateWallet, getWalletTransactions, transferWalletBalance, IdempotencyConflictError, releaseWalletPaymentReservation } from '../services/walletService.js'
import { finalizeWalletDeposit, notifyDepositSuccess } from '../services/walletDepositService.js'
import { finalizePlanPurchase } from '../services/membershipService.js'
import { finalizePlanChangePurchase } from './planChangeController.js'
import { finalizePtBookingPayment } from './bookingController.js'
import { createVnpayPaymentUrl, verifyVnpayReturn } from '../services/vnpayService.js'
import { createNotification } from '../services/notificationService.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import AppError from '../utils/appError.js'
import { assertPolicyConsent } from '../utils/policyConsent.js'

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

// Partial checkouts retain the order total on Payment, while VNPay charges
// only the remaining amount after the wallet contribution.
const getVnpayChargedAmount = (payment) => {
    const remainingAmount = Number(payment?.metadata?.remainingAmount)
    if (Number.isFinite(remainingAmount) && remainingAmount > 0) return remainingAmount
    return Number(payment?.amount || 0)
}

const failPendingPlanPayment = async ({ payment, txnRef, metadata, reason }) => {
    const result = await Payment.updateOne(
        { _id: payment._id, txnRef, status: 'PENDING' },
        { $set: { status: 'FAILED', completedAt: new Date(), metadata } },
    )
    if (result.modifiedCount) {
        await releaseWalletPaymentReservation({ paymentId: payment._id, reason })
    }
    return result.modifiedCount > 0
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

const getClientIp = (req) => {
    const forwardedFor = req.headers['x-forwarded-for']
    if (forwardedFor) return String(forwardedFor).split(',')[0].trim()
    return req.ip || req.socket?.remoteAddress || '127.0.0.1'
}

const generateTxnRef = (userId) => {
    const random = Math.random().toString(36).slice(2, 8).toUpperCase()
    return `WALLET${Date.now()}${userId.toString().slice(-6).toUpperCase()}${random}`
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
            idempotencyKey: `fake_deposit_${userId}_${Date.now()}`,
            withdrawableAmount: Number(amount),
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

export const getMyDepositPayments = async (req, res, next) => {
    try {
        const payments = await Payment.find({
            userId: req.user._id,
            $or: [
                { 'metadata.purpose': { $in: ['WALLET_DEPOSIT', 'PLAN_PURCHASE', 'PT_BOOKING_PAYMENT'] } },
                // Older wallet-paid plan payments predate the purpose field.
                { planId: { $ne: null } },
            ],
        })
            .populate('planId', 'nameVi nameEn durationDays')
            .sort({ createdAt: -1 })
            .limit(100)

        return res.json({ success: true, data: payments })
    } catch (error) {
        next(error)
    }
}

export const getManualQrDepositInfo = async (req, res, next) => {
    try {
        const { txnRef } = req.params
        const payment = await Payment.findOne({
            txnRef,
            method: 'MANUAL_QR',
            'metadata.purpose': 'WALLET_DEPOSIT',
        }).select('txnRef amount status method paymentMethod createdAt metadata')

        if (!payment) {
            throw new AppError('Không tìm thấy mã QR nạp tiền', 404)
        }

        return res.json({
            success: true,
            data: {
                txnRef: payment.txnRef,
                amount: payment.amount,
                status: payment.status,
                method: payment.method || payment.paymentMethod,
                createdAt: payment.createdAt,
                scannedAt: payment.metadata?.scannedAt || null,
                scanCount: payment.metadata?.scanCount || 0,
                demoOnly: true,
            },
        })
    } catch (error) {
        next(error)
    }
}

export const handleManualQrScan = async (req, res, next) => {
    try {
        const { txnRef } = req.params
        const payment = await Payment.findOne({
            txnRef,
            method: 'MANUAL_QR',
            'metadata.purpose': 'WALLET_DEPOSIT',
        })

        if (!payment) {
            return res.redirect(buildClientUrl('/bank-transfer-demo', { error: 'not_found', txnRef }))
        }

        const scanCount = Number(payment.metadata?.scanCount || 0) + 1
        payment.metadata = {
            ...(payment.metadata || {}),
            scannedAt: new Date(),
            scanCount,
            lastScanIp: getClientIp(req),
            lastScanUserAgent: req.headers['user-agent'] || '',
        }
        await payment.save()

        return res.redirect(buildClientUrl('/bank-transfer-demo', { txnRef }))
    } catch (error) {
        next(error)
    }
}

export const simulateManualQrPayment = async (req, res, next) => {
    const session = await mongoose.startSession()
    try {
        const { txnRef } = req.params

        const outcome = await session.withTransaction(async () => {
            const payment = await Payment.findOne({
                txnRef,
                method: 'MANUAL_QR',
                'metadata.purpose': 'WALLET_DEPOSIT',
                'metadata.demoOnly': true,
            }).session(session)

            if (!payment) {
                throw new AppError('Không tìm thấy giao dịch demo', 404)
            }

            if (payment.status === 'PAID') {
                return { status: 'PAID', txnRef: payment.txnRef, alreadyPaid: true }
            }

            if (payment.status !== 'PENDING') {
                throw new AppError('Giao dịch không còn ở trạng thái chờ', 400)
            }

            const depositCredit = calculateDepositCredit(payment.amount)
            const finalized = await finalizeWalletDeposit({
                userId: payment.userId,
                amountVnd: depositCredit.creditedAmount,
                originalAmount: depositCredit.originalAmount,
                bonusAmount: depositCredit.bonusAmount,
                bonusRate: depositCredit.bonusRate,
                paymentMethod: 'MANUAL_QR',
                description: 'Nạp tiền vào ví qua mã QR chuyển khoản',
                txnRef,
                providerMetadata: {
                    demoOnly: true,
                    demoPaidAt: new Date(),
                },
                idempotencyKey: txnRef,
                existingPayment: payment,
                session,
            })
            return {
                status: payment.status,
                txnRef: payment.txnRef,
                amount: payment.amount,
                creditedAmount: depositCredit.creditedAmount,
                walletBalance: finalized.wallet.balance,
                alreadyPaid: finalized.alreadyPaid,
                userId: payment.userId,
                method: 'MANUAL_QR',
            }
        })

        if (!outcome.alreadyPaid) {
            notifyDepositSuccess({ userId: outcome.userId, amountVnd: outcome.creditedAmount, paymentMethod: outcome.method })
        }
        return res.json({
            success: true,
            data: {
                status: outcome.status,
                txnRef: outcome.txnRef,
                amount: outcome.amount,
                creditedAmount: outcome.creditedAmount,
                walletBalance: outcome.walletBalance,
            },
        })
    } catch (error) {
        if (error instanceof IdempotencyConflictError || error?.errorLabels?.includes('TransientTransactionError')) {
            return res.json({ success: true, data: { status: 'PAID', txnRef: req.params.txnRef, alreadyPaid: true } })
        }
        next(error)
    } finally {
        session.endSession()
    }
}

export const createManualQrDepositPayment = async (req, res, next) => {
    try {
        await assertPolicyConsent(req.user._id, ['payment', 'refund'])

        const amount = Number(req.body.amount)
        if (!amount || Number.isNaN(amount) || amount < 10000 || amount > 100000000) {
            throw new AppError('Số tiền không hợp lệ (10.000đ - 100.000.000đ)', 400)
        }

        await getOrCreateWallet(req.user._id)
        const txnRef = generateTxnRef(req.user._id).replace(/^WALLET/, 'MANUAL')
        const manualUrl = `${getBackendUrl()}/api/wallet/manual-qr-scan/${encodeURIComponent(txnRef)}`
        const qrDataUrl = await QRCode.toDataURL(manualUrl, {
            errorCorrectionLevel: 'M',
            margin: 1,
            width: 320,
        })

        const payment = await Payment.create({
            userId: req.user._id,
            amount,
            currency: 'vnd',
            status: 'PENDING',
            paymentMethod: 'MANUAL_QR',
            method: 'MANUAL_QR',
            source: 'OFFLINE',
            txnRef,
            metadata: {
                purpose: 'WALLET_DEPOSIT',
                provider: 'MANUAL_QR',
                manualUrl,
                qrDataUrl,
                demoOnly: true,
            },
        })

        return res.status(201).json({
            success: true,
            data: {
                paymentId: payment._id,
                txnRef,
                qrDataUrl,
                manualUrl,
                status: payment.status,
                amount: payment.amount,
                method: payment.method,
                note: 'QR nội bộ demo, không thực hiện giao dịch ngân hàng thật.',
            },
        })
    } catch (error) {
        next(error)
    }
}

export const createVnpayDepositPayment = async (req, res, next) => {
    try {
        await assertPolicyConsent(req.user._id, ['payment', 'refund'])

        const amount = Number(req.body.amount)
        if (!amount || Number.isNaN(amount) || amount < 10000 || amount > 100000000) {
            throw new AppError('Số tiền không hợp lệ (10.000đ - 100.000.000đ)', 400)
        }

        await getOrCreateWallet(req.user._id)
        const txnRef = generateTxnRef(req.user._id)
        const payment = await Payment.create({
            userId: req.user._id,
            amount,
            currency: 'vnd',
            status: 'PENDING',
            paymentMethod: 'VNPAY',
            method: 'VNPAY',
            source: 'ONLINE',
            txnRef,
            metadata: {
                purpose: 'WALLET_DEPOSIT',
                provider: 'VNPAY',
            },
        })

        const paymentUrl = createVnpayPaymentUrl({
            amount,
            txnRef,
            orderInfo: `Nap tien vi GymPro ${txnRef}`,
            ipAddr: getClientIp(req),
            locale: req.body.locale || 'vn',
            bankCode: req.body.bankCode,
        })
        const qrDataUrl = await QRCode.toDataURL(paymentUrl, {
            errorCorrectionLevel: 'M',
            margin: 1,
            width: 320,
        })

        return res.status(201).json({
            success: true,
            data: {
                paymentId: payment._id,
                txnRef,
                paymentUrl,
                qrDataUrl,
                status: payment.status,
                amount: payment.amount,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            },
        })
    } catch (error) {
        next(error)
    }
}

export const handleVnpayReturn = async (req, res, next) => {
  const redirectWithStatus = (status, txnRef, target = '/deposit') => res.redirect(buildClientUrl(target, {
    payment: status,
    txnRef,
  }))

  try {
    const txnRef = req.query.vnp_TxnRef
    if (!txnRef) return redirectWithStatus('failed')

    const isValidSignature = verifyVnpayReturn(req.query)
    const responseCode = req.query.vnp_ResponseCode
    const transactionStatus = req.query.vnp_TransactionStatus
    const isPaid = isValidSignature && responseCode === '00' && transactionStatus === '00'

    const payment = await Payment.findOne({ txnRef }).lean()
    if (!payment) return redirectWithStatus('failed')

    const paymentPurpose = payment.metadata?.purpose
    const paymentRedirectTarget = paymentPurpose === 'PLAN_PURCHASE'
      ? '/my-membership'
      : paymentPurpose === 'PT_BOOKING_PAYMENT'
        ? '/booking'
        : '/deposit'

    // Chống lệch tiền: số tiền VNPay báo phải khớp số tiền giao dịch (vnp_Amount = tiền * 100)
    const vnpAmount = Number(req.query.vnp_Amount)
    if (vnpAmount && Math.round(getVnpayChargedAmount(payment) * 100) !== vnpAmount) {
      return redirectWithStatus('failed', txnRef, paymentRedirectTarget)
    }

    // === Thanh toán gói tập (đăng ký/gia hạn) ===
    if (paymentPurpose === 'PLAN_PURCHASE') {
      const redirectTarget = '/my-membership'
      if (payment.status === 'PAID') return redirectWithStatus('success', txnRef, redirectTarget)
      if (payment.status !== 'PENDING') return redirectWithStatus('failed', txnRef, redirectTarget)

      const metaPatch = {
        ...(payment.metadata || {}),
        vnpayReturn: req.query,
        verified: isValidSignature,
      }

      if (!isPaid) {
        await failPendingPlanPayment({
          payment,
          txnRef,
          metadata: metaPatch,
          reason: 'vnpay_return_failed',
        })
        return redirectWithStatus('failed', txnRef, redirectTarget)
      }

      await Payment.updateOne({ txnRef, status: 'PENDING' }, { $set: { metadata: metaPatch } })
      try {
        if (payment.metadata?.planChange) {
          await finalizePlanChangePurchase({ paymentId: payment._id })
        } else {
          await finalizePlanPurchase({ paymentId: payment._id, vnpayQuery: req.query })
        }
      } catch (error) {
        if (error instanceof IdempotencyConflictError || error?.errorLabels?.includes('TransientTransactionError')) {
          return redirectWithStatus('success', txnRef, redirectTarget)
        }
        throw error
      }
      return redirectWithStatus('success', txnRef, redirectTarget)
    }

    // === Thanh toán đặt lịch PT (trả phần còn thiếu qua VNPay) ===
    if (paymentPurpose === 'PT_BOOKING_PAYMENT') {
      const redirectTarget = '/booking'
      if (payment.status === 'PAID') return redirectWithStatus('success', txnRef, redirectTarget)
      if (payment.status !== 'PENDING') return redirectWithStatus('failed', txnRef, redirectTarget)

      if (!isPaid) {
        await Payment.updateOne({ txnRef, status: 'PENDING' }, {
          $set: {
            status: 'FAILED',
            metadata: { ...(payment.metadata || {}), vnpayReturn: req.query, verified: isValidSignature },
          },
        })
        const bookingIds = (payment.metadata?.bookingIds || []).map(String)
        if (bookingIds.length) {
          await Booking.updateMany(
            { _id: { $in: bookingIds }, status: 'awaiting_payment', paymentStatus: { $ne: 'paid' } },
            { $set: { paymentStatus: 'failed', paymentFailedAt: new Date() } },
          )
          const firstBooking = await Booking.findOne({ _id: bookingIds[0] }).select('memberId').lean()
          if (firstBooking) {
            createNotification({
              receiverId: firstBooking.memberId,
              receiverRole: 'member',
              notificationType: NOTIFICATION_TYPES.PAYMENT_FAILED,
              title: 'Thanh toán qua VNPay thất bại',
              content: 'Thanh toán phần còn thiếu qua VNPay chưa hoàn tất. Bạn có thể thử lại trước khi hết thời hạn giữ chỗ.',
              relatedId: firstBooking._id,
              relatedType: 'Booking',
              redirectUrl: '/booking',
              createdBy: 'System',
            }).catch(() => {})
          }
        }
        return redirectWithStatus('failed', txnRef, redirectTarget)
      }

      try {
        const outcome = await finalizePtBookingPayment({ paymentId: payment._id, vnpayQuery: req.query })
        if (outcome?.status === 'success') {
          return redirectWithStatus('success', txnRef, redirectTarget)
        }
        if (outcome?.status === 'already_paid') {
          return redirectWithStatus('success', txnRef, redirectTarget)
        }
        if (outcome?.status === 'expired') {
          return redirectWithStatus('expired', txnRef, redirectTarget)
        }
        return redirectWithStatus('failed', txnRef, redirectTarget)
      } catch (error) {
        if (error instanceof IdempotencyConflictError || error?.errorLabels?.includes('TransientTransactionError')) {
          return redirectWithStatus('success', txnRef, redirectTarget)
        }
        throw error
      }
    }

    const session = await mongoose.startSession()
    try {
      const outcome = await session.withTransaction(async () => {
        const payment = await Payment.findOne({ txnRef }).session(session)
        if (!payment) return { status: 'failed' }

                if (payment.status === 'PAID') return { status: 'success', alreadyPaid: true }

                if (payment.status !== 'PENDING') return { status: 'failed' }

                payment.metadata = {
                    ...(payment.metadata || {}),
                    vnpayReturn: req.query,
                    verified: isValidSignature,
                }

                if (!isPaid) {
                    payment.status = 'FAILED'
                    await payment.save({ session })
                    return { status: 'failed' }
                }

                const depositCredit = calculateDepositCredit(payment.amount)
                const finalized = await finalizeWalletDeposit({
                    userId: payment.userId,
                    amountVnd: depositCredit.creditedAmount,
                    originalAmount: depositCredit.originalAmount,
                    bonusAmount: depositCredit.bonusAmount,
                    bonusRate: depositCredit.bonusRate,
                    paymentMethod: 'VNPAY',
                    description: 'Nạp tiền vào ví qua VNPay',
                    txnRef,
                    providerRef: req.query.vnp_TransactionNo,
                    providerRefKey: 'vnpTransactionNo',
                    providerMetadata: {
                        vnpayReturn: req.query,
                        verified: true,
                        vnpTransactionNo: req.query.vnp_TransactionNo,
                        bankCode: req.query.vnp_BankCode,
                        bankTranNo: req.query.vnp_BankTranNo,
                        payDate: req.query.vnp_PayDate,
                    },
                    idempotencyKey: txnRef,
                    existingPayment: payment,
                    session,
                })
                return {
                    status: 'success',
                    alreadyPaid: finalized.alreadyPaid,
                    userId: payment.userId,
                    amount: depositCredit.creditedAmount,
                    method: 'VNPAY',
                }
            })

            if (outcome.status === 'success' && !outcome.alreadyPaid) {
                notifyDepositSuccess({ userId: outcome.userId, amountVnd: outcome.amount, paymentMethod: outcome.method })
            }
            return redirectWithStatus(outcome.status, txnRef)
        } catch (error) {
            throw error
        } finally {
            session.endSession()
        }
    } catch (error) {
        if (error instanceof IdempotencyConflictError || error?.errorLabels?.includes('TransientTransactionError')) {
            return redirectWithStatus('success', txnRef)
        }
        next(error)
    }
}

export const handleVnpayIpn = async (req, res, next) => {
  // VNPay gọi endpoint này ngay sau khi xử lý thanh toán (không phụ thuộc trình duyệt).
  // Phải trả lời nhanh: RspCode=00 = đã xử lý OK, 99 = lỗi (VNPay sẽ gọi lại).
  const respond = (code, message) => res.json({ RspCode: code, Message: message })

  try {
    if (!verifyVnpayReturn(req.query)) {
      return respond('97', 'Invalid Signature')
    }

    const txnRef = req.query.vnp_TxnRef
    const payment = await Payment.findOne({ txnRef })
    if (!payment) {
      return respond('01', 'Order Not Found')
    }

    // Chống lệch tiền: vnp_Amount (đơn vị *100) phải khớp số tiền giao dịch
    const vnpAmount = Number(req.query.vnp_Amount)
    if (vnpAmount && Math.round(getVnpayChargedAmount(payment) * 100) !== vnpAmount) {
      return respond('04', 'Invalid Amount')
    }

    const isPaid = req.query.vnp_ResponseCode === '00' && req.query.vnp_TransactionStatus === '00'

    if (String(payment.status).toUpperCase() === 'PAID') {
      return respond('02', 'Order Already Confirmed')
    }

    const ipnMeta = { ...(payment.metadata || {}), vnpayIpn: req.query, verified: true, ipnProcessedAt: new Date() }

    if (!isPaid) {
      if (payment.metadata?.purpose === 'PLAN_PURCHASE') {
        await failPendingPlanPayment({
          payment,
          txnRef,
          metadata: ipnMeta,
          reason: 'vnpay_ipn_failed',
        })
      } else {
        await Payment.updateOne(
          { _id: payment._id, status: 'PENDING' },
          { $set: { status: 'FAILED', metadata: ipnMeta } },
        )
      }
      return respond('00', 'Confirm Success')
    }

    if (String(payment.status).toUpperCase() !== 'PENDING') return respond('02', 'Order Already Confirmed')

    try {
      const purpose = payment.metadata?.purpose
      if (purpose === 'PLAN_PURCHASE') {
        if (payment.metadata?.planChange) {
          await finalizePlanChangePurchase({ paymentId: payment._id })
        } else {
          await finalizePlanPurchase({ paymentId: payment._id, vnpayQuery: req.query })
        }
      } else if (purpose === 'PT_BOOKING_PAYMENT') {
        await finalizePtBookingPayment({ paymentId: payment._id, vnpayQuery: req.query })
      } else {
        const depositCredit = calculateDepositCredit(payment.amount)
        await finalizeWalletDeposit({
          userId: payment.userId,
          amountVnd: depositCredit.creditedAmount,
          originalAmount: depositCredit.originalAmount,
          bonusAmount: depositCredit.bonusAmount,
          bonusRate: depositCredit.bonusRate,
          paymentMethod: 'VNPAY',
          description: 'Nạp tiền vào ví qua VNPay',
          txnRef,
          providerRef: req.query.vnp_TransactionNo,
          providerRefKey: 'vnpTransactionNo',
          providerMetadata: {
            vnpayIpn: req.query,
            verified: true,
            vnpTransactionNo: req.query.vnp_TransactionNo,
            bankCode: req.query.vnp_BankCode,
            bankTranNo: req.query.vnp_BankTranNo,
            payDate: req.query.vnp_PayDate,
          },
          idempotencyKey: txnRef,
          existingPayment: payment,
        })
        notifyDepositSuccess({ userId: payment.userId, amountVnd: depositCredit.creditedAmount, paymentMethod: 'VNPAY' })
      }
    } catch (error) {
      if (error instanceof IdempotencyConflictError || error?.errorLabels?.includes('TransientTransactionError')) {
        return respond('02', 'Order Already Confirmed')
      }
      console.error('[VNPay IPN] finalize failed:', error?.message || error)
      return respond('99', 'Unknown Error')
    }

    return respond('00', 'Confirm Success')
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
            paymentIntentId: paymentIntent.id,
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
        if (!webhookSecret) {
            throw new AppError('STRIPE_WEBHOOK_SECRET chưa được cấu hình, từ chối xử lý webhook', 503)
        }
        const event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret)

        if (event.type === 'payment_intent.succeeded') {
            const paymentIntent = event.data.object
            const userId = paymentIntent.metadata?.userId
            const amount = Number(paymentIntent.metadata?.walletAmountVnd || 0)
            const exchangeRate = Number(paymentIntent.metadata?.exchangeRate) || null
            const depositCredit = calculateDepositCredit(amount)

            if (userId && amount > 0) {
                const session = await mongoose.startSession()
                try {
                    const result = await session.withTransaction(async () => {
                        return finalizeWalletDeposit({
                            userId,
                            amountVnd: depositCredit.creditedAmount,
                            originalAmount: depositCredit.originalAmount,
                            bonusAmount: depositCredit.bonusAmount,
                            bonusRate: depositCredit.bonusRate,
                            currency: 'VND',
                            exchangeRate,
                            paymentMethod: 'INTERNATIONAL_CARD',
                            description: 'Nạp tiền vào ví qua thẻ quốc tế',
                            txnRef: paymentIntent.id,
                            providerRef: paymentIntent.id,
                            providerRefKey: 'stripePaymentIntentId',
                            providerMetadata: {
                                stripePaymentIntentId: paymentIntent.id,
                                stripePaymentMethod: paymentIntent.payment_method,
                                stripeAmount: paymentIntent.amount_received || paymentIntent.amount,
                                stripeCurrency: paymentIntent.currency,
                                exchangeRate,
                            },
                            idempotencyKey: paymentIntent.id,
                            session,
                        })
                    })
                    if (!result.alreadyPaid) {
                        notifyDepositSuccess({ userId, amountVnd: depositCredit.creditedAmount, paymentMethod: 'INTERNATIONAL_CARD' })
                    }
                } finally {
                    session.endSession()
                }
            }
        }

        return res.json({ received: true })
    } catch (error) {
        if (error.type === 'StripeSignatureVerificationError') {
            return res.status(400).json({ success: false, message: `Webhook Error: ${error.message}` })
        }
        if (error instanceof IdempotencyConflictError || error?.errorLabels?.includes('TransientTransactionError')) {
            return res.json({ received: true })
        }
        next(error)
    }
}

export const confirmStripeCardPayment = async (req, res, next) => {
    try {
        if (!stripe) {
            throw new AppError('Stripe chưa được cấu hình', 500)
        }

        const { paymentIntentId } = req.body
        if (!paymentIntentId) {
            throw new AppError('paymentIntentId là bắt buộc', 400)
        }

        // Xác thực kết quả thanh toán trực tiếp với Stripe (không tin client)
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
        if (!paymentIntent) {
            throw new AppError('Không tìm thấy thanh toán trên Stripe', 404)
        }
        if (String(paymentIntent.metadata?.userId || '') !== req.user._id.toString()) {
            throw new AppError('Thanh toán không thuộc về tài khoản của bạn', 403)
        }
        if (paymentIntent.status !== 'succeeded') {
            throw new AppError('Thanh toán chưa hoàn tất, vui lòng thử lại', 400)
        }

        const amount = Number(paymentIntent.metadata?.walletAmountVnd || 0)
        if (!amount || amount <= 0) {
            throw new AppError('Dữ liệu thanh toán không hợp lệ', 400)
        }
        const exchangeRate = Number(paymentIntent.metadata?.exchangeRate) || null
        const depositCredit = calculateDepositCredit(amount)

        const session = await mongoose.startSession()
        try {
            const result = await session.withTransaction(async () => {
                return finalizeWalletDeposit({
                    userId: req.user._id,
                    amountVnd: depositCredit.creditedAmount,
                    originalAmount: depositCredit.originalAmount,
                    bonusAmount: depositCredit.bonusAmount,
                    bonusRate: depositCredit.bonusRate,
                    currency: 'VND',
                    exchangeRate,
                    paymentMethod: 'INTERNATIONAL_CARD',
                    description: 'Nạp tiền vào ví qua thẻ quốc tế',
                    txnRef: paymentIntent.id,
                    providerRef: paymentIntent.id,
                    providerRefKey: 'stripePaymentIntentId',
                    providerMetadata: {
                        stripePaymentIntentId: paymentIntent.id,
                        stripePaymentMethod: paymentIntent.payment_method,
                        stripeAmount: paymentIntent.amount_received || paymentIntent.amount,
                        stripeCurrency: paymentIntent.currency,
                        exchangeRate,
                    },
                    idempotencyKey: paymentIntent.id,
                    session,
                })
            })
            if (!result.alreadyPaid) {
                notifyDepositSuccess({ userId: req.user._id, amountVnd: depositCredit.creditedAmount, paymentMethod: 'INTERNATIONAL_CARD' })
            }
            return res.json({
                success: true,
                data: {
                    paymentId: result.payment?._id || null,
                    transactionId: result.transaction?._id || null,
                    walletBalance: result.wallet?.balance,
                    creditedAmount: result.transaction?.amount || depositCredit.creditedAmount,
                    alreadyPaid: result.alreadyPaid,
                },
            })
        } catch (error) {
            const isTransient = error?.errorLabels?.includes('TransientTransactionError')
            if (error instanceof IdempotencyConflictError || isTransient) {
                const existingTxn = await Transaction.findOne({ idempotencyKey: paymentIntentId }).lean()
                let existingPayment = existingTxn?.paymentId ? await Payment.findById(existingTxn.paymentId).lean() : null
                const wallet = await getOrCreateWallet(req.user._id)
                return res.json({
                    success: true,
                    data: {
                        paymentId: existingPayment?._id || null,
                        transactionId: existingTxn?._id || null,
                        walletBalance: wallet.balance,
                        creditedAmount: existingTxn?.amount || amount,
                        alreadyPaid: true,
                    },
                })
            }
            throw error
        } finally {
            session.endSession()
        }
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

export const staffListAllTransactions = async (req, res, next) => {
    try {
        const { page = 1, limit = 50, status, type, search } = req.query
        const filter = {}

        if (status) filter.status = status
        if (type) filter.type = type
        if (search) {
            const users = await User.find({
                $or: [
                    { memberCode: { $regex: search, $options: 'i' } },
                    { fullName: { $regex: search, $options: 'i' } },
                    { name: { $regex: search, $options: 'i' } },
                ],
            }).select('_id').lean()
            filter.userId = { $in: users.map((u) => u._id) }
        }

        const total = await Transaction.countDocuments(filter)
        const transactions = await Transaction.find(filter)
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .lean()

        const userIds = [...new Set(transactions.map((t) => t.userId?.toString()))]
        const users = await User.find({ _id: { $in: userIds } })
            .select('name fullName memberCode memberNumber email phone')
            .lean()
        const userMap = {}
        for (const u of users) {
            userMap[u._id.toString()] = { name: u.fullName || u.name, memberCode: u.memberCode, email: u.email, phone: u.phone }
        }

        const enriched = transactions.map((t) => ({
            ...t,
            userInfo: userMap[t.userId?.toString()] || null,
        }))

        return res.json({
            success: true,
            data: {
                transactions: enriched,
                pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
            },
        })
    } catch (error) {
        next(error)
    }
}

export const staffListAllPayments = async (req, res, next) => {
    try {
        const { page = 1, limit = 50, status, search } = req.query
        const filter = {}

        if (status) filter.status = status
        if (search) {
            const users = await User.find({
                $or: [
                    { memberCode: { $regex: search, $options: 'i' } },
                    { fullName: { $regex: search, $options: 'i' } },
                    { name: { $regex: search, $options: 'i' } },
                ],
            }).select('_id').lean()
            filter.userId = { $in: users.map((u) => u._id) }
        }

        const total = await Payment.countDocuments(filter)
        const payments = await Payment.find(filter)
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .populate('userId', 'name fullName email phone memberCode memberNumber')
            .populate('planId', 'nameVi nameEn price')
            .lean()

        return res.json({
            success: true,
            data: { payments, pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) } },
        })
    } catch (error) {
        next(error)
    }
}
