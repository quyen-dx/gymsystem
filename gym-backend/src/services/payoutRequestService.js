import mongoose from 'mongoose'
import PayoutRequest from '../models/PayoutRequest.js'
import Wallet from '../models/Wallet.js'
import Transaction from '../models/Transaction.js'
import User from '../models/User.js'
import AppError from '../utils/appError.js'
import { getOrCreateWallet } from './walletService.js'
import { getSystemSettingsValue } from './systemSettingsService.js'
import { assertPayoutTransition } from './payoutStateMachine.js'
import { createNotification } from './notificationService.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { recordUserActivity } from './userActivityService.js'

const DEFAULT_MIN_PAYOUT = 10000
const DEFAULT_CONFIRM_HOURS = 72
const DEFAULT_ADMIN_REMINDER_HOURS = 24
const DEFAULT_AUTO_CANCEL_HOURS = 48
const AUTO_CANCEL_REASON = 'Tự động hủy do yêu cầu chưa được Admin xử lý đúng hạn'
const STAFF_ROLES = ['admin', 'super_admin']

const asId = (value, label = 'ID') => {
  if (!mongoose.Types.ObjectId.isValid(String(value))) throw new AppError(`${label} không hợp lệ`, 400)
  return new mongoose.Types.ObjectId(value)
}
const clean = (value, max = 500) => String(value || '').trim().replace(/[<>]/g, '').slice(0, max)
const formatMoney = (amount) => Number(amount).toLocaleString('vi-VN')
const formatDuration = (hours) => (hours % 24 === 0 ? `${hours / 24} ngày` : `${hours} giờ`)

const getPayoutSettings = async () => {
  const settings = await getSystemSettingsValue()
  return {
    minAmount: Math.max(1, Number(settings?.billing?.payoutMinAmount) || DEFAULT_MIN_PAYOUT),
    confirmHours: Math.max(1, Number(settings?.billing?.payoutAutoConfirmHours) || DEFAULT_CONFIRM_HOURS),
    adminReminderHours: Math.max(1, Number(settings?.billing?.payoutAdminReminderHours) || DEFAULT_ADMIN_REMINDER_HOURS),
    autoCancelHours: Math.max(1, Number(settings?.billing?.payoutAutoCancelHours) || DEFAULT_AUTO_CANCEL_HOURS),
  }
}

const notifyMember = (request, type, title, content) => createNotification({
  receiverId: request.memberId,
  receiverRole: 'member', notificationType: type, title, content,
  relatedId: request._id, relatedType: 'PayoutRequest', redirectUrl: '/payouts', createdBy: 'System',
}).catch(() => {})

const notifyAdmins = (request, type, title, content) => createNotification({
  receiverId: null, receiverRole: 'admin', notificationType: type, title, content,
  relatedId: request._id, relatedType: 'PayoutRequest', redirectUrl: '/admin/payout-requests', createdBy: 'System', priority: 'high',
}).catch(() => {})

const createPayoutTransaction = async ({ request, session }) => {
  const wallet = await Wallet.findOneAndUpdate(
    { _id: request.walletId, userId: request.memberId, lockedBalance: { $gte: request.amount } },
    { $inc: { lockedBalance: -request.amount } },
    { new: true, session },
  )
  if (!wallet) throw new AppError('Payout lock is missing or has already been released', 409)
  const [transaction] = await Transaction.create([{
    userId: request.memberId, walletId: request.walletId, type: 'payout', amount: -request.amount,
    balanceBefore: wallet.balance, balanceAfter: wallet.balance, status: 'completed', completedAt: new Date(),
    provider: 'manual_bank_transfer', source: 'wallet_payout', description: 'Rút tiền từ ví về tài khoản ngân hàng',
    referenceId: request._id.toString(), idempotencyKey: `payout_${request._id}`,
    metadata: { payoutRequestId: request._id, transferReference: request.transferReference },
  }], { session })
  return transaction
}

