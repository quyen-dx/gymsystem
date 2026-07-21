import mongoose from 'mongoose'
import Stripe from 'stripe'
import { buildClientUrl } from '../config/appUrls.js'
import Membership from '../models/Membership.js'
import MembershipPeriod from '../models/MembershipPeriod.js'
import MembershipRenewal from '../models/MembershipRenewal.js'
import MembershipRegistration from '../models/MembershipRegistration.js'
import Payment from '../models/Payment.js'
import Plan from '../models/Plan.js'
import PlanFeature from '../models/PlanFeature.js'
import ClassEnrollment from '../models/ClassEnrollment.js'
import RefundRequest from '../models/RefundRequest.js'
import Transaction from '../models/Transaction.js'
import User from '../models/User.js'
import Wallet from '../models/Wallet.js'
import CheckIn from '../models/CheckIn.js'
import Booking from '../models/Booking.js'
import Workout from '../models/Workout.js'
import WorkoutSchedule from '../models/WorkoutSchedule.js'
import PTAssignment from '../models/PTAssignment.js'
import TrainingAssignment from '../models/TrainingAssignment.js'
import MembershipCycle from '../models/MembershipCycle.js'
import PlanChangeHistory from '../models/PlanChangeHistory.js'
import { endEnrollments as endClassEnrollments } from './classEnrollmentService.js'
import { getSystemSettingsValue } from './systemSettingsService.js'
import { recordUserActivity } from './userActivityService.js'
import { applyWalletTransaction } from './walletService.js'
import { normalizeUserMemberIdentity } from '../utils/memberIdentity.js'
import { assertPolicyConsent } from '../utils/policyConsent.js'
import { sendRenewalSuccessEmail, sendPeriodCompletedEmail, sendPeriodActivatedEmail, sendCancelRenewalEmail } from './emailService.js'
import {
  startOfTodayVN,
  endOfDayVN,
  calculateRemainingDays,
  calcMembershipEndDate,
} from '../utils/dateUtils.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification, notifyPtMemberChanged } from '../services/notificationService.js'
import { assertPurchaseEligibility } from './membershipBusinessRules.js'

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null

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

const toObjectId = (value, fieldName) => {
  if (!mongoose.Types.ObjectId.isValid(String(value))) {
    const error = new Error(`${fieldName} không hợp lệ`)
    error.statusCode = 400
    throw error
  }
  return new mongoose.Types.ObjectId(value)
}

const getRenewalThresholdDays = async () => {
  try {
    const settings = await getSystemSettingsValue()
    return settings?.billing?.renewalThresholdDays ?? 7
  } catch {
    return 7
  }
}

const assertRenewalAllowed = async () => {}

