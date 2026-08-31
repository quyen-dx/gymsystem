import assert from 'node:assert/strict'
import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import User from '../models/User.js'
import Wallet from '../models/Wallet.js'
import Payment from '../models/Payment.js'
import Membership from '../models/Membership.js'
import MembershipCycle from '../models/MembershipCycle.js'
import MembershipPeriod from '../models/MembershipPeriod.js'
import PlanChangeHistory from '../models/PlanChangeHistory.js'
import Plan from '../models/Plan.js'
import Notification from '../models/Notification.js'
import UserActivity from '../models/UserActivity.js'
import { changePlanCheckout, finalizePlanChangePurchase } from '../controllers/planChangeController.js'
import { releaseWalletPaymentReservation } from '../services/walletService.js'

const EMAILS = ['planchange.partial.test@example.com', 'planchange.failure.test@example.com']
const check = (condition, label) => { assert.ok(condition, label); console.log(`  OK: ${label}`) }

const removeUserData = async (user) => {
  if (!user) return
  const userId = user._id
  await Promise.all([
    Payment.deleteMany({ userId }), PlanChangeHistory.deleteMany({ memberId: userId }), MembershipPeriod.deleteMany({ memberId: userId }),
    MembershipCycle.deleteMany({ memberId: userId }), Membership.deleteMany({ memberId: userId }), Wallet.deleteMany({ userId }),
    Notification.deleteMany({ receiverId: userId }), UserActivity.deleteMany({ userId }),
  ])
  await User.deleteOne({ _id: userId })
}

const setupMember = async ({ email, oldPlan, balance, memberNumber }) => {
  const password = await bcrypt.hash('Test@1234', 10)
  const user = await User.create({ email, name: email.split('@')[0], role: 'member', provider: 'email', password, memberNumber })
  await Wallet.create({ userId: user._id, balance, withdrawableBalance: balance, lockedBalance: 0, checkoutReservedBalance: 0 })
  const now = new Date(); const startDate = new Date(now.getTime() - 10 * 86400000); const endDate = new Date(now.getTime() + 20 * 86400000)
  const membership = await Membership.create({ memberId: user._id, planId: oldPlan._id, status: 'active', source: 'wallet' })
  await MembershipCycle.create({ memberId: user._id, currentMembershipId: membership._id, currentPlanId: oldPlan._id, startDate, endDate, activatedAt: startDate, expiresAt: endDate, durationDays: 30, status: 'active' })
  await MembershipPeriod.create({ membershipId: membership._id, planId: oldPlan._id, memberId: user._id, startDate, endDate, totalDays: 30, price: oldPlan.price, status: 'ACTIVE', activatedAt: startDate })
  return user
}

const checkout = async ({ user, newPlanId }) => {
  const req = { user: { _id: user._id, role: 'member' }, body: { newPlanId }, headers: {}, ip: '127.0.0.1' }
  const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
  await changePlanCheckout(req, res)
  return res
}

await mongoose.connect(process.env.MONGO_URI)
try {
  for (const email of EMAILS) await removeUserData(await User.findOne({ email }))
  const plans = await Plan.find({ isActive: { $ne: false }, price: { $gt: 0 } }).sort({ price: 1 }).lean()
  if (plans.length < 2) throw new Error('Cần ít nhất 2 gói active để test đổi gói')
  const oldPlan = plans[0]; const newPlan = plans[plans.length - 1]
  const partialBalance = Math.min(100_000, Math.max(10_000, Math.floor((newPlan.price - oldPlan.price) / 3)))
  console.log(`Đổi gói test: ${oldPlan.nameVi} -> ${newPlan.nameVi}, ví dùng ${partialBalance.toLocaleString('vi-VN')}đ`)

  console.log('CASE 1: đổi/nâng cấp kết hợp Ví + VNPay thành công')
  const firstUser = await setupMember({ email: EMAILS[0], oldPlan, balance: partialBalance, memberNumber: Date.now() + 1 })
  const first = await checkout({ user: firstUser, newPlanId: newPlan._id })
  const heldWallet = await Wallet.findOne({ userId: firstUser._id }).lean()
  check(first.statusCode === 200 && first.body?.status === 'PARTIAL', 'thiếu tiền tạo checkout đổi gói kết hợp')
  check(heldWallet.balance === 0 && heldWallet.checkoutReservedBalance === partialBalance, 'giữ phần tiền ví khi chờ VNPay đổi gói')
  const completed = await finalizePlanChangePurchase({ paymentId: first.body.paymentId })
  const paidWallet = await Wallet.findOne({ userId: firstUser._id }).lean()
  const cycle = await MembershipCycle.findOne({ memberId: firstUser._id, status: 'active' }).lean()
  const payment = await Payment.findById(first.body.paymentId).lean()
  const replay = await finalizePlanChangePurchase({ paymentId: first.body.paymentId })
  check(completed.alreadyPaid === false && replay.alreadyPaid === true, 'hoàn tất đổi gói là idempotent')
  check(payment.status === 'PAID' && payment.metadata.walletReservationStatus === 'CONSUMED', 'Payment chốt khoản ví đã giữ')
  check(paidWallet.balance === 0 && paidWallet.checkoutReservedBalance === 0, 'đổi gói thành công không hoàn/trừ trùng khoản ví')
  check(String(cycle.currentPlanId) === String(newPlan._id), 'gói active được cập nhật sang gói mới')

  console.log('CASE 2: đổi/nâng cấp VNPay thất bại')
  const secondUser = await setupMember({ email: EMAILS[1], oldPlan, balance: partialBalance, memberNumber: Date.now() + 2 })
  const second = await checkout({ user: secondUser, newPlanId: newPlan._id })
  await Payment.findByIdAndUpdate(second.body.paymentId, { $set: { status: 'FAILED' } })
  const release = await releaseWalletPaymentReservation({ paymentId: second.body.paymentId, reason: 'test_plan_change_failed' })
  const restoredWallet = await Wallet.findOne({ userId: secondUser._id }).lean()
  const originalCycle = await MembershipCycle.findOne({ memberId: secondUser._id, status: 'active' }).lean()
  check(release.released === true && restoredWallet.balance === partialBalance && restoredWallet.checkoutReservedBalance === 0, 'VNPay thất bại hoàn khoản giữ về ví')
  check(String(originalCycle.currentPlanId) === String(oldPlan._id), 'VNPay thất bại giữ nguyên gói cũ')
  console.log('PLAN CHANGE CHECKOUT INTEGRATION TEST PASSED')
} finally {
  await mongoose.disconnect()
}
