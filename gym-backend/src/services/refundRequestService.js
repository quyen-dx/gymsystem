import mongoose from 'mongoose'
import RefundRequest from '../models/RefundRequest.js'
import MembershipPeriod from '../models/MembershipPeriod.js'
import Membership from '../models/Membership.js'
import User from '../models/User.js'
import Wallet from '../models/Wallet.js'
import Transaction from '../models/Transaction.js'
import CheckIn from '../models/CheckIn.js'
import Booking from '../models/Booking.js'
import { rebuildMembershipTimeline } from './membershipService.js'
import { recordUserActivity } from './userActivityService.js'
import { invalidatePersonalContextCache } from './conversationContextCache.js'
import { emitRefundRequestUpdate } from './socketService.js'
import { sendRefundRequestSubmittedEmail, sendRefundRequestProcessedEmail } from './emailService.js'

const toObjectId = (value, fieldName) => {
  if (!mongoose.Types.ObjectId.isValid(String(value))) {
    const error = new Error(`${fieldName} không hợp lệ`)
    error.statusCode = 400
    throw error
  }
  return new mongoose.Types.ObjectId(value)
}

const hasUsedMembershipBenefits = async ({ memberId, purchaseDate, session = null }) => {
  const since = new Date(purchaseDate)
  const now = new Date()

  const checkInQuery = CheckIn.exists({
    memberId,
    status: 'success',
    checkinTime: { $gte: since },
  })
  const bookingQuery = Booking.exists({
    memberId,
    status: { $in: ['completed', 'confirmed'] },
    date: { $gte: since, $lte: now },
  })

  if (session) {
    checkInQuery.session(session)
    bookingQuery.session(session)
    const checkIn = await checkInQuery
    const booking = await bookingQuery
    return Boolean(checkIn || booking)
  }

  const [checkIn, booking] = await Promise.all([checkInQuery, bookingQuery])
  return Boolean(checkIn || booking)
}

const computePeriodStatus = (period) => {
  if (!period) return 'COMPLETED'
  if (period.status === 'CANCELLED' || period.status === 'REFUNDED') {
    return period.status
  }
  const now = Date.now()
  const start = new Date(period.startDate).getTime()
  const end = new Date(period.endDate).getTime()
  if (now >= start && now <= end) return 'ACTIVE'
  if (now > end) return 'COMPLETED'
  return 'PENDING'
}

