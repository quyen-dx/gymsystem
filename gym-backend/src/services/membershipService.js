import mongoose from 'mongoose'
import Stripe from 'stripe'
import { buildClientUrl } from '../config/appUrls.js'
import Membership from '../models/Membership.js'
import MembershipCancellationRequest from '../models/MembershipCancellationRequest.js'
import MembershipRegistration from '../models/MembershipRegistration.js'
import Payment from '../models/Payment.js'
import Plan from '../models/Plan.js'
import Transaction from '../models/Transaction.js'
import User from '../models/User.js'
import Wallet from '../models/Wallet.js'
import { getSystemSettingsValue } from './systemSettingsService.js'
import { invalidatePersonalContextCache } from './conversationContextCache.js'
import { recordUserActivity } from './userActivityService.js'
import { normalizeUserMemberIdentity } from '../utils/memberIdentity.js'

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null
const MS_PER_DAY = 24 * 60 * 60 * 1000

const toObjectId = (value, fieldName) => {
  if (!mongoose.Types.ObjectId.isValid(String(value))) {
    const error = new Error(`${fieldName} không hợp lệ`)
    error.statusCode = 400
    throw error
  }
  return new mongoose.Types.ObjectId(value)
}

const startOfToday = () => {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now
}

const endOfDay = (date) => {
  const value = new Date(date)
  value.setHours(23, 59, 59, 999)
  return value
}

const calculateRemainingDays = (endDate) => {
  const end = endOfDay(endDate)
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / MS_PER_DAY))
}

const getMembershipDisplayStatus = (membership) => {
  if (!membership) return 'expired'
  const remainingDays = calculateRemainingDays(membership.endDate)
  if (remainingDays <= 0) return 'expired'
  if (remainingDays < 30) return 'expiring_soon'
  return 'active'
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
    autoRenew: raw.autoRenew || false,
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
  const today = startOfToday()
  let startDate = new Date(today)

  if (mode === 'renew' && existingMembership) {
    const existingEnd = new Date(existingMembership.endDate)
    if (existingEnd >= today) {
      startDate = new Date(existingEnd)
      startDate.setHours(0, 0, 0, 0)
      startDate.setDate(startDate.getDate() + 1)
    }
  }

  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + Number(durationDays) - 1)

  return { startDate, endDate: endOfDay(endDate) }
}

const calculateWalletMembershipEndDate = ({ baseDate, durationDays }) => {
  const endDate = new Date(baseDate)
  endDate.setDate(endDate.getDate() + Number(durationDays))
  return endOfDay(endDate)
}