const finalizePayout = async ({ payoutRequestId, expectedStatus, confirmationSource, resolvedBy = null, resolutionNote = '' }) => {
  const session = await mongoose.startSession()
  try {
    let result
    await session.withTransaction(async () => {
      const request = await PayoutRequest.findOneAndUpdate(
        { _id: asId(payoutRequestId, 'Payout request ID'), status: expectedStatus },
        { $set: { status: 'COMPLETED', confirmedAt: new Date(), confirmationSource, ...(resolvedBy ? { resolvedBy, resolvedAt: new Date(), resolutionNote: clean(resolutionNote) } : {}) } },
        { new: true, session },
      )
      if (!request) throw new AppError('Payout request is no longer available for confirmation', 409)
      assertPayoutTransition(expectedStatus, 'COMPLETED')
      const transaction = await createPayoutTransaction({ request, session })
      request.payoutTransactionId = transaction._id
      await request.save({ session })
      await recordUserActivity({
        userId: request.memberId, type: 'wallet', title: 'Hoàn tất rút tiền',
        description: `Yêu cầu rút ${formatMoney(request.amount)}đ đã hoàn tất.`,
        metadata: { payoutRequestId: request._id, source: confirmationSource }, session,
      })
      result = request
    })
    return result
  } finally { session.endSession() }
}

export const createPayoutRequest = async ({ memberId, payload }) => {
  const amount = Number(payload?.amount)
  const bankCode = clean(payload?.bankCode, 30)
  const bankName = clean(payload?.bankName, 100)
  const accountNumber = clean(payload?.accountNumber, 40).replace(/[\s-]/g, '')
  const accountHolder = clean(payload?.accountHolder, 120)
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) throw new AppError('Số tiền rút phải là số nguyên dương', 400)
  if (!bankCode || !bankName || !accountHolder || !/^[A-Za-z0-9]{6,34}$/.test(accountNumber)) {
    throw new AppError('Thông tin tài khoản ngân hàng không hợp lệ', 400)
  }
  const { minAmount } = await getPayoutSettings()
  if (amount < minAmount) throw new AppError(`Số tiền rút tối thiểu là ${formatMoney(minAmount)}đ`, 400)
  const session = await mongoose.startSession()
  try {
    let request
    await session.withTransaction(async () => {
      const wallet = await getOrCreateWallet(memberId, session)
      const reserved = await Wallet.findOneAndUpdate(
        { _id: wallet._id, userId: memberId, balance: { $gte: amount }, withdrawableBalance: { $gte: amount } },
        { $inc: { balance: -amount, lockedBalance: amount, withdrawableBalance: -amount } },
        { new: true, session },
      )
      if (!reserved) throw new AppError('Số dư có thể rút không đủ', 400)
      ;[request] = await PayoutRequest.create([{
        memberId, walletId: reserved._id, amount, status: 'PENDING_REVIEW',
        bankSnapshot: { bankCode, bankName, accountNumber, accountHolder }, memberNote: clean(payload?.note),
      }], { session })
      await recordUserActivity({ userId: memberId, type: 'wallet', title: 'Gửi yêu cầu rút tiền', description: `Yêu cầu rút ${formatMoney(amount)}đ đang chờ duyệt.`, metadata: { payoutRequestId: request._id }, session })
    })
    notifyMember(request, NOTIFICATION_TYPES.PAYOUT_REQUEST_SUBMITTED, 'Đã gửi yêu cầu rút tiền', `Yêu cầu rút ${formatMoney(amount)}đ đang chờ Admin xử lý thủ công.`)
    notifyAdmins(request, NOTIFICATION_TYPES.PAYOUT_REQUEST_SUBMITTED, 'Yêu cầu rút tiền mới', `Có yêu cầu rút ${formatMoney(amount)}đ cần được duyệt.`)
    return request
  } finally { session.endSession() }
}

