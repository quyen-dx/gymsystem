import Payment from '../models/Payment.js'
import AppError from '../utils/appError.js'
import { createPaymentQrCodeUrl, generateReferenceId, verifyMomoSignature, verifyVnPaySignature, verifyZaloPaySignature } from '../utils/gatewayUtils.js'
import { applyWalletTransaction } from './walletService.js'

const validProviders = ['momo', 'vnpay', 'zalopay', 'sandbox']

export const createDepositRequest = async ({ userId, amount, provider }) => {
    if (!userId || !amount || !provider) {
        throw new AppError('Missing deposit request information', 400)
    }
    if (amount <= 0) {
        throw new AppError('Amount must be greater than zero', 400)
    }
    if (!validProviders.includes(provider)) {
        throw new AppError('Unsupported payment provider', 400)
    }

    const referenceId = generateReferenceId()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
    const paymentUrl = createPaymentQrCodeUrl(provider, { amount, referenceId, userId })

    const payment = await Payment.create({
        userId,
        provider,
        amount,
        qrCodeUrl: paymentUrl,
        referenceId,
        expiresAt,
        metadata: { expiresAt },
    })

    return payment
}

export const getSandboxPaymentByOrderId = async (orderId) => {
    const payment = await Payment.findOne({ referenceId: orderId, provider: 'sandbox' })
    if (!payment) return null

    if (payment.status === 'pending' && payment.expiresAt && payment.expiresAt < new Date()) {
        payment.status = 'expired'
        await payment.save()
    }

    return payment
}

export const simulateSandboxPaymentSuccess = async (orderId) => {
    const payment = await Payment.findOne({ referenceId: orderId, provider: 'sandbox' })
    if (!payment) {
        throw new AppError('Payment không tìm thấy', 404)
    }

    if (payment.status === 'success') {
        return payment
    }

    if (payment.status !== 'pending') {
        if (payment.status === 'expired') {
            throw new AppError('Yêu cầu thanh toán đã hết hạn', 400)
        }
        throw new AppError('Yêu cầu thanh toán không hợp lệ', 400)
    }

    if (payment.expiresAt && payment.expiresAt < new Date()) {
        payment.status = 'expired'
        await payment.save()
        throw new AppError('Yêu cầu thanh toán đã hết hạn', 400)
    }

    payment.status = 'success'
    await payment.save()

    const depositResult = await applyWalletTransaction({
        userId: payment.userId,
        amount: payment.amount,
        type: 'deposit',
        provider: 'sandbox',
        referenceId: payment.referenceId,
        status: 'completed',
        metadata: { sandbox: true },
        idempotencyKey: payment.referenceId,
    })

    return { payment, transaction: depositResult.transaction }
}

const verifyProviderPayload = (provider, payload, headers) => {
    switch (provider) {
        case 'momo':
            return verifyMomoSignature(payload, payload.signature, process.env.MOMO_SECRET || '')
        case 'vnpay':
            return verifyVnPaySignature(payload, process.env.VNPAY_SECRET || '')
        case 'zalopay':
            return verifyZaloPaySignature(payload, process.env.ZALOPAY_MAC_KEY || '')
        default:
            return false
    }
}

const getPaymentReferenceId = (provider, payload) => {
    if (provider === 'momo') return payload.orderId || payload.requestId
    if (provider === 'vnpay') return payload.vnp_TxnRef || payload.vnp_OrderInfo
    if (provider === 'zalopay') return payload.apptransid
    return null
}

export const processProviderWebhook = async (provider, payload, headers) => {
    if (!verifyProviderPayload(provider, payload, headers)) {
        throw new AppError('Invalid webhook signature', 400)
    }

    const referenceId = getPaymentReferenceId(provider, payload)
    if (!referenceId) {
        throw new AppError('Missing reference identifier', 400)
    }

    const payment = await Payment.findOne({ referenceId })
    if (!payment) {
        throw new AppError('Payment record not found', 404)
    }

    if (payment.status === 'paid') {
        return payment
    }

    const isPaid =
        provider === 'momo'
            ? payload.errorCode === 0 || payload.resultCode === 0
            : provider === 'vnpay'
                ? payload.vnp_ResponseCode === '00'
                : provider === 'zalopay'
                    ? payload.return_code === 1 || payload.status === 1
                    : false

    if (!isPaid) {
        payment.status = 'failed'
        payment.paymentId = payload.transId || payload.vnp_TransactionNo || payload.pmcid
        await payment.save()
        return payment
    }

    payment.status = 'paid'
    payment.paymentId = payload.transId || payload.vnp_TransactionNo || payload.pmcid
    await payment.save()

    const depositResult = await applyWalletTransaction({
        userId: payment.userId,
        amount: payment.amount,
        type: 'deposit',
        provider,
        referenceId: payment.referenceId,
        status: 'completed',
        metadata: {
            providerPayload: payload,
        },
        idempotencyKey: payment.paymentId || payment.referenceId,
    })

    return depositResult.transaction
}

export const getDepositById = async (paymentId) => {
    return Payment.findById(paymentId)
}

export const getDepositByReference = async (referenceId) => {
    return Payment.findOne({ referenceId })
}
