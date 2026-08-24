import mongoose from 'mongoose'
import Booking from '../models/Booking.js'
import Membership from '../models/Membership.js'
import MembershipCycle from '../models/MembershipCycle.js'
import MembershipPeriod from '../models/MembershipPeriod.js'
import MembershipTransferRequest from '../models/MembershipTransferRequest.js'
import User from '../models/User.js'
import AppError from '../utils/appError.js'
import { createNotification } from './notificationService.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { recordUserActivity } from './userActivityService.js'

const asId = (value, label = 'ID') => {
  if (!mongoose.Types.ObjectId.isValid(String(value))) throw new AppError(`${label} không hợp lệ`, 400)
  return new mongoose.Types.ObjectId(value)
}
const clean = (value, max = 500) => String(value || '').trim().replace(/[<>]/g, '').slice(0, max)
const money = (value) => Number(value || 0).toLocaleString('vi-VN')
const dayStart = (value = new Date()) => new Date(value.getFullYear(), value.getMonth(), value.getDate())
const daysRemaining = (endDate, now = new Date()) => Math.max(1, Math.ceil((new Date(endDate).getTime() - now.getTime()) / 86400000))

const notify = (receiverId, receiverRole, type, title, content, request, redirectUrl) => createNotification({
  receiverId, receiverRole, notificationType: type, title, content,
  relatedId: request._id, relatedType: 'MembershipTransferRequest', redirectUrl, createdBy: 'System',
}).catch(() => {})
const notifyAdmins = (request, title, content) => notify(null, 'admin', NOTIFICATION_TYPES.MEMBERSHIP_TRANSFER_ACCEPTED, title, content, request, '/admin/membership-transfers')

const releaseSourceCycle = (request, session = null) => MembershipCycle.updateOne(
  { _id: request.sourceCycleId, transferRequestId: request._id },
  { $set: { transferPending: false, transferRequestId: null } },
  { session },
)

const resolveRecipient = async (value) => {
  const key = clean(value, 120)
  if (!key) throw new AppError('Nhập mã hội viên hoặc email người nhận', 400)
  const recipient = await User.findOne({
    role: 'member', isActive: { $ne: false }, status: { $ne: 'locked' },
    $or: [{ memberCode: key.toUpperCase() }, { email: key.toLowerCase() }],
  }).select('_id name fullName email memberCode').lean()
  if (!recipient) throw new AppError('Không tìm thấy hội viên nhận gói', 404)
  return recipient
}

export const searchEligibleMembershipTransferRecipients = async ({ senderId, search }) => {
  const term = clean(search, 80)
  if (term.length < 2) return []
  const senderObjectId = asId(senderId, 'Sender ID')
  const members = await User.find({
    _id: { $ne: senderObjectId }, role: 'member', isActive: { $ne: false }, status: { $ne: 'locked' },
    $or: [
      { name: { $regex: term, $options: 'i' } }, { fullName: { $regex: term, $options: 'i' } },
      { email: { $regex: term, $options: 'i' } }, { memberCode: { $regex: term, $options: 'i' } },
    ],
  }).select('_id name fullName email memberCode').limit(12).lean()
  const activeMemberIds = await MembershipCycle.distinct('memberId', {
    memberId: { $in: members.map((member) => member._id) }, status: 'active', expiresAt: { $gt: new Date() },
  })
  const activeIds = new Set(activeMemberIds.map((id) => String(id)))
  return members.filter((member) => !activeIds.has(String(member._id)))
}

