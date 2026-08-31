import mongoose from 'mongoose'
import Plan from '../models/Plan.js'
import Membership from '../models/Membership.js'
import MembershipCycle from '../models/MembershipCycle.js'
import MembershipPeriod from '../models/MembershipPeriod.js'
import PlanChangeHistory from '../models/PlanChangeHistory.js'
import Payment from '../models/Payment.js'
import Wallet from '../models/Wallet.js'
import Transaction from '../models/Transaction.js'
import { createNotification } from '../services/notificationService.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createVnpayPaymentUrl } from '../services/vnpayService.js'
import { cleanupMemberBenefitsOnPlanChange, resolvePlanFeatureCodes } from '../services/membershipService.js'
import {
  buildSpendDebitUpdate,
  consumeWalletPaymentReservation,
  reserveWalletForPayment,
} from '../services/walletService.js'

const MS_PER_DAY = 24 * 60 * 60 * 1000

function calcMembershipEndDate({ baseDate, durationDays }) {
  const endDate = new Date(baseDate)
  endDate.setDate(endDate.getDate() + Number(durationDays || 0) - 1)
  endDate.setHours(23, 59, 59, 999)
  return endDate
}

function calcRemainingDays(endDate) {
  if (!endDate) return 0
  const now = new Date()
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / MS_PER_DAY))
}

function calcProratedValue({ plan, remainingDays }) {
  const durationDays = Number(plan?.durationDays || 0)
  const planPrice = Number(plan?.price || 0)
  if (durationDays <= 0 || remainingDays <= 0 || planPrice <= 0) return 0
  return Math.round((planPrice / durationDays) * remainingDays)
}

const fail = (statusCode, message) => {
  const err = new Error(message)
  err.statusCode = statusCode
  throw err
}

const getOrCreateWallet = async ({ memberId, session }) => {
  let wallet = await Wallet.findOne({ userId: memberId }).session(session)
  if (!wallet) {
    [wallet] = await Wallet.create([{ userId: memberId, balance: 0 }], { session })
  }
  return wallet
}

const getClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for']
  if (forwardedFor) return String(forwardedFor).split(',')[0].trim()
  return req.ip || req.socket?.remoteAddress || '127.0.0.1'
}

/**
 * Tính toán snapshot đổi gói (dùng chung cho preview + checkout + thực thi).
 * - Tính phí theo chênh lệch giá full (khớp contract FE + available-plans).
 * - Trả đủ dữ liệu để tạo đơn thanh toán hoặc thực hiện đổi gói.
 */
const computePlanChangeSnapshot = async ({ memberId, newPlanId, expectedDirection, session = null }) => {
  const cycle = await MembershipCycle.findOne({ memberId, status: 'active' })
    .populate('currentPlanId').session(session)
  if (!cycle) fail(404, 'Không tìm thấy gói tập đang hoạt động')

  const membershipId = cycle.currentMembershipId

  const newPlan = await Plan.findById(newPlanId).populate('featureIds').session(session)
  if (!newPlan) fail(404, 'Không tìm thấy gói mới')

  const oldPlan = cycle.currentPlanId

  if (newPlan._id.toString() === oldPlan._id.toString()) {
    fail(400, 'Gói mới phải khác gói hiện tại')
  }
  if (expectedDirection === 'upgrade' && newPlan.price <= oldPlan.price) {
    fail(400, 'Gói mới phải có giá cao hơn gói hiện tại để nâng cấp')
  }
  if (expectedDirection === 'downgrade' && newPlan.price >= oldPlan.price) {
    fail(400, 'Gói mới phải có giá thấp hơn gói hiện tại để hạ cấp')
  }

  const allPeriods = membershipId
    ? await MembershipPeriod.find({ membershipId }).sort({ startDate: 1 }).session(session)
    : []
  const activePeriod = allPeriods.find((p) => p.status === 'ACTIVE')
  const oldEndDate = activePeriod?.endDate || cycle.expiresAt
  const remainingDays = calcRemainingDays(oldEndDate)
  const currentDailyValue = Math.round(Number(oldPlan.price || 0) / Math.max(1, Number(oldPlan.durationDays || cycle.durationDays || 1)))
  const remainingValue = calcProratedValue({ plan: oldPlan, remainingDays })
  const fullPriceDiff = Number(newPlan.price || 0) - Number(oldPlan.price || 0)
  const changeType = fullPriceDiff > 0 ? 'upgrade' : 'downgrade'
  const amountToPayPreview = changeType === 'upgrade'
    ? Math.max(0, Number(newPlan.price || 0) - remainingValue)
    : 0
  const creditToWalletPreview = changeType === 'downgrade'
    ? Math.max(0, remainingValue - Number(newPlan.price || 0))
    : 0

  const wallet = await getOrCreateWallet({ memberId, session })

  return {
    cycle, membershipId, newPlan, oldPlan,
    allPeriods, activePeriod, oldEndDate, remainingDays,
    currentDailyValue, remainingValue, changeType,
    amountToPayPreview, creditToWalletPreview, wallet,
  }
}