export const createRefundRequest = async ({ userId, periodId, reason = '' }) => {
  const memberId = toObjectId(userId, 'userId')
  const period = await MembershipPeriod.findById(periodId).populate('planId', 'nameVi nameEn price')
  if (!period) {
    const error = new Error('Không tìm thấy kỳ hạn.')
    error.statusCode = 404
    throw error
  }
  if (String(period.memberId) !== String(memberId)) {
    const error = new Error('Không có quyền hủy kỳ hạn này.')
    error.statusCode = 403
    throw error
  }

  const displayStatus = computePeriodStatus(period)
  if (displayStatus !== 'PENDING' && displayStatus !== 'ACTIVE') {
    const error = new Error('Kỳ hạn này không thể hủy.')
    error.statusCode = 400
    throw error
  }

  const existingPending = await RefundRequest.findOne({
    memberId,
    membershipPeriodId: period._id,
    status: 'PENDING',
  })
  if (existingPending) {
    const error = new Error('Bạn đã có yêu cầu hủy cho kỳ hạn này đang chờ xử lý.')
    error.statusCode = 400
    throw error
  }

  // === Tính toán Snapshot tại thời điểm gửi yêu cầu ===
  const now = new Date()
  const activatedAt = period.activatedAt || period.startDate
  const daysSinceActivation = Math.max(0, Math.floor((now.getTime() - new Date(activatedAt).getTime()) / (1000 * 60 * 60 * 24)))
  const refundDeadline = new Date(new Date(activatedAt).getTime() + 7 * 24 * 60 * 60 * 1000)
  const isWithinWindow = now.getTime() <= refundDeadline.getTime()

  // Check-in
  const checkInCount = await CheckIn.countDocuments({
    memberId,
    status: 'success',
    checkinTime: { $gte: activatedAt },
  })
  const usedCheckIn = checkInCount > 0

  // Booking: PT
  const ptBookingCount = await Booking.countDocuments({
    memberId,
    status: { $in: ['completed', 'confirmed'] },
    date: { $gte: activatedAt, $lte: now },
  })
  const usedPT = ptBookingCount > 0

  // Booking: Gym / room usage — treat booking count as gym usage
  const gymUsageCount = ptBookingCount // same Booking collection for PT/gym
  const usedGym = gymUsageCount > 0

  const usedBenefits = usedCheckIn || usedPT || usedGym
  const eligibleForRefund = isWithinWindow && !usedBenefits

  let refundPolicyResult = ''
  if (!isWithinWindow) {
    refundPolicyResult = 'Quá 7 ngày'
  } else if (usedCheckIn && usedPT) {
    refundPolicyResult = 'Đã check-in và sử dụng PT'
  } else if (usedCheckIn) {
    refundPolicyResult = 'Đã check-in'
  } else if (usedPT) {
    refundPolicyResult = 'Đã sử dụng PT'
  } else if (usedGym) {
    refundPolicyResult = 'Đã sử dụng phòng tập'
  } else {
    refundPolicyResult = 'Đủ điều kiện hoàn tiền'
  }

  const periodDisplayStatus = computePeriodStatus(period)
  const isFullMembershipCancel = periodDisplayStatus === 'ACTIVE'

  if (isFullMembershipCancel) {
    await Membership.findByIdAndUpdate(period.membershipId, { $set: { status: 'cancel_requested' } })
  } else {
    period.status = 'CANCEL_REQUESTED'
    await period.save()
  }
  await rebuildMembershipTimeline({ membershipId: period.membershipId })

  // Tính tổng tiền các MembershipPeriod PENDING (gia hạn chưa kích hoạt)
  let pendingPeriodsTotal = 0
  let pendingPeriodsCount = 0
  if (isFullMembershipCancel) {
    const pendingPeriods = await MembershipPeriod.find({
      membershipId: period.membershipId,
      _id: { $ne: period._id },
      status: 'PENDING',
    })
    pendingPeriodsCount = pendingPeriods.length
    pendingPeriodsTotal = pendingPeriods.reduce((sum, pp) => sum + (pp.price || 0), 0)
  }

  const refundRequest = await RefundRequest.create({
    memberId,
    membershipId: period.membershipId,
    membershipPeriodId: period._id,
    planId: period.planId?._id || period.planId,
    reason: String(reason || '').trim(),
    refundAmount: eligibleForRefund ? (period.price || 0) : 0,
    status: 'PENDING',
    requestedAt: now,

    // Snapshot
    daysUsedAtRequest: daysSinceActivation,
    eligibleWithin7Days: isWithinWindow,
    usedCheckIn,
    usedGym,
    usedPT,
    usedBenefits,
    checkInCountAtRequest: checkInCount,
    gymUsageCountAtRequest: gymUsageCount,
    ptBookingCountAtRequest: ptBookingCount,
    refundPolicyResult,
    policyVersion: '1.0',

    // Thông tin các kỳ gia hạn PENDING (chỉ có khi hủy toàn bộ gói)
    pendingPeriodsTotal,
    pendingPeriodsCount,
  })

  emitRefundRequestUpdate().catch(() => {})

  await recordUserActivity({
    userId: memberId,
    type: 'membership',
    title: 'Yêu cầu hủy kỳ hạn',
    description: `Yêu cầu hủy kỳ hạn (+${period.totalDays} ngày)`,
    metadata: {
      refundRequestId: refundRequest._id,
      periodId: period._id,
      membershipId: period.membershipId,
    },
  })

  invalidatePersonalContextCache(memberId)

  const planName = period.planId?.nameVi || period.planId?.nameEn || ''
  const refundUser = await User.findById(memberId).select('email fullName name')
  if (refundUser?.email && !isFullMembershipCancel) {
    sendRefundRequestSubmittedEmail({
      toEmail: refundUser.email,
      userName: refundUser.fullName || refundUser.name || refundUser.email,
      planName,
      periodDetail: `Kỳ hạn: ${new Date(period.startDate).toLocaleDateString('vi-VN')} → ${new Date(period.endDate).toLocaleDateString('vi-VN')}`,
      isFullCancel: isFullMembershipCancel,
    }).catch((e) => console.error('Gửi email yêu cầu hủy thất bại:', e.message))
  }

  return {
    message: 'Yêu cầu đã được gửi tới nhân viên. Vui lòng chờ phê duyệt.',
    refundRequest,
  }
}

