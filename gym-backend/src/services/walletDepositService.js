import mongoose from 'mongoose'
import Payment from '../models/Payment.js'
import Transaction from '../models/Transaction.js'
import { applyWalletTransaction, getOrCreateWallet, IdempotencyConflictError } from './walletService.js'
import { createNotification } from './notificationService.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import AppError from '../utils/appError.js'

const normalizePaymentMethod = (method) => String(method || '').toUpperCase()

export const getDepositMethodLabel = (method) => {
  const m = normalizePaymentMethod(method)
  if (m === 'VNPAY') return 'VNPay'
  if (m === 'INTERNATIONAL_CARD') return 'Thẻ quốc tế'
  if (m === 'MANUAL_QR') return 'Chuyển khoản'
  return m || 'VNPay'
}

/**
 * Flow chuẩn sau khi thanh toán thành công (dùng chung cho mọi phương thức nạp tiền):
 * 1. Xác thực kết quả (caller đã verify signature/status trước khi gọi)
 * 2. Cộng tiền vào Wallet (atomic)
 * 3. Tạo Transaction (liên kết paymentId, lưu currency/exchangeRate/paymentMethod)
 * 4. Tạo/update Payment (liên kết walletId/transactionId, status = PAID, completedAt)
 * 5. Audit log (chỉ khi có actor admin/staff, theo chuẩn hệ thống)
 * 6. Trả kết quả
 *
 * Idempotent theo idempotencyKey / txnRef / providerRef.
 */