/**
 * Core thống nhất cho mọi luồng đổi gói (upgrade/downgrade/change_plan).
 * - Hỗ trợ externalPayment: đơn VNPay đã thanh toán → chỉ trừ phần ví đã cam kết
 *   (walletUsed) và hoàn tất Payment, không tạo Payment mới.
 */
const executePlanChangeCore = async ({ memberId, newPlanId, expectedDirection, cancelRenewals = false, externalPayment = null }) => {
  const session = await mongoose.startSession()
  session.startTransaction()
  let committed = false

  try {
    const {
      cycle, membershipId, newPlan, oldPlan,
      allPeriods, activePeriod, remainingDays,
      currentDailyValue, remainingValue, changeType,
      amountToPayPreview, creditToWalletPreview, wallet: initialWallet,
    } = await computePlanChangeSnapshot({ memberId, newPlanId, expectedDirection, session })
    let wallet = initialWallet

    // Kỳ gia hạn PENDING: hủy + hoàn tiền nếu cancelRenewals, ngược lại trỏ sang gói mới
    const nowMs = Date.now()
    const pendingPeriods = allPeriods.filter((p) => p.status === 'PENDING')
    const futurePending = pendingPeriods.filter(p => nowMs < new Date(p.startDate).getTime())

    if (cancelRenewals) {
      for (const p of futurePending) {
        if ((p.price || 0) > 0) {
          const balanceBefore = Number(wallet.balance || 0)
          wallet.balance += p.price
          wallet.withdrawableBalance = Number(wallet.withdrawableBalance || 0) + p.price
          await wallet.save({ session })

          await Transaction.create([{
            userId: memberId, walletId: wallet._id, type: 'REFUND_TO_WALLET', provider: 'wallet', source: 'plan_change',
            description: `Hoàn tiền hủy gia hạn khi đổi gói (+${p.totalDays} ngày)`,
            amount: p.price, balanceBefore, balanceAfter: wallet.balance,
            referenceId: p._id.toString(), status: 'completed', completedAt: new Date(),
            metadata: { periodId: p._id, membershipId, reason: 'cancelled_on_plan_change' },
            idempotencyKey: `change_cancel_period_${p._id}`,
          }], { session })
        }
        await MembershipPeriod.updateOne(
          { _id: p._id },
          { $set: { status: 'CANCELLED' } },
        ).session(session)
      }
    } else if (pendingPeriods.length > 0) {
      await MembershipPeriod.updateMany(
        { membershipId, status: 'PENDING' },
        { $set: { planId: newPlan._id } },
      ).session(session)
    }

    let payment = null
    let amountToPay = 0
    let creditToWallet = 0

    if (changeType === 'upgrade') {
      amountToPay = externalPayment ? Number(externalPayment.amount || amountToPayPreview) : amountToPayPreview
      const walletPart = externalPayment
        ? Math.max(0, Number(externalPayment.metadata?.walletUsed || 0))
        : amountToPay

      if (!externalPayment && wallet.balance < amountToPay) {
        fail(400, `Số dư không đủ. Cần ${amountToPay.toLocaleString('vi-VN')}đ nhưng ví chỉ có ${wallet.balance.toLocaleString('vi-VN')}đ`)
      }

      if (amountToPay > 0) {
        const reservationHeld = externalPayment?.metadata?.walletReservationStatus === 'HELD'
        const balanceBefore = reservationHeld
          ? Number(externalPayment.metadata?.walletBalanceAtCheckout ?? wallet.balance ?? 0)
          : Number(wallet.balance || 0)
        if (walletPart > 0) {
          if (reservationHeld) {
            wallet = await consumeWalletPaymentReservation({
              userId: memberId,
              walletId: wallet._id,
              amount: walletPart,
              session,
            })
          } else {
            wallet = await Wallet.findOneAndUpdate(
              { _id: wallet._id, balance: { $gte: walletPart } },
              buildSpendDebitUpdate(walletPart),
              { new: true, session, updatePipeline: true },
            )
            if (!wallet) fail(400, 'Số dư ví không đủ')
          }
        }

        if (externalPayment) {
          payment = externalPayment
          payment.status = 'PAID'
          payment.paidAt = new Date()
          payment.completedAt = new Date()
          payment.paymentMethod = 'VNPAY'
          payment.planId = newPlan._id
          payment.membershipId = membershipId
          payment.metadata = {
            ...(payment.metadata || {}),
            purpose: 'PLAN_PURCHASE',
            planChange: true,
            changeType,
            walletUsed: walletPart,
            walletReservationStatus: reservationHeld ? 'CONSUMED' : externalPayment.metadata?.walletReservationStatus || 'NONE',
            ...(reservationHeld ? { walletReservationConsumedAt: new Date() } : {}),
            walletBalanceBefore: balanceBefore,
            walletBalanceAfter: wallet.balance,
            finalizedAt: new Date(),
          }
          await payment.save({ session })
        } else {
          const [p] = await Payment.create([{
            userId: memberId, planId: newPlan._id, membershipId,
            amount: amountToPay, currency: 'vnd', status: 'PAID', paymentMethod: 'WALLET', source: 'ONLINE', paidAt: new Date(),
            metadata: { changeType, fromPlanId: oldPlan._id, remainingDays, remainingValue, currentDailyValue, walletBalanceBefore: balanceBefore, walletBalanceAfter: wallet.balance },
          }], { session })
          payment = p
        }

        await Transaction.create([{
          userId: memberId, walletId: wallet._id, type: 'payment', provider: 'wallet', source: 'plan_change',
          description: `Đổi gói: ${oldPlan.nameVi} -> ${newPlan.nameVi}`, amount: -walletPart,
          balanceBefore, balanceAfter: wallet.balance, referenceId: payment._id.toString(), status: 'completed', completedAt: new Date(),
          metadata: {
            fromPlan: oldPlan.nameVi, toPlan: newPlan.nameVi,
            remainingDays, remainingValue,
            paymentMethod: externalPayment ? 'VNPAY' : 'WALLET',
          },
          idempotencyKey: externalPayment
            ? `change_${membershipId}_${newPlan._id}_${externalPayment._id}`
            : `change_${membershipId}_${newPlan._id}`,
        }], { session })
      }
    } else {
      creditToWallet = creditToWalletPreview
      if (creditToWallet > 0) {
        const balanceBefore = Number(wallet.balance || 0)
        wallet.balance += creditToWallet
        wallet.withdrawableBalance = Number(wallet.withdrawableBalance || 0) + creditToWallet
        await wallet.save({ session })

        await Transaction.create([{
          userId: memberId, walletId: wallet._id, type: 'REFUND_TO_WALLET', provider: 'wallet', source: 'plan_change',
          description: `Đổi gói: ${oldPlan.nameVi} -> ${newPlan.nameVi}. Hoàn ${creditToWallet.toLocaleString('vi-VN')}đ vào ví.`,
          amount: creditToWallet, balanceBefore, balanceAfter: wallet.balance,
          referenceId: membershipId.toString(), status: 'completed', completedAt: new Date(),
          metadata: { fromPlan: oldPlan.nameVi, toPlan: newPlan.nameVi, remainingDays, remainingValue },
          idempotencyKey: `change_credit_${membershipId}_${newPlan._id}`,
        }], { session })
      }
    }

    const changeDate = new Date()
    const newStartDate = new Date(changeDate)
    newStartDate.setHours(0, 0, 0, 0)
    const newEndDate = calcMembershipEndDate({ baseDate: newStartDate, durationDays: newPlan.durationDays })

    if (activePeriod) {
      activePeriod.status = 'COMPLETED'
      activePeriod.endDate = new Date(changeDate)
      activePeriod.completedAt = new Date(changeDate)
      await activePeriod.save({ session })
    }

    await MembershipPeriod.create([{
      membershipId,
      planId: newPlan._id,
      memberId,
      startDate: newStartDate,
      endDate: newEndDate,
      totalDays: newPlan.durationDays,
      price: newPlan.price,
      paymentId: payment?._id || null,
      status: 'ACTIVE',
      activatedAt: new Date(),
    }], { session })
    await MembershipCycle.updateOne(
      { _id: cycle._id },
      {
        $set: {
          currentPlanId: newPlan._id,
          startDate: newStartDate,
          expiresAt: newEndDate,
          durationDays: newPlan.durationDays,
          activatedAt: new Date(),
        },
      },
    ).session(session)

    await Membership.updateOne(
      { _id: membershipId },
      { $set: { planId: newPlan._id } },
    ).session(session)

    const [oldCodes, newCodes] = await Promise.all([
      resolvePlanFeatureCodes(oldPlan),
      resolvePlanFeatureCodes(newPlan),
    ])

    await PlanChangeHistory.create([{
      memberId, membershipId, cycleId: cycle._id,
      fromPlanId: oldPlan._id, toPlanId: newPlan._id, changeType,
      amount: amountToPay, walletCredit: creditToWallet,
      paymentId: payment?._id || null,
      oldPlanRemainingDays: remainingDays,
      oldPlanRemainingValue: remainingValue,
      newStartDate,
      newEndDate,
      featureSnapshot: { from: oldCodes, to: newCodes },
    }], { session })

    try {
      await cleanupMemberBenefitsOnPlanChange({ memberId, oldPlan, newPlan, session })
    } catch (ptErr) {
      console.error(`[PLAN_CHANGE] Cleanup failed for member ${memberId}:`, ptErr)
      fail(500, 'Không thể dọn dẹp dữ liệu gói tập. Giao dịch đã được hủy.')
    }

    await session.commitTransaction()
    committed = true

    const populated = await Membership.findById(membershipId)
      .populate({ path: 'planId', populate: { path: 'featureIds', model: 'PlanFeature' } })

    return {
      changeType,
      oldPlanName: oldPlan.nameVi,
      newPlanName: newPlan.nameVi,
      amountToPay,
      creditToWallet,
      oldPlanPrice: oldPlan.price,
      oldPlanDurationDays: oldPlan.durationDays || cycle.durationDays,
      remainingDays,
      currentDailyValue,
      remainingValue,
      newPlanPrice: newPlan.price,
      newPlanDurationDays: newPlan.durationDays,
      newStartDate,
      newEndDate,
      payment,
      membership: populated,
    }
  } catch (error) {
    if (!committed && session.inTransaction()) {
      await session.abortTransaction().catch(() => {})
    }
    throw error
  } finally {
    session.endSession()
  }
}

