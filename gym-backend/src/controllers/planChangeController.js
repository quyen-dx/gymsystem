import mongoose from 'mongoose'
import Plan from '../models/Plan.js'
import Membership from '../models/Membership.js'
import PlanChangeHistory from '../models/PlanChangeHistory.js'
import Payment from '../models/Payment.js'
import Wallet from '../models/Wallet.js'
import Transaction from '../models/Transaction.js'
import { createNotification } from '../services/notificationService.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { handlePTDataOnPlanChange } from '../services/membershipService.js'

function calcProratedValue(membership, plan) {
  const now = new Date()
  const start = new Date(membership.startDate)
  const end = new Date(membership.endDate)
  const totalDuration = end.getTime() - start.getTime()
  const remaining = end.getTime() - now.getTime()
  if (totalDuration <= 0 || remaining <= 0) return 0
  const ratio = remaining / totalDuration
  return Math.round(plan.price * ratio)
}

export const getAvailablePlans = async (req, res) => {
  try {
    const memberId = req.user._id
    const membership = await Membership.findOne({ memberId, status: { $in: ['active', 'pending_cancel'] } })
      .populate('planId')

    if (!membership) return res.status(404).json({ message: 'Không tìm thấy gói tập đang hoạt động' })

    const currentPrice = membership.planId?.price || 0
    const remainingValue = calcProratedValue(membership, membership.planId)

    const allPlans = await Plan.find({ isActive: true }).populate('featureIds').lean()

    const plans = allPlans
      .filter(p => p._id.toString() !== membership.planId._id.toString())
      .map(p => ({
        ...p,
        diff: p.price - currentPrice, // >0: can tra, <0: hoan vao vi
      }))

    res.json({
      currentPlan: membership.planId,
      remainingDays: Math.max(0, Math.ceil((new Date(membership.endDate) - new Date()) / (1000 * 60 * 60 * 24))),
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
    const membership = await Membership.findOne({ memberId, status: { $in: ['active', 'pending_cancel'] } })
      .populate('planId').session(session)
    if (!membership) {
      await session.abortTransaction()
      return res.status(404).json({ message: 'Không tìm thấy gói tập đang hoạt động' })
    }

    const newPlan = await Plan.findById(newPlanId).session(session)
    if (!newPlan) {
      await session.abortTransaction()
      return res.status(404).json({ message: 'Không tìm thấy gói mới' })
    }

    if (newPlan.price <= membership.planId.price) {
      await session.abortTransaction()
      return res.status(400).json({ message: 'Gói mới phải có giá cao hơn gói hiện tại để nâng cấp' })
    }

    const oldPlan = membership.planId
    const remainingValue = calcProratedValue(membership, oldPlan)
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
      membershipId: membership._id,
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
      idempotencyKey: `upgrade_${membership._id}_${newPlan._id}`,
    }], { session })

    const oldPlanId = oldPlan._id
    const oldPlanName = oldPlan.nameVi
    membership.planId = newPlan._id
    membership.source = 'wallet'
    await membership.save({ session })

    await PlanChangeHistory.create([{
      memberId,
      membershipId: membership._id,
      fromPlanId: oldPlanId,
      toPlanId: newPlan._id,
      changeType: 'upgrade',
      amount: amountToPay,
      proratedCredit: remainingValue,
      paymentId: payment._id,
    }], { session })

    // Handle PT data changes WITHIN transaction so that failure rolls back plan change
    try {
      await handlePTDataOnPlanChange({ memberId, oldPlan, newPlan, session })
    } catch (ptErr) {
      console.error(`[PLAN_CHANGE] PT cleanup failed for member ${memberId}:`, ptErr)
      await session.abortTransaction()
      return res.status(500).json({ message: 'Không thể dọn dẹp dữ liệu PT. Giao dịch đã được hủy.' })
    }

    await session.commitTransaction()

    // Notifications (outside transaction, failure is acceptable)
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

    const populated = await Membership.findById(membership._id).populate('planId')
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
    const membership = await Membership.findOne({ memberId, status: { $in: ['active', 'pending_cancel'] } })
      .populate('planId').session(session)
    if (!membership) {
      await session.abortTransaction()
      return res.status(404).json({ message: 'Không tìm thấy gói tập đang hoạt động' })
    }

    const newPlan = await Plan.findById(newPlanId).session(session)
    if (!newPlan) {
      await session.abortTransaction()
      return res.status(404).json({ message: 'Không tìm thấy gói mới' })
    }

    if (newPlan.price >= membership.planId.price) {
      await session.abortTransaction()
      return res.status(400).json({ message: 'Gói mới phải có giá thấp hơn gói hiện tại để hạ cấp' })
    }

    const oldPlan = membership.planId
    const remainingValue = calcProratedValue(membership, oldPlan)
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
        referenceId: membership._id.toString(),
        status: 'completed',
        completedAt: new Date(),
        metadata: { fromPlan: oldPlan.nameVi, toPlan: newPlan.nameVi, remainingValue, newPlanCost },
        idempotencyKey: `downgrade_${membership._id}_${newPlan._id}`,
      }], { session })
    }

    const oldPlanId = oldPlan._id
    const oldPlanName = oldPlan.nameVi
    membership.planId = newPlan._id
    membership.source = 'wallet'
    await membership.save({ session })

    await PlanChangeHistory.create([{
      memberId,
      membershipId: membership._id,
      fromPlanId: oldPlanId,
      toPlanId: newPlan._id,
      changeType: 'downgrade',
      walletCredit: creditToWallet,
    }], { session })

    // Handle PT data changes WITHIN transaction
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

    const populated = await Membership.findById(membership._id).populate('planId')
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
    const membership = await Membership.findOne({ memberId, status: { $in: ['active', 'pending_cancel'] } })
      .populate('planId').session(session)
    if (!membership) {
      await session.abortTransaction()
      return res.status(404).json({ message: 'Không tìm thấy gói tập đang hoạt động' })
    }

    const newPlan = await Plan.findById(newPlanId).populate('featureIds').session(session)
    if (!newPlan) {
      await session.abortTransaction()
      return res.status(404).json({ message: 'Không tìm thấy gói mới' })
    }

    if (newPlan._id.toString() === membership.planId._id.toString()) {
      await session.abortTransaction()
      return res.status(400).json({ message: 'Gói mới phải khác gói hiện tại' })
    }

    const oldPlan = membership.planId
    const diff = newPlan.price - oldPlan.price // >0: can tra, <0: hoan vao vi
    const changeType = diff > 0 ? 'upgrade' : 'downgrade'

    let wallet = await Wallet.findOne({ userId: memberId }).session(session)
    if (!wallet) {
      [wallet] = await Wallet.create([{ userId: memberId, balance: 0 }], { session })
    }

    let payment = null
    let amountToPay = 0
    let creditToWallet = 0

    if (diff > 0) {
      // Can thanh toan them
      amountToPay = diff
      if (wallet.balance < amountToPay) {
        await session.abortTransaction()
        return res.status(400).json({ message: `Số dư không đủ. Cần ${amountToPay.toLocaleString('vi-VN')}đ nhưng ví chỉ có ${wallet.balance.toLocaleString('vi-VN')}đ` })
      }

      const balanceBefore = wallet.balance
      wallet.balance -= amountToPay
      await wallet.save({ session })

      const [p] = await Payment.create([{
        userId: memberId, planId: newPlan._id, membershipId: membership._id,
        amount: amountToPay, currency: 'vnd', status: 'PAID', paymentMethod: 'WALLET', source: 'ONLINE', paidAt: new Date(),
        metadata: { changeType, fromPlanId: oldPlan._id, walletBalanceBefore: balanceBefore, walletBalanceAfter: wallet.balance },
      }], { session })
      payment = p

      await Transaction.create([{
        userId: memberId, walletId: wallet._id, type: 'payment', provider: 'wallet', source: 'plan_change',
        description: `Đổi gói: ${oldPlan.nameVi} → ${newPlan.nameVi}`, amount: -amountToPay,
        balanceBefore, balanceAfter: wallet.balance, referenceId: p._id.toString(), status: 'completed', completedAt: new Date(),
        metadata: { fromPlan: oldPlan.nameVi, toPlan: newPlan.nameVi },
        idempotencyKey: `change_${membership._id}_${newPlan._id}`,
      }], { session })
    } else {
      // Hoan vao vi
      creditToWallet = Math.abs(diff)
      if (creditToWallet > 0) {
        const balanceBefore = wallet.balance
        wallet.balance += creditToWallet
        await wallet.save({ session })

        await Transaction.create([{
          userId: memberId, walletId: wallet._id, type: 'deposit', provider: 'wallet', source: 'plan_change',
          description: `Đổi gói: ${oldPlan.nameVi} → ${newPlan.nameVi}. Hoàn ${creditToWallet.toLocaleString('vi-VN')}đ vào ví.`,
          amount: creditToWallet, balanceBefore, balanceAfter: wallet.balance,
          referenceId: membership._id.toString(), status: 'completed', completedAt: new Date(),
          metadata: { fromPlan: oldPlan.nameVi, toPlan: newPlan.nameVi },
          idempotencyKey: `change_credit_${membership._id}_${newPlan._id}`,
        }], { session })
      }
    }

    const oldPlanId = oldPlan._id
    const oldPlanName = oldPlan.nameVi
    membership.planId = newPlan._id
    membership.source = 'wallet'
    await membership.save({ session })

    await PlanChangeHistory.create([{
      memberId, membershipId: membership._id, fromPlanId: oldPlanId, toPlanId: newPlan._id, changeType,
      amount: amountToPay, walletCredit: creditToWallet,
      paymentId: payment?._id || null,
    }], { session })

    // Handle PT data changes WITHIN transaction
    try {
      await handlePTDataOnPlanChange({ memberId, oldPlan, newPlan, session })
    } catch (ptErr) {
      console.error(`[PLAN_CHANGE] PT cleanup failed for member ${memberId}:`, ptErr)
      await session.abortTransaction()
      return res.status(500).json({ message: 'Không thể dọn dẹp dữ liệu PT. Giao dịch đã được hủy.' })
    }

    await session.commitTransaction()

    const notifTitle = changeType === 'upgrade' ? 'Đổi gói tập thành công' : 'Đổi gói tập thành công'
    const notifContent = changeType === 'upgrade'
      ? `Bạn đã đổi từ gói "${oldPlanName}" sang "${newPlan.nameVi}". Thanh toán: ${amountToPay.toLocaleString('vi-VN')}đ.`
      : `Bạn đã đổi từ gói "${oldPlanName}" sang "${newPlan.nameVi}".${creditToWallet > 0 ? ` Đã hoàn ${creditToWallet.toLocaleString('vi-VN')}đ vào ví.` : ''}`

    createNotification({
      receiverId: memberId, receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
      title: notifTitle, content: notifContent,
      redirectUrl: '/my-membership', createdBy: 'System', sendEmail: true,
    }).catch(() => {})

    const populated = await Membership.findById(membership._id).populate('planId')
    res.json({ message: notifTitle, membership: populated, amountToPay, creditToWallet, payment })
  } catch (error) {
    await session.abortTransaction()
    res.status(500).json({ message: error.message })
  } finally {
    session.endSession()
  }
}