export const finalizeWalletDeposit = async ({
    userId,
    amountVnd,
    originalAmount = null,
    bonusAmount = 0,
    bonusRate = 0,
    currency = 'VND',
    exchangeRate = null,
    paymentMethod,
    description,
    txnRef = null,
    providerRef = null,
    providerRefKey = null,
    providerMetadata = {},
    idempotencyKey,
    existingPayment = null,
    session = null,
}) => {
    const method = normalizePaymentMethod(paymentMethod)
    if (!userId) throw new AppError('finalizeWalletDeposit requires userId', 400)
    if (!method) throw new AppError('finalizeWalletDeposit requires paymentMethod', 400)
    const creditAmount = typeof amountVnd === 'string' ? Number(amountVnd) : amountVnd
    if (!creditAmount || Number.isNaN(creditAmount) || creditAmount <= 0) {
        throw new AppError('finalizeWalletDeposit requires a positive amountVnd', 400)
    }

    const ownsSession = !session
    const s = session || (await mongoose.startSession())
    if (ownsSession) s.startTransaction()

    try {
        // 1) Resolve existing Payment để idempotent + cập nhật đúng bản ghi
        let payment = null
        if (existingPayment) {
            payment = existingPayment
        } else if (txnRef) {
            payment = await Payment.findOne({ txnRef }).session(s)
            if (!payment && providerRef && providerRefKey) {
                payment = await Payment.findOne({ [`metadata.${providerRefKey}`]: providerRef }).session(s)
            }
        }

        if (payment && payment.status && String(payment.status).toUpperCase() === 'PAID') {
            const transaction = payment.transactionId
                ? await Transaction.findById(payment.transactionId).session(s)
                : null
            if (ownsSession) await s.commitTransaction()
            return { wallet: await getOrCreateWallet(userId, s), transaction, payment, alreadyPaid: true }
        }

        // 2) Cộng tiền vào Wallet + tạo Transaction
        const applyResult = await applyWalletTransaction({
            userId,
            amount: creditAmount,
            type: 'deposit',
            provider: method === 'VNPAY' ? 'vnpay' : method === 'INTERNATIONAL_CARD' ? 'stripe' : 'manual_qr_demo',
            source: method === 'VNPAY' ? 'online' : method === 'INTERNATIONAL_CARD' ? 'card' : 'bank_demo',
            description,
            referenceId: txnRef || providerRef,
            status: 'completed',
            paymentId: payment ? payment._id : null,
            currency,
            exchangeRate,
            paymentMethod: method,
            // Deposit bonuses remain usable in the wallet but cannot be paid
            // out. The original customer-funded amount is withdrawable.
            withdrawableAmount: Number(originalAmount ?? creditAmount),
            metadata: {
                paymentId: payment ? payment._id : null,
                txnRef: txnRef || null,
                paymentMethod: method,
                currency,
                exchangeRate,
                originalAmount,
                bonusAmount,
                bonusRate,
                ...providerMetadata,
            },
            idempotencyKey,
            session: s,
        })
        const { wallet, transaction } = applyResult

        // 2b) Transaction đã tồn tại cho idempotencyKey này (xử lý lặp/đồng thời):
        //     KHÔNG credit lại wallet, chỉ đảm bảo có Payment ghi nhận.
        if (applyResult.idempotent) {
            let existingPayment = transaction.paymentId
                ? await Payment.findById(transaction.paymentId).session(s)
                : null
            if (!existingPayment && txnRef) {
                existingPayment = await Payment.findOne({ txnRef }).session(s)
            }
            if (!existingPayment) {
                try {
                    const [createdPayment] = await Payment.create(
                        [
                            {
                                userId,
                                walletId: wallet._id,
                                transactionId: transaction._id,
                                txnRef: txnRef || null,
                                amount: originalAmount || creditAmount,
                                currency: 'vnd',
                                exchangeRate: exchangeRate || null,
                                type: 'deposit',
                                status: 'PAID',
                                paymentMethod: method,
                                method,
                                source: 'ONLINE',
                                paidAt: new Date(),
                                completedAt: new Date(),
                                metadata: {
                                    purpose: 'WALLET_DEPOSIT',
                                    provider: method,
                                    walletId: wallet._id,
                                    walletTransactionId: transaction._id,
                                    creditedAmount: creditAmount,
                                    bonusAmount,
                                    bonusRate,
                                    ...(providerRef ? { [providerRefKey || 'providerRef']: providerRef } : {}),
                                    ...providerMetadata,
                                },
                            },
                        ],
                        { session: s },
                    )
                    existingPayment = createdPayment
                    transaction.paymentId = createdPayment._id
                    await transaction.save({ session: s })
                } catch (paymentError) {
                    if (paymentError?.code === 11000) {
                        existingPayment = txnRef ? await Payment.findOne({ txnRef }).session(s) : null
                    } else {
                        throw paymentError
                    }
                }
            }
            if (ownsSession) await s.commitTransaction()
            return { wallet, transaction, payment: existingPayment, alreadyPaid: true }
        }

        // 3) Tạo mới hoặc cập nhật Payment
        if (payment) {
            payment.status = 'PAID'
            payment.paidAt = new Date()
            payment.completedAt = new Date()
            payment.walletId = wallet._id
            payment.transactionId = transaction._id
            if (exchangeRate) payment.exchangeRate = exchangeRate
            payment.metadata = {
                ...(payment.metadata || {}),
                purpose: 'WALLET_DEPOSIT',
                walletId: wallet._id,
                walletTransactionId: transaction._id,
                creditedAmount: creditAmount,
                bonusAmount,
                bonusRate,
                ...providerMetadata,
            }
            await payment.save({ session: s })
        } else {
            const [createdPayment] = await Payment.create(
                [
                    {
                        userId,
                        walletId: wallet._id,
                        transactionId: transaction._id,
                        txnRef: txnRef || null,
                        amount: originalAmount || creditAmount,
                        currency: 'vnd',
                        exchangeRate: exchangeRate || null,
                        type: 'deposit',
                        status: 'PAID',
                        paymentMethod: method,
                        method,
                        source: 'ONLINE',
                        paidAt: new Date(),
                        completedAt: new Date(),
                        metadata: {
                            purpose: 'WALLET_DEPOSIT',
                            provider: method,
                            walletId: wallet._id,
                            walletTransactionId: transaction._id,
                            creditedAmount: creditAmount,
                            bonusAmount,
                            bonusRate,
                            ...(providerRef ? { [providerRefKey || 'providerRef']: providerRef } : {}),
                            ...providerMetadata,
                        },
                    },
                ],
                { session: s },
            )
            payment = createdPayment
        }

        // Đảm bảo Transaction trỏ ngược về Payment
        if (!transaction.paymentId) {
            transaction.paymentId = payment._id
            await transaction.save({ session: s })
        }

        if (ownsSession) await s.commitTransaction()

        return { wallet, transaction, payment, alreadyPaid: false }
    } catch (error) {
        if (ownsSession) await s.abortTransaction()
        throw error
    } finally {
        if (ownsSession) s.endSession()
    }
}

/**
 * Gửi notification nạp tiền thành công (fire-and-forget, sau khi commit).
 */
export const notifyDepositSuccess = ({ userId, amountVnd, paymentMethod }) => {
    if (!userId) return
    const label = getDepositMethodLabel(paymentMethod)
    createNotification({
        receiverId: userId,
        receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
        title: 'Nạp tiền vào ví thành công',
        content: `Bạn vừa nạp ${Number(amountVnd).toLocaleString('vi-VN')} VND vào ví qua ${label}.`,
        redirectUrl: '/wallet',
        createdBy: 'System',
    }).catch(() => {})
}
