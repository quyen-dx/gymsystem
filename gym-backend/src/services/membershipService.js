import mongoose from 'mongoose'
import Stripe from 'stripe'
import { buildClientUrl } from '../config/appUrls.js'
import Membership from '../models/Membership.js'
import MembershipPeriod from '../models/MembershipPeriod.js'
import MembershipRenewal from '../models/MembershipRenewal.js'
import MembershipCancellationRequest from '../models/MembershipCancellationRequest.js'
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
import { endEnrollments as endClassEnrollments } from './classEnrollmentService.js'
import { getSystemSettingsValue } from './systemSettingsService.js'
import { recordUserActivity } from './userActivityService.js'
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
import { createNotification } from '../services/notificationService.js'

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

const getMembershipDisplayStatus = (membership) => {
  if (!membership) return 'expired'
  if (membership.status === 'pending_cancel') return 'expiring_soon'
  if (membership.status === 'cancel_requested') return 'cancel_requested'
  const end = endOfDayVN(membership.endDate)
  const rawDiff = Math.ceil((end.getTime() - Date.now()) / MS_PER_DAY)
  if (rawDiff > 7) return 'active'
  if (rawDiff >= 1) return 'expiring_soon'
  if (rawDiff === 0) return 'expires_today'
  return 'expired'
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

const serializeMembership = (membership) => {
  if (!membership) return null
  const raw = membership.toObject ? membership.toObject() : membership
  const plan = raw.planId
  const remainingDays = calculateRemainingDays(raw.endDate)
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
    startDate: raw.startDate,
    endDate: raw.endDate,
    remainingDays,
    status: remainingDays <= 0 ? 'expired' : raw.status,
    displayStatus: getMembershipDisplayStatus(raw),
    source: raw.source,
    createdAt: raw.createdAt,
    cancelledAt: raw.cancelledAt,
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

const findLatestActiveMembership = (memberId) =>
  Membership.findOne({ memberId, status: 'active' }).sort({ endDate: -1 }).populate('planId')

const calculateNewMembershipDates = ({ existingMembership, durationDays, mode }) => {
  const today = startOfTodayVN()
  let startDate = new Date(today)

  if (mode === 'renew' && existingMembership) {
    const existingEnd = new Date(existingMembership.endDate)
    if (existingEnd >= today) {
      startDate = new Date(existingEnd)
      startDate.setHours(0, 0, 0, 0) // midnight VN (nhờ TZ env)
      startDate.setDate(startDate.getDate() + 1)
    }
  }

  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + Number(durationDays) - 1)

  return { startDate, endDate: endOfDayVN(endDate) }
}

const subscribeWithWallet = async ({ userId, planId, mode = 'register', durationMultiplier = 1 }) => {
  await assertPolicyConsent(userId, ['membership', 'terms'])

  const { user, plan, memberId, planObjectId } = await ensureMemberAndPlan({ userId, planId })
  const multiplier = Math.max(1, Math.floor(Number(durationMultiplier) || 1))
  const effectiveDays = plan.durationDays * multiplier
  const amount = Number(plan.price || 0) * multiplier

  const existingActive = await findLatestActiveMembership(memberId)
  if (mode === 'register' && existingActive) {
    const error = new Error('Bạn đang có gói tập hoạt động. Vui lòng gia hạn trong mục Gói tập của tôi.')
    error.statusCode = 400
    throw error
  }

  if (mode === 'renew') {
    if (!existingActive) {
      const error = new Error('Bạn chưa có gói tập để gia hạn. Vui lòng đăng ký gói mới.')
      error.statusCode = 404
      throw error
    }
    await assertRenewalAllowed(existingActive.endDate)
  }

  const session = await mongoose.startSession()
  let committed = false

  try {
    session.startTransaction()

    const wallet = await Wallet.findOneAndUpdate(
      { userId: memberId, balance: { $gte: amount } },
      { $inc: { balance: -amount } },
      { new: false, session },
    )

    if (!wallet) {
      const error = new Error('Đăng ký không thành công, tài khoản không đủ số dư')
      error.statusCode = 400
      throw error
    }

    const balanceBefore = Number(wallet.balance || 0)
    const walletBalance = balanceBefore - amount
    const today = startOfTodayVN()
    const isRenew = existingActive && new Date(existingActive.endDate) >= today
    let oldEndDate = null
    let renewalPeriodsData = null
    let newRegistrationPeriodData = null

    let membership = isRenew ? existingActive : null

    if (membership) {
      // Gia hạn: tạo nhiều MembershipPeriod (mỗi period = một chu kỳ chuẩn của Plan)
      const latestPeriod = await MembershipPeriod.findOne({ membershipId: membership._id })
        .sort({ endDate: -1 })
        .session(session)

      const lastEnd = latestPeriod
        ? endOfDayVN(latestPeriod.endDate)
        : endOfDayVN(membership.endDate)

      oldEndDate = new Date(membership.endDate)

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
      if (existingActive) {
        existingActive.status = 'expired'
        await existingActive.save({ session })
      }

      // Đăng ký mới: startDate = 00:00:00 VN hôm nay, endDate = 23:59:59 VN ngày cuối
      const startDate = new Date(today)
      const periodEnd = calcMembershipEndDate({ baseDate: startDate, durationDays: plan.durationDays })
      const [createdMembership] = await Membership.create(
        [
          {
            memberId,
            planId: planObjectId,
            startDate,
            endDate: periodEnd,
            status: 'active',
            source: 'manual',
          },
        ],
        { session },
      )
      membership = createdMembership

      // Lưu thông tin để tạo MembershipPeriod sau khi có paymentId
      newRegistrationPeriodData = {
        membershipId: membership._id,
        planId: planObjectId,
        memberId,
        startDate,
        endDate: periodEnd,
        totalDays: plan.durationDays,
        price: amount,
      }
    }

    const [payment] = await Payment.create(
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
          },
        },
      ],
      { session },
    )

    await Transaction.create(
      [
        {
          userId: memberId,
          walletId: wallet._id,
          type: 'payment',
          provider: 'wallet',
          source: 'membership',
          description: `Thanh toán gói tập ${plan.nameVi || plan.nameEn}`,
          amount: -amount,
          balanceBefore,
          balanceAfter: walletBalance,
          referenceId: payment._id.toString(),
          status: 'completed',
          completedAt: new Date(),
          metadata: {
            paymentId: payment._id,
            planId: plan._id,
            membershipId: membership._id,
          },
          idempotencyKey: payment._id.toString(),
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

      // Khi gia hạn, KHÔNG cập nhật membership.endDate.

    }

    if ((renewalPeriodsData && renewalPeriodsData.length > 0) || newRegistrationPeriodData) {
      await rebuildMembershipTimeline({ membershipId: membership._id, session })
    }

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
          : membership.endDate,
        periodIndex: existingPeriodCount > 0 ? existingPeriodCount + 1 : undefined,
      }).catch((e) => console.error('Gửi email gia hạn thất bại:', e.message))
    }

    const populatedMembership = await Membership.findById(membership._id).populate('planId')
    return {
      message: isRenew ? 'Gia hạn thành công' : 'Đăng ký gói tập thành công',
      walletBalance,
      membership: serializeMembership(populatedMembership),
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
  const existingActive = await findLatestActiveMembership(memberId)

  if (mode === 'register' && existingActive) {
    const error = new Error('Bạn đang có gói tập active. Vui lòng gia hạn trong trang Gói tập của tôi.')
    error.statusCode = 400
    throw error
  }

  if (mode === 'renew') {
    if (!existingActive) {
      const error = new Error('Bạn chưa có gói tập để gia hạn. Vui lòng đăng ký gói mới.')
      error.statusCode = 400
      throw error
    }

    if (String(existingActive.planId?._id || existingActive.planId) !== String(planObjectId)) {
      const error = new Error('Chỉ có thể gia hạn gói tập hiện tại.')
      error.statusCode = 400
      throw error
    }

    await assertRenewalAllowed(existingActive.endDate)
  }

  const { startDate, endDate } = calculateNewMembershipDates({
    existingMembership: existingActive,
    durationDays: plan.durationDays,
    mode,
  })

  if (mode === 'register') {
    // Đăng ký mới: tạo Membership + ACTIVE MembershipPeriod
    const membership = await Membership.create({
      memberId,
      planId: planObjectId,
      startDate,
      endDate,
      status: 'active',
      source,
      paymentId,
    })

    await MembershipPeriod.create({
      membershipId: membership._id,
      planId: planObjectId,
      memberId,
      startDate,
      endDate,
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

    const populated = await Membership.findById(membership._id).populate('planId')
    return serializeMembership({ ...populated.toObject(), planId: plan.toObject() })
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

  const populated = await Membership.findById(existingActive._id).populate('planId')
  return serializeMembership({ ...populated.toObject(), planId: plan.toObject() })
}

const createManualRegistration = async ({ userId, planId }) => {
  const { user, plan } = await ensureMemberAndPlan({ userId, planId })
  const existingActive = await findLatestActiveMembership(user._id)
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

  const payment = await Payment.create({
    userId: user._id,
    planId: plan._id,
    registrationId: registration._id,
    amount: plan.price,
    currency: 'vnd',
    status: 'PENDING',
    paymentMethod: 'MANUAL',
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

  if (mode === 'register') {
    const existingActive = await findLatestActiveMembership(user._id)
    if (existingActive) {
      const error = new Error('Bạn đang có gói tập active. Vui lòng gia hạn trong trang Gói tập của tôi.')
      error.statusCode = 400
      throw error
    }
  }

  if (mode === 'renew') {
    await createActivatedMembershipDryRun({ userId: user._id, planId: plan._id })
  }

  const payment = await Payment.create({
    userId: user._id,
    planId: plan._id,
    amount: plan.price,
    currency: 'vnd',
    status: 'PENDING',
    paymentMethod: 'STRIPE',
    source: 'ONLINE',
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
  const existingActive = await findLatestActiveMembership(user._id)
  if (!existingActive) {
    const error = new Error('Bạn chưa có gói tập để gia hạn. Vui lòng đăng ký gói mới.')
    error.statusCode = 400
    throw error
  }
  if (String(existingActive.planId?._id || existingActive.planId) !== String(plan._id)) {
    const error = new Error('Chỉ có thể gia hạn gói tập hiện tại.')
    error.statusCode = 400
    throw error
  }
  if (calculateRemainingDays(existingActive.endDate) >= 30) {
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
  const activeMembership = await findLatestActiveMembership(toObjectId(userId, 'userId'))
  if (!activeMembership) {
    const error = new Error('Bạn chưa có gói tập để gia hạn.')
    error.statusCode = 404
    throw error
  }
  return createCheckoutSession({ userId, planId: activeMembership.planId?._id || activeMembership.planId, mode: 'renew' })
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

  // Gọi lazyActivatePendingPeriods trước để cập nhật database
  await lazyActivatePendingPeriods({ memberId })

  const membership = await Membership.findOne({ memberId, status: { $in: ['active', 'pending_cancel', 'cancel_requested'] } })
    .sort({ endDate: -1 })
    .populate({ path: 'planId', populate: { path: 'featureIds', model: 'PlanFeature' } })

  let canRenew = !!membership

  let pendingCancelRequest = null
  if (membership && membership.status === 'cancel_requested') {
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

  return {
    membership: serializeMembership(membership),
    canRenew,
    renewalThresholdDays: membership ? await getRenewalThresholdDays() : 7,
    pendingCancelRequest,
  }
}

const renewMembershipWithWallet = async ({ userId }) => {
  const memberId = toObjectId(userId, 'userId')
  const existingActive = await findLatestActiveMembership(memberId)
  if (!existingActive) {
    const error = new Error('Bạn chưa có gói tập để gia hạn.')
    error.statusCode = 404
    throw error
  }
  await assertRenewalAllowed(existingActive.endDate)
  const planId = existingActive.planId?._id || existingActive.planId
  return subscribeWithWallet({ userId, planId, mode: 'renew' })
}

const renewMembershipWithDuration = async ({ userId, durationMultiplier = 1 }) => {
  const memberId = toObjectId(userId, 'userId')
  const existingActive = await findLatestActiveMembership(memberId)
  if (!existingActive) {
    const error = new Error('Bạn chưa có gói tập để gia hạn.')
    error.statusCode = 404
    throw error
  }

  await assertRenewalAllowed(existingActive.endDate)

  return subscribeWithWallet({
    userId,
    planId: existingActive.planId?._id || existingActive.planId,
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

    // Tính lại endDate của membership
    const membership = await Membership.findById(renewal.membershipId).session(session).populate('planId')
    if (!membership) {
      const error = new Error('Không tìm thấy gói tập.')
      error.statusCode = 404
      throw error
    }

    // Tính lại endDate từ startDate + plan.durationDays + tổng các renewal ACTIVE
    const plan = membership.planId
    let totalDays = plan?.durationDays || 0
    const activeRenewals = await MembershipRenewal.find({
      membershipId: membership._id,
      status: 'ACTIVE',
    }).session(session)

    for (const r of activeRenewals) {
      totalDays += r.days
    }

    const newEnd = new Date(membership.startDate)
    newEnd.setDate(newEnd.getDate() + totalDays - 1)
    const recalculatedEnd = endOfDayVN(newEnd)
    membership.endDate = recalculatedEnd
    await membership.save({ session })

    // Hoàn tiền: cộng vào ví
    const refundAmount = renewal.price
    if (refundAmount > 0) {
      let wallet = await Wallet.findOne({ userId: memberId }).session(session)
      if (!wallet) {
        [wallet] = await Wallet.create([{ userId: memberId, balance: 0 }], { session })
      }

      const balanceBefore = Number(wallet.balance || 0)
      wallet.balance = balanceBefore + refundAmount
      await wallet.save({ session })

      await Transaction.create([{
        userId: memberId,
        walletId: wallet._id,
        type: 'REFUND_TO_WALLET',
        provider: 'wallet',
        source: 'membership',
        description: `Hoàn tiền hủy gia hạn (+${renewal.days} ngày)`,
        amount: refundAmount,
        balanceBefore,
        balanceAfter: balanceBefore + refundAmount,
        referenceId: renewal._id.toString(),
        status: 'completed',
        completedAt: new Date(),
        metadata: {
          renewalId: renewal._id,
          membershipId: membership._id,
          renewalDays: renewal.days,
          renewalPrice: renewal.price,
        },
        idempotencyKey: `cancel_renewal_refund_${renewal._id}`,
      }], { session })
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

  // Sync Membership.startDate và endDate với kỳ đang ACTIVE
  const activePeriod = periods.find((p) => p.status === 'ACTIVE')
  if (activePeriod) {
    const refStart = activePeriod.startDate
    const refEnd = endOfDayVN(activePeriod.endDate)
    if (session) {
      await Membership.updateOne(
        { _id: membershipId },
        { $set: { startDate: refStart, endDate: refEnd } }
      ).session(session)
    } else {
      await Membership.updateOne(
        { _id: membershipId },
        { $set: { startDate: refStart, endDate: refEnd } }
      )
    }
  }
}

const lazyActivatePendingPeriods = async ({ memberId, session = null }) => {
  const now = new Date()

  // 1. Tìm membership hiện tại của member
  const membership = await Membership.findOne({
    memberId,
    status: { $in: ['active', 'pending_cancel', 'cancel_requested', 'expired'] },
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
    // Đồng bộ startDate và endDate của Membership với activePeriod
    membership.startDate = activePeriod.startDate
    membership.endDate = activePeriod.endDate
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
  const currentMembership = await Membership.findOne({
    memberId,
    status: { $in: ['active', 'pending_cancel', 'cancel_requested'] },
  }).sort({ endDate: -1 }).select('_id')

  const filter = { memberId }
  if (currentMembership) {
    filter.membershipId = currentMembership._id
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

const refundPeriodToWallet = async ({ period, wallet, session }) => {
  if (!period.price || period.price <= 0) return 0
  const balanceBefore = Number(wallet.balance || 0)
  wallet.balance = balanceBefore + period.price
  await wallet.save({ session })

  await Transaction.create([{
    userId: period.memberId,
    walletId: wallet._id,
    type: 'REFUND_TO_WALLET',
    provider: 'wallet',
    source: 'membership',
    description: `Hoàn tiền kỳ hạn (+${period.totalDays} ngày)`,
    amount: period.price,
    balanceBefore,
    balanceAfter: balanceBefore + period.price,
    referenceId: period._id.toString(),
    status: 'completed',
    completedAt: new Date(),
    metadata: {
      periodId: period._id,
      membershipId: period.membershipId,
      periodDays: period.totalDays,
      periodPrice: period.price,
    },
    idempotencyKey: `period_refund_${period._id}`,
  }], { session })

  return period.price
}

const cancelPeriod = async ({ userId, periodId, reason = '' }) => {
  const { createRefundRequest } = await import('./refundRequestService.js')
  return createRefundRequest({ userId, periodId, reason })
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
  const memberships = await Membership.find({ memberId })
    .populate('planId', 'nameVi nameEn price durationDays')
    .sort({ startDate: -1 })

  const result = []
  for (const membership of memberships) {
    const periods = await MembershipPeriod.find({ membershipId: membership._id })
      .populate('planId', 'nameVi nameEn price durationDays')
      .sort({ startDate: 1 })
    result.push({
      membership: serializeMembership(membership),
      periods: periods.map((p) => {
        const pObj = p.toObject ? p.toObject() : p
        pObj.displayStatus = computePeriodStatus(p)
        return pObj
      }),
    })
  }
  return result
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
  const membership = await Membership.findOne({
    memberId,
    status: { $in: ['active', 'cancel_requested'] },
  }).sort({ endDate: -1 }).populate('planId', 'nameVi nameEn price durationDays')

  if (!membership) {
    const error = new Error('Không tìm thấy gói tập.')
    error.statusCode = 404
    throw error
  }

  const allPeriods = await MembershipPeriod.find({
    membershipId: membership._id,
  }).sort({ startDate: 1 })

  let activePeriod = null
  const pendingPeriods = []
  let activeIndex = -1

  for (let i = 0; i < allPeriods.length; i++) {
    const p = allPeriods[i]
    const status = computePeriodStatus(p)
    if (status === 'ACTIVE') {
      activePeriod = p
      activeIndex = i
    } else if (status === 'PENDING' && !['CANCELLED', 'REFUNDED', 'CANCEL_REQUESTED', 'REJECTED'].includes(p.status)) {
      pendingPeriods.push(p)
    }
  }

  if (!activePeriod) {
    const error = new Error('Không tìm thấy kỳ hạn đang hoạt động.')
    error.statusCode = 400
    throw error
  }

  // Tính toán refund cho đợt active
  const activatedAt = activePeriod.activatedAt || activePeriod.startDate
  const refundDeadline = new Date(new Date(activatedAt).getTime() + 7 * 24 * 60 * 60 * 1000)
  const isWithinWindow = Date.now() <= refundDeadline.getTime()

  let hasUsed = false
  if (isWithinWindow) {
    hasUsed = await hasUsedMembershipBenefits({ memberId, purchaseDate: activatedAt })
  }

  const activeRefundEligible = isWithinWindow && !hasUsed

  // Tạo danh sách chi tiết các đợt
  const periodsDetail = []

  // Đợt hiện tại (active)
  periodsDetail.push({
    _id: activePeriod._id,
    index: activeIndex + 1,
    status: 'ACTIVE',
    startDate: activePeriod.startDate,
    endDate: activePeriod.endDate,
    totalDays: activePeriod.totalDays,
    price: activePeriod.price,
    activatedAt: activePeriod.activatedAt,
    refundEligible: activeRefundEligible,
    refundReason: !isWithinWindow
      ? `Đã quá hạn 07 ngày kể từ ngày kích hoạt (${new Date(activatedAt).toLocaleDateString('vi-VN')}).`
      : hasUsed
        ? 'Đã sử dụng quyền lợi của gói tập (check-in, đặt lịch PT, ...).'
        : null,
  })

  // Các đợt PENDING
  for (const pp of pendingPeriods) {
    periodsDetail.push({
      _id: pp._id,
      index: allPeriods.indexOf(pp) + 1,
      status: 'PENDING',
      startDate: pp.startDate,
      endDate: pp.endDate,
      totalDays: pp.totalDays,
      price: pp.price,
      activatedAt: null,
      refundEligible: true,
      refundReason: null,
    })
  }

  const totalRefund = periodsDetail
    .filter((pd) => pd.refundEligible)
    .reduce((sum, pd) => sum + (pd.price || 0), 0)

  return {
    membership: serializeMembership(membership),
    period: {
      _id: activePeriod._id,
      startDate: activePeriod.startDate,
      endDate: activePeriod.endDate,
      totalDays: activePeriod.totalDays,
      price: activePeriod.price,
      activatedAt: activePeriod.activatedAt,
    },
    refundInfo: {
      eligibleForRefund: activeRefundEligible,
      isWithinWindow,
      hasUsedBenefits: hasUsed,
      refundDeadline,
      estimatedRefundAmount: activeRefundEligible ? (activePeriod.price || 0) : 0,
      reason: !isWithinWindow
        ? `Đã quá hạn 07 ngày kể từ ngày kích hoạt (${new Date(activatedAt).toLocaleDateString('vi-VN')}).`
        : hasUsed
          ? 'Bạn đã sử dụng quyền lợi của gói tập (check-in, đặt lịch PT, ...).'
          : '',
    },
    pendingPeriods: pendingPeriods.map((pp) => ({
      _id: pp._id,
      startDate: pp.startDate,
      endDate: pp.endDate,
      totalDays: pp.totalDays,
      price: pp.price,
    })),
    periodsDetail,
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
  const now = new Date()

  await lazyActivatePendingPeriods({ memberId })

  // Step 1: Get the active Membership (same approach as frontend's getMyMembership)
  // This ensures AI and UI return the SAME membership record.
  const membership = await Membership.findOne({
    memberId,
    status: { $in: ['active', 'pending_cancel', 'cancel_requested'] },
  })
    .sort({ endDate: -1 })
    .populate('planId')

  // Step 2: Get all MembershipPeriods for the active membership only
  let activePeriod = null
  let pendingRenewals = []
  let cancelRequests = []
  let completedMemberships = []

  if (membership) {
    const plan = membership.planId || {}
    const mStart = membership.startDate
    const mEnd = membership.endDate

    activePeriod = {
      planName: plan.nameVi || plan.nameEn || '',
      startDate: mStart,
      endDate: mEnd,
      remainingDays: calculateRemainingDays(mEnd),
      status: 'ACTIVE',
    }
  }

  // Step 3: Get periods for detailed info (renewals, cancellations)
  const allPeriods = await MembershipPeriod.find({ memberId })
    .populate('planId', 'nameVi nameEn')
    .sort({ startDate: 1 })
    .lean()

  pendingRenewals = allPeriods
    .filter((p) => p.status === 'PENDING')
    .map((p) => ({
      planName: p.planId?.nameVi || p.planId?.nameEn || '',
      startDate: p.startDate,
      endDate: p.endDate,
      status: 'PENDING',
    }))

  cancelRequests = allPeriods
    .filter((p) => p.status === 'CANCEL_REQUESTED' || p.status === 'REFUND_PENDING')
    .map((p) => ({
      planName: p.planId?.nameVi || p.planId?.nameEn || '',
      startDate: p.startDate,
      endDate: p.endDate,
      status: p.status,
    }))

  completedMemberships = allPeriods
    .filter((p) => ['COMPLETED', 'EXPIRED', 'CANCELLED', 'REFUNDED'].includes(p.status))
    .map((p) => ({
      planName: p.planId?.nameVi || p.planId?.nameEn || '',
      startDate: p.startDate,
      endDate: p.endDate,
      status: p.status,
    }))

  return {
    hasActiveMembership: !!membership,
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
      ? `[${enrollments[0].classId.code}] ${enrollments[0].classId.name}`
      : 'lớp'

    await endClassEnrollments({ memberId, sourceReason: 'package_switched_to_1on1', note: 'Chuyển sang gói PT 1-1', session })

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
  rebuildMembershipTimeline,
}