const serializeForMember = (request) => {
  const value = request?.toObject ? request.toObject() : request
  const { reviewedBy, rejectReason, transferredBy, resolvedBy, resolvedAt, resolutionNote, payoutTransactionId, ...safe } = value
  return safe
}

export const getMemberPayoutRequests = async (memberId) => (await PayoutRequest.find({ memberId }).sort({ createdAt: -1 }).lean()).map(serializeForMember)
export const getMemberPayoutRequest = async ({ memberId, payoutRequestId }) => {
  const request = await PayoutRequest.findOne({ _id: asId(payoutRequestId, 'Payout request ID'), memberId }).lean()
  if (!request) throw new AppError('Không tìm thấy yêu cầu rút tiền', 404)
  return serializeForMember(request)
}

export const cancelPayoutRequest = async ({ memberId, payoutRequestId }) => {
  const session = await mongoose.startSession()
  try {
    let request
    await session.withTransaction(async () => {
      assertPayoutTransition('PENDING_REVIEW', 'CANCELLED')
      request = await PayoutRequest.findOneAndUpdate({ _id: asId(payoutRequestId, 'Payout request ID'), memberId, status: 'PENDING_REVIEW' }, { $set: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'Hội viên đã hủy yêu cầu' } }, { new: true, session })
      if (!request) throw new AppError('Chỉ có thể hủy yêu cầu đang chờ duyệt', 409)
      const wallet = await Wallet.findOneAndUpdate({ _id: request.walletId, lockedBalance: { $gte: request.amount } }, { $inc: { balance: request.amount, lockedBalance: -request.amount, withdrawableBalance: request.amount } }, { new: true, session })
      if (!wallet) throw new AppError('Payout lock is missing', 409)
      await recordUserActivity({ userId: memberId, type: 'wallet', title: 'Đã hủy yêu cầu rút tiền', description: `Đã hoàn lại ${formatMoney(request.amount)}đ vào ví.`, metadata: { payoutRequestId: request._id }, session })
    })
    return request
  } finally { session.endSession() }
}

export const listAdminPayoutRequests = async ({ status, search, page = 1, limit = 20 }) => {
  const filter = {}
  if (status) filter.status = status
  if (search) {
    const members = await User.find({ $or: [{ name: { $regex: clean(search, 80), $options: 'i' } }, { fullName: { $regex: clean(search, 80), $options: 'i' } }, { email: { $regex: clean(search, 80), $options: 'i' } }, { memberCode: { $regex: clean(search, 80), $options: 'i' } }] }).select('_id').lean()
    filter.memberId = { $in: members.map((member) => member._id) }
  }
  const safePage = Math.max(1, Number(page) || 1); const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20))
  const [total, requests] = await Promise.all([
    PayoutRequest.countDocuments(filter),
    PayoutRequest.find(filter).populate('memberId', 'name fullName email memberCode phone').populate('reviewedBy transferredBy resolvedBy', 'name fullName email').sort({ createdAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
  ])
  return { requests, pagination: { total, page: safePage, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) } }
}

export const getAdminPayoutRequest = async (payoutRequestId) => {
  const request = await PayoutRequest.findById(asId(payoutRequestId, 'Payout request ID')).populate('memberId', 'name fullName email memberCode phone').populate('walletId', 'balance lockedBalance withdrawableBalance currency').populate('reviewedBy transferredBy resolvedBy', 'name fullName email').lean()
  if (!request) throw new AppError('Không tìm thấy yêu cầu rút tiền', 404)
  return request
}