const computePeriodStatus = (period) => {
  if (!period) return 'COMPLETED'
  if (['CANCELLED', 'REFUNDED', 'CANCEL_REQUESTED', 'REJECTED'].includes(period.status)) {
    return period.status
  }
  const now = Date.now()
  const start = new Date(period.startDate).getTime()
  const end = new Date(period.endDate).getTime()
  if (now >= start && now <= end) return 'ACTIVE'
  if (now > end) return 'COMPLETED'
  return 'PENDING'
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

const getMembershipDisplayStatus = (membership, cycle) => {
  if (!membership && !cycle) return 'expired'
  const cycleStatus = cycle?.status
  if (cycleStatus === 'pending_initial_activation' || cycleStatus === 'pending_renewal_activation') return 'pending_activation'
  if (cycleStatus === 'active') {
    if (!cycle.expiresAt) return 'active'
    const end = endOfDayVN(cycle.expiresAt)
    const rawDiff = Math.ceil((end.getTime() - Date.now()) / MS_PER_DAY)
    if (rawDiff > 7) return 'active'
    if (rawDiff >= 1) return 'expiring_soon'
    if (rawDiff === 0) return 'expires_today'
    return 'expired'
  }
  if (cycleStatus === 'completed') return 'expired'
  if (cycleStatus === 'cancelled') return 'cancelled'
  if (cycleStatus === 'refunded') return 'refunded'
  return membership?.status === 'active' ? 'active' : 'expired'
}

const serializePlan = (plan) => ({
  id: plan?._id,
  _id: plan?._id,
  nameVi: plan?.nameVi,
  nameEn: plan?.nameEn,
  price: plan?.price,
  durationDays: plan?.durationDays,
  descriptionVi: plan?.descriptionVi,
  descriptionEn: plan?.descriptionEn,
  featuresVi: plan?.featuresVi || [],
  featuresEn: plan?.featuresEn || [],
  featureIds: plan?.featureIds || [],
  color: plan?.color,
})

const serializeMembership = (membership, cycle) => {
  if (!membership) return null
  const raw = membership.toObject ? membership.toObject() : membership
  const plan = raw.planId
  const startDate = raw.startDate || cycle?.startDate || null
  const endDate = raw.endDate || cycle?.expiresAt || null
  const remainingDays = calculateRemainingDays(endDate)
  return {
    id: raw._id,
    _id: raw._id,
    memberId: raw.memberId,
    planId: plan?._id || raw.planId,
    plan: plan?.nameVi || plan?.nameEn ? serializePlan(plan) : undefined,
    planNameVi: plan?.nameVi,
    planNameEn: plan?.nameEn,
    price: plan?.price,
    durationDays: plan?.durationDays,
    startDate,
    endDate,
    remainingDays,
    status: remainingDays <= 0 ? 'expired' : raw.status,
    displayStatus: getMembershipDisplayStatus(raw, cycle),
    source: raw.source,
    createdAt: raw.createdAt,
  }
}

const ensureMemberAndPlan = async ({ userId, planId }) => {
  const memberId = toObjectId(userId, 'userId')
  const planObjectId = toObjectId(planId, 'planId')

  const [user, plan] = await Promise.all([
    User.findById(memberId),
    Plan.findOne({ _id: planObjectId, isActive: true }),
  ])

  if (!user) {
    const error = new Error('Không tìm thấy người dùng')
    error.statusCode = 404
    throw error
  }

  if (user.role !== 'member') {
    const error = new Error('Chỉ hội viên mới có thể đăng ký gói tập')
    error.statusCode = 400
    throw error
  }

  if (!plan) {
    const error = new Error('Không tìm thấy gói tập hợp lệ')
    error.statusCode = 404
    throw error
  }

  return { user, plan, memberId, planObjectId }
}

const subscribeWithWallet = async ({ userId, planId, mode = 'register', durationMultiplier = 1 }) => {
  await assertPolicyConsent(userId, ['membership', 'terms'])

  const { user, plan, memberId, planObjectId } = await ensureMemberAndPlan({ userId, planId })
  const multiplier = Math.max(1, Math.floor(Number(durationMultiplier) || 1))
  const effectiveDays = plan.durationDays * multiplier
  const amount = Number(plan.price || 0) * multiplier

  await assertPurchaseEligibility(memberId, mode)

  const existingActiveCycle = await MembershipCycle.findOne({
    memberId, status: 'active',
  }).sort({ createdAt: -1 }).lean()

  if (mode === 'renew') {
    if (!existingActiveCycle) {
      const error = new Error('Bạn chưa có gói tập để gia hạn. Vui lòng đăng ký gói mới.')
      error.statusCode = 404
      throw error
    }
    await assertRenewalAllowed(existingActiveCycle.expiresAt)
  }

  const existingPendingCycle = !existingActiveCycle && mode === 'register'
    ? await MembershipCycle.findOne({
        memberId, status: 'pending_initial_activation',
      }).sort({ createdAt: -1 }).lean()
    : null

  const session = await mongoose.startSession()
  let committed = false

  try {
    session.startTransaction()

    const today = startOfTodayVN()

    const isRenew = mode === 'renew'
    const existingActive = existingActiveCycle
      ? await Membership.findById(existingActiveCycle.currentMembershipId).session(session)
      : null
    let oldEndDate = null
    let renewalPeriodsData = null
    let newRegistrationPeriodData = null

    let membership = isRenew && existingActive ? existingActive : null

    if (membership) {
      // Gia hạn: tạo nhiều MembershipPeriod (mỗi period = một chu kỳ chuẩn của Plan)
      const latestPeriod = await MembershipPeriod.findOne({ membershipId: membership._id })
        .sort({ endDate: -1 })
        .session(session)

      const lastEnd = latestPeriod
        ? endOfDayVN(latestPeriod.endDate)
        : endOfDayVN(existingActiveCycle.expiresAt)

      oldEndDate = new Date(existingActiveCycle.expiresAt)

      let currentStart = new Date(lastEnd)
      currentStart.setDate(currentStart.getDate() + 1)
      currentStart.setHours(0, 0, 0, 0)

      const numPeriods = Math.max(1, multiplier)
      const periodsData = []
      for (let i = 0; i < numPeriods; i++) {
        const pStart = new Date(currentStart)
        const pEnd = calcMembershipEndDate({
          baseDate: pStart,
          durationDays: plan.durationDays,
        })
        periodsData.push({
          membershipId: membership._id,
          planId: planObjectId,
          memberId,
          startDate: pStart,
          endDate: pEnd,
          totalDays: plan.durationDays,
          price: plan.price,
        })
        // Period tiếp theo bắt đầu sau period hiện tại
        currentStart = endOfDayVN(pEnd)
        currentStart.setDate(currentStart.getDate() + 1)
        currentStart.setHours(0, 0, 0, 0)
      }

      membership.planId = planObjectId
      membership.source = 'manual'
      await membership.save({ session })

      // Lưu thông tin để tạo MembershipPeriod sau khi có paymentId
      renewalPeriodsData = periodsData
    } else {
      // Đăng ký mới: tạo Membership container (không startDate/endDate)
      const [createdMembership] = await Membership.create(
        [{
          memberId,
          planId: planObjectId,
          status: 'active',
          source: 'manual',
        }],
        { session },
      )
      membership = createdMembership

      // Legacy MembershipPeriod (giữ để tương thích)
      const periodStart = new Date(today)
      const periodEnd = calcMembershipEndDate({ baseDate: periodStart, durationDays: plan.durationDays })
      newRegistrationPeriodData = {
        membershipId: membership._id,
        planId: planObjectId,
        memberId,
        startDate: periodStart,
        endDate: periodEnd,
        totalDays: plan.durationDays,
        price: amount,
      }
    }

    const { wallet, transaction: walletTxn } = await applyWalletTransaction({
      userId: memberId,
      amount: -amount,
      type: 'payment',
      provider: 'wallet',
      source: 'membership',
      description: `Thanh toán gói tập ${plan.nameVi || plan.nameEn}`,
      status: 'completed',
      metadata: {
        planId: plan._id,
        membershipId: membership._id,
      },
      idempotencyKey: `subscribe_wallet_${memberId}_${membership._id}`,
      session,
    })

    const balanceBefore = walletTxn.balanceBefore
    const walletBalance = walletTxn.balanceAfter

    const [payment] = await Payment.createWithIdempotency(
      [
        {
          userId: memberId,
          planId: planObjectId,
          membershipId: membership._id,
          amount,
          currency: 'vnd',
          status: 'PAID',
          paymentMethod: 'WALLET',
          source: 'ONLINE',
          paidAt: new Date(),
          metadata: {
            walletBalanceBefore: balanceBefore,
            walletBalanceAfter: walletBalance,
            walletTransactionId: walletTxn._id,
          },
        },
      ],
      { session },
    )

    membership.paymentId = payment._id
    await membership.save({ session })

    if (newRegistrationPeriodData) {
      // Tạo MembershipPeriod đầu tiên (ACTIVE) cho đăng ký mới
      await MembershipPeriod.create([{
        ...newRegistrationPeriodData,
        paymentId: payment._id,
        status: 'ACTIVE',
        activatedAt: new Date(),
      }], { session })
    }

    if (renewalPeriodsData && renewalPeriodsData.length > 0) {
      // Tạo nhiều MembershipPeriod (mỗi period = một chu kỳ chuẩn)
      await MembershipPeriod.create(
        renewalPeriodsData.map((pd) => ({
          ...pd,
          paymentId: payment._id,
          status: 'PENDING',
        })),
        { session, ordered: true },
      )

      const lastPeriodEnd = renewalPeriodsData[renewalPeriodsData.length - 1].endDate
      await MembershipRenewal.create([{
        membershipId: membership._id,
        planId: planObjectId,
        memberId,
        days: effectiveDays,
        price: amount,
        oldEndDate,
        newEndDate: lastPeriodEnd,
        renewedAt: new Date(),
        status: 'ACTIVE',
        paymentId: payment._id,
        durationMultiplier: multiplier,
      }], { session })

    }

    if ((renewalPeriodsData && renewalPeriodsData.length > 0) || newRegistrationPeriodData) {
      await rebuildMembershipTimeline({ membershipId: membership._id, session })
    }

    // === MembershipCycle integration (cycle-based) ===
    const now = new Date()
    const refundExpiredAt = new Date(now)
    refundExpiredAt.setDate(refundExpiredAt.getDate() + 7)

    if (isRenew) {
      // R13: Tạo cycle MỚI pending_renewal_activation
      // R14: KHÔNG modify active cycle (không extend durationDays/expiresAt)
      await MembershipCycle.create([{
        memberId,
        currentMembershipId: membership._id,
        currentPlanId: planObjectId,
        purchasedAt: now,
        durationDays: effectiveDays,
        status: 'pending_renewal_activation',
        refundEligible: true,
        refundExpiredAt,
        previousCycleId: existingActiveCycle?._id || null,
      }], { session })
    } else if (existingPendingCycle) {
      // Mua mới + đã có pending_initial_activation → extend durationDays (EC10)
      await MembershipCycle.updateOne(
        { _id: existingPendingCycle._id },
        {
          $inc: { durationDays: effectiveDays },
          $set: {
            currentMembershipId: membership._id,
            currentPlanId: planObjectId,
            refundExpiredAt,
          },
        },
      ).session(session)
    } else {
      // Mua mới: tạo cycle pending_initial_activation
      await MembershipCycle.create([{
        memberId,
        currentMembershipId: membership._id,
        currentPlanId: planObjectId,
        purchasedAt: now,
        durationDays: effectiveDays,
        status: 'pending_initial_activation',
        refundEligible: true,
        refundExpiredAt,
        previousCycleId: null,
      }], { session })
    }

    await PlanChangeHistory.create([{
      memberId,
      membershipId: membership._id,
      fromPlanId: null,
      toPlanId: planObjectId,
      changedAt: new Date(),
      changeType: isRenew ? 'renew' : 'purchase',
      type: isRenew ? 'renew' : 'purchase',
      amount: amount || 0,
      priceDifference: 0,
      proratedValue: 0,
      proratedCredit: 0,
      walletCredit: 0,
    }], { session })
    // === end MembershipCycle integration ===

    await session.commitTransaction()
    committed = true

    if (isRenew) {
      createNotification({
        receiverId: memberId,
        receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.MEMBERSHIP_RENEWAL_SUCCESS,
        title: 'Gia hạn gói tập thành công',
        content: `Bạn đã gia hạn thành công gói "${plan.nameVi || plan.nameEn}".`,
        relatedId: membership._id,
        relatedType: 'Membership',
        redirectUrl: '/my-membership',
        createdBy: 'System',
      }).catch(err => console.error('Notify renewal failed:', err.message))

      createNotification({
        receiverId: memberId,
        receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
        title: 'Thanh toán gia hạn thành công',
        content: `Bạn đã thanh toán ${amount.toLocaleString('vi-VN')}đ để gia hạn gói tập.`,
        relatedId: payment._id,
        relatedType: 'Payment',
        redirectUrl: '/my-membership',
        createdBy: 'System',
      }).catch(err => console.error('Notify payment failed:', err.message))
    } else {
      createNotification({
        receiverId: memberId,
        receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.MEMBERSHIP_ACTIVATED,
        title: 'Gói tập đã được kích hoạt',
        content: `Gói "${plan.nameVi || plan.nameEn}" đã được kích hoạt thành công.`,
        relatedId: membership._id,
        relatedType: 'Membership',
        redirectUrl: '/my-membership',
        createdBy: 'System',
      }).catch(err => console.error('Notify membership activated failed:', err.message))

      createNotification({
        receiverId: memberId,
        receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
        title: 'Thanh toán gói tập thành công',
        content: `Bạn đã thanh toán ${amount.toLocaleString('vi-VN')}đ cho gói "${plan.nameVi || plan.nameEn}".`,
        relatedId: payment._id,
        relatedType: 'Payment',
        redirectUrl: '/my-membership',
        createdBy: 'System',
      }).catch(err => console.error('Notify payment failed:', err.message))
    }

    if (!isRenew) {
      await cleanupMemberPTData({ memberId })
    }

    try {
      await recordUserActivity({
        userId: user._id,
        type: 'membership',
        title: isRenew ? 'Gia hạn gói tập' : 'Đăng ký gói tập',
        description: `${isRenew ? 'Gia hạn' : 'Đăng ký'} gói "${plan.nameVi}" bằng ví tài khoản`,
        metadata: { membershipId: membership._id, planId: plan._id, paymentId: payment._id, paymentMethod: 'WALLET' },
      })
    } catch (activityError) {
      console.error('Không thể ghi hoạt động đăng ký gói tập:', activityError.message)
    }

    if (isRenew && user.email) {
      const existingPeriodCount = renewalPeriodsData
        ? await MembershipPeriod.countDocuments({ membershipId: membership._id })
        : 0
      sendRenewalSuccessEmail({
        toEmail: user.email,
        userName: user.fullName || user.name || user.email,
        planName: plan.nameVi || plan.nameEn,
        endDate: renewalPeriodsData
          ? renewalPeriodsData[0].endDate
          : existingActiveCycle?.expiresAt,
        periodIndex: existingPeriodCount > 0 ? existingPeriodCount + 1 : undefined,
      }).catch((e) => console.error('Gửi email gia hạn thất bại:', e.message))
    }

    const [populatedMembership, latestCycle] = await Promise.all([
      Membership.findById(membership._id).populate('planId').session(null),
      MembershipCycle.find({ memberId })
        .sort({ createdAt: -1 })
        .limit(1)
        .lean()
        .session(null),
    ])
    const cycle = latestCycle?.[0] || null
    return {
      message: isRenew ? 'Gia hạn thành công' : 'Đăng ký gói tập thành công',
      walletBalance,
      membership: serializeMembership(populatedMembership, cycle),
      cycle: cycle
        ? {
            id: cycle._id,
            status: cycle.status,
            expiresAt: cycle.expiresAt,
            durationDays: cycle.durationDays,
            refundExpiredAt: cycle.refundExpiredAt,
          }
        : undefined,
      payment,
      ...(renewalPeriodsData && renewalPeriodsData.length > 0
        ? { newEndDate: renewalPeriodsData[renewalPeriodsData.length - 1].endDate }
        : {}),
    }
  } catch (error) {
    if (!committed) {
      await session.abortTransaction()
    }
    throw error
  } finally {
    session.endSession()
  }
}

const createActivatedMembership = async ({ userId, planId, source = 'manual', paymentId = null, mode = 'register' }) => {
  const { user, plan, memberId, planObjectId } = await ensureMemberAndPlan({ userId, planId })

  await assertPurchaseEligibility(memberId, mode)

  const existingActiveCycle = await MembershipCycle.findOne({
    memberId, status: 'active',
  }).sort({ createdAt: -1 }).lean()

  if (mode === 'register' && existingActiveCycle) {
    const error = new Error('Bạn đang có gói tập active. Vui lòng gia hạn trong trang Gói tập của tôi.')
    error.statusCode = 400
    throw error
  }

  if (mode === 'renew') {
    if (!existingActiveCycle) {
      const error = new Error('Bạn chưa có gói tập để gia hạn. Vui lòng đăng ký gói mới.')
      error.statusCode = 400
      throw error
    }

    await assertRenewalAllowed(existingActiveCycle.expiresAt)
  }

  const existingPendingCycle = !existingActiveCycle && mode === 'register'
    ? await MembershipCycle.findOne({
        memberId, status: 'pending_initial_activation',
      }).sort({ createdAt: -1 }).lean()
    : null

  const existingActive = mode === 'renew' && existingActiveCycle
    ? await Membership.findById(existingActiveCycle.currentMembershipId)
    : null

  if (mode === 'register') {
    // Đăng ký mới: tạo Membership container (không startDate/endDate)
    const membership = await Membership.create({
      memberId,
      planId: planObjectId,
      status: 'active',
      source,
      paymentId,
    })

    // Legacy MembershipPeriod (giữ để tương thích)
    const periodStart = new Date()
    const periodEnd = calcMembershipEndDate({ baseDate: periodStart, durationDays: plan.durationDays })
    await MembershipPeriod.create({
      membershipId: membership._id,
      planId: planObjectId,
      memberId,
      startDate: periodStart,
      endDate: periodEnd,
      totalDays: plan.durationDays,
      price: plan.price,
      paymentId,
      status: 'ACTIVE',
      activatedAt: new Date(),
    })

    if (paymentId) {
      await Payment.findByIdAndUpdate(paymentId, { membershipId: membership._id })
    }

    await cleanupMemberPTData({ memberId: user._id })

    await recordUserActivity({
      userId: user._id,
      type: 'membership',
      title: 'Đăng ký gói tập',
      description: `Đăng ký gói "${plan.nameVi}" - ${plan.durationDays} ngày`,
      metadata: { membershipId: membership._id, planId: plan._id, source },
    })

    createNotification({
      receiverId: user._id,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.MEMBERSHIP_ACTIVATED,
      title: 'Gói tập đã được kích hoạt',
      content: `Gói "${plan.nameVi || plan.nameEn}" đã được kích hoạt thành công.`,
      relatedId: membership._id,
      relatedType: 'Membership',
      redirectUrl: '/my-membership',
      createdBy: source === 'staff' ? 'Staff' : 'System',
    }).catch(err => console.error('Notify membership activated failed:', err.message))

    // === MembershipCycle integration (cycle-based) ===
    const now = new Date()
    const refundExpiredAt = new Date(now)
    refundExpiredAt.setDate(refundExpiredAt.getDate() + 7)

    if (existingPendingCycle) {
      // Đã có pending_initial_activation → extend durationDays (EC10)
      await MembershipCycle.updateOne(
        { _id: existingPendingCycle._id },
        {
          $inc: { durationDays: plan.durationDays },
          $set: {
            currentMembershipId: membership._id,
            currentPlanId: planObjectId,
            refundExpiredAt,
          },
        },
      )
    } else {
      // Tạo cycle pending_initial_activation
      await MembershipCycle.create({
        memberId,
        currentMembershipId: membership._id,
        currentPlanId: planObjectId,
        purchasedAt: now,
        durationDays: plan.durationDays,
        status: 'pending_initial_activation',
        refundEligible: true,
        refundExpiredAt,
        previousCycleId: null,
      })
    }

    await PlanChangeHistory.create({
      memberId,
      membershipId: membership._id,
      fromPlanId: null,
      toPlanId: planObjectId,
      changedAt: new Date(),
      changeType: 'purchase',
      type: 'purchase',
      amount: plan.price || 0,
      priceDifference: 0,
      proratedValue: 0,
      proratedCredit: 0,
      walletCredit: 0,
    })
    // === end MembershipCycle integration ===

    const [populated, latestCycle] = await Promise.all([
      Membership.findById(membership._id).populate('planId'),
      MembershipCycle.find({ memberId }).sort({ createdAt: -1 }).limit(1).lean(),
    ])
    const cycle = latestCycle?.[0] || null
    return {
      ...serializeMembership({ ...populated.toObject(), planId: plan.toObject() }, cycle),
      cycle: cycle
        ? {
            id: cycle._id,
            status: cycle.status,
            expiresAt: cycle.expiresAt,
            durationDays: cycle.durationDays,
            refundExpiredAt: cycle.refundExpiredAt,
          }
        : undefined,
    }
  }

  // mode === 'renew': thêm MembershipPeriod vào Membership hiện tại
  const latestPeriod = await MembershipPeriod.findOne({ membershipId: existingActive._id })
    .sort({ endDate: -1 })

  const lastEnd = latestPeriod
    ? endOfDayVN(latestPeriod.endDate)
    : endOfDayVN(existingActive.endDate)

  const periodStart = new Date(lastEnd)
  periodStart.setDate(periodStart.getDate() + 1)
  periodStart.setHours(0, 0, 0, 0)

  const periodEnd = calcMembershipEndDate({
    baseDate: periodStart,
    durationDays: plan.durationDays,
  })

  await MembershipPeriod.create({
    membershipId: existingActive._id,
    planId: planObjectId,
    memberId,
    startDate: periodStart,
    endDate: periodEnd,
    totalDays: plan.durationDays,
    price: plan.price,
    paymentId,
    status: 'PENDING',
  })

  await MembershipRenewal.create({
    membershipId: existingActive._id,
    planId: planObjectId,
    memberId,
    days: plan.durationDays,
    price: plan.price,
    oldEndDate: new Date(existingActive.endDate),
    newEndDate: periodEnd,
    renewedAt: new Date(),
    status: 'ACTIVE',
    paymentId,
    durationMultiplier: 1,
  })

  existingActive.planId = planObjectId
  existingActive.source = source
  if (paymentId) existingActive.paymentId = paymentId
  await existingActive.save()

  if (paymentId) {
    await Payment.findByIdAndUpdate(paymentId, { membershipId: existingActive._id })
  }

  // Gọi rebuild để đồng bộ timeline của các period
  await rebuildMembershipTimeline({ membershipId: existingActive._id })

  await recordUserActivity({
    userId: user._id,
    type: 'membership',
    title: 'Gia hạn gói tập',
    description: `Gia hạn gói "${plan.nameVi}" thêm ${plan.durationDays} ngày`,
    metadata: { membershipId: existingActive._id, planId: plan._id, source },
  })

  createNotification({
    receiverId: user._id,
    receiverRole: 'member',
    notificationType: NOTIFICATION_TYPES.MEMBERSHIP_RENEWAL_SUCCESS,
    title: 'Gia hạn gói tập thành công',
    content: `Bạn đã gia hạn thành công gói "${plan.nameVi || plan.nameEn}".`,
    relatedId: existingActive._id,
    relatedType: 'Membership',
    redirectUrl: '/my-membership',
    createdBy: source === 'staff' ? 'Staff' : 'System',
  }).catch(err => console.error('Notify renewal failed:', err.message))

  if (user.email) {
    const nextPeriodIndex = await MembershipPeriod.countDocuments({ membershipId: existingActive._id }) + 1
    sendRenewalSuccessEmail({
      toEmail: user.email,
      userName: user.fullName || user.name || user.email,
      planName: plan.nameVi || plan.nameEn,
      endDate: periodEnd,
      periodIndex: nextPeriodIndex,
    }).catch((e) => console.error('Gửi email gia hạn thất bại:', e.message))
  }

  // === MembershipCycle integration (renew) ===
  const activeCycle = await MembershipCycle.findOne({
    memberId, status: { $in: ['active', 'pending'] },
  }).sort({ createdAt: -1 }).lean()

  if (activeCycle) {
    if (activeCycle.activatedAt) {
      // Activated → extend endDate
      await MembershipCycle.updateOne(
        { _id: activeCycle._id },
        {
          $inc: { durationDays: plan.durationDays },
          $set: {
            currentMembershipId: existingActive._id,
            currentPlanId: planObjectId,
            endDate: periodEnd,
          },
        },
      )
    } else {
      // Not activated → just increase duration
      await MembershipCycle.updateOne(
        { _id: activeCycle._id },
        {
          $inc: { durationDays: plan.durationDays },
          $set: {
            currentMembershipId: existingActive._id,
            currentPlanId: planObjectId,
          },
        },
      )
    }
  } else {
    await MembershipCycle.create({
      memberId,
      currentMembershipId: existingActive._id,
      currentPlanId: planObjectId,
      purchasedAt: new Date(),
      durationDays: plan.durationDays,
      status: 'active',
      refundEligible: true,
    })
  }

  await PlanChangeHistory.create({
    memberId,
    membershipId: existingActive._id,
    fromPlanId: null,
    toPlanId: planObjectId,
    changedAt: new Date(),
    changeType: 'renew',
    type: 'renew',
    amount: plan.price || 0,
    priceDifference: 0,
    proratedValue: 0,
    proratedCredit: 0,
    walletCredit: 0,
  })
  // === end MembershipCycle integration ===

  const populated = await Membership.findById(existingActive._id).populate('planId')
  return serializeMembership({ ...populated.toObject(), planId: plan.toObject() })
}

const createManualRegistration = async ({ userId, planId }) => {
  const { user, plan } = await ensureMemberAndPlan({ userId, planId })

  await assertPurchaseEligibility(user._id, 'register')

  const existingActive = await MembershipCycle.findOne({
    memberId: user._id, status: 'active',
  })
  if (existingActive) {
    const error = new Error('Bạn đang có gói tập active. Vui lòng gia hạn trong trang Gói tập của tôi.')
    error.statusCode = 400
    throw error
  }

  const existingPending = await MembershipRegistration.findOne({
    userId: user._id,
    planId: plan._id,
    status: 'pending',
  })
  if (existingPending) {
    return {
      mode: 'manual',
      registration: existingPending,
      message: 'Bạn đã có yêu cầu đăng ký đang chờ xác nhận.',
    }
  }

  const registration = await MembershipRegistration.create({
    userId: user._id,
    planId: plan._id,
    status: 'pending',
  })

  const payment = await Payment.createWithIdempotency({
    userId: user._id,
    planId: plan._id,
    registrationId: registration._id,
    amount: plan.price,
    currency: 'vnd',
    status: 'PENDING',
    paymentMethod: 'MANUAL',
    idempotencyKey: `reg_${registration._id}`,
  })

  return {
    mode: 'manual',
    registration,
    payment,
    plan: serializePlan(plan),
    message: 'Đã tạo yêu cầu đăng ký. Staff sẽ liên hệ để hướng dẫn thanh toán.',
  }
}

const createCheckoutSession = async ({ userId, planId, mode = 'register' }) => {
  if (!stripe) {
    const error = new Error('Stripe chưa được cấu hình')
    error.statusCode = 500
    throw error
  }

  const { user, plan } = await ensureMemberAndPlan({ userId, planId })

  await assertPurchaseEligibility(user._id, mode)

  if (mode === 'register') {
    const existingActive = await MembershipCycle.findOne({
      memberId: user._id, status: 'active',
    })
    if (existingActive) {
      const error = new Error('Bạn đang có gói tập active. Vui lòng gia hạn trong trang Gói tập của tôi.')
      error.statusCode = 400
      throw error
    }
  }

  if (mode === 'renew') {
    await createActivatedMembershipDryRun({ userId: user._id, planId: plan._id })
  }

  const payment = await Payment.createWithIdempotency({
    userId: user._id,
    planId: plan._id,
    amount: plan.price,
    currency: 'vnd',
    status: 'PENDING',
    paymentMethod: 'STRIPE',
    source: 'ONLINE',
    idempotencyKey: `stripe_checkout_${user._id}_${Date.now()}`,
    metadata: { mode },
  })

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'vnd',
          product_data: {
            name: plan.nameVi || plan.nameEn,
            description: `${plan.durationDays} ngày`,
          },
          unit_amount: Math.round(Number(plan.price)),
        },
        quantity: 1,
      },
    ],
    metadata: {
      paymentId: payment._id.toString(),
      userId: user._id.toString(),
      planId: plan._id.toString(),
      mode,
    },
    success_url: buildClientUrl('/my-membership', { payment: 'success', session_id: '{CHECKOUT_SESSION_ID}' }),
    cancel_url: buildClientUrl(mode === 'renew' ? '/my-membership' : '/plans', { payment: 'cancelled' }),
  })

  payment.stripeSessionId = session.id
  payment.metadata = { ...(payment.metadata || {}), stripeUrl: session.url }
  await payment.save()

  return {
    mode: 'stripe',
    checkoutUrl: session.url,
    sessionId: session.id,
    paymentId: payment._id,
  }
}

