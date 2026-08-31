import assert from 'node:assert/strict'
import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import User from '../models/User.js'
import Plan from '../models/Plan.js'
import PlanFeature from '../models/PlanFeature.js'
import Membership from '../models/Membership.js'
import MembershipCycle from '../models/MembershipCycle.js'
import MembershipPeriod from '../models/MembershipPeriod.js'
import CheckIn from '../models/CheckIn.js'
import Notification from '../models/Notification.js'
import UserActivity from '../models/UserActivity.js'
import { staffVerifyCheckin, isAfterCheckinCutoff } from '../controllers/checkInController.js'

const EMAILS = ['checkin.active.test@example.com', 'checkin.expired.test@example.com', 'checkin.staff.test@example.com']
const check = (condition, label) => { assert.ok(condition, label); console.log(`  OK: ${label}`) }

const removeUserData = async (user) => {
  if (!user) return
  const userId = user._id
  await Promise.all([
    CheckIn.deleteMany({ $or: [{ memberId: userId }, { staffId: userId }, { performedBy: userId }] }),
    MembershipPeriod.deleteMany({ memberId: userId }), MembershipCycle.deleteMany({ memberId: userId }), Membership.deleteMany({ memberId: userId }),
    Notification.deleteMany({ receiverId: userId }), UserActivity.deleteMany({ userId }),
  ])
  await User.deleteOne({ _id: userId })
}

const invokeCheckin = async ({ memberId, staff }) => {
  const req = { body: { memberId: String(memberId), manualReason: 'Kiểm thử nghiệp vụ check-in' }, user: staff }
  const res = { statusCode: null, body: null, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
  await staffVerifyCheckin(req, res)
  return res
}

// Test thành công cần chạy trong khung giờ cho phép. Chỉ mô phỏng đồng hồ bên
// trong process test; không thay đổi thời gian máy chủ hay logic production.
const runInCheckinWindow = async (callback) => {
  const NativeDate = globalThis.Date
  const simulatedNow = new NativeDate()
  simulatedNow.setUTCHours(3, 0, 0, 0) // 10:00 giờ Việt Nam (UTC+7)
  class TestDate extends NativeDate {
    constructor(...args) { super(...(args.length ? args : [simulatedNow.getTime()])) }
    static now() { return simulatedNow.getTime() }
  }
  globalThis.Date = TestDate
  try { return await callback() } finally { globalThis.Date = NativeDate }
}

await mongoose.connect(process.env.MONGO_URI)
try {
  for (const email of EMAILS) await removeUserData(await User.findOne({ email }))
  check(isAfterCheckinCutoff() === true, 'quy tắc thực tế đang chặn check-in sau 23:00 giờ Việt Nam')
  const feature = await PlanFeature.findOne({ code: 'GYM_ACCESS' }).lean()
  if (!feature) throw new Error('Thiếu feature GYM_ACCESS để kiểm thử check-in')
  const plan = await Plan.findOne({ isActive: { $ne: false }, featureIds: feature._id }).lean()
  if (!plan) throw new Error('Không có gói active hỗ trợ GYM_ACCESS')
  const password = await bcrypt.hash('Test@1234', 10)
  const memberNumberBase = Date.now()
  const [activeMember, expiredMember, staff] = await User.create([
    { email: EMAILS[0], name: 'checkin.active.test', role: 'member', provider: 'email', password, isActive: true, status: 'active', memberNumber: memberNumberBase + 1 },
    { email: EMAILS[1], name: 'checkin.expired.test', role: 'member', provider: 'email', password, isActive: true, status: 'active', memberNumber: memberNumberBase + 2 },
    { email: EMAILS[2], name: 'checkin.staff.test', role: 'staff', provider: 'email', password, isActive: true, status: 'active', memberNumber: memberNumberBase + 3 },
  ])
  const now = new Date(); const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const membership = await Membership.create({ memberId: activeMember._id, planId: plan._id, status: 'active', source: 'manual' })
  await MembershipCycle.create({ memberId: activeMember._id, currentMembershipId: membership._id, currentPlanId: plan._id, startDate: now, endDate, activatedAt: now, expiresAt: endDate, durationDays: 7, status: 'active' })
  await MembershipPeriod.create({ membershipId: membership._id, planId: plan._id, memberId: activeMember._id, startDate: now, endDate, totalDays: 7, price: plan.price, status: 'ACTIVE', activatedAt: now })

  console.log('CASE 1: gói hợp lệ, check-in tự do')
  const first = await runInCheckinWindow(() => invokeCheckin({ memberId: activeMember._id, staff }))
  const success = await CheckIn.findOne({ memberId: activeMember._id, status: 'success' }).lean()
  check(first.statusCode === 201 && first.body?.checkin?.sessionType === 'FREE_TRAINING', 'check-in thành công khi gói còn hạn và có GYM_ACCESS')
  check(success?.checkInMethod === 'STAFF' && String(success?.performedBy) === String(staff._id), 'lưu đủ người thực hiện và phương thức check-in')

  console.log('CASE 2: chống check-in tự do trùng trong ngày')
  const duplicate = await runInCheckinWindow(() => invokeCheckin({ memberId: activeMember._id, staff }))
  check(duplicate.statusCode === 429, 'chặn check-in tự do lần hai trong cùng ngày')
  check(await CheckIn.countDocuments({ memberId: activeMember._id, status: 'success' }) === 1, 'không tạo thêm bản ghi success khi trùng')

  console.log('CASE 3: hội viên không có gói hợp lệ')
  const expired = await runInCheckinWindow(() => invokeCheckin({ memberId: expiredMember._id, staff }))
  const failed = await CheckIn.findOne({ memberId: expiredMember._id, status: 'failed' }).lean()
  check(expired.statusCode === 403, 'từ chối check-in khi không có gói còn hạn')
  check(Boolean(failed?.errorNote), 'lưu lịch sử check-in thất bại để lễ tân tra cứu')
  console.log('CHECK-IN INTEGRATION TEST PASSED')
} finally {
  await mongoose.disconnect()
}