export const getAvailablePlans = async (req, res) => {
  try {
    const memberId = req.user._id
    const cycle = await MembershipCycle.findOne({ memberId, status: 'active' })
      .populate('currentPlanId')

    if (!cycle) return res.status(404).json({ message: 'Không tìm thấy gói tập đang hoạt động' })

    const allPlans = await Plan.find({ isActive: true }).populate('featureIds').lean()

    // Kiểm tra các kỳ gia hạn chưa sử dụng
    const allPeriods = cycle.currentMembershipId
      ? await MembershipPeriod.find({ membershipId: cycle.currentMembershipId })
          .sort({ startDate: 1 })
          .lean()
      : []

    // Nguồn sự thật duy nhất: MembershipPeriod (ACTIVE).endDate, fallback cycle.expiresAt
    const activePeriod = allPeriods.find((p) => p.status === 'ACTIVE')
    const periodEndDate = activePeriod?.endDate || cycle.expiresAt
    const remainingDays = periodEndDate
      ? Math.max(0, Math.ceil((new Date(periodEndDate) - new Date()) / (1000 * 60 * 60 * 24)))
      : 0
    const currentDailyValue = Math.round(Number(cycle.currentPlanId?.price || 0) / Math.max(1, Number(cycle.currentPlanId?.durationDays || cycle.durationDays || 1)))
    const remainingValue = calcProratedValue({ plan: cycle.currentPlanId, remainingDays })

    const plans = allPlans
      .filter(p => p._id.toString() !== cycle.currentPlanId._id.toString())
      .map(p => {
        const changeType = Number(p.price || 0) > Number(cycle.currentPlanId?.price || 0) ? 'upgrade' : 'downgrade'
        const amountToPay = changeType === 'upgrade' ? Math.max(0, Number(p.price || 0) - remainingValue) : 0
        const creditToWallet = changeType === 'downgrade' ? Math.max(0, remainingValue - Number(p.price || 0)) : 0
        return {
          ...p,
          changeType,
          diff: amountToPay > 0 ? amountToPay : -creditToWallet,
          amountToPay,
          creditToWallet,
          remainingValue,
          currentDailyValue,
        }
      })

    const nowMs = Date.now()
    const pendingRenewals = allPeriods.filter(p => {
      const start = new Date(p.startDate).getTime()
      return p.status === 'PENDING' && nowMs < start
    })

    res.json({
      currentPlan: cycle.currentPlanId,
      remainingDays,
      remainingValue,
      currentDailyValue,
      cycleStatus: cycle.status,
      durationDays: cycle.durationDays || cycle.currentPlanId?.durationDays || 0,
      hasPendingRenewals: pendingRenewals.length > 0,
      pendingRenewalsCount: pendingRenewals.length,
      pendingRenewalsTotal: pendingRenewals.reduce((sum, p) => sum + (p.price || 0), 0),
      plans,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const upgradePlan = async (req, res) => {
  const { newPlanId } = req.body
  const memberId = req.user._id

  try {
    const result = await executePlanChangeCore({
      memberId,
      newPlanId,
      expectedDirection: 'upgrade',
      cancelRenewals: req.body.cancelRenewals === true,
    })

    createNotification({
      receiverId: memberId, receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
      title: 'Nâng cấp gói tập thành công',
      content: `Bạn đã nâng cấp từ gói "${result.oldPlanName}" lên "${result.newPlanName}". Thanh toán: ${result.amountToPay.toLocaleString('vi-VN')}đ.`,
      redirectUrl: '/my-membership', createdBy: 'System', sendEmail: true,
    }).catch(() => {})

    res.json({ message: 'Nâng cấp gói tập thành công', ...result })
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message })
  }
}

export const downgradePlan = async (req, res) => {
  const { newPlanId } = req.body
  const memberId = req.user._id

  try {
    const result = await executePlanChangeCore({
      memberId,
      newPlanId,
      expectedDirection: 'downgrade',
      cancelRenewals: req.body.cancelRenewals === true,
    })

    createNotification({
      receiverId: memberId, receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.MEMBERSHIP_ACTIVATED,
      title: 'Hạ cấp gói tập thành công',
      content: `Bạn đã hạ cấp từ gói "${result.oldPlanName}" xuống "${result.newPlanName}".${result.creditToWallet > 0 ? ` Đã hoàn ${result.creditToWallet.toLocaleString('vi-VN')}đ vào ví.` : ''}`,
      redirectUrl: '/my-membership', createdBy: 'System', sendEmail: true,
    }).catch(() => {})

    res.json({ message: 'Hạ cấp gói tập thành công', ...result })
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message })
  }
}