const createActivatedMembershipDryRun = async ({ userId, planId }) => {
  const { user, plan } = await ensureMemberAndPlan({ userId, planId })
  const activeCycle = await MembershipCycle.findOne({
    memberId: user._id, status: 'active',
  }).populate('currentPlanId')
  if (!activeCycle) {
    const error = new Error('Bạn chưa có gói tập để gia hạn. Vui lòng đăng ký gói mới.')
    error.statusCode = 400
    throw error
  }
  const cyclePlanId = activeCycle.currentPlanId?._id || activeCycle.currentPlanId
  if (String(cyclePlanId) !== String(plan._id)) {
    const error = new Error('Chỉ có thể gia hạn gói tập hiện tại.')
    error.statusCode = 400
    throw error
  }
  if (calculateRemainingDays(activeCycle.expiresAt) >= 30) {
    const error = new Error('Chỉ được gia hạn khi còn dưới 30 ngày hoặc đã hết hạn.')
    error.statusCode = 400
    throw error
  }
}

const createMembership = async ({ userId, planId }) => {
  const settings = await getSystemSettingsValue()
  if (settings.billing?.onlinePaymentEnabled) {
    return createCheckoutSession({ userId, planId, mode: 'register' })
  }
  return createManualRegistration({ userId, planId })
}