const subscribeWithWallet = async ({ userId, planId, mode = 'register' }) => {
  const { user, plan, memberId, planObjectId } = await ensureMemberAndPlan({ userId, planId })
  const amount = Number(plan.price || 0)

  const existingActive = await findLatestActiveMembership(memberId)
  if (mode === 'register' && existingActive) {
    const error = new Error('Bạn đang có gói tập hoạt động. Vui lòng gia hạn trong mục Gói tập của tôi.')
    error.statusCode = 400
    throw error
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
    const today = startOfToday()
    const isRenew = existingActive && new Date(existingActive.endDate) >= today

    let membership = isRenew ? existingActive : null

    if (membership) {
      const currentEnd = endOfDay(membership.endDate)
      membership.planId = planObjectId
      membership.endDate = calculateWalletMembershipEndDate({
        baseDate: currentEnd,
        durationDays: plan.durationDays,
      })
      membership.source = 'manual'
      await membership.save({ session })
    } else {
      if (existingActive) {
        existingActive.status = 'expired'
        await existingActive.save({ session })
      }

      const startDate = new Date(today)
      const [createdMembership] = await Membership.create(
        [
          {
            memberId,
            planId: planObjectId,
            startDate,
            endDate: calculateWalletMembershipEndDate({ baseDate: startDate, durationDays: plan.durationDays }),
            status: 'active',
            source: 'manual',
          },
        ],
        { session },
      )
      membership = createdMembership
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

    await session.commitTransaction()
    committed = true

    try {
      await recordUserActivity({
        userId: user._id,
        type: 'membership',
        title: isRenew ? 'Gia hạn gói tập' : 'Đăng ký gói tập',
        description: `${isRenew ? 'Gia hạn' : 'Đăng ký'} gói "${plan.nameVi}" bằng ví tài khoản`,
        metadata: { membershipId: membership._id, planId: plan._id, paymentId: payment._id, paymentMethod: 'WALLET' },
      })
      invalidatePersonalContextCache(user._id)
    } catch (activityError) {
      console.error('Không thể ghi hoạt động đăng ký gói tập:', activityError.message)
    }

    const populatedMembership = await Membership.findById(membership._id).populate('planId')
    return {
      message: 'Đăng ký gói tập thành công',
      walletBalance,
      membership: serializeMembership(populatedMembership),
      payment,
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

    if (calculateRemainingDays(existingActive.endDate) >= 30) {
      const error = new Error('Chỉ được gia hạn khi còn dưới 30 ngày hoặc đã hết hạn.')
      error.statusCode = 400
      throw error
    }
  }

  const { startDate, endDate } = calculateNewMembershipDates({
    existingMembership: existingActive,
    durationDays: plan.durationDays,
    mode,
  })

  const membership = await Membership.create({
    memberId,
    planId: planObjectId,
    startDate,
    endDate,
    status: 'active',
    source,
    paymentId,
  })

  if (paymentId) {
    await Payment.findByIdAndUpdate(paymentId, { membershipId: membership._id })
  }

  await recordUserActivity({
    userId: user._id,
    type: 'membership',
    title: mode === 'renew' ? 'Gia hạn gói tập' : 'Đăng ký gói tập',
    description: `${mode === 'renew' ? 'Gia hạn' : 'Đăng ký'} gói "${plan.nameVi}" - ${plan.durationDays} ngày`,
    metadata: { membershipId: membership._id, planId: plan._id, source },
  })
  invalidatePersonalContextCache(user._id)

  return serializeMembership({ ...membership.toObject(), planId: plan.toObject() })
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

const processAutoRenewal = async ({ userId }) => {
  const memberId = toObjectId(userId, 'userId')
  const membership = await Membership.findOne({ memberId, autoRenew: true, status: 'active' })
    .sort({ endDate: -1 })
    .populate('planId')

  if (!membership) return null

  const remainingDays = calculateRemainingDays(membership.endDate)
  if (remainingDays > 0) return null

  const plan = membership.planId
  if (!plan || !plan.price || !plan.durationDays) {
    membership.autoRenew = false
    membership.status = 'expired'
    await membership.save()
    return { expired: true, reason: 'no_plan' }
  }

  const price = Number(plan.price)
  const durationDays = Number(plan.durationDays)

  const wallet = await Wallet.findOneAndUpdate(
    { userId: memberId, balance: { $gte: price } },
    { $inc: { balance: -price } },
    { new: false },
  )

  if (!wallet) {
    membership.autoRenew = false
    membership.status = 'expired'
    await membership.save()
    return { expired: true, reason: 'insufficient_balance' }
  }

  const balanceBefore = Number(wallet.balance || 0)
  const walletBalance = balanceBefore - price
  const currentEnd = endOfDay(membership.endDate)
  const newEndDate = calculateWalletMembershipEndDate({ baseDate: currentEnd, durationDays })

  membership.endDate = newEndDate
  membership.source = 'manual'
  await membership.save()

  const planName = plan.nameVi || plan.nameEn || ''
  const [payment] = await Payment.create([
    {
      userId: memberId,
      planId: plan._id,
      membershipId: membership._id,
      amount: price,
      currency: 'vnd',
      status: 'PAID',
      paymentMethod: 'WALLET',
      source: 'ONLINE',
      type: 'RENEWAL',
      paidAt: new Date(),
      metadata: {
        walletBalanceBefore: balanceBefore,
        walletBalanceAfter: walletBalance,
        autoRenew: true,
      },
    },
  ])

  await Transaction.create([
    {
      userId: memberId,
      walletId: wallet._id,
      type: 'payment',
      provider: 'wallet',
      source: 'membership',
      description: `Tự động gia hạn gói tập ${planName}`,
      amount: -price,
      balanceBefore,
      balanceAfter: walletBalance,
      referenceId: payment._id.toString(),
      status: 'completed',
      completedAt: new Date(),
      metadata: { paymentId: payment._id, planId: plan._id, membershipId: membership._id, autoRenew: true },
      idempotencyKey: `auto_renew_${membership._id}_${Date.now()}`,
    },
  ])

  membership.paymentId = payment._id
  await membership.save()

  try {
    await recordUserActivity({
      userId,
      type: 'membership',
      title: 'Tự động gia hạn gói tập',
      description: `Tự động gia hạn gói "${planName}" bằng ví tài khoản`,
      metadata: { membershipId: membership._id, planId: plan._id, paymentId: payment._id, autoRenew: true },
    })
    invalidatePersonalContextCache(userId)
  } catch (activityError) {
    console.error('Không thể ghi hoạt động tự động gia hạn:', activityError.message)
  }

  return { renewed: true, newEndDate }
}

const toggleAutoRenew = async ({ userId }) => {
  const memberId = toObjectId(userId, 'userId')
  const membership = await Membership.findOne({ memberId, status: 'active' })
    .sort({ endDate: -1 })
    .populate('planId')

  if (!membership) {
    const error = new Error('Bạn chưa có gói tập đang hoạt động.')
    error.statusCode = 400
    throw error
  }

  if (membership.status === 'cancelled') {
    const error = new Error('Gói tập đã bị hủy, không thể bật tự động gia hạn.')
    error.statusCode = 400
    throw error
  }

  const remainingDays = calculateRemainingDays(membership.endDate)
  if (remainingDays <= 0) {
    const error = new Error('Gói tập đã hết hạn, không thể bật tự động gia hạn.')
    error.statusCode = 400
    throw error
  }

  const pendingCancel = await MembershipCancellationRequest.findOne({
    memberId,
    membershipId: membership._id,
    status: 'pending',
  })
  if (pendingCancel) {
    const error = new Error('Gói tập đang chờ xử lý hủy, không thể bật tự động gia hạn.')
    error.statusCode = 400
    throw error
  }

  membership.autoRenew = !membership.autoRenew
  await membership.save()

  return {
    autoRenew: membership.autoRenew,
    message: membership.autoRenew ? 'Đã bật tự động gia hạn.' : 'Đã tắt tự động gia hạn.',
  }
}

const getMyMembership = async ({ userId }) => {
  const memberId = toObjectId(userId, 'userId')

  const autoRenewResult = await processAutoRenewal({ userId })

  const membership = await Membership.findOne({ memberId, status: 'active' })
    .sort({ endDate: -1 })
    .populate('planId')

  return {
    membership: serializeMembership(membership),
    canRenew: false,
    autoRenew: membership?.autoRenew || false,
    autoRenewResult,
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
  const planId = existingActive.planId?._id || existingActive.planId
  return subscribeWithWallet({ userId, planId, mode: 'renew' })
}

const renewMembershipWithDuration = async ({ userId, durationMultiplier }) => {
  const memberId = toObjectId(userId, 'userId')
  const existingActive = await findLatestActiveMembership(memberId)
  if (!existingActive) {
    const error = new Error('Bạn chưa có gói tập để gia hạn.')
    error.statusCode = 404
    throw error
  }

  const plan = existingActive.planId
  const totalDays = Number(plan.durationDays) * durationMultiplier
  const totalPrice = Number(plan.price) * durationMultiplier
  const today = startOfToday()
  const currentEnd = new Date(existingActive.endDate)
  const isActive = currentEnd >= today

  const session = await mongoose.startSession()
  let committed = false

  try {
    session.startTransaction()

    const wallet = await Wallet.findOneAndUpdate(
      { userId: memberId, balance: { $gte: totalPrice } },
      { $inc: { balance: -totalPrice } },
      { new: false, session },
    )

    if (!wallet) {
      const error = new Error('Số dư ví không đủ để gia hạn gói tập.')
      error.statusCode = 400
      throw error
    }

    const balanceBefore = Number(wallet.balance || 0)
    const walletBalance = balanceBefore - totalPrice
    let membership

    if (isActive) {
      existingActive.endDate = endOfDay(
        calculateWalletMembershipEndDate({ baseDate: currentEnd, durationDays: totalDays }),
      )
      existingActive.source = 'manual'
      await existingActive.save({ session })
      membership = existingActive
    } else {
      existingActive.status = 'expired'
      await existingActive.save({ session })

      const [newMembership] = await Membership.create(
        [
          {
            memberId,
            planId: plan._id,
            startDate: new Date(today),
            endDate: endOfDay(
              calculateWalletMembershipEndDate({ baseDate: today, durationDays: totalDays }),
            ),
            status: 'active',
            source: 'manual',
          },
        ],
        { session },
      )
      membership = newMembership
    }

    const [payment] = await Payment.create(
      [
        {
          userId: memberId,
          planId: plan._id,
          membershipId: membership._id,
          amount: totalPrice,
          currency: 'vnd',
          status: 'PAID',
          paymentMethod: 'WALLET',
          source: 'ONLINE',
          type: 'RENEWAL',
          paidAt: new Date(),
          metadata: {
            walletBalanceBefore: balanceBefore,
            walletBalanceAfter: walletBalance,
            durationMultiplier,
            totalDays,
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
          description: `Gia hạn gói tập ${plan.nameVi || plan.nameEn} (${durationMultiplier}x)`,
          amount: -totalPrice,
          balanceBefore,
          balanceAfter: walletBalance,
          referenceId: payment._id.toString(),
          status: 'completed',
          completedAt: new Date(),
          metadata: {
            paymentId: payment._id,
            planId: plan._id,
            membershipId: membership._id,
            durationMultiplier,
            totalDays,
          },
          idempotencyKey: payment._id.toString(),
        },
      ],
      { session },
    )

    membership.paymentId = payment._id
    await membership.save({ session })

    await session.commitTransaction()
    committed = true

    try {
      await recordUserActivity({
        userId,
        type: 'membership',
        title: 'Gia hạn gói tập',
        description: `Gia hạn gói "${plan.nameVi || plan.nameEn}" (${durationMultiplier}x) bằng ví tài khoản`,
        metadata: { membershipId: membership._id, planId: plan._id, paymentId: payment._id, paymentMethod: 'WALLET', durationMultiplier },
      })
      invalidatePersonalContextCache(userId)
    } catch (activityError) {
      console.error('Không thể ghi hoạt động gia hạn gói tập:', activityError.message)
    }

    const populated = await Membership.findById(membership._id).populate('planId')
    return {
      message: 'Gia hạn gói tập thành công.',
      walletBalance,
      membership: serializeMembership(populated),
      payment,
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

export {
  calculateRemainingDays,
  cancelRegistration,
  confirmRegistration,
  createCheckoutSession,
  createMembership,
  subscribeWithWallet,
  createRenewalCheckoutSession,
  getMyMembership,
  handleMembershipStripeWebhook,
  listPayments,
  listRegistrations,
  renewMembershipWithDuration,
  renewMembershipWithWallet,
  toggleAutoRenew,
  processAutoRenewal,
}