export const getChangeHistory = async (req, res) => {
  try {
    const memberId = req.user._id
    const history = await PlanChangeHistory.find({ memberId })
      .populate('fromPlanId', 'nameVi price')
      .populate('toPlanId', 'nameVi price')
      .sort({ createdAt: -1 })
    res.json({ history })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// POST /api/memberships/change-plan - doi goi thong nhat (upgrade + downgrade)
export const changePlan = async (req, res) => {
  const { newPlanId } = req.body
  const memberId = req.user._id

  try {
    const result = await executePlanChangeCore({
      memberId,
      newPlanId,
      expectedDirection: null,
      cancelRenewals: req.body.cancelRenewals === true,
    })

    const notifTitle = 'Đổi gói tập thành công'
    const notifContent = result.changeType === 'upgrade'
      ? `Bạn đã đổi từ gói "${result.oldPlanName}" sang "${result.newPlanName}". Thanh toán: ${result.amountToPay.toLocaleString('vi-VN')}đ.`
      : `Bạn đã đổi từ gói "${result.oldPlanName}" sang "${result.newPlanName}".${result.creditToWallet > 0 ? ` Đã hoàn ${result.creditToWallet.toLocaleString('vi-VN')}đ vào ví.` : ''}`

    createNotification({
      receiverId: memberId, receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
      title: notifTitle, content: notifContent,
      redirectUrl: '/my-membership', createdBy: 'System', sendEmail: true,
    }).catch(() => {})

    res.json({
      message: notifTitle,
      membership: result.membership,
      amountToPay: result.amountToPay,
      creditToWallet: result.creditToWallet,
      oldPlanPrice: result.oldPlanPrice,
      oldPlanDurationDays: result.oldPlanDurationDays,
      remainingDays: result.remainingDays,
      currentDailyValue: result.currentDailyValue,
      remainingValue: result.remainingValue,
      newPlanPrice: result.newPlanPrice,
      newPlanDurationDays: result.newPlanDurationDays,
      newStartDate: result.newStartDate,
      newEndDate: result.newEndDate,
      payment: result.payment,
    })
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message })
  }
}

