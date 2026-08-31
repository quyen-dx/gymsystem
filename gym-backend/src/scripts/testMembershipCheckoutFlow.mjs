import assert from 'node:assert/strict'
import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import User from '../models/User.js'
import Wallet from '../models/Wallet.js'
import Payment from '../models/Payment.js'
import Transaction from '../models/Transaction.js'
import Membership from '../models/Membership.js'
import MembershipCycle from '../models/MembershipCycle.js'
import MembershipPeriod from '../models/MembershipPeriod.js'
import Policy from '../models/Policy.js'
import PolicyConsent from '../models/PolicyConsent.js'
import Notification from '../models/Notification.js'
import UserActivity from '../models/UserActivity.js'
import Plan from '../models/Plan.js'
import { createMembershipCheckout, finalizePlanPurchase } from '../services/membershipService.js'
import { releaseWalletPaymentReservation } from '../services/walletService.js'

const TEST_USERS = ['checkout.full.test@example.com', 'checkout.partial.test@example.com', 'checkout.failure.test@example.com']
const PASSWORD = 'Test@1234'
const check = (condition, label) => { assert.ok(condition, label); console.log(`  OK: ${label}`) }

const removeUserData = async (user) => {
  if (!user) return
  const memberId = user._id
  await Promise.all([
    Payment.deleteMany({ userId: memberId }), Transaction.deleteMany({ userId: memberId }),
    MembershipPeriod.deleteMany({ memberId }), MembershipCycle.deleteMany({ memberId }), Membership.deleteMany({ memberId }),
    Wallet.deleteMany({ userId: memberId }), PolicyConsent.deleteMany({ userId: memberId }),
    Notification.deleteMany({ receiverId: memberId }), UserActivity.deleteMany({ userId: memberId }),
  ])
  await User.deleteOne({ _id: memberId })
}

const makeMember = async ({ email, balance }) => {
  const password = await bcrypt.hash(PASSWORD, 10)
  const user = await User.create({ email, name: email.split('@')[0], role: 'member', provider: 'email', password, identityStatus: 'approved' })
  await Wallet.create({ userId: user._id, balance, withdrawableBalance: balance, lockedBalance: 0, checkoutReservedBalance: 0 })
  const policies = await Policy.find({ type: { $in: ['membership', 'terms'] }, isPublished: true }).lean()
  if (policies.length) await PolicyConsent.create(policies.map((policy) => ({
    userId: user._id, policyType: policy.type, policyVersion: policy.version, policyId: policy._id, context: 'membership-checkout-test', acceptedAt: new Date(),
  })))
  return user
}

await mongoose.connect(process.env.MONGO_URI)
try {
  for (const email of TEST_USERS) await removeUserData(await User.findOne({ email }))
  const plan = await Plan.findOne({ isActive: { $ne: false }, price: { $gt: 10_000 } }).sort({ price: 1 }).lean()
  if (!plan) throw new Error('Không có gói tập hoạt động để kiểm thử')
  const price = Number(plan.price)
  console.log(`Plan test: ${plan.nameVi || plan.nameEn} (${price.toLocaleString('vi-VN')}đ)`)

  console.log('CASE 1: wallet đủ tiền')
  const fullUser = await makeMember({ email: TEST_USERS[0], balance: price + 50_000 })
  const fullResult = await createMembershipCheckout({ userId: fullUser._id, planId: plan._id, mode: 'register' })
  const fullWallet = await Wallet.findOne({ userId: fullUser._id }).lean()
  const fullCycle = await MembershipCycle.findOne({ memberId: fullUser._id, status: 'active' }).lean()
  check(fullResult.status === 'PAID', 'ví đủ tiền thanh toán ngay')
  check(fullWallet.balance === 50_000 && fullWallet.checkoutReservedBalance === 0, 'ví trừ đúng giá gói và không còn tiền giữ')
  check(Boolean(fullCycle), 'tạo gói tập active sau thanh toán ví')

  console.log('CASE 2: ví + VNPay thành công')
  const partialBalance = Math.min(100_000, price - 10_000)
  const partialUser = await makeMember({ email: TEST_USERS[1], balance: partialBalance })
  const partial = await createMembershipCheckout({ userId: partialUser._id, planId: plan._id, mode: 'register' })
  const heldWallet = await Wallet.findOne({ userId: partialUser._id }).lean()
  const heldPayment = await Payment.findById(partial.paymentId).lean()
  check(partial.status === 'PARTIAL', 'thiếu tiền tạo checkout VNPay kết hợp')
  check(heldWallet.balance === 0 && heldWallet.checkoutReservedBalance === partialBalance, 'phần tiền ví được giữ ngay khi chờ VNPay')
  check(heldPayment.status === 'PENDING' && heldPayment.metadata.walletReservationStatus === 'HELD', 'Payment ghi nhận trạng thái giữ tiền')
  await finalizePlanPurchase({ paymentId: partial.paymentId })
  const paidWallet = await Wallet.findOne({ userId: partialUser._id }).lean()
  const paidPayment = await Payment.findById(partial.paymentId).lean()
  const paidCycle = await MembershipCycle.findOne({ memberId: partialUser._id, status: 'active' }).lean()
  check(paidPayment.status === 'PAID' && paidPayment.metadata.walletReservationStatus === 'CONSUMED', 'VNPay thành công chốt khoản tiền ví đã giữ')
  check(paidWallet.balance === 0 && paidWallet.checkoutReservedBalance === 0, 'không hoàn/trừ lại khoản ví sau khi thanh toán thành công')
  check(Boolean(paidCycle), 'kích hoạt gói sau thanh toán kết hợp')

  console.log('CASE 3: ví + VNPay thất bại/hết hạn')
  const failBalance = Math.min(80_000, price - 10_000)
  const failUser = await makeMember({ email: TEST_USERS[2], balance: failBalance })
  const failed = await createMembershipCheckout({ userId: failUser._id, planId: plan._id, mode: 'register' })
  await Payment.findByIdAndUpdate(failed.paymentId, { $set: { status: 'FAILED' } })
  const release = await releaseWalletPaymentReservation({ paymentId: failed.paymentId, reason: 'test_vnpay_failed' })
  const replayRelease = await releaseWalletPaymentReservation({ paymentId: failed.paymentId, reason: 'test_vnpay_failed_replay' })
  const restoredWallet = await Wallet.findOne({ userId: failUser._id }).lean()
  const failedPayment = await Payment.findById(failed.paymentId).lean()
  const failedCycle = await MembershipCycle.findOne({ memberId: failUser._id, status: 'active' }).lean()
  check(release.released === true && replayRelease.released === false, 'hoàn tiền giữ là idempotent')
  check(restoredWallet.balance === failBalance && restoredWallet.checkoutReservedBalance === 0, 'VNPay thất bại hoàn đủ tiền đã giữ về ví')
  check(failedPayment.status === 'FAILED' && failedPayment.metadata.walletReservationStatus === 'RELEASED', 'Payment thất bại lưu trạng thái hoàn tiền giữ')
  check(!failedCycle, 'không kích hoạt gói khi VNPay thất bại')

  console.log('MEMBERSHIP CHECKOUT INTEGRATION TEST PASSED')
} finally {
  await mongoose.disconnect()
}