const createRenewalCheckoutSession = async ({ userId }) => {
  const activeCycle = await MembershipCycle.findOne({
    memberId: toObjectId(userId, 'userId'), status: 'active',
  }).populate('currentPlanId')
  if (!activeCycle) {
    const error = new Error('Bạn chưa có gói tập để gia hạn.')
    error.statusCode = 404
    throw error
  }
  const planId = activeCycle.currentPlanId?._id || activeCycle.currentPlanId
  return createCheckoutSession({ userId, planId, mode: 'renew' })
}

const completeStripeCheckoutSession = async (session) => {
  const stripeSessionId = session.id
  const payment = await Payment.findOne({ stripeSessionId })
  if (!payment) return null
  if ((payment.status === 'PAID' || payment.status === 'paid') && payment.membershipId) return payment

  const mode = session.metadata?.mode || payment.metadata?.mode || 'register'
  payment.status = 'PAID'
  payment.paidAt = new Date()
  payment.paymentMethod = 'STRIPE'
  payment.metadata = {
    ...(payment.metadata || {}),
    stripePaymentStatus: session.payment_status,
    stripeCustomer: session.customer,
    stripePaymentIntent: session.payment_intent,
  }
  await payment.save()

  const membership = await createActivatedMembership({
    userId: payment.userId,
    planId: payment.planId,
    source: 'stripe',
    paymentId: payment._id,
    mode,
  })

  payment.membershipId = membership.id
  await payment.save()

  createNotification({
    receiverId: payment.userId,
    receiverRole: 'member',
    notificationType: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
    title: 'Thanh toán Stripe thành công',
    content: `Thanh toán gói tập qua Stripe đã hoàn tất.`,
    relatedId: membership.id,
    relatedType: 'Membership',
    redirectUrl: '/my-membership',
    createdBy: 'System',
  }).catch(err => console.error('Notify stripe success failed:', err.message))

  return payment
}

const handleMembershipStripeWebhook = async ({ rawBody, signature }) => {
  if (!stripe) {
    const error = new Error('Stripe chưa được cấu hình')
    error.statusCode = 500
    throw error
  }

  const webhookSecret = process.env.STRIPE_MEMBERSHIP_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET
  let event
  if (webhookSecret) {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } else {
    const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : JSON.stringify(rawBody)
    event = JSON.parse(body)
  }

  if (event.type === 'checkout.session.completed') {
    await completeStripeCheckoutSession(event.data.object)
  }

  return event
}

const confirmRegistration = async ({ registrationId, staffId }) => {
  const registration = await MembershipRegistration.findById(registrationId)
  if (!registration) {
    const error = new Error('Không tìm thấy yêu cầu đăng ký')
    error.statusCode = 404
    throw error
  }
  if (registration.status !== 'pending') {
    const error = new Error('Yêu cầu đăng ký đã được xử lý')
    error.statusCode = 400
    throw error
  }

  const membership = await createActivatedMembership({
    userId: registration.userId,
    planId: registration.planId,
    source: 'staff',
    mode: 'register',
  })

  registration.status = 'confirmed'
  registration.confirmedBy = staffId
  registration.confirmedAt = new Date()
  registration.membershipId = membership.id
  await registration.save()

  createNotification({
    receiverId: registration.userId,
    receiverRole: 'member',
    notificationType: NOTIFICATION_TYPES.MEMBERSHIP_ACTIVATED,
    title: 'Gói tập đã được kích hoạt',
    content: `Yêu cầu đăng ký gói tập của bạn đã được staff xác nhận.`,
    relatedId: membership.id,
    relatedType: 'Membership',
    redirectUrl: '/my-membership',
    createdBy: 'Staff',
  }).catch(err => console.error('Notify confirm registration failed:', err.message))

  await Payment.updateOne(
    { registrationId: registration._id, status: 'PENDING' },
    { $set: { status: 'PAID', paidAt: new Date(), membershipId: membership.id } },
  )

  return { registration, membership }
}

const cancelRegistration = async ({ registrationId, staffId, reason = '' }) => {
  const registration = await MembershipRegistration.findById(registrationId)
  if (!registration) {
    const error = new Error('Không tìm thấy yêu cầu đăng ký')
    error.statusCode = 404
    throw error
  }
  if (registration.status !== 'pending') {
    const error = new Error('Yêu cầu đăng ký đã được xử lý')
    error.statusCode = 400
    throw error
  }

  registration.status = 'cancelled'
  registration.cancelledBy = staffId
  registration.cancelledAt = new Date()
  registration.rejectionReason = String(reason || '').trim()
  await registration.save()

  await Payment.updateOne(
    { registrationId: registration._id, status: 'PENDING' },
    { $set: { status: 'FAILED' } },
  )

  createNotification({
    receiverId: registration.userId,
    receiverRole: 'member',
    notificationType: NOTIFICATION_TYPES.MEMBERSHIP_ACTIVATED,
    title: 'Yêu cầu đăng ký gói tập bị từ chối',
    content: `Yêu cầu đăng ký gói tập của bạn đã bị từ chối. Lý do: ${reason || 'Không có lý do.'}`,
    relatedId: registration._id,
    relatedType: 'MembershipRegistration',
    redirectUrl: '/plans',
    createdBy: 'Staff',
  }).catch(err => console.error('Notify cancel registration failed:', err.message))

  return registration
}

const listRegistrations = async ({ page = 1, limit = 50, status, search, paymentStatus, fromDate, toDate }) => {
  const filter = {}

  if (status) filter.status = status

  if (search) {
    const keyword = String(search).trim()
    const [matchingUsers, matchingPlans] = await Promise.all([
      User.find({
        $or: [
          { fullName: { $regex: keyword, $options: 'i' } },
          { name: { $regex: keyword, $options: 'i' } },
          { email: { $regex: keyword, $options: 'i' } },
          { phone: { $regex: keyword, $options: 'i' } },
          { memberCode: { $regex: keyword, $options: 'i' } },
        ],
      }).select('_id').lean(),
      Plan.find({
        $or: [
          { nameVi: { $regex: keyword, $options: 'i' } },
          { nameEn: { $regex: keyword, $options: 'i' } },
        ],
      }).select('_id').lean(),
    ])
    const userIds = matchingUsers.map((u) => u._id)
    const planIds = matchingPlans.map((p) => p._id)
    const orConditions = []
    if (userIds.length) orConditions.push({ userId: { $in: userIds } })
    if (planIds.length) orConditions.push({ planId: { $in: planIds } })
    if (orConditions.length) {
      filter.$or = orConditions
    }
  }

  if (fromDate || toDate) {
    const dateFilter = {}
    if (fromDate) dateFilter.$gte = new Date(fromDate)
    if (toDate) {
      const end = new Date(toDate)
      end.setHours(23, 59, 59, 999)
      dateFilter.$lte = end
    }
    filter.createdAt = dateFilter
  }

  if (paymentStatus) {
    const paymentFilter = { registrationId: { $ne: null } }
    if (paymentStatus === 'PAID' || paymentStatus === 'paid') {
      paymentFilter.status = { $in: ['PAID', 'paid'] }
      const paidPayments = await Payment.find(paymentFilter).select('registrationId').lean()
      const paidRegIds = paidPayments.map((p) => p.registrationId).filter(Boolean)
      filter._id = { $in: paidRegIds }
    } else {
      const paidPayments = await Payment.find({
        registrationId: { $ne: null },
        status: { $in: ['PAID', 'paid'] },
      }).select('registrationId').lean()
      const paidRegIds = new Set(paidPayments.map((p) => String(p.registrationId)))
      const allRegs = await MembershipRegistration.find(filter).select('_id').lean()
      const unpaidRegIds = allRegs
        .map((r) => r._id)
        .filter((id) => !paidRegIds.has(String(id)))
      filter._id = { $in: unpaidRegIds }
    }
  }

  const skip = (Number(page) - 1) * Number(limit)
  const [items, total] = await Promise.all([
    MembershipRegistration.find(filter)
      .populate('userId', 'name fullName email phone memberCode memberNumber')
      .populate('planId', 'nameVi nameEn price durationDays')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    MembershipRegistration.countDocuments(filter),
  ])

  const registrationIds = items.map((r) => r._id)
  const payments = registrationIds.length > 0
    ? await Payment.find({ registrationId: { $in: registrationIds } }).lean()
    : []
  const paymentByRegId = {}
  for (const p of payments) {
    paymentByRegId[String(p.registrationId)] = p
  }

  return {
    registrations: items.map((item) => {
      const raw = item.toObject ? item.toObject() : item
      const payment = paymentByRegId[String(raw._id)]
      return {
        ...raw,
        userId: normalizeUserMemberIdentity(raw.userId),
        paymentStatus: payment?.status || null,
        paymentMethod: payment?.paymentMethod || null,
      }
    }),
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  }
}

