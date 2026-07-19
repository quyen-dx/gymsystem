import mongoose from 'mongoose'
import Plan from '../models/Plan.js'
import Membership from '../models/Membership.js'
import MembershipCycle from '../models/MembershipCycle.js'
import PlanChangeHistory from '../models/PlanChangeHistory.js'
import Payment from '../models/Payment.js'
import Wallet from '../models/Wallet.js'
import Transaction from '../models/Transaction.js'
import { createNotification } from '../services/notificationService.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { handlePTDataOnPlanChange } from '../services/membershipService.js'

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

    res.json({
      currentPlan: cycle.currentPlanId,
      remainingDays: Math.max(0, Math.ceil((new Date(cycle.expiresAt) - new Date()) / (1000 * 60 * 60 * 24))),
      plans,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const upgradePlan = async (req, res) => {
  const { newPlanId } = req.body
  const memberId = req.user._id

  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const cycle = await MembershipCycle.findOne({ memberId, status: 'active' })
      .populate('currentPlanId').session(session)
    if (!cycle) {
      await session.abortTransaction()
      return res.status(404).json({ message: 'Không tìm thấy gói tập đang hoạt động' })
    }

    const membershipId = cycle.currentMembershipId

    const newPlan = await Plan.findById(newPlanId).session(session)
    if (!newPlan) {
      await session.abortTransaction()
      return res.status(404).json({ message: 'Không tìm thấy gói mới' })
    }

    if (newPlan.price <= cycle.currentPlanId.price) {
      await session.abortTransaction()
      return res.status(400).json({ message: 'Gói mới phải có giá cao hơn gói hiện tại để nâng cấp' })
    }

    const oldPlan = cycle.currentPlanId
    const remainingValue = calcProratedValue(cycle, oldPlan)
    const amountToPay = Math.max(0, newPlan.price - remainingValue)

    const wallet = await Wallet.findOne({ userId: memberId }).session(session)
    if (!wallet || wallet.balance < amountToPay) {
      await session.abortTransaction()
      return res.status(400).json({ message: `Số dư không đủ. Cần ${amountToPay.toLocaleString('vi-VN')}đ nhưng ví chỉ có ${(wallet?.balance || 0).toLocaleString('vi-VN')}đ` })
    }

    const balanceBefore = wallet.balance
    wallet.balance -= amountToPay
    await wallet.save({ session })

    const [payment] = await Payment.create([{
      userId: memberId,
      planId: newPlan._id,
      membershipId,
      amount: amountToPay,
      currency: 'vnd',
      status: 'PAID',
      paymentMethod: 'WALLET',
      source: 'ONLINE',
      paidAt: new Date(),
      metadata: {
        changeType: 'upgrade',
        fromPlanId: oldPlan._id,
        proratedCredit: remainingValue,
        walletBalanceBefore: balanceBefore,
        walletBalanceAfter: wallet.balance,
      },
    }], { session })

    await Transaction.create([{
      userId: memberId,
      walletId: wallet._id,
      type: 'payment',
      provider: 'wallet',
      source: 'plan_upgrade',
      description: `Nâng cấp gói: ${oldPlan.nameVi} → ${newPlan.nameVi}`,
      amount: -amountToPay,
      balanceBefore,
      balanceAfter: wallet.balance,
      referenceId: payment._id.toString(),
      status: 'completed',
      completedAt: new Date(),
      metadata: { paymentId: payment._id, fromPlan: oldPlan.nameVi, toPlan: newPlan.nameVi, proratedCredit: remainingValue },
      idempotencyKey: `upgrade_${membershipId}_${newPlan._id}`,
    }], { session })

    const oldPlanId = oldPlan._id
    const oldPlanName = oldPlan.nameVi

    await MembershipCycle.updateOne(
      { _id: cycle._id },
      { $set: { currentPlanId: newPlan._id } },
    ).session(session)

    await PlanChangeHistory.create([{
      memberId,
      membershipId,
      fromPlanId: oldPlanId,
      toPlanId: newPlan._id,
      changeType: 'upgrade',
      amount: amountToPay,
      proratedCredit: remainingValue,
      paymentId: payment._id,
    }], { session })

    try {
      await handlePTDataOnPlanChange({ memberId, oldPlan, newPlan, session })
    } catch (ptErr) {
      console.error(`[PLAN_CHANGE] PT cleanup failed for member ${memberId}:`, ptErr)
      await session.abortTransaction()
      return res.status(500).json({ message: 'Không thể dọn dẹp dữ liệu PT. Giao dịch đã được hủy.' })
    }

    await session.commitTransaction()

    createNotification({
      receiverId: memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
      title: 'Nâng cấp gói tập thành công',
      content: `Bạn đã nâng cấp từ gói "${oldPlanName}" lên "${newPlan.nameVi}". Thanh toán: ${amountToPay.toLocaleString('vi-VN')}đ.`,
      redirectUrl: '/my-membership',
      createdBy: 'System',
      sendEmail: true,
    }).catch(() => {})

    const populated = await Membership.findById(membershipId).populate('planId')
    res.json({ message: 'Nâng cấp gói tập thành công', membership: populated, payment })
  } catch (error) {
    await session.abortTransaction()
    res.status(500).json({ message: error.message })
  } finally {
    session.endSession()
  }
}

export const downgradePlan = async (req, res) => {
  const { newPlanId } = req.body
  const memberId = req.user._id

  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const cycle = await MembershipCycle.findOne({ memberId, status: 'active' })
      .populate('currentPlanId').session(session)
    if (!cycle) {
      await session.abortTransaction()
      return res.status(404).json({ message: 'Không tìm thấy gói tập đang hoạt động' })
    }

    const membershipId = cycle.currentMembershipId

    const newPlan = await Plan.findById(newPlanId).session(session)
    if (!newPlan) {
      await session.abortTransaction()
      return res.status(404).json({ message: 'Không tìm thấy gói mới' })
    }

    if (newPlan.price >= cycle.currentPlanId.price) {
      await session.abortTransaction()
      return res.status(400).json({ message: 'Gói mới phải có giá thấp hơn gói hiện tại để hạ cấp' })
    }

    const oldPlan = cycle.currentPlanId
    const remainingValue = calcProratedValue(cycle, oldPlan)
    const newPlanCost = Math.round(newPlan.price * (remainingValue / oldPlan.price))
    const creditToWallet = remainingValue - newPlanCost

    let wallet = await Wallet.findOne({ userId: memberId }).session(session)
    if (!wallet) {
      [wallet] = await Wallet.create([{ userId: memberId, balance: 0 }], { session })
    }
    const balanceBefore = wallet.balance
    if (creditToWallet > 0) {
      wallet.balance += creditToWallet
      await wallet.save({ session })
    }

    if (creditToWallet > 0) {
      await Transaction.create([{
        userId: memberId,
        walletId: wallet._id,
        type: 'deposit',
        provider: 'wallet',
        source: 'plan_downgrade',
        description: `Hạ cấp gói: ${oldPlan.nameVi} → ${newPlan.nameVi}. Hoàn ${creditToWallet.toLocaleString('vi-VN')}đ vào ví.`,
        amount: creditToWallet,
        balanceBefore,
        balanceAfter: wallet.balance,
        referenceId: membershipId.toString(),
        status: 'completed',
        completedAt: new Date(),
        metadata: { fromPlan: oldPlan.nameVi, toPlan: newPlan.nameVi, remainingValue, newPlanCost },
        idempotencyKey: `downgrade_${membershipId}_${newPlan._id}`,
      }], { session })
    }

    const oldPlanId = oldPlan._id
    const oldPlanName = oldPlan.nameVi

    await MembershipCycle.updateOne(
      { _id: cycle._id },
      { $set: { currentPlanId: newPlan._id } },
    ).session(session)

    await PlanChangeHistory.create([{
      memberId,
      membershipId,
      fromPlanId: oldPlanId,
      toPlanId: newPlan._id,
      changeType: 'downgrade',
      walletCredit: creditToWallet,
    }], { session })

    try {
      await handlePTDataOnPlanChange({ memberId, oldPlan, newPlan, session })
    } catch (ptErr) {
      console.error(`[PLAN_CHANGE] PT cleanup failed for member ${memberId}:`, ptErr)
      await session.abortTransaction()
      return res.status(500).json({ message: 'Không thể dọn dẹp dữ liệu PT. Giao dịch đã được hủy.' })
    }

    await session.commitTransaction()

    createNotification({
      receiverId: memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.MEMBERSHIP_ACTIVATED,
      title: 'Hạ cấp gói tập thành công',
      content: `Bạn đã hạ cấp từ gói "${oldPlanName}" xuống "${newPlan.nameVi}".${creditToWallet > 0 ? ` Đã hoàn ${creditToWallet.toLocaleString('vi-VN')}đ vào ví.` : ''}`,
      redirectUrl: '/my-membership',
      createdBy: 'System',
      sendEmail: true,
    }).catch(() => {})

    const populated = await Membership.findById(membershipId).populate('planId')
    res.json({ message: 'Hạ cấp gói tập thành công', membership: populated, creditToWallet })
  } catch (error) {
    await session.abortTransaction()
    res.status(500).json({ message: error.message })
  } finally {
    session.endSession()
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

  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const cycle = await MembershipCycle.findOne({ memberId, status: 'active' })
      .populate('currentPlanId').session(session)
    if (!cycle) {
      await session.abortTransaction()
      return res.status(404).json({ message: 'Không tìm thấy gói tập đang hoạt động' })
    }

    const membershipId = cycle.currentMembershipId

    const newPlan = await Plan.findById(newPlanId).populate('featureIds').session(session)
    if (!newPlan) {
      await session.abortTransaction()
      return res.status(404).json({ message: 'Không tìm thấy gói mới' })
    }

    if (newPlan._id.toString() === cycle.currentPlanId._id.toString()) {
      await session.abortTransaction()
      return res.status(400).json({ message: 'Gói mới phải khác gói hiện tại' })
    }

    const oldPlan = cycle.currentPlanId
    const diff = newPlan.price - oldPlan.price
    const changeType = diff > 0 ? 'upgrade' : 'downgrade'

    let wallet = await Wallet.findOne({ userId: memberId }).session(session)
    if (!wallet) {
      [wallet] = await Wallet.create([{ userId: memberId, balance: 0 }], { session })
    }

    let payment = null
    let amountToPay = 0
    let creditToWallet = 0

    if (diff > 0) {
      amountToPay = diff
      if (wallet.balance < amountToPay) {
        await session.abortTransaction()
        return res.status(400).json({ message: `Số dư không đủ. Cần ${amountToPay.toLocaleString('vi-VN')}đ nhưng ví chỉ có ${wallet.balance.toLocaleString('vi-VN')}đ` })
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
    } else {
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

    const oldPlanId = oldPlan._id
    const oldPlanName = oldPlan.nameVi

    await MembershipCycle.updateOne(
      { _id: cycle._id },
      { $set: { currentPlanId: newPlan._id } },
    ).session(session)

    await PlanChangeHistory.create([{
      memberId, membershipId, fromPlanId: oldPlanId, toPlanId: newPlan._id, changeType,
      amount: amountToPay, walletCredit: creditToWallet,
      paymentId: payment?._id || null,
    }], { session })

    try {
      await handlePTDataOnPlanChange({ memberId, oldPlan, newPlan, session })
    } catch (ptErr) {
      console.error(`[PLAN_CHANGE] PT cleanup failed for member ${memberId}:`, ptErr)
      await session.abortTransaction()
      return res.status(500).json({ message: 'Không thể dọn dẹp dữ liệu PT. Giao dịch đã được hủy.' })
    }

    await session.commitTransaction()

    const notifTitle = 'Đổi gói tập thành công'
    const notifContent = changeType === 'upgrade'
      ? `Bạn đã đổi từ gói "${oldPlanName}" sang "${newPlan.nameVi}". Thanh toán: ${amountToPay.toLocaleString('vi-VN')}đ.`
      : `Bạn đã đổi từ gói "${oldPlanName}" sang "${newPlan.nameVi}".${creditToWallet > 0 ? ` Đã hoàn ${creditToWallet.toLocaleString('vi-VN')}đ vào ví.` : ''}`

    createNotification({
      receiverId: memberId, receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
      title: notifTitle, content: notifContent,
      redirectUrl: '/my-membership', createdBy: 'System', sendEmail: true,
    }).catch(() => {})

    const populated = await Membership.findById(membershipId).populate('planId')
    res.json({ message: notifTitle, membership: populated, amountToPay, creditToWallet, payment })
  } catch (error) {
    await session.abortTransaction()
    res.status(500).json({ message: error.message })
  } finally {
    session.endSession()
  }
}
