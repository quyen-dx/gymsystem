import mongoose from 'mongoose'
import RefundRequest from '../models/RefundRequest.js'
import MembershipPeriod from '../models/MembershipPeriod.js'
import MembershipCycle from '../models/MembershipCycle.js'
import User from '../models/User.js'
import Wallet from '../models/Wallet.js'
import Transaction from '../models/Transaction.js'
import CheckIn from '../models/CheckIn.js'
import Booking from '../models/Booking.js'
import { rebuildMembershipTimeline, hasUsedMembershipBenefits, cleanupMemberPTData } from './membershipService.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'
import { recordUserActivity } from './userActivityService.js'
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
  // Business Rule: hoàn tiền dựa trên registeredAt (ngày đăng ký) + hasUsedBenefit.
  // Với kỳ chính, registeredAt = activatedAt = thời điểm thanh toán (gói kích hoạt ngay).
  const now = new Date()
  const registeredAt = period.activatedAt || period.startDate
  const daysSinceActivation = Math.max(0, Math.floor((now.getTime() - new Date(registeredAt).getTime()) / (1000 * 60 * 60 * 24)))
  const refundDeadline = new Date(new Date(registeredAt).getTime() + 7 * 24 * 60 * 60 * 1000)
  const isWithinWindow = now.getTime() <= refundDeadline.getTime()

  // Check-in
  const checkInCount = await CheckIn.countDocuments({
    memberId,
    status: 'success',
    checkinTime: { $gte: registeredAt },
  })
  const usedCheckIn = checkInCount > 0

  // Booking: PT
  const ptBookingCount = await Booking.countDocuments({
    memberId,
    status: { $in: ['completed', 'confirmed'] },
    date: { $gte: registeredAt, $lte: now },
  })
  const usedPT = ptBookingCount > 0

  // Booking: Gym / room usage — treat booking count as gym usage
  const gymUsageCount = ptBookingCount // same Booking collection for PT/gym
  const usedGym = gymUsageCount > 0

  // Đã sử dụng quyền lợi: check-in, đặt lịch PT, tham gia lớp học, hoặc tính năng yêu cầu quyền của gói
  const hasUsedBenefit = usedCheckIn || usedPT || usedGym
    || await hasUsedMembershipBenefits({ memberId, purchaseDate: registeredAt })
  const usedBenefits = hasUsedBenefit
  const eligibleForRefund = isWithinWindow && !hasUsedBenefit

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

  if (!isFullMembershipCancel) {
    period.status = 'CANCEL_REQUESTED'
    await period.save()
  }
  await rebuildMembershipTimeline({ membershipId: period.membershipId })

  // Tính tổng tiền các MembershipPeriod PENDING (gia hạn chưa tới ngày bắt đầu)
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

  createNotification({
    receiverId: null,
    receiverRole: 'admin',
    notificationType: NOTIFICATION_TYPES.REFUND_REQUEST,
    title: 'Yêu cầu hoàn tiền mới',
    content: `Hội viên đã gửi yêu cầu hoàn tiền kỳ hạn (+${period.totalDays} ngày). Lý do: ${reason || 'Không có lý do.'}`,
    relatedId: refundRequest._id,
    relatedType: 'RefundRequest',
    redirectUrl: '/admin/refund-requests',
    createdBy: 'System',
  }).catch(err => console.error('Notify refund request failed:', err.message))

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
    if (isActivePeriod) {
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

    // Update cycle status when active period is refunded/cancelled
    if (isActivePeriod) {
      const cycle = await MembershipCycle.findOne({ currentMembershipId: period.membershipId })
        .session(session).sort({ createdAt: -1 }).lean()
      if (cycle) {
        await MembershipCycle.updateOne(
          { _id: cycle._id },
          { $set: { status: totalRefundAmount > 0 ? 'refunded' : 'cancelled' } },
        ).session(session)
      }
      // Cleanup toàn bộ PT/class/booking data khi hủy toàn bộ gói
      await cleanupMemberPTData({
        memberId: period.memberId,
        session,
        sourceReason: 'membership_cancelled',
        note: totalRefundAmount > 0 ? 'Gói tập đã được hoàn tiền' : 'Gói tập đã bị hủy',
      })
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

    const memberId = refundRequest.memberId
    createNotification({
      receiverId: refundRequest.memberId,
      receiverRole: 'member',
      notificationType: totalRefundAmount > 0 ? NOTIFICATION_TYPES.REFUND_APPROVED : NOTIFICATION_TYPES.REFUND_REJECTED,
      title: totalRefundAmount > 0 ? 'Yêu cầu hoàn tiền đã được duyệt' : 'Yêu cầu hủy kỳ hạn đã được duyệt',
      content: totalRefundAmount > 0
        ? `Yêu cầu hoàn tiền của bạn đã được duyệt. ${totalRefundAmount.toLocaleString('vi-VN')}đ đã được hoàn vào ví.`
        : `Yêu cầu hủy kỳ hạn của bạn đã được duyệt (không hoàn tiền).`,
      relatedId: refundRequest._id,
      relatedType: 'RefundRequest',
      redirectUrl: '/my-membership',
      createdBy: 'Staff',
    }).catch(err => console.error('Notify refund approved failed:', err.message))

    if (totalRefundAmount > 0) {
      createNotification({
        receiverId: refundRequest.memberId,
        receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
        title: 'Hoàn tiền thành công',
        content: `${totalRefundAmount.toLocaleString('vi-VN')}đ đã được hoàn vào ví của bạn.`,
        relatedId: refundRequest._id,
        relatedType: 'RefundRequest',
        redirectUrl: '/my-wallet',
        createdBy: 'System',
      }).catch(err => console.error('Notify refund payment failed:', err.message))
    }

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

  createNotification({
    receiverId: refundRequest.memberId,
    receiverRole: 'member',
    notificationType: NOTIFICATION_TYPES.REFUND_REJECTED,
    title: 'Yêu cầu hủy kỳ hạn bị từ chối',
    content: `Yêu cầu hủy kỳ hạn của bạn đã bị từ chối. Lý do: ${reason || 'Không có lý do.'}`,
    relatedId: refundRequest._id,
    relatedType: 'RefundRequest',
    redirectUrl: '/my-membership',
    createdBy: 'Staff',
  }).catch(err => console.error('Notify refund rejected failed:', err.message))

  const period = await MembershipPeriod.findById(refundRequest.membershipPeriodId)
  if (period && period.status === 'CANCEL_REQUESTED') {
    period.status = 'REJECTED'
    await period.save()
    await rebuildMembershipTimeline({ membershipId: period.membershipId })
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

  const memberFilter = {}
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
    if (userIds.length) {
      filter.memberId = { $in: userIds }
      memberFilter.memberId = { $in: userIds }
    }
  }

  // Xây dựng cancelFilter từ status giống refundFilter
  let cancelFilter = {}
  if (status) {
    const statuses = String(status).split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    if (statuses.length === 1) {
      cancelFilter = { status: statuses[0] }
    } else if (statuses.length > 1) {
      cancelFilter = { status: { $in: statuses } }
    }
  }
  if (memberFilter.memberId) cancelFilter.memberId = memberFilter.memberId

  const refundFilter = { ...filter }

  const skip = (Number(page) - 1) * Number(limit)
  const limitNum = Number(limit)

  const queryCancels = true

  const [cancelRequests, refundItems] = await Promise.all([
    queryCancels
      ? import('../models/MembershipCancellationRequest.js').then(mod =>
          mod.default.find(cancelFilter)
            .populate('memberId', 'name fullName email phone memberCode memberNumber avatar')
            .populate('planId', 'nameVi nameEn price durationDays')
            .populate('membershipCycleId', 'activatedAt refundEligible firstBenefitType firstBenefitUsedAt purchasedAt startDate expiresAt durationDays createdAt')
            .populate('handledBy', 'name fullName email')
            .sort({ createdAt: -1 })
            .lean()
        )
      : Promise.resolve([]),
    RefundRequest.find(refundFilter)
      .populate('memberId', 'name fullName email phone memberCode memberNumber avatar')
      .populate('planId', 'nameVi nameEn price durationDays')
      .populate('membershipId', 'status')
      .populate('membershipPeriodId', 'startDate endDate totalDays price activatedAt')
      .populate('reviewedBy', 'name fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
  ])

  // Debug logging
  console.log(`[listRefundRequests] status=${status} cancelFilter=${JSON.stringify(cancelFilter)} refundFilter=${JSON.stringify(refundFilter)}`)
  console.log(`[listRefundRequests] cancelRequests found: ${cancelRequests.length}, refundItems found: ${refundItems.length}`)

  // Format CancellationRequest records to match RefundRequest shape
  const now = Date.now()
  const REFUND_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
  const formattedCancels = cancelRequests.map((cr) => {
    const cycle = cr.membershipCycleId || null
    const isActivated = !!cycle?.activatedAt
    const effectivePurchaseDate = cycle?.purchasedAt || cycle?.startDate || cycle?.createdAt || cr.registeredAt || cr.createdAt
    const purchaseTime = effectivePurchaseDate ? new Date(effectivePurchaseDate).getTime() : null
    const isWithin7Days = purchaseTime ? (now - purchaseTime) < REFUND_WINDOW_MS : false
    const isEligible = !isActivated && isWithin7Days

    // Tính số ngày đã dùng dựa trên cycle
    let daysUsedAtRequest = 0
    if (cycle?.activatedAt) {
      daysUsedAtRequest = Math.max(0, Math.floor((now - new Date(cycle.activatedAt).getTime()) / 86400000))
    } else if (cycle?.firstBenefitUsedAt) {
      // Có benefit usage nhưng chưa activate (vd: upgrade/downgrade) → không tính là đã dùng ngày
      daysUsedAtRequest = 0
    }

    // Tính còn bao nhiêu ngày để refund
    let remainingRefundDays = 0
    if (purchaseTime && !isActivated) {
      const elapsedDays = Math.floor((now - purchaseTime) / 86400000)
      remainingRefundDays = Math.max(0, 7 - elapsedDays)
    }

    // Policy label: dùng từ cancellation request, nếu thiếu thì tính lại
    let refundPolicyResult = cr.policyLabel || ''
    if (!refundPolicyResult || refundPolicyResult === 'Không đủ thông tin để xét hoàn tiền.') {
      if (isActivated) {
        refundPolicyResult = 'Gói tập đang hoạt động.'
      } else if (isEligible) {
        refundPolicyResult = 'Đủ điều kiện hoàn tiền'
      } else if (purchaseTime) {
        refundPolicyResult = 'Đã quá 07 ngày kể từ ngày đăng ký.'
      } else {
        refundPolicyResult = 'Không đủ thông tin để xét hoàn tiền.'
      }
    }

    const renewalTotal = (cr.renewalRefunds || []).reduce((sum, r) => sum + (r.refundAmount || 0), 0)
    const renewalCount = (cr.renewalRefunds || []).length

    return {
      _id: cr._id,
      memberId: cr.memberId,
      planId: cr.planId,
      reason: cr.reason,
      refundAmount: cr.estimatedRefundAmount || 0,
      status: cr.status === 'pending' ? 'PENDING' : cr.status === 'approved' ? 'APPROVED' : 'REJECTED',
      requestedAt: cr.requestedAt || cr.createdAt,
      reviewedBy: cr.handledBy || null,
      reviewedAt: cr.handledAt || null,
      staffNote: cr.staffNote || '',
      daysUsedAtRequest,
      eligibleWithin7Days: !isActivated && isWithin7Days,
      usedCheckIn: false,
      usedGym: false,
      usedPT: false,
      usedBenefits: false,
      refundPolicyResult,
      policyVersion: '1.0',
      pendingPeriodsTotal: renewalTotal,
      pendingPeriodsCount: renewalCount,
      __source: 'cancellation',
      cancellationRequestId: cr._id,
      cycle,
      activationStatus: isActivated ? 'activated' : 'pending',
      remainingRefundDays,
    }
  })

  // Merge: cancellation requests first, then period refunds
  const merged = [...formattedCancels, ...refundItems]

  const total = cancelRequests.length + await RefundRequest.countDocuments(refundFilter)

  return {
    refundRequests: merged,
    pagination: { total, page: Number(page), limit: limitNum, totalPages: Math.ceil(total / limitNum) },
  }
}