const listPayments = async ({ page = 1, limit = 20, status }) => {
  const filter = {}
  if (status) filter.status = status
  const skip = (Number(page) - 1) * Number(limit)
  const [items, total] = await Promise.all([
    Payment.find(filter)
      .populate('userId', 'name fullName email phone memberCode memberNumber')
      .populate('planId', 'nameVi nameEn price durationDays')
      .populate('membershipId', 'startDate endDate status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Payment.countDocuments(filter),
  ])
  return {
    payments: items.map((item) => {
      const raw = item.toObject ? item.toObject() : item
      return { ...raw, userId: normalizeUserMemberIdentity(raw.userId) }
    }),
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  }
}

const getMyMembership = async ({ userId }) => {
  const memberId = toObjectId(userId, 'userId')

  // Priority query: active → pending_initial_activation → pending_renewal_activation
  // KHÔNG dùng $in vì nếu member có cả active + pending, findOne có thể trả sai cycle
  let displayCycle = await MembershipCycle.findOne({ memberId, status: 'active' })
    .populate({ path: 'currentPlanId', populate: { path: 'featureIds', model: 'PlanFeature' } })
    .sort({ createdAt: -1 })
    .lean()

  if (!displayCycle) {
    displayCycle = await MembershipCycle.findOne({ memberId, status: 'pending_initial_activation' })
      .populate({ path: 'currentPlanId', populate: { path: 'featureIds', model: 'PlanFeature' } })
      .sort({ createdAt: -1 })
      .lean()
  }

  if (!displayCycle) {
    displayCycle = await MembershipCycle.findOne({ memberId, status: 'pending_renewal_activation' })
      .populate({ path: 'currentPlanId', populate: { path: 'featureIds', model: 'PlanFeature' } })
      .sort({ createdAt: -1 })
      .lean()
  }

  // Membership container (cho serializeMembership và cancel request)
  const membership = displayCycle
    ? await Membership.findById(displayCycle.currentMembershipId)
        .populate({ path: 'planId', populate: { path: 'featureIds', model: 'PlanFeature' } })
    : null

  // Pending cycles (chờ kích hoạt) — exclude the one we're already displaying
  const pendingCycles = displayCycle && (displayCycle.status === 'active' || displayCycle.status === 'pending_renewal_activation')
    ? await MembershipCycle.find({
        memberId,
        status: { $in: ['pending_initial_activation', 'pending_renewal_activation'] },
        _id: { $ne: displayCycle._id },
      }).sort({ createdAt: 1 }).lean()
    : []

  // Cancel request pending (Commit 6 sẽ refactor)
  let pendingCancelRequest = null
  if (membership) {
    const pendingRefund = await RefundRequest.findOne({
      membershipId: membership._id,
      status: 'PENDING',
    }).sort({ createdAt: -1 })
    if (pendingRefund) {
      pendingCancelRequest = {
        id: pendingRefund._id,
        reason: pendingRefund.reason,
        refundAmount: pendingRefund.refundAmount,
        status: pendingRefund.status,
        requestedAt: pendingRefund.requestedAt,
        createdAt: pendingRefund.createdAt,
      }
    }
  }

  // Estimated dates cho pending cycles
  let lastEndDate = displayCycle?.expiresAt || null
  const pendingWithEstimates = pendingCycles.map((c) => {
    let estimatedActivation = null
    let estimatedExpiry = null
    if (lastEndDate) {
      estimatedActivation = new Date(lastEndDate)
      estimatedActivation.setDate(estimatedActivation.getDate() + 1)
      estimatedExpiry = new Date(estimatedActivation)
      estimatedExpiry.setDate(estimatedExpiry.getDate() + Math.max(c.durationDays || 30, 1) - 1)
    }
    lastEndDate = estimatedExpiry || lastEndDate
    return {
      purchasedAt: c.purchasedAt,
      durationDays: c.durationDays,
      currentPlanId: c.currentPlanId,
      estimatedActivationDate: estimatedActivation,
      estimatedExpiryDate: estimatedExpiry,
      refundEligible: c.refundEligible,
    }
  })

  const isActive = displayCycle?.status === 'active'

  return {
    membership: serializeMembership(membership, displayCycle),
    canRenew: isActive,
    renewalThresholdDays: membership ? await getRenewalThresholdDays() : 7,
    pendingCancelRequest,
    cycle: displayCycle ? {
      purchasedAt: displayCycle.purchasedAt,
      activatedAt: displayCycle.activatedAt,
      expiresAt: displayCycle.expiresAt,
      refundEligible: displayCycle.refundEligible,
      refundExpiredAt: displayCycle.refundExpiredAt,
      durationDays: displayCycle.durationDays,
      startDate: displayCycle.startDate,
      status: displayCycle.status,
      currentPlanId: displayCycle.currentPlanId?._id || displayCycle.currentPlanId,
    } : null,
    pendingCycles: pendingWithEstimates,
  }
}

const renewMembershipWithWallet = async ({ userId }) => {
  const memberId = toObjectId(userId, 'userId')
  const activeCycle = await MembershipCycle.findOne({
    memberId, status: 'active',
  }).populate('currentPlanId')
  if (!activeCycle) {
    const error = new Error('Bạn chưa có gói tập để gia hạn.')
    error.statusCode = 404
    throw error
  }
  await assertRenewalAllowed(activeCycle.expiresAt)
  const planId = activeCycle.currentPlanId?._id || activeCycle.currentPlanId
  return subscribeWithWallet({ userId, planId, mode: 'renew' })
}

const renewMembershipWithDuration = async ({ userId, durationMultiplier = 1 }) => {
  const memberId = toObjectId(userId, 'userId')
  const activeCycle = await MembershipCycle.findOne({
    memberId, status: 'active',
  }).populate('currentPlanId')
  if (!activeCycle) {
    const error = new Error('Bạn chưa có gói tập để gia hạn.')
    error.statusCode = 404
    throw error
  }

  await assertRenewalAllowed(activeCycle.expiresAt)

  return subscribeWithWallet({
    userId,
    planId: activeCycle.currentPlanId?._id || activeCycle.currentPlanId,
    mode: 'renew',
    durationMultiplier,
  })
}

const getMyRenewals = async ({ userId }) => {
  const memberId = toObjectId(userId, 'userId')
  const renewals = await MembershipRenewal.find({ memberId })
    .populate('planId', 'nameVi nameEn price durationDays')
    .sort({ renewedAt: -1 })
  return renewals
}

const cancelRenewal = async ({ userId, renewalId }) => {
  const memberId = toObjectId(userId, 'userId')
  const renewal = await MembershipRenewal.findById(renewalId).populate('planId', 'nameVi nameEn price')
  if (!renewal) {
    const error = new Error('Không tìm thấy lần gia hạn.')
    error.statusCode = 404
    throw error
  }

  if (String(renewal.memberId) !== String(memberId)) {
    const error = new Error('Không có quyền hủy lần gia hạn này.')
    error.statusCode = 403
    throw error
  }

  if (renewal.status !== 'ACTIVE') {
    const error = new Error('Lần gia hạn này đã được xử lý.')
    error.statusCode = 400
    throw error
  }

  // Chỉ cho phép hủy lần gia hạn mới nhất
  const latestActive = await MembershipRenewal.findOne({
    membershipId: renewal.membershipId,
    status: 'ACTIVE',
  }).sort({ renewedAt: -1 })

  if (!latestActive || String(latestActive._id) !== String(renewal._id)) {
    const error = new Error('Chỉ có thể hủy lần gia hạn mới nhất.')
    error.statusCode = 400
    throw error
  }

  const session = await mongoose.startSession()
  let committed = false

  try {
    session.startTransaction()

    // Cập nhật status renewal
    renewal.status = 'CANCELLED'
    await renewal.save({ session })

    const membership = await Membership.findById(renewal.membershipId).session(session).populate('planId')
    if (!membership) {
      const error = new Error('Không tìm thấy gói tập.')
      error.statusCode = 404
      throw error
    }

    // Hoàn tiền: cộng vào ví
    const refundAmount = renewal.price
    if (refundAmount > 0) {
      await applyWalletTransaction({
        userId: memberId,
        amount: refundAmount,
        type: 'REFUND_TO_WALLET',
        provider: 'wallet',
        source: 'membership',
        description: `Hoàn tiền hủy gia hạn (+${renewal.days} ngày)`,
        referenceId: renewal._id.toString(),
        status: 'completed',
        metadata: {
          renewalId: renewal._id,
          membershipId: membership._id,
          renewalDays: renewal.days,
          renewalPrice: renewal.price,
        },
        idempotencyKey: `cancel_renewal_refund_${renewal._id}`,
        session,
      })
    }

    await recordUserActivity({
      userId: memberId,
      type: 'membership',
      title: 'Hủy lần gia hạn',
      description: `Đã hủy lần gia hạn +${renewal.days} ngày. Hoàn tiền: ${refundAmount.toLocaleString('vi-VN')}đ`,
      metadata: { renewalId: renewal._id, membershipId: membership._id, refundAmount },
      session,
    })

    await session.commitTransaction()
    committed = true

    createNotification({
      receiverId: memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.REFUND_APPROVED,
      title: 'Hủy gia hạn và hoàn tiền',
      content: `Bạn đã hủy lần gia hạn +${renewal.days} ngày. Đã hoàn ${refundAmount.toLocaleString('vi-VN')}đ vào ví.`,
      relatedId: renewal._id,
      relatedType: 'MembershipRenewal',
      redirectUrl: '/my-membership',
      createdBy: 'System',
    }).catch(err => console.error('Notify cancel renewal failed:', err.message))

    const planName = renewal.planId?.nameVi || renewal.planId?.nameEn || ''
    const cancelUser = await User.findById(memberId).select('email fullName name')
    if (cancelUser?.email) {
      sendCancelRenewalEmail({
        toEmail: cancelUser.email,
        userName: cancelUser.fullName || cancelUser.name || cancelUser.email,
        planName,
        days: renewal.days,
        refundAmount,
      }).catch((e) => console.error('Gửi email hủy gia hạn thất bại:', e.message))
    }

    return {
      message: `Đã hủy lần gia hạn +${renewal.days} ngày và hoàn ${refundAmount.toLocaleString('vi-VN')}đ vào ví.`,
      membership: serializeMembership(membership),
      renewal,
    }
  } catch (error) {
    if (!committed) await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}

const rebuildMembershipTimeline = async ({ membershipId, session = null }) => {
  const query = MembershipPeriod.find({
    membershipId,
    status: { $nin: ['CANCELLED', 'REFUNDED', 'CANCEL_REQUESTED'] },
  }).sort({ createdAt: 1 })
  if (session) query.session(session)
  const periods = await query

  if (periods.length === 0) return

  // Fix period[0] nếu startDate >= endDate (dữ liệu bị lỗi)
  const p0 = periods[0]
  if (new Date(p0.startDate).getTime() >= new Date(p0.endDate).getTime()) {
    const correctedEnd = calcMembershipEndDate({
      baseDate: p0.startDate,
      durationDays: p0.totalDays,
    })
    p0.endDate = correctedEnd
    if (session) {
      await p0.save({ session })
    } else {
      await p0.save()
    }
  }

  let prevEnd = endOfDayVN(periods[0].endDate)

  for (let i = 1; i < periods.length; i++) {
    const period = periods[i]

    const newStart = new Date(prevEnd)
    newStart.setDate(newStart.getDate() + 1)
    newStart.setHours(0, 0, 0, 0)

    const newEnd = calcMembershipEndDate({
      baseDate: newStart,
      durationDays: period.totalDays,
    })

    if (
      new Date(period.startDate).getTime() !== newStart.getTime() ||
      new Date(period.endDate).getTime() !== newEnd.getTime()
    ) {
      period.startDate = newStart
      period.endDate = newEnd
      if (session) {
        await period.save({ session })
      } else {
        await period.save()
      }
    }

    prevEnd = endOfDayVN(newEnd)
  }

}

const lazyActivatePendingPeriods = async ({ memberId, session = null }) => {
  const now = new Date()

  // 1. Tìm membership hiện tại của member
  const membership = await Membership.findOne({
    memberId,
    status: { $in: ['active', 'expired'] },
  }).populate('planId', 'nameVi nameEn')
  if (!membership) return

  // 2. Tìm tất cả các periods thuộc membership này (ngoại trừ các kỳ bị hủy/hoàn tiền)
  // Sắp xếp theo startDate tăng dần
  const query = MembershipPeriod.find({
    membershipId: membership._id,
    status: { $nin: ['CANCELLED', 'REFUNDED', 'CANCEL_REQUESTED'] },
  }).sort({ startDate: 1 })
  if (session) query.session(session)
  const periods = await query

  let activePeriod = periods.find((p) => p.status === 'ACTIVE')

  // Lấy thông tin user và plan để gửi email
  const planName = membership.planId?.nameVi || membership.planId?.nameEn || ''

  // 3. Nếu kỳ ACTIVE hiện tại đã hết hạn (endDate < now)
  if (activePeriod && new Date(activePeriod.endDate) < now) {
    const completedPeriod = activePeriod
    const periodIndex = periods.findIndex((p) => p._id.toString() === completedPeriod._id.toString()) + 1
    const completedEndDate = completedPeriod.endDate
    completedPeriod.status = 'COMPLETED'
    completedPeriod.completedAt = now
    if (session) {
      await completedPeriod.save({ session })
    } else {
      await completedPeriod.save()
    }
    activePeriod = null

    // Gửi email thông báo kỳ đã kết thúc
    if (!session) {
      const user = await User.findById(memberId).select('email fullName name')
      if (user?.email) {
        sendPeriodCompletedEmail({
          toEmail: user.email,
          userName: user.fullName || user.name || user.email,
          planName,
          periodIndex,
          endDate: completedEndDate,
        }).catch((e) => console.error('Gửi email kết thúc kỳ thất bại:', e.message))
      }
    }
  }

  // 4. Nếu không có kỳ ACTIVE (do chưa kích hoạt hoặc do vừa hết hạn ở bước trên)
  if (!activePeriod) {
    // Tìm kỳ PENDING tiếp theo gần nhất có startDate <= now
    const nextPending = periods.find((p) => p.status === 'PENDING' && new Date(p.startDate) <= now)
    if (nextPending) {
      const periodIndex = periods.findIndex((p) => p._id.toString() === nextPending._id.toString()) + 1
      nextPending.status = 'ACTIVE'
      nextPending.activatedAt = now
      if (session) {
        await nextPending.save({ session })
      } else {
        await nextPending.save()
      }
      activePeriod = nextPending

      // Gửi email thông báo kỳ mới đã được kích hoạt
      if (!session) {
        const user = await User.findById(memberId).select('email fullName name')
        if (user?.email) {
          sendPeriodActivatedEmail({
            toEmail: user.email,
            userName: user.fullName || user.name || user.email,
            planName,
            periodIndex,
            startDate: nextPending.startDate,
            endDate: nextPending.endDate,
          }).catch((e) => console.error('Gửi email kích hoạt kỳ mới thất bại:', e.message))
        }
      }
    }
  }

  // 5. Cập nhật Membership dựa trên activePeriod hiện tại
  if (activePeriod) {
    if (membership.status === 'expired') {
      membership.status = 'active'
    }
    if (session) {
      await membership.save({ session })
    } else {
      await membership.save()
    }
  } else {
    // Nếu không còn kỳ ACTIVE nào (tất cả các kỳ đều đã COMPLETED hoặc CANCELLED), chuyển trạng thái Membership sang expired
    const allCompletedOrCancelled = periods.every((p) =>
      ['COMPLETED', 'CANCELLED', 'REFUNDED', 'CANCEL_REQUESTED', 'REJECTED'].includes(p.status)
    )
    if (allCompletedOrCancelled && membership.status !== 'expired') {
      membership.status = 'expired'
      if (session) {
        await membership.save({ session })
        await cleanupMemberPTData({ memberId: membership.memberId, session })
      } else {
        await membership.save()
        await cleanupMemberPTData({ memberId: membership.memberId })
      }
    }
  }
}

const getMyPeriods = async ({ userId }) => {
  const memberId = toObjectId(userId, 'userId')
  await lazyActivatePendingPeriods({ memberId })

  // Tìm cycle hiện tại theo thứ tự ưu tiên (giống getMyMembership)
  let displayCycle = await MembershipCycle.findOne({ memberId, status: 'active' })
    .select('currentMembershipId').sort({ createdAt: -1 }).lean()

  if (!displayCycle) {
    displayCycle = await MembershipCycle.findOne({ memberId, status: 'pending_initial_activation' })
      .select('currentMembershipId').sort({ createdAt: -1 }).lean()
  }

  if (!displayCycle) {
    displayCycle = await MembershipCycle.findOne({ memberId, status: 'pending_renewal_activation' })
      .select('currentMembershipId').sort({ createdAt: -1 }).lean()
  }

  // Chỉ lấy periods thuộc membership hiện tại, không lấy toàn bộ periods của user
  const filter = { memberId }
  if (displayCycle?.currentMembershipId) {
    filter.membershipId = displayCycle.currentMembershipId
  } else {
    // Không có cycle nào → không có periods
    return []
  }

  const periods = await MembershipPeriod.find(filter)
    .populate('planId', 'nameVi nameEn price durationDays')
    .sort({ startDate: 1 })

  const { default: RefundRequest } = await import('../models/RefundRequest.js')
  const periodIds = periods.map(p => p._id)
  const refundRequests = await RefundRequest.find({
    membershipPeriodId: { $in: periodIds },
    status: { $in: ['PENDING', 'REJECTED'] },
  }).sort({ createdAt: -1 }).lean()

  const refundByPeriod = {}
  for (const rr of refundRequests) {
    const key = String(rr.membershipPeriodId)
    if (!refundByPeriod[key]) refundByPeriod[key] = rr
  }

  return periods.map((p) => {
    const pObj = p.toObject ? p.toObject() : p
    pObj.displayStatus = computePeriodStatus(p)
    pObj.canCancel = pObj.displayStatus === 'PENDING' || pObj.displayStatus === 'REJECTED'
    pObj.isFirst = false

    const rr = refundByPeriod[String(p._id)]
    if (rr) {
      if (rr.status === 'PENDING') {
        pObj.hasPendingRequest = true
      } else if (rr.status === 'REJECTED') {
        pObj.rejectionReason = rr.staffNote || ''
      }
    }

    return pObj
  })
}

const refundPeriodToWallet = async ({ period, session }) => {
  if (!period.price || period.price <= 0) return 0

  await applyWalletTransaction({
    userId: period.memberId,
    amount: period.price,
    type: 'REFUND_TO_WALLET',
    provider: 'wallet',
    source: 'membership',
    description: `Hoàn tiền kỳ hạn (+${period.totalDays} ngày)`,
    referenceId: period._id.toString(),
    status: 'completed',
    metadata: {
      periodId: period._id,
      membershipId: period.membershipId,
      periodDays: period.totalDays,
      periodPrice: period.price,
    },
    idempotencyKey: `period_refund_${period._id}`,
    session,
  })

  return period.price
}

const cancelPeriod = async ({ userId, periodId, reason = '' }) => {
  const { createRefundRequest } = await import('./refundRequestService.js')
  return createRefundRequest({ userId, periodId, reason })
}

const autoCancelPendingPeriod = async ({ userId, periodId }) => {
  const memberId = toObjectId(userId, 'userId')
  const periodIdObj = toObjectId(periodId, 'periodId')

  const period = await MembershipPeriod.findById(periodIdObj)
  if (!period) {
    const error = new Error('Không tìm thấy kỳ gia hạn.')
    error.statusCode = 404
    throw error
  }

  if (String(period.memberId) !== String(memberId)) {
    const error = new Error('Không có quyền hủy kỳ gia hạn này.')
    error.statusCode = 403
    throw error
  }

  // Chỉ cho phép hủy kỳ chưa bắt đầu (PENDING)
  const now = Date.now()
  const start = new Date(period.startDate).getTime()
  if (now >= start) {
    const error = new Error('Gói gia hạn đã bắt đầu sử dụng nên không thể hủy.')
    error.statusCode = 400
    throw error
  }

  if (period.status !== 'PENDING') {
    const error = new Error('Gói gia hạn đã được xử lý trước đó.')
    error.statusCode = 400
    throw error
  }

  const session = await mongoose.startSession()
  let committed = false
  try {
    session.startTransaction()

    const refundAmount = period.price || 0

    // Hoàn tiền vào ví
    if (refundAmount > 0) {
      await applyWalletTransaction({
        userId: memberId,
        amount: refundAmount,
        type: 'REFUND_TO_WALLET',
        provider: 'wallet',
        source: 'membership',
        description: `Hoàn tiền hủy gia hạn (+${period.totalDays} ngày)`,
        referenceId: period._id.toString(),
        status: 'completed',
        metadata: { periodId: period._id, membershipId: period.membershipId, periodDays: period.totalDays, periodPrice: period.price },
        idempotencyKey: `auto_cancel_period_${period._id}`,
        session,
      })
    }

    // Cập nhật period status + refund info
    period.status = 'CANCELLED'
    period.refundStatus = refundAmount > 0 ? 'refunded' : 'none'
    period.refundAmount = refundAmount
    period.refundAt = refundAmount > 0 ? new Date() : null
    period.refundMethod = refundAmount > 0 ? 'WALLET' : null
    await period.save({ session })

    await recordUserActivity({
      userId: memberId,
      type: 'membership',
      title: 'Hủy kỳ gia hạn',
      description: `Đã hủy kỳ gia hạn (+${period.totalDays} ngày). Hoàn tiền: ${refundAmount.toLocaleString('vi-VN')}đ`,
      metadata: { periodId: period._id, membershipId: period.membershipId, refundAmount },
      session,
    })

    createNotification({
      receiverId: memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.REFUND_APPROVED,
      title: 'Hủy gia hạn thành công',
      content: `Đã hủy gia hạn (+${period.totalDays} ngày). ${refundAmount > 0 ? `Đã hoàn ${refundAmount.toLocaleString('vi-VN')}đ vào ví.` : ''}`,
      relatedId: period._id,
      relatedType: 'MembershipPeriod',
      redirectUrl: '/my-membership',
      createdBy: 'System',
    }).catch(() => {})

    await session.commitTransaction()
    committed = true

    return { message: refundAmount > 0 ? `Đã hủy gói gia hạn thành công. ${refundAmount.toLocaleString('vi-VN')}đ đã được hoàn vào Ví GymPro.` : 'Đã hủy gói gia hạn.', refundAmount }
  } catch (error) {
    if (!committed) await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}

const hasActivePeriod = async ({ memberId }) => {
  const now = new Date()
  const period = await MembershipPeriod.findOne({
    memberId,
    startDate: { $lte: now },
    endDate: { $gte: now },
  }).sort({ endDate: -1 })
  return !!period
}

const getMyHistory = async ({ userId }) => {
  const memberId = toObjectId(userId, 'userId')

  // Timeline từ MembershipCycle
  const cycles = await MembershipCycle.find({ memberId })
    .populate('currentPlanId', 'nameVi nameEn price durationDays')
    .sort({ createdAt: -1 })

  // Gom cycles theo membership
  const membershipIds = [...new Set(cycles.map(c => String(c.currentMembershipId)))]
  const memberships = await Membership.find({ _id: { $in: membershipIds } })
    .populate('planId', 'nameVi nameEn price durationDays')

  const membershipMap = {}
  for (const m of memberships) {
    membershipMap[String(m._id)] = m
  }

  const result = []
  for (const memId of membershipIds) {
    const memCycles = cycles.filter(c => String(c.currentMembershipId) === memId)
    const membership = membershipMap[memId] || null
    result.push({
      membership: serializeMembership(membership, memCycles[0]),
      periods: memCycles.map((c) => {
        const cObj = c.toObject ? c.toObject() : c
        cObj.displayStatus = computeCyclePeriodStatus(c)
        return cObj
      }),
    })
  }
  return result
}

const computeCyclePeriodStatus = (cycle) => {
  if (!cycle) return 'COMPLETED'
  if (['cancelled', 'refunded'].includes(cycle.status)) return cycle.status.toUpperCase()
  const now = Date.now()
  if (cycle.status === 'active') {
    if (cycle.expiresAt && now > new Date(cycle.expiresAt).getTime()) return 'COMPLETED'
    return 'ACTIVE'
  }
  if (cycle.status === 'pending_initial_activation' || cycle.status === 'pending_renewal_activation') return 'PENDING'
  return 'COMPLETED'
}

const getMembershipDetail = async ({ userId, membershipId }) => {
  const memberId = toObjectId(userId, 'userId')
  const membershipIdObj = toObjectId(membershipId, 'membershipId')

  const membership = await Membership.findOne({ _id: membershipIdObj, memberId })
    .populate('planId', 'nameVi nameEn price durationDays')

  if (!membership) {
    const error = new Error('Không tìm thấy gói tập.')
    error.statusCode = 404
    throw error
  }

  await lazyActivatePendingPeriods({ memberId })

  const periods = await MembershipPeriod.find({ membershipId: membership._id })
    .populate('planId', 'nameVi nameEn price durationDays')
    .sort({ startDate: 1 })

  const refundRequest = await RefundRequest.findOne({ membershipId: membership._id })
    .populate('reviewedBy', 'name fullName')
    .sort({ createdAt: -1 })

  return {
    membership: serializeMembership(membership),
    periods: periods.map((p) => {
      const pObj = p.toObject ? p.toObject() : p
      pObj.displayStatus = computePeriodStatus(p)
      return pObj
    }),
    refundRequest: refundRequest || null,
  }
}

const getCancelInfo = async ({ userId }) => {
  const memberId = toObjectId(userId, 'userId')

  let cycle = await MembershipCycle.findOne({ memberId, status: 'active' })
    .populate('currentPlanId', 'nameVi nameEn price durationDays')
    .sort({ createdAt: -1 }).lean()

  if (!cycle) {
    cycle = await MembershipCycle.findOne({ memberId, status: 'pending_initial_activation' })
      .populate('currentPlanId', 'nameVi nameEn price durationDays')
      .sort({ createdAt: -1 }).lean()
  }

  if (!cycle) {
    const error = new Error('Không tìm thấy gói tập.')
    error.statusCode = 404
    throw error
  }

  const plan = cycle.currentPlanId
  const planPrice = plan?.price || 0

  const membership = cycle.currentMembershipId
    ? await Membership.findById(cycle.currentMembershipId).populate('planId').lean()
    : null

  const membershipForSerialize = membership || {
    _id: cycle._id,
    memberId: cycle.memberId,
    planId: plan,
    status: 'active',
    source: 'manual',
    createdAt: cycle.createdAt,
  }

  let refundEligible = false
  let refundReason = ''

  if (cycle.activatedAt) {
    refundEligible = false
    refundReason = 'Gói tập đã được kích hoạt.'
  } else if (!cycle.refundEligible) {
    refundEligible = false
    refundReason = cycle.refundExpiredAt
      ? 'Đã quá 07 ngày kể từ ngày đăng ký.'
      : 'Quyền hoàn tiền đã hết hiệu lực.'
  } else if (cycle.purchasedAt) {
    const daysSince = Math.floor((Date.now() - new Date(cycle.purchasedAt).getTime()) / 86400000)
    if (daysSince >= 7) {
      refundEligible = false
      refundReason = 'Đã quá 07 ngày kể từ ngày đăng ký.'
    } else {
      refundEligible = true
      const remaining = 7 - daysSince
      refundReason = remaining === 1
        ? 'Hôm nay là ngày cuối để yêu cầu hoàn tiền.'
        : `Còn ${remaining} ngày để yêu cầu hoàn tiền.`
    }
  } else {
    refundEligible = false
    refundReason = 'Không đủ thông tin để xét hoàn tiền.'
  }

  // Lấy tất cả periods để phân tích gói chính và các lần gia hạn
  const allPeriods = cycle.currentMembershipId
    ? await MembershipPeriod.find({ membershipId: cycle.currentMembershipId })
        .sort({ startDate: 1 })
        .lean()
    : []

  // Gói chính = period đầu tiên, các period còn lại = gia hạn
  const mainPeriod = allPeriods[0] || null
  // Chỉ lấy các renewal còn hiệu lực (chưa hủy/chưa hoàn)
  const renewalPeriods = allPeriods.slice(1).filter(p =>
    p.status === 'PENDING' && p.refundStatus !== 'refunded'
  )

  // --- Tính hoàn tiền gói chính ---
  let mainRefundEligible = false
  let mainRefundAmount = 0
  let mainRefundReason = ''

  if (cycle.activatedAt) {
    mainRefundEligible = false
    mainRefundReason = 'Gói chính đã được kích hoạt nên không đủ điều kiện hoàn tiền.'
  } else {
    const effectivePurchaseDate = cycle.purchasedAt || cycle.startDate || cycle.createdAt
    if (effectivePurchaseDate) {
      const daysSince = Math.floor((Date.now() - new Date(effectivePurchaseDate).getTime()) / 86400000)
      if (daysSince < 7) {
        mainRefundEligible = true
        mainRefundAmount = planPrice
        mainRefundReason = 'Gói chính chưa kích hoạt và còn trong thời gian hoàn tiền.'
      } else {
        mainRefundReason = 'Đã quá 07 ngày kể từ ngày đăng ký gói chính.'
      }
    } else {
      mainRefundReason = 'Không đủ thông tin để xét hoàn tiền gói chính.'
    }
  }

  // --- Tính hoàn tiền từng lần gia hạn ---
  const now = Date.now()
  const renewals = renewalPeriods.map((p, idx) => {
    const start = new Date(p.startDate).getTime()
    const end = new Date(p.endDate).getTime()
    let displayStatus
    let refundEligible
    if (now < start) {
      displayStatus = 'Chưa sử dụng'
      refundEligible = true
    } else if (now >= start && now <= end) {
      displayStatus = 'Đang sử dụng'
      refundEligible = false
    } else {
      displayStatus = 'Đã sử dụng'
      refundEligible = false
    }
    const refundAmount = refundEligible ? (p.price || 0) : 0
    return {
      index: idx + 1,
      days: p.totalDays,
      price: p.price || 0,
      startDate: p.startDate,
      endDate: p.endDate,
      status: p.status,
      displayStatus,
      refundEligible,
      refundAmount,
    }
  })

  const renewalsRefundTotal = renewals
    .filter(r => r.refundEligible)
    .reduce((sum, r) => sum + r.refundAmount, 0)

  const totalRefund = mainRefundAmount + renewalsRefundTotal

  return {
    membership: serializeMembership(membershipForSerialize, cycle),
    mainPackage: {
      planName: plan?.nameVi || plan?.nameEn || '',
      price: planPrice,
      status: cycle.activatedAt ? 'Đã kích hoạt' : 'Chưa kích hoạt',
      activatedAt: cycle.activatedAt,
      purchasedAt: cycle.purchasedAt,
      refundEligible: mainRefundEligible,
      refundAmount: mainRefundAmount,
      reason: mainRefundReason,
    },
    renewals,
    totalRefund,
    period: mainPeriod ? {
      startDate: mainPeriod.startDate,
      endDate: mainPeriod.endDate,
      totalDays: mainPeriod.totalDays,
      price: mainPeriod.price,
      activatedAt: mainPeriod.activatedAt,
    } : null,
    refundInfo: {
      eligibleForRefund: mainRefundEligible || renewalsRefundTotal > 0,
      estimatedRefundAmount: totalRefund,
      reason: mainRefundReason || (renewalsRefundTotal > 0 ? 'Có gia hạn chưa sử dụng đủ điều kiện hoàn tiền.' : 'Không có khoản nào đủ điều kiện hoàn tiền.'),
      purchasedAt: cycle.purchasedAt,
      activatedAt: cycle.activatedAt,
    },
    pendingPeriods: [],
    periodsDetail: [],
    totalEstimatedRefund: totalRefund,
  }
}

const getMembershipPeriods = async ({ userId, membershipId }) => {
  const memberId = toObjectId(userId, 'userId')
  const membershipIdObj = toObjectId(membershipId, 'membershipId')

  const membership = await Membership.findOne({ _id: membershipIdObj, memberId }).select('_id')
  if (!membership) {
    const error = new Error('Không tìm thấy gói tập.')
    error.statusCode = 404
    throw error
  }

  const periods = await MembershipPeriod.find({ membershipId: membership._id })
    .populate('planId', 'nameVi nameEn price durationDays')
    .sort({ startDate: 1 })

  return periods.map((p) => {
    const pObj = p.toObject ? p.toObject() : p
    pObj.displayStatus = computePeriodStatus(p)
    return pObj
  })
}

const getMembershipInfo = async ({ userId }) => {
  const memberId = toObjectId(userId, 'userId')

  // Active cycle (nguồn sự thật duy nhất)
  let activeCycle = await MembershipCycle.findOne({ memberId, status: 'active' })
    .populate('currentPlanId')
    .sort({ createdAt: -1 })
    .lean()
  if (!activeCycle) {
    activeCycle = await MembershipCycle.findOne({ memberId, status: 'pending_initial_activation' })
      .populate('currentPlanId')
      .sort({ createdAt: -1 })
      .lean()
  }

  let activePeriod = null
  let pendingRenewals = []
  let cancelRequests = []
  let completedMemberships = []

  if (activeCycle) {
    const plan = activeCycle.currentPlanId || {}
    activePeriod = {
      planName: plan.nameVi || plan.nameEn || '',
      startDate: activeCycle.startDate,
      endDate: activeCycle.expiresAt,
      remainingDays: calculateRemainingDays(activeCycle.expiresAt),
      status: 'ACTIVE',
    }
  }

  // Pending cycles (renewals chờ kích hoạt)
  const allCycles = await MembershipCycle.find({ memberId })
    .populate('currentPlanId', 'nameVi nameEn')
    .sort({ createdAt: 1 })
    .lean()

  pendingRenewals = allCycles
    .filter((c) => c.status === 'pending_renewal_activation')
    .map((c) => ({
      planName: c.currentPlanId?.nameVi || c.currentPlanId?.nameEn || '',
      startDate: c.startDate,
      endDate: c.expiresAt,
      status: 'PENDING',
    }))

  cancelRequests = allCycles
    .filter((c) => c.status === 'cancelled')
    .map((c) => ({
      planName: c.currentPlanId?.nameVi || c.currentPlanId?.nameEn || '',
      startDate: c.startDate,
      endDate: c.expiresAt,
      status: 'CANCELLED',
    }))

  completedMemberships = allCycles
    .filter((c) => ['completed', 'refunded'].includes(c.status))
    .map((c) => ({
      planName: c.currentPlanId?.nameVi || c.currentPlanId?.nameEn || '',
      startDate: c.startDate,
      endDate: c.expiresAt,
      status: c.status === 'refunded' ? 'REFUNDED' : 'COMPLETED',
    }))

  return {
    hasActiveMembership: !!activeCycle,
    currentMembership: activePeriod,
    pendingRenewals,
    cancelRequests,
    completedMemberships,
  }
}

export const cleanupMemberPTData = async ({ memberId, session, sourceReason = 'ended_by_admin', note }) => {
  const opts = session ? { session } : {}
  const reason = note || 'Gói tập đã kết thúc'

  await WorkoutSchedule.updateMany(
    { memberId, status: 'active' },
    { $set: { status: 'cancelled' } },
    opts,
  )

  await Booking.updateMany(
    { memberId, status: { $in: ['pending', 'awaiting_payment', 'confirmed'] } },
    { $set: { status: 'cancelled', cancelReason: reason } },
    opts,
  )

  await Workout.updateMany(
    { memberId, isTemplate: false, status: 'active' },
    { $set: { status: 'archived' } },
    opts,
  )

  await PTAssignment.updateMany(
    { memberId, status: 'active' },
    {
      $set: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason: reason,
      },
    },
    opts,
  )

  await TrainingAssignment.updateMany(
    { memberId, status: { $in: ['waiting_pt', 'active'] } },
    { $set: { status: 'finished', endDate: new Date() } },
    opts,
  )

  // End ClassEnrollment (member leaves all classes when membership expired)
  await endClassEnrollments({
    memberId,
    sourceReason: sourceReason || 'ended_by_admin',
    note: note || reason,
    session,
  })

  // Notifications
  const m = await User.findById(memberId).select('name fullName').lean()
  const mName = m?.fullName || m?.name || 'Hội viên'

  await createNotification({
    receiverId: memberId,
    receiverRole: 'member',
    notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
    title: 'Quyền lợi PT đã kết thúc',
    content: `Gói tập của bạn đã kết thúc/hủy. Toàn bộ quyền lợi PT, lớp học và giáo án đã được đóng lại.`,
    redirectUrl: '/my-membership',
    createdBy: 'System',
  }).catch(() => {})

  const ptAss = await PTAssignment.findOne({ memberId }).select('ptId').lean()
  if (ptAss?.ptId) {
    await createNotification({
      receiverId: ptAss.ptId,
      receiverRole: 'pt',
      notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
      title: 'Hội viên đã kết thúc/hủy gói tập',
      content: `Hội viên ${mName} đã kết thúc/hủy gói tập và không còn trong lớp PT của bạn.`,
      relatedId: memberId,
      relatedType: 'User',
      redirectUrl: '/pt/clients',
      createdBy: 'System',
    }).catch(() => {})
  }
}

/**
 * Determine PT benefit type from a plan's features.
 * Returns 'group' (BOOK_PT_GROUP), 'private' (BOOK_PT_PRIVATE), or 'none'.
 */
async function getPlanPTBenefitType(plan) {
  const featureIds = plan.featureIds || []
  if (featureIds.length === 0) return 'none'

  const codes = featureIds
    .map(f => (typeof f === 'object' && f.code) ? f.code : null)
    .filter(Boolean)

  if (codes.length > 0) {
    if (codes.includes('BOOK_PT_PRIVATE')) return 'private'
    if (codes.includes('BOOK_PT_GROUP')) return 'group'
    return 'none'
  }

  const features = await PlanFeature.find({ _id: { $in: featureIds } }).lean()
  const featureCodes = features.map(f => f.code)
  if (featureCodes.includes('BOOK_PT_PRIVATE')) return 'private'
  if (featureCodes.includes('BOOK_PT_GROUP')) return 'group'
  return 'none'
}

/**
 * Handle PT data cleanup + notifications when a membership plan changes.
 * Must be called AFTER the plan change transaction is committed.
 * Handles 4 cases:
 *   Case 2: group/private → none (lose PT benefit)
 *   Case 3: private → group (switch PT type, need class assignment)
 *   Case 4: group → private (switch PT type, need 1-1 assignment)
 *   Case 1 (cancellation): handled by cleanupMemberPTData separately
 */
export async function handlePTDataOnPlanChange({ memberId, oldPlan, newPlan, session }) {
  const opts = session ? { session } : {}

  const [oldType, newType] = await Promise.all([
    getPlanPTBenefitType(oldPlan),
    getPlanPTBenefitType(newPlan),
  ])

  const newPlanName = newPlan?.nameVi || 'gói mới'

  const member = await User.findById(memberId).select('name fullName').lean()
  const mName = member?.fullName || member?.name || 'Hội viên'

  // Case 2: Lost PT benefit (group/private → none)
  if ((oldType === 'group' || oldType === 'private') && newType === 'none') {
    const reason = `Hạ cấp gói: ${newPlanName}`

    if (oldType === 'group') {
      const enrollments = await ClassEnrollment.find({ memberId, status: 'active' })
        .populate('classId', 'code name')
        .lean()

      for (const e of enrollments) {
        const cls = e.classId
        const className = cls ? `[${cls.code}] ${cls.name}` : 'lớp'

        const ptAss = await PTAssignment.findOne({ memberId, status: 'active' }).select('ptId').lean()
        if (ptAss?.ptId) {
          await createNotification({
            receiverId: ptAss.ptId,
            receiverRole: 'pt',
            notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
            title: 'Hội viên đã rời lớp do hạ cấp gói tập',
            content: `Hội viên ${mName} đã hạ cấp xuống gói "${newPlanName}" (không PT) và bị xóa khỏi lớp ${className}.`,
            relatedId: cls?._id || memberId,
            relatedType: 'TrainingClass',
            redirectUrl: '/pt/clients',
            createdBy: 'System',
          }).catch(() => {})
        }
      }
    }

    await PTAssignment.updateMany(
      { memberId, status: 'active' },
      { $set: { status: 'cancelled', cancelledAt: new Date(), cancelReason: reason } },
      opts,
    )

    await TrainingAssignment.updateMany(
      { memberId, status: { $in: ['waiting_pt', 'active'] } },
      { $set: { status: 'finished', endDate: new Date() } },
      opts,
    )

    if (oldType === 'group') {
      await endClassEnrollments({ memberId, sourceReason: 'package_downgraded', note: reason, session })
    }

    await createNotification({
      receiverId: memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
      title: 'Thay đổi quyền lợi PT',
      content: `Bạn đã chuyển sang gói "${newPlanName}" - gói này không bao gồm quyền lợi PT. Bạn đã được rời khỏi lớp PT.`,
      redirectUrl: '/my-membership',
      createdBy: 'System',
    }).catch(() => {})

    return
  }

  // Case 4: Group PT → 1-1 PT
  if (oldType === 'group' && newType === 'private') {
    const enrollments = await ClassEnrollment.find({ memberId, status: 'active' })
      .populate('classId', 'code name')
      .lean()

    const className = enrollments.length > 0 && enrollments[0].classId
      ? enrollments[0].classId.name
      : 'lớp'

    // Lấy PT của class trước khi end enrollment
    const classId = enrollments.length > 0 && enrollments[0].classId ? enrollments[0].classId._id : null
    let ptId = null
    if (classId) {
      const tc = await (await import('../models/TrainingClass.js')).default.findById(classId).select('ptId').lean()
      ptId = tc?.ptId || null
    }

    await endClassEnrollments({ memberId, sourceReason: 'package_switched_to_1on1', note: 'Chuyển sang gói PT 1-1', session })

    // Notify the group PT that the member left
    if (ptId) {
      notifyPtMemberChanged({
        action: 'transferred_out',
        memberName: mName,
        className,
        classId,
        ptId,
      })
    }

    await createNotification({
      receiverId: null, receiverRole: 'admin',
      notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
      title: 'Hội viên cần xếp PT 1-1 mới',
      content: `Hội viên ${mName} đã chuyển từ gói PT nhóm (${className}) sang PT 1-1. Cần xếp PT 1-1 phù hợp.`,
      relatedId: memberId, relatedType: 'User',
      redirectUrl: '/admin/members',
      createdBy: 'System',
    }).catch(() => {})

    await createNotification({
      receiverId: memberId, receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
      title: 'Chuyển sang gói PT 1-1',
      content: `Bạn đã chuyển sang gói PT 1-1. Admin sẽ sắp xếp PT phù hợp cho bạn trong thời gian sớm nhất.`,
      redirectUrl: '/my-membership', createdBy: 'System',
    }).catch(() => {})

    return
  }

  // Case 3: 1-1 PT → Group PT
  if (oldType === 'private' && newType === 'group') {
    const oldAssignment = await PTAssignment.findOne({ memberId, status: 'active' })
      .populate('ptId', 'name fullName')
      .lean()

    await PTAssignment.updateMany(
      { memberId, status: 'active' },
      { $set: { status: 'cancelled', cancelledAt: new Date(), cancelReason: 'Chuyển sang gói PT nhóm' } },
      opts,
    )

    if (oldAssignment?.ptId) {
      const ptInfo = typeof oldAssignment.ptId === 'object' ? oldAssignment.ptId : null
      await createNotification({
        receiverId: typeof oldAssignment.ptId === 'object' ? oldAssignment.ptId._id : oldAssignment.ptId,
        receiverRole: 'pt',
        notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
        title: 'Hội viên đã chuyển sang PT nhóm',
        content: `Hội viên ${mName} đã chuyển từ PT 1-1 sang gói PT nhóm. Bạn không còn phụ trách 1-1 hội viên này.`,
        relatedId: memberId, relatedType: 'User',
        redirectUrl: '/pt/clients', createdBy: 'System',
      }).catch(() => {})
    }

    await createNotification({
      receiverId: null, receiverRole: 'admin',
      notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
      title: 'Hội viên cần xếp lớp PT nhóm',
      content: `Hội viên ${mName} đã chuyển sang gói PT nhóm. Cần xếp hội viên vào lớp tập phù hợp.`,
      relatedId: memberId, relatedType: 'User',
      redirectUrl: '/admin/training-classes', createdBy: 'System',
    }).catch(() => {})

    await createNotification({
      receiverId: memberId, receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
      title: 'Chuyển sang gói PT nhóm',
      content: `Bạn đã chuyển sang gói PT nhóm. Admin sẽ xếp bạn vào lớp tập phù hợp trong thời gian sớm nhất.`,
      redirectUrl: '/my-membership', createdBy: 'System',
    }).catch(() => {})

    return
  }
}

export {
  calculateRemainingDays,
  cancelRegistration,
  confirmRegistration,
  createCheckoutSession,
  createMembership,
  subscribeWithWallet,
  createRenewalCheckoutSession,
  getMyMembership,
  getCancelInfo,
  getMembershipDetail,
  getMembershipInfo,
  getMembershipPeriods,
  handleMembershipStripeWebhook,
  listPayments,
  listRegistrations,
  renewMembershipWithDuration,
  renewMembershipWithWallet,
  getMyRenewals,
  cancelRenewal,
  getMyHistory,
  getMyPeriods,
  hasActivePeriod,
  cancelPeriod,
  autoCancelPendingPeriod,
  rebuildMembershipTimeline,
}