export const approvePayoutRequest = async ({ payoutRequestId, adminId }) => {
  const request = await PayoutRequest.findOneAndUpdate({ _id: asId(payoutRequestId, 'Payout request ID'), status: 'PENDING_REVIEW' }, { $set: { status: 'APPROVED', reviewedBy: adminId, reviewedAt: new Date() } }, { new: true })
  if (!request) throw new AppError('Yêu cầu đã được xử lý bởi quản trị viên khác', 409)
  await recordUserActivity({ userId: request.memberId, type: 'wallet', title: 'Yêu cầu rút tiền đã được duyệt', description: `Yêu cầu rút ${formatMoney(request.amount)}đ đã được duyệt.`, metadata: { payoutRequestId: request._id, reviewedBy: adminId } })
  notifyMember(request, NOTIFICATION_TYPES.PAYOUT_APPROVED, 'Yêu cầu rút tiền đã được duyệt', `Yêu cầu rút ${formatMoney(request.amount)}đ đã được duyệt, đang chờ chuyển khoản.`)
  return request
}

export const rejectPayoutRequest = async ({ payoutRequestId, adminId, reason }) => {
  const rejectReason = clean(reason)
  if (!rejectReason) throw new AppError('Lý do từ chối là bắt buộc', 400)
  const session = await mongoose.startSession()
  try {
    let request
    await session.withTransaction(async () => {
      request = await PayoutRequest.findOneAndUpdate({ _id: asId(payoutRequestId, 'Payout request ID'), status: { $in: ['PENDING_REVIEW', 'APPROVED'] } }, { $set: { status: 'REJECTED', reviewedBy: adminId, reviewedAt: new Date(), rejectReason } }, { new: true, session })
      if (!request) throw new AppError('Yêu cầu không thể bị từ chối ở trạng thái hiện tại', 409)
      const wallet = await Wallet.findOneAndUpdate({ _id: request.walletId, lockedBalance: { $gte: request.amount } }, { $inc: { balance: request.amount, lockedBalance: -request.amount, withdrawableBalance: request.amount } }, { new: true, session })
      if (!wallet) throw new AppError('Payout lock is missing', 409)
      await recordUserActivity({ userId: request.memberId, type: 'wallet', title: 'Yêu cầu rút tiền bị từ chối', description: `Đã hoàn lại ${formatMoney(request.amount)}đ vào ví.`, metadata: { payoutRequestId: request._id, rejectedBy: adminId }, session })
    })
    notifyMember(request, NOTIFICATION_TYPES.PAYOUT_REJECTED, 'Yêu cầu rút tiền bị từ chối', `Yêu cầu rút tiền bị từ chối: ${rejectReason}`)
    return request
  } finally { session.endSession() }
}

export const markPayoutTransferred = async ({ payoutRequestId, adminId, transferReference, transferProof, fromDispute = false }) => {
  const reference = clean(transferReference, 120); const proof = clean(transferProof, 1000)
  if (!reference || !proof) throw new AppError('Mã tham chiếu và bill chuyển khoản là bắt buộc', 400)
  const { confirmHours } = await getPayoutSettings(); const now = new Date(); const deadline = new Date(now.getTime() + confirmHours * 60 * 60 * 1000)
  const expectedStatus = fromDispute ? 'DISPUTED' : 'APPROVED'
  const request = await PayoutRequest.findOneAndUpdate({ _id: asId(payoutRequestId, 'Payout request ID'), status: expectedStatus }, { $set: { status: 'TRANSFERRED', transferredBy: adminId, transferredAt: now, transferReference: reference, transferProof: proof, confirmationDeadline: deadline }, $push: { transferHistory: { transferReference: reference, transferProof: proof, transferredBy: adminId, transferredAt: now } } }, { new: true })
  if (!request) throw new AppError('Yêu cầu không thể đánh dấu đã chuyển ở trạng thái hiện tại', 409)
  await recordUserActivity({ userId: request.memberId, type: 'wallet', title: 'Đã chuyển khoản rút tiền', description: `Admin đã chuyển ${formatMoney(request.amount)}đ.`, metadata: { payoutRequestId: request._id, transferReference: reference }, })
  notifyMember(request, NOTIFICATION_TYPES.PAYOUT_TRANSFERRED, 'Admin đã chuyển khoản', `Admin đã chuyển ${formatMoney(request.amount)}đ. Vui lòng kiểm tra tài khoản và xác nhận.`)
  return request
}