export const createMembershipTransferRequest = async ({ senderId, recipientLookup, note }) => {
  const senderObjectId = asId(senderId, 'Sender ID')
  const recipient = await resolveRecipient(recipientLookup)
  if (String(recipient._id) === String(senderObjectId)) throw new AppError('Không thể chuyển gói cho chính bạn', 400)

  const session = await mongoose.startSession()
  try {
    let request
    await session.withTransaction(async () => {
      const cycle = await MembershipCycle.findOne({ memberId: senderObjectId, status: 'active', transferPending: { $ne: true } }).session(session)
      if (!cycle) throw new AppError('Không có gói tập đang hoạt động để chuyển nhượng', 409)
      const membership = await Membership.findOne({ _id: cycle.currentMembershipId, memberId: senderObjectId, status: 'active' }).session(session)
      if (!membership) throw new AppError('Gói tập hiện tại không hợp lệ để chuyển nhượng', 409)
      const periods = await MembershipPeriod.find({ membershipId: membership._id, status: { $in: ['ACTIVE', 'PENDING'] } }).sort({ endDate: 1 }).session(session)
      const activePeriod = periods.find((period) => period.status === 'ACTIVE' && new Date(period.endDate) > new Date())
      if (!activePeriod) throw new AppError('Gói tập đã hết hạn hoặc không còn thời gian để chuyển nhượng', 409)
      const sourceEndDate = periods[periods.length - 1]?.endDate || activePeriod.endDate
      const existing = await MembershipTransferRequest.findOne({
        sourceCycleId: cycle._id,
        status: { $in: ['PENDING_RECIPIENT', 'PENDING_REVIEW'] },
      }).session(session)
      if (existing) throw new AppError('Gói tập này đang có yêu cầu chuyển nhượng', 409)
      ;[request] = await MembershipTransferRequest.create([{
        senderId: senderObjectId, recipientId: recipient._id, sourceMembershipId: membership._id,
        sourceCycleId: cycle._id, planId: membership.planId, sourceEndDate, note: clean(note),
      }], { session })
      const locked = await MembershipCycle.findOneAndUpdate(
        { _id: cycle._id, status: 'active', transferPending: { $ne: true } },
        { $set: { transferPending: true, transferRequestId: request._id } },
        { new: true, session },
      )
      if (!locked) throw new AppError('Gói tập vừa thay đổi, vui lòng thử lại', 409)
      await recordUserActivity({
        userId: senderObjectId, type: 'membership', title: 'Đã gửi yêu cầu chuyển nhượng gói',
        description: 'Đang chờ hội viên nhận xác nhận.', metadata: { membershipTransferRequestId: request._id }, session,
      })
    })
    notify(recipient._id, 'member', NOTIFICATION_TYPES.MEMBERSHIP_TRANSFER_REQUESTED, 'Có yêu cầu nhận chuyển nhượng gói', 'Bạn có một yêu cầu nhận gói tập cần xác nhận.', request, '/membership-transfers')
    return request
  } finally { await session.endSession() }
}

export const getMyMembershipTransferRequests = async (memberId) => MembershipTransferRequest.find({
  $or: [{ senderId: asId(memberId, 'Member ID') }, { recipientId: asId(memberId, 'Member ID') }],
}).populate('senderId recipientId', 'name fullName email memberCode').populate('planId', 'nameVi nameEn').sort({ createdAt: -1 }).lean()

export const respondToMembershipTransferRequest = async ({ recipientId, requestId, accept }) => {
  const request = await MembershipTransferRequest.findOneAndUpdate(
    { _id: asId(requestId, 'Transfer request ID'), recipientId: asId(recipientId, 'Recipient ID'), status: 'PENDING_RECIPIENT' },
    { $set: { status: accept ? 'PENDING_REVIEW' : 'REJECTED', recipientRespondedAt: new Date(), ...(accept ? {} : { rejectionReason: 'Hội viên nhận từ chối yêu cầu' }) } },
    { new: true },
  )
  if (!request) throw new AppError('Yêu cầu không còn chờ bạn xác nhận', 409)
  if (!accept) {
    await releaseSourceCycle(request)
    notify(request.senderId, 'member', NOTIFICATION_TYPES.MEMBERSHIP_TRANSFER_REJECTED, 'Yêu cầu chuyển nhượng bị từ chối', 'Hội viên nhận đã từ chối yêu cầu chuyển nhượng gói tập.', request, '/membership-transfers')
    return request
  }
  await recordUserActivity({ userId: recipientId, type: 'membership', title: 'Đã xác nhận nhận chuyển nhượng', description: 'Yêu cầu đang chờ quản lý phê duyệt.', metadata: { membershipTransferRequestId: request._id } })
  notify(request.senderId, 'member', NOTIFICATION_TYPES.MEMBERSHIP_TRANSFER_ACCEPTED, 'Người nhận đã xác nhận', 'Yêu cầu chuyển nhượng đang chờ quản lý phê duyệt.', request, '/membership-transfers')
  notifyAdmins(request, 'Cần duyệt chuyển nhượng gói tập', 'Có yêu cầu chuyển nhượng gói tập đã được người nhận xác nhận.')
  return request
}

