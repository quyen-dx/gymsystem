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
import { cleanupMemberBenefitsOnPlanChange, resolvePlanFeatureCodes } from '../services/membershipService.js'

function calcProratedValue(cycle, plan) {
  const now = new Date()
  const start = new Date(cycle.startDate)
  const end = new Date(cycle.expiresAt)
  const totalDuration = end.getTime() - start.getTime()
  const remaining = end.getTime() - now.getTime()
  if (totalDuration <= 0 || remaining <= 0) return 0
  const ratio = remaining / totalDuration
  return Math.round(plan.price * ratio)
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

/**
 * Core thống nhất cho mọi luồng đổi gói (upgrade/downgrade/change_plan).
 * - Tính phí theo chênh lệch giá full (khớp contract FE + available-plans).
 * - Đồng bộ MembershipCycle.currentPlanId + Membership.planId.
 * - Xử lý MembershipPeriod PENDING (hủy+hoàn nếu cancelRenewals, ngược lại trỏ sang gói mới).
 * - Ghi PlanChangeHistory kèm cycleId + featureSnapshot.
 * - Gọi cleanupMemberBenefitsOnPlanChange để dọn dữ liệu PT/class/waitlist/request không còn hợp lệ.
 */
const executePlanChangeCore = async ({ memberId, newPlanId, expectedDirection, cancelRenewals = false }) => {
  const session = await mongoose.startSession()
  session.startTransaction()
  let committed = false

  try {
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

    const diff = newPlan.price - oldPlan.price
    const changeType = diff > 0 ? 'upgrade' : 'downgrade'

    const wallet = await getOrCreateWallet({ memberId, session })

    // Kỳ gia hạn PENDING: hủy + hoàn tiền nếu cancelRenewals, ngược lại trỏ sang gói mới
    const nowMs = Date.now()
    const pendingPeriods = membershipId
      ? await MembershipPeriod.find({ membershipId, status: 'PENDING' })
          .sort({ startDate: 1 }).session(session).lean()
      : []
    const futurePending = pendingPeriods.filter(p => nowMs < new Date(p.startDate).getTime())

    if (cancelRenewals) {
      for (const p of futurePending) {
        if ((p.price || 0) > 0) {
          const balanceBefore = Number(wallet.balance || 0)
          wallet.balance += p.price
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

    if (diff > 0) {
      amountToPay = diff
      if (wallet.balance < amountToPay) {
        fail(400, `Số dư không đủ. Cần ${amountToPay.toLocaleString('vi-VN')}đ nhưng ví chỉ có ${wallet.balance.toLocaleString('vi-VN')}đ`)
      }

      const balanceBefore = wallet.balance
      wallet.balance -= amountToPay
      await wallet.save({ session })

      const [p] = await Payment.create([{
        userId: memberId, planId: newPlan._id, membershipId,
        amount: amountToPay, currency: 'vnd', status: 'PAID', paymentMethod: 'WALLET', source: 'ONLINE', paidAt: new Date(),
        metadata: { changeType, fromPlanId: oldPlan._id, walletBalanceBefore: balanceBefore, walletBalanceAfter: wallet.balance },
      }], { session })
      payment = p

      await Transaction.create([{
        userId: memberId, walletId: wallet._id, type: 'payment', provider: 'wallet', source: 'plan_change',
        description: `Đổi gói: ${oldPlan.nameVi} → ${newPlan.nameVi}`, amount: -amountToPay,
        balanceBefore, balanceAfter: wallet.balance, referenceId: p._id.toString(), status: 'completed', completedAt: new Date(),
        metadata: { fromPlan: oldPlan.nameVi, toPlan: newPlan.nameVi },
        idempotencyKey: `change_${membershipId}_${newPlan._id}`,
      }], { session })
    } else if (diff < 0) {
      creditToWallet = Math.abs(diff)
      if (creditToWallet > 0) {
        const balanceBefore = wallet.balance
        wallet.balance += creditToWallet
        await wallet.save({ session })

        await Transaction.create([{
          userId: memberId, walletId: wallet._id, type: 'deposit', provider: 'wallet', source: 'plan_change',
          description: `Đổi gói: ${oldPlan.nameVi} → ${newPlan.nameVi}. Hoàn ${creditToWallet.toLocaleString('vi-VN')}đ vào ví.`,
          amount: creditToWallet, balanceBefore, balanceAfter: wallet.balance,
          referenceId: membershipId.toString(), status: 'completed', completedAt: new Date(),
          metadata: { fromPlan: oldPlan.nameVi, toPlan: newPlan.nameVi },
          idempotencyKey: `change_credit_${membershipId}_${newPlan._id}`,
        }], { session })
      }
    }

    await MembershipCycle.updateOne(
      { _id: cycle._id },
      { $set: { currentPlanId: newPlan._id } },
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

    const currentPrice = cycle.currentPlanId?.price || 0
    const remainingValue = calcProratedValue(cycle, cycle.currentPlanId)

    const allPlans = await Plan.find({ isActive: true }).populate('featureIds').lean()

    const plans = allPlans
      .filter(p => p._id.toString() !== cycle.currentPlanId._id.toString())
      .map(p => ({
        ...p,
        diff: p.price - currentPrice,
      }))

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

    const nowMs = Date.now()
    const pendingRenewals = allPeriods.filter(p => {
      const start = new Date(p.startDate).getTime()
      return p.status === 'PENDING' && nowMs < start
    })

    res.json({
      currentPlan: cycle.currentPlanId,
      remainingDays,
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

    res.json({ message: 'Nâng cấp gói tập thành công', membership: result.membership, payment: result.payment })
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

    res.json({ message: 'Hạ cấp gói tập thành công', membership: result.membership, creditToWallet: result.creditToWallet })
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
      payment: result.payment,
    })
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message })
  }
}