/**
 * Checkout đổi gói linh hoạt (3 trường hợp):
 * - Không phát sinh phí / ví đủ → thực hiện đổi gói ngay (status = PAID)
 * - 0 < ví < phí → trừ toàn bộ ví, phần còn thiếu thanh toán VNPay (status = PARTIAL)
 * - Ví = 0 → thanh toán toàn bộ qua VNPay (status = NO_BALANCE)
 */
export const changePlanCheckout = async (req, res) => {
  const { newPlanId } = req.body
  const memberId = req.user._id
  const cancelRenewals = req.body.cancelRenewals === true

  try {
    const snap = await computePlanChangeSnapshot({ memberId, newPlanId, expectedDirection: null })
    const { changeType, amountToPayPreview, wallet, oldPlan, newPlan, remainingDays, remainingValue, currentDailyValue } = snap

    if (changeType !== 'upgrade' || amountToPayPreview <= 0 || Number(wallet.balance || 0) >= amountToPayPreview) {
      const result = await executePlanChangeCore({ memberId, newPlanId, expectedDirection: null, cancelRenewals })
      return res.json({ status: 'PAID', ...result })
    }

    const balance = Number(wallet.balance || 0)
    const walletUsed = balance
    const remaining = amountToPayPreview - balance
    const txnRef = `PLANCHANGE${Date.now()}${memberId.toString().slice(-6).toUpperCase()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`

    const session = await mongoose.startSession()
    let payment
    let reservation
    try {
      await session.withTransaction(async () => {
        reservation = await reserveWalletForPayment({
          userId: memberId,
          walletId: wallet._id,
          amount: walletUsed,
          session,
        })
        ;[payment] = await Payment.create([{
          userId: memberId,
          walletId: wallet._id,
          planId: newPlan._id,
          amount: amountToPayPreview,
          currency: 'vnd',
          status: 'PENDING',
          paymentMethod: 'VNPAY',
          method: 'VNPAY',
          source: 'ONLINE',
          txnRef,
          metadata: {
            purpose: 'PLAN_PURCHASE',
            planChange: true,
            provider: 'VNPAY',
            changeType,
            newPlanId: newPlan._id,
            oldPlanId: oldPlan._id,
            cancelRenewals,
            totalAmount: amountToPayPreview,
            walletUsed,
            remainingAmount: remaining,
            walletBalanceAtCheckout: reservation.balanceBefore,
            walletBalanceAfterReservation: reservation.balanceAfter,
            walletReservedAmount: walletUsed,
            walletWithdrawableReserved: reservation.withdrawableReserved,
            walletReservationStatus: walletUsed > 0 ? 'HELD' : 'NONE',
            walletReservedAt: walletUsed > 0 ? new Date() : null,
            remainingDays,
            remainingValue,
            currentDailyValue,
            oldPlanName: oldPlan.nameVi,
            newPlanName: newPlan.nameVi,
          },
        }], { session })
      })
    } finally {
      session.endSession()
    }

    const paymentUrl = createVnpayPaymentUrl({
      amount: remaining,
      txnRef,
      orderInfo: `Doi goi tap GymPro ${txnRef}`,
      ipAddr: getClientIp(req),
      locale: req.body.locale || 'vn',
    })

    return res.json({
      status: balance > 0 ? 'PARTIAL' : 'NO_BALANCE',
      totalAmount: amountToPayPreview,
      walletBalance: reservation?.balanceAfter ?? balance,
      walletUsed,
      remainingAmount: remaining,
      paymentId: payment._id,
      txnRef,
      paymentUrl,
      changeType,
      oldPlanName: oldPlan.nameVi,
      newPlanName: newPlan.nameVi,
    })
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message })
  }
}

/**
 * Hoàn tất đổi gói sau khi VNPay xác nhận thanh toán (idempotent).
 */
export const finalizePlanChangePurchase = async ({ paymentId }) => {
  const payment = await Payment.findById(paymentId)
  if (!payment) fail(404, 'Không tìm thấy giao dịch thanh toán')
  if (String(payment.status).toUpperCase() === 'PAID') return { alreadyPaid: true }
  if (String(payment.status).toUpperCase() !== 'PENDING') fail(400, 'Giao dịch không còn ở trạng thái chờ thanh toán')

  const meta = payment.metadata || {}
  const result = await executePlanChangeCore({
    memberId: payment.userId,
    newPlanId: meta.newPlanId,
    expectedDirection: null,
    cancelRenewals: meta.cancelRenewals === true,
    externalPayment: payment,
  })
  return { ...result, alreadyPaid: false }
}