export const cancelMembershipTransferRequest = async ({ senderId, requestId }) => {
  const request = await MembershipTransferRequest.findOneAndUpdate(
    { _id: asId(requestId, 'Transfer request ID'), senderId: asId(senderId, 'Sender ID'), status: { $in: ['PENDING_RECIPIENT', 'PENDING_REVIEW'] } },
    { $set: { status: 'CANCELLED' } }, { new: true },
  )
  if (!request) throw new AppError('Không thể hủy yêu cầu ở trạng thái hiện tại', 409)
  await releaseSourceCycle(request)
  notify(request.recipientId, 'member', NOTIFICATION_TYPES.MEMBERSHIP_TRANSFER_REJECTED, 'Yêu cầu chuyển nhượng đã bị hủy', 'Người gửi đã hủy yêu cầu chuyển nhượng gói tập.', request, '/membership-transfers')
  return request
}

export const listMembershipTransferRequestsForStaff = async ({ status }) => {
  const filter = status ? { status } : {}
  return MembershipTransferRequest.find(filter).populate('senderId recipientId', 'name fullName email memberCode').populate('planId', 'nameVi nameEn').populate('reviewedBy', 'name fullName email').sort({ createdAt: -1 }).lean()
}

export const rejectMembershipTransferRequest = async ({ requestId, staffId, reason }) => {
  const rejectionReason = clean(reason)
  if (!rejectionReason) throw new AppError('Lý do từ chối là bắt buộc', 400)
  const request = await MembershipTransferRequest.findOneAndUpdate(
    { _id: asId(requestId, 'Transfer request ID'), status: 'PENDING_REVIEW' },
    { $set: { status: 'REJECTED', reviewedBy: asId(staffId, 'Staff ID'), reviewedAt: new Date(), rejectionReason } }, { new: true },
  )
  if (!request) throw new AppError('Yêu cầu không còn chờ phê duyệt', 409)
  await releaseSourceCycle(request)
  const content = `Yêu cầu chuyển nhượng bị từ chối: ${rejectionReason}`
  notify(request.senderId, 'member', NOTIFICATION_TYPES.MEMBERSHIP_TRANSFER_REJECTED, 'Yêu cầu chuyển nhượng bị từ chối', content, request, '/membership-transfers')
  notify(request.recipientId, 'member', NOTIFICATION_TYPES.MEMBERSHIP_TRANSFER_REJECTED, 'Yêu cầu chuyển nhượng bị từ chối', content, request, '/membership-transfers')
  return request
}