export const approveRefundRequest = async ({ refundRequestId, staffId, staffNote = '' }) => {
  const refundRequest = await RefundRequest.findById(refundRequestId)
    .populate('planId', 'nameVi nameEn price')
  if (!refundRequest) {
    const error = new Error('Không tìm thấy yêu cầu hoàn tiền.')
    error.statusCode = 404
    throw error
  }
  if (refundRequest.status !== 'PENDING') {
    const error = new Error('Yêu cầu hoàn tiền đã được xử lý.')
    error.statusCode = 400
    throw error
  }

  const session = await mongoose.startSession()
  let committed = false

  try {
    session.startTransaction()

    const period = await MembershipPeriod.findById(refundRequest.membershipPeriodId).session(session)
    if (!period) {
      const error = new Error('Không tìm thấy kỳ hạn.')
      error.statusCode = 404
      throw error
    }

    // Prevent double refund
    if (period.status === 'REFUNDED') {
      const error = new Error('Kỳ hạn này đã được hoàn tiền trước đó.')
      error.statusCode = 400
      throw error
    }

    const periodComputedStatus = computePeriodStatus(period)
    const isPendingPeriod = periodComputedStatus === 'PENDING'
    const isActivePeriod = periodComputedStatus === 'ACTIVE'
    let totalRefundAmount = 0
    const allPeriodsToUpdate = [period]
    let processedPendingPeriods = []

    const processRefundToWallet = async ({ amount, description }) => {
      if (amount <= 0) return
      let wallet = await Wallet.findOne({ userId: period.memberId }).session(session)
      if (!wallet) {
        [wallet] = await Wallet.create([{ userId: period.memberId, balance: 0 }], { session })
      }
      const balanceBefore = Number(wallet.balance || 0)
      wallet.balance = balanceBefore + amount
      await wallet.save({ session })
      await Transaction.create([{
        userId: period.memberId,
        walletId: wallet._id,
        type: 'REFUND_TO_WALLET',
        provider: 'wallet',
        source: 'membership',
        description,
        amount,
        balanceBefore,
        balanceAfter: balanceBefore + amount,
        referenceId: period._id.toString(),
        status: 'completed',
        completedAt: new Date(),
        metadata: {
          refundRequestId: refundRequest._id,
          periodId: period._id,
          membershipId: period.membershipId,
        },
        idempotencyKey: `refund_req_${refundRequest._id}`,
      }], { session })
    }

    // --- Process the primary period (the one in refund request) ---
    if (isPendingPeriod) {
      totalRefundAmount += period.price || 0
      period.status = 'REFUNDED'
    } else if (isActivePeriod) {
      const activatedAt = period.activatedAt || period.startDate
      const refundDeadline = new Date(new Date(activatedAt).getTime() + 7 * 24 * 60 * 60 * 1000)
      const isWithinWindow = Date.now() <= refundDeadline.getTime()

      let hasUsed = false
      if (isWithinWindow) {
        hasUsed = await hasUsedMembershipBenefits({
          memberId: period.memberId,
          purchaseDate: activatedAt,
          session,
        })
      }

      if (isWithinWindow && !hasUsed) {
        totalRefundAmount += period.price || 0
        period.status = 'REFUNDED'
      } else {
        period.status = 'CANCELLED'
      }
    } else {
      period.status = 'CANCELLED'
    }

    // --- If full membership cancel, also process all PENDING periods ---
    const membership = await Membership.findById(period.membershipId).session(session)
    if (membership && membership.status === 'cancel_requested') {
      processedPendingPeriods = await MembershipPeriod.find({
        membershipId: period.membershipId,
        _id: { $ne: period._id },
        status: 'PENDING',
      }).session(session)

      for (const pp of processedPendingPeriods) {
        totalRefundAmount += pp.price || 0
        pp.status = 'REFUNDED'
        allPeriodsToUpdate.push(pp)
      }
    }

    // --- Create ONE wallet transaction for the total ---
    if (totalRefundAmount > 0) {
      const desc = processedPendingPeriods.length > 0
        ? `Hoàn tiền hủy toàn bộ gói tập (${processedPendingPeriods.length + 1} kỳ hạn)`
        : `Hoàn tiền hủy kỳ hạn (+${period.totalDays} ngày)`
      await processRefundToWallet({ amount: totalRefundAmount, description: desc })
    }

    // Save all modified periods
    for (const p of allPeriodsToUpdate) {
      await p.save({ session })
    }

    await rebuildMembershipTimeline({ membershipId: period.membershipId, session })

    // Update membership status
    if (membership && membership.status === 'cancel_requested') {
      membership.status = totalRefundAmount > 0 ? 'refunded' : 'cancelled'
      membership.cancelledAt = new Date()
      membership.cancelHandledAt = new Date()
      membership.cancelHandledBy = toObjectId(staffId, 'staffId')
      await membership.save({ session })
    } else if (membership && (membership.status === 'active' || membership.status === 'pending_cancel')) {
      const remainingPeriods = await MembershipPeriod.find({
        membershipId: period.membershipId,
        _id: { $ne: period._id },
        status: { $in: ['PENDING', 'ACTIVE'] },
      }).session(session)
      if (remainingPeriods.length === 0) {
        membership.status = 'cancelled'
        membership.cancelledAt = new Date()
        await membership.save({ session })
      }
    }

    // Update refund request
    refundRequest.status = totalRefundAmount > 0 ? 'REFUNDED' : 'APPROVED'
    refundRequest.refundAmount = totalRefundAmount
    refundRequest.staffNote = String(staffNote || '').trim()
    refundRequest.reviewedBy = toObjectId(staffId, 'staffId')
    refundRequest.reviewedAt = new Date()
    await refundRequest.save({ session })

    const totalPeriods = 1 + processedPendingPeriods.length
    await recordUserActivity({
      userId: period.memberId,
      type: 'membership',
      title: totalRefundAmount > 0 ? 'Phê duyệt hoàn tiền' : 'Phê duyệt hủy kỳ hạn',
      description: totalPeriods > 1
        ? `${totalPeriods} kỳ hạn đã được phê duyệt. Tổng hoàn: ${totalRefundAmount.toLocaleString('vi-VN')}đ`
        : `Kỳ hạn (+${period.totalDays} ngày) đã được phê duyệt${totalRefundAmount > 0 ? `. Hoàn: ${totalRefundAmount.toLocaleString('vi-VN')}đ` : ' (không hoàn tiền)'}`,
      metadata: {
        refundRequestId: refundRequest._id,
        periodId: period._id,
        membershipId: period.membershipId,
        handledBy: staffId,
        refundAmount: totalRefundAmount,
        totalPeriodsProcessed: totalPeriods,
      },
      session,
    })

    await session.commitTransaction()
    committed = true
    invalidatePersonalContextCache(period.memberId)

    emitRefundRequestUpdate().catch(() => {})

    const planName = refundRequest.planId?.nameVi || refundRequest.planId?.nameEn || ''
    const procUser = await User.findById(period.memberId).select('email fullName name')
    const staffInfo = staffId ? await User.findById(staffId).select('fullName name') : null
    const staffName = staffInfo ? (staffInfo.fullName || staffInfo.name) : ''
    if (procUser?.email && refundRequest.memberId) {
      const isFullCancel = refundRequest.pendingPeriodsCount > 0
      sendRefundRequestProcessedEmail({
        toEmail: procUser.email,
        userName: procUser.fullName || procUser.name || procUser.email,
        planName,
        status: totalRefundAmount > 0 ? 'REFUNDED' : 'APPROVED',
        refundAmount: totalRefundAmount,
        reason: '',
        isFullCancel,
        staffName,
        staffNote: staffNote || '',
      }).catch((e) => console.error('Gửi email xử lý hủy thất bại:', e.message))
    }

    const message = totalRefundAmount > 0
      ? `Đã phê duyệt và hoàn ${totalRefundAmount.toLocaleString('vi-VN')}đ vào ví hội viên.`
      : 'Đã phê duyệt hủy kỳ hạn (không hoàn tiền).'

    return { message, refundRequest, period }
  } catch (error) {
    if (!committed) await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}

export const rejectRefundRequest = async ({ refundRequestId, staffId, reason = '' }) => {
  const refundRequest = await RefundRequest.findById(refundRequestId)
    .populate('planId', 'nameVi nameEn price')
  if (!refundRequest) {
    const error = new Error('Không tìm thấy yêu cầu hoàn tiền.')
    error.statusCode = 404
    throw error
  }
  if (refundRequest.status !== 'PENDING') {
    const error = new Error('Yêu cầu hoàn tiền đã được xử lý.')
    error.statusCode = 400
    throw error
  }

  refundRequest.status = 'REJECTED'
  refundRequest.staffNote = String(reason || '').trim()
  refundRequest.reviewedBy = toObjectId(staffId, 'staffId')
  refundRequest.reviewedAt = new Date()
  await refundRequest.save()

  const period = await MembershipPeriod.findById(refundRequest.membershipPeriodId)
  if (period) {
    if (period.status === 'CANCEL_REQUESTED') {
      period.status = 'REJECTED'
      await period.save()
      await rebuildMembershipTimeline({ membershipId: period.membershipId })
    } else {
      // Full membership cancellation: restore membership status
      await Membership.findByIdAndUpdate(refundRequest.membershipId, { $set: { status: 'active' } })
    }
  }

  await recordUserActivity({
    userId: refundRequest.memberId,
    type: 'membership',
    title: 'Từ chối yêu cầu hủy kỳ hạn',
    description: 'Yêu cầu hủy kỳ hạn đã bị từ chối.',
    metadata: {
      refundRequestId: refundRequest._id,
      periodId: refundRequest.membershipPeriodId,
      membershipId: refundRequest.membershipId,
      handledBy: staffId,
      reason: reason || '',
    },
  })

  invalidatePersonalContextCache(refundRequest.memberId)

  emitRefundRequestUpdate().catch(() => {})

  const planName = refundRequest.planId?.nameVi || refundRequest.planId?.nameEn || ''
  const rejUser = await User.findById(refundRequest.memberId).select('email fullName name')
  const staffInfo = staffId ? await User.findById(staffId).select('fullName name') : null
  const staffName = staffInfo ? (staffInfo.fullName || staffInfo.name) : ''
  if (rejUser?.email) {
    const isFullCancel = refundRequest.pendingPeriodsCount > 0
    sendRefundRequestProcessedEmail({
      toEmail: rejUser.email,
      userName: rejUser.fullName || rejUser.name || rejUser.email,
      planName,
      status: 'REJECTED',
      refundAmount: 0,
      reason: reason || '',
      isFullCancel,
      staffName,
      staffNote: reason || '',
    }).catch((e) => console.error('Gửi email từ chối hủy thất bại:', e.message))
  }

  return {
    message: 'Đã từ chối yêu cầu. Kỳ hạn của hội viên không thay đổi.',
    refundRequest,
  }
}

export const listRefundRequests = async ({ page = 1, limit = 20, status, search }) => {
  const filter = {}
  if (status) {
    const statuses = String(status).split(',').map(s => s.trim()).filter(Boolean)
    if (statuses.length === 1) filter.status = statuses[0]
    else if (statuses.length > 1) filter.status = { $in: statuses }
  }

  if (search) {
    const keyword = String(search).trim()
    const User = (await import('../models/User.js')).default
    const matchingUsers = await User.find({
      $or: [
        { fullName: { $regex: keyword, $options: 'i' } },
        { name: { $regex: keyword, $options: 'i' } },
        { email: { $regex: keyword, $options: 'i' } },
        { phone: { $regex: keyword, $options: 'i' } },
        { memberCode: { $regex: keyword, $options: 'i' } },
      ],
    }).select('_id').lean()
    const userIds = matchingUsers.map((u) => u._id)
    if (userIds.length) filter.memberId = { $in: userIds }
  }

  const skip = (Number(page) - 1) * Number(limit)
  const [items, total] = await Promise.all([
    RefundRequest.find(filter)
      .populate('memberId', 'name fullName email phone memberCode memberNumber avatar')
      .populate('planId', 'nameVi nameEn price durationDays')
      .populate('membershipId', 'startDate endDate status')
      .populate('membershipPeriodId', 'startDate endDate totalDays price activatedAt')
      .populate('reviewedBy', 'name fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    RefundRequest.countDocuments(filter),
  ])

  return {
    refundRequests: items,
    pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
  }
}