export const confirmPayoutReceived = async ({ memberId, payoutRequestId }) => {
  const request = await PayoutRequest.findOne({ _id: asId(payoutRequestId, 'Payout request ID'), memberId, status: 'TRANSFERRED' }).select('_id')
  if (!request) throw new AppError('Yêu cầu không thể xác nhận ở trạng thái hiện tại', 409)
  const completed = await finalizePayout({ payoutRequestId: request._id, expectedStatus: 'TRANSFERRED', confirmationSource: 'MEMBER' })
  notifyMember(completed, NOTIFICATION_TYPES.PAYOUT_COMPLETED, 'Rút tiền hoàn tất', `Yêu cầu rút ${formatMoney(completed.amount)}đ đã hoàn tất.`)
  return completed
}

export const disputePayoutRequest = async ({ memberId, payoutRequestId, reason }) => {
  const disputeReason = clean(reason)
  if (!disputeReason) throw new AppError('Lý do khiếu nại là bắt buộc', 400)
  const request = await PayoutRequest.findOneAndUpdate({ _id: asId(payoutRequestId, 'Payout request ID'), memberId, status: 'TRANSFERRED' }, { $set: { status: 'DISPUTED', disputedAt: new Date(), disputeReason } }, { new: true })
  if (!request) throw new AppError('Yêu cầu không thể khiếu nại ở trạng thái hiện tại', 409)
  await recordUserActivity({ userId: memberId, type: 'wallet', title: 'Khiếu nại rút tiền', description: 'Đã báo chưa nhận được tiền rút.', metadata: { payoutRequestId: request._id }, })
  notifyAdmins(request, NOTIFICATION_TYPES.PAYOUT_DISPUTED, 'Khiếu nại rút tiền', `Hội viên báo chưa nhận được ${formatMoney(request.amount)}đ: ${disputeReason}`)
  return request
}

export const resolvePayoutDispute = async ({ payoutRequestId, adminId, action, transferReference, transferProof, resolutionNote }) => {
  if (action === 'retransfer') return markPayoutTransferred({ payoutRequestId, adminId, transferReference, transferProof, fromDispute: true })
  if (action !== 'complete') throw new AppError('Hướng xử lý khiếu nại không hợp lệ', 400)
  const request = await PayoutRequest.findOne({ _id: asId(payoutRequestId, 'Payout request ID'), status: 'DISPUTED' }).select('_id')
  if (!request) throw new AppError('Khiếu nại không thể được xác minh ở trạng thái hiện tại', 409)
  const completed = await finalizePayout({ payoutRequestId: request._id, expectedStatus: 'DISPUTED', confirmationSource: 'ADMIN', resolvedBy: adminId, resolutionNote })
  notifyMember(completed, NOTIFICATION_TYPES.PAYOUT_COMPLETED, 'Rút tiền đã được xác minh', `Yêu cầu rút ${formatMoney(completed.amount)}đ đã được Admin xác minh hoàn tất.`)
  return completed
}

export const autoConfirmDuePayouts = async () => {
  const due = await PayoutRequest.find({ status: 'TRANSFERRED', confirmationDeadline: { $lte: new Date() } }).select('_id').lean()
  let completed = 0
  for (const item of due) {
    try {
      const request = await finalizePayout({ payoutRequestId: item._id, expectedStatus: 'TRANSFERRED', confirmationSource: 'AUTO' })
      completed += 1
      notifyMember(request, NOTIFICATION_TYPES.PAYOUT_COMPLETED, 'Rút tiền tự động hoàn tất', `Yêu cầu rút ${formatMoney(request.amount)}đ đã tự động hoàn tất sau thời hạn xác nhận.`)
    } catch (error) {
      if (error?.statusCode !== 409) console.error(`[payoutAutoConfirmation] ${item._id}:`, error.message)
    }
  }
  return completed
}