export const approveMembershipTransferRequest = async ({ requestId, staffId }) => {
  const session = await mongoose.startSession()
  try {
    let result
    await session.withTransaction(async () => {
      const request = await MembershipTransferRequest.findOne({ _id: asId(requestId, 'Transfer request ID'), status: 'PENDING_REVIEW' }).session(session)
      if (!request) throw new AppError('Yêu cầu không còn chờ phê duyệt', 409)
      const now = new Date()
      const sourceCycle = await MembershipCycle.findOne({ _id: request.sourceCycleId, memberId: request.senderId, status: 'active', transferPending: true, transferRequestId: request._id }).session(session)
      const sourceMembership = await Membership.findOne({ _id: request.sourceMembershipId, memberId: request.senderId, status: 'active' }).session(session)
      const recipient = await User.findOne({ _id: request.recipientId, role: 'member', isActive: { $ne: false }, status: { $ne: 'locked' } }).session(session)
      if (!sourceCycle || !sourceMembership || !recipient) throw new AppError('Dữ liệu gói hoặc hội viên nhận không còn hợp lệ', 409)
      const recipientHasPlan = await MembershipCycle.exists({ memberId: request.recipientId, status: 'active', expiresAt: { $gt: now } }).session(session)
      if (recipientHasPlan) throw new AppError('Hội viên nhận đang có gói tập còn hiệu lực', 409)
      const sourcePeriods = await MembershipPeriod.find({ membershipId: sourceMembership._id, status: { $in: ['ACTIVE', 'PENDING'] } }).sort({ startDate: 1 }).session(session)
      const activePeriod = sourcePeriods.find((period) => period.status === 'ACTIVE' && new Date(period.endDate) > now)
      if (!activePeriod) throw new AppError('Gói nguồn đã hết hạn hoặc không còn thời gian để chuyển', 409)
      const lastEndDate = sourcePeriods.reduce((latest, period) => new Date(period.endDate) > latest ? new Date(period.endDate) : latest, new Date(activePeriod.endDate))
      const [targetMembership] = await Membership.create([{
        memberId: request.recipientId, planId: sourceMembership.planId, status: 'active', source: 'transfer', paymentId: null,
      }], { session })
      const targetPeriods = sourcePeriods.map((period) => ({
        membershipId: targetMembership._id, planId: period.planId, memberId: request.recipientId,
        startDate: period.status === 'ACTIVE' ? now : period.startDate,
        endDate: period.endDate, totalDays: period.status === 'ACTIVE' ? daysRemaining(period.endDate, now) : period.totalDays,
        price: period.price, paymentId: null, activatedAt: period.status === 'ACTIVE' ? now : null,
        status: period.status,
      }))
      await MembershipPeriod.create(targetPeriods, { session, ordered: true })
      const [targetCycle] = await MembershipCycle.create([{
        memberId: request.recipientId, currentMembershipId: targetMembership._id, currentPlanId: sourceMembership.planId,
        purchasedAt: now, startDate: now, activatedAt: now, endDate: lastEndDate, expiresAt: lastEndDate,
        durationDays: daysRemaining(lastEndDate, now), status: 'active', refundEligible: false,
      }], { session })
      await Booking.updateMany({ memberId: request.senderId, date: { $gte: dayStart(now) }, status: { $in: ['pending', 'awaiting_payment', 'confirmed'] } }, { $set: { status: 'cancelled', cancelReason: 'Chuyển nhượng gói tập' } }, { session })
      await MembershipPeriod.updateMany({ membershipId: sourceMembership._id, status: { $in: ['ACTIVE', 'PENDING'] } }, { $set: { status: 'CANCELLED' } }, { session })
      await Membership.updateOne({ _id: sourceMembership._id }, { $set: { status: 'cancelled' } }, { session })
      await MembershipCycle.updateOne({ _id: sourceCycle._id }, { $set: { status: 'cancelled', transferPending: false, transferRequestId: null } }, { session })
      request.status = 'COMPLETED'; request.reviewedBy = asId(staffId, 'Staff ID'); request.reviewedAt = now; request.completedAt = now; request.targetMembershipId = targetMembership._id; request.targetCycleId = targetCycle._id
      await request.save({ session })
      await Promise.all([
        recordUserActivity({ userId: request.senderId, type: 'membership', title: 'Đã chuyển nhượng gói tập', description: 'Gói tập đã được chuyển cho hội viên nhận.', metadata: { membershipTransferRequestId: request._id }, session }),
        recordUserActivity({ userId: request.recipientId, type: 'membership', title: 'Đã nhận chuyển nhượng gói tập', description: `Đã nhận gói tập còn hiệu lực đến ${lastEndDate.toLocaleDateString('vi-VN')}.`, metadata: { membershipTransferRequestId: request._id }, session }),
      ])
      result = request
    })
    const content = 'Chuyển nhượng đã hoàn tất. Các lịch tập tương lai của người gửi đã được hủy.'
    notify(result.senderId, 'member', NOTIFICATION_TYPES.MEMBERSHIP_TRANSFER_COMPLETED, 'Chuyển nhượng gói tập hoàn tất', content, result, '/membership-transfers')
    notify(result.recipientId, 'member', NOTIFICATION_TYPES.MEMBERSHIP_TRANSFER_COMPLETED, 'Bạn đã nhận gói tập', content, result, '/my-membership')
    return result
  } finally { await session.endSession() }
}