export const sendStalePayoutAdminReminders = async () => {
  const { adminReminderHours } = await getPayoutSettings()
  const reminderCutoff = new Date(Date.now() - adminReminderHours * 60 * 60 * 1000)
  const due = await PayoutRequest.find({
    status: 'PENDING_REVIEW',
    createdAt: { $lte: reminderCutoff },
    adminReminderSentAt: null,
  }).select('_id').lean()

  let reminded = 0
  for (const item of due) {
    const request = await PayoutRequest.findOneAndUpdate(
      { _id: item._id, status: 'PENDING_REVIEW', adminReminderSentAt: null },
      { $set: { adminReminderSentAt: new Date() } },
      { new: true },
    )
    if (!request) continue
    reminded += 1
    notifyAdmins(
      request,
      NOTIFICATION_TYPES.PAYOUT_ADMIN_REMINDER,
      'Nhắc xử lý yêu cầu rút tiền',
      `Yêu cầu rút ${formatMoney(request.amount)}đ đã chờ hơn ${adminReminderHours} giờ và chưa được xử lý.`,
    )
  }
  return reminded
}

export const autoCancelStalePayoutRequests = async () => {
  const { autoCancelHours } = await getPayoutSettings()
  const cancelCutoff = new Date(Date.now() - autoCancelHours * 60 * 60 * 1000)
  const due = await PayoutRequest.find({ status: 'PENDING_REVIEW', createdAt: { $lte: cancelCutoff } }).select('_id').lean()
  let cancelled = 0

  for (const item of due) {
    const session = await mongoose.startSession()
    try {
      let request
      await session.withTransaction(async () => {
        assertPayoutTransition('PENDING_REVIEW', 'CANCELLED')
        request = await PayoutRequest.findOneAndUpdate(
          { _id: item._id, status: 'PENDING_REVIEW' },
          { $set: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: AUTO_CANCEL_REASON } },
          { new: true, session },
        )
        if (!request) return
        const wallet = await Wallet.findOneAndUpdate(
          { _id: request.walletId, userId: request.memberId, lockedBalance: { $gte: request.amount } },
          { $inc: { balance: request.amount, lockedBalance: -request.amount, withdrawableBalance: request.amount } },
          { new: true, session },
        )
        if (!wallet) throw new AppError('Payout lock is missing', 409)
        await recordUserActivity({
          userId: request.memberId,
          type: 'wallet',
          title: 'Yêu cầu rút tiền đã tự động hủy',
          description: `Đã hoàn lại ${formatMoney(request.amount)}đ vào ví vì yêu cầu chưa được Admin xử lý đúng hạn.`,
          metadata: { payoutRequestId: request._id, autoCancelled: true },
          session,
        })
      })
      if (!request) continue
      cancelled += 1
      notifyMember(
        request,
        NOTIFICATION_TYPES.PAYOUT_AUTO_CANCELLED,
        'Yêu cầu rút tiền đã tự động hủy',
        `Yêu cầu rút ${formatMoney(request.amount)}đ chưa được Admin xử lý trong ${formatDuration(autoCancelHours)}, nên tiền đã được hoàn lại vào ví của bạn.`,
      )
    } catch (error) {
      if (error?.statusCode !== 409) console.error(`[payoutAutoCancel] ${item._id}:`, error.message)
    } finally {
      await session.endSession()
    }
  }
  return cancelled
}

export const getWalletPayoutSummary = async (memberId) => {
  const wallet = await getOrCreateWallet(memberId)
  return { balance: wallet.balance, lockedBalance: wallet.lockedBalance || 0, withdrawableBalance: wallet.withdrawableBalance || 0, currency: wallet.currency }
}

export const isPayoutStaff = (role) => STAFF_ROLES.includes(role)
