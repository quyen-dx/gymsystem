import mongoose from 'mongoose'
import bcrypt from 'bcrypt'

const uri = process.env.MONGO_URI || process.env.MONGODB_URI
await mongoose.connect(uri)

const User = (await import('../models/User.js')).default
const Wallet = (await import('../models/Wallet.js')).default
const Membership = (await import('../models/Membership.js')).default
const MembershipCycle = (await import('../models/MembershipCycle.js')).default
const MembershipPeriod = (await import('../models/MembershipPeriod.js')).default
const PTAssignment = (await import('../models/PTAssignment.js')).default
const ClassEnrollment = (await import('../models/ClassEnrollment.js')).default
const TrainingClass = (await import('../models/TrainingClass.js')).default
const Booking = (await import('../models/Booking.js')).default
const Waitlist = (await import('../models/Waitlist.js')).default
const TrainingRequest = (await import('../models/TrainingRequest.js')).default
const PlanChangeHistory = (await import('../models/PlanChangeHistory.js')).default
const Plan = (await import('../models/Plan.js')).default
const Transaction = (await import('../models/Transaction.js')).default

const EMAIL = 'planc.test@example.com'
const PASSWORD = 'Test@1234'

let user = await User.findOne({ email: EMAIL })
if (user) {
  // Reset mọi dữ liệu liên quan
  await Membership.deleteMany({ memberId: user._id })
  await MembershipCycle.deleteMany({ memberId: user._id })
  await MembershipPeriod.deleteMany({ memberId: user._id })
  await PTAssignment.deleteMany({ memberId: user._id })
  await ClassEnrollment.deleteMany({ memberId: user._id })
  await Booking.deleteMany({ memberId: user._id })
  await Waitlist.deleteMany({ memberId: user._id })
  await TrainingRequest.deleteMany({ memberId: user._id })
  await PlanChangeHistory.deleteMany({ memberId: user._id })
  await Transaction.deleteMany({ userId: user._id })
  await Wallet.deleteMany({ userId: user._id })
  await User.deleteOne({ _id: user._id })
  console.log('reset old test user')
}

const hash = await bcrypt.hash(PASSWORD, 10)
const [created] = await User.create([{
  email: EMAIL,
  name: 'planc.test',
  fullName: 'Plan Change Test',
  role: 'member',
  password: PASSWORD,
  provider: 'email',
  identityStatus: 'approved',
}])
user = created
console.log('user id:', user._id)

// Tìm 1 PT thật (tạo nếu chưa có)
let pt = await User.findOne({ role: 'pt' }).lean()
if (!pt) {
  const [p] = await User.create([{ email: 'planc.pt@example.com', name: 'planc.pt', fullName: 'PlanChange PT', role: 'pt', provider: 'email' }])
  pt = p
}
console.log('pt id:', pt._id)

// Tìm 1 TrainingClass active (tạo nếu chưa có)
let cls = await TrainingClass.findOne({ status: 'active' }).lean()
if (!cls) {
  const [c] = await TrainingClass.create([{ name: 'PlanChangeTestClass', ptId: pt._id, status: 'active' }])
  cls = c
}
console.log('class id:', cls._id)

const plus = await Plan.findOne({ nameVi: 'Plus' }).lean()
const basic = await Plan.findOne({ nameVi: 'Basic' }).lean()
console.log('plus:', plus._id, 'basic:', basic._id)

// Wallet đủ tiền
await Wallet.create([{ userId: user._id, balance: 2000000 }])

// Membership + Cycle (Plus)
const [membership] = await Membership.create([{ memberId: user._id, planId: plus._id, status: 'active', source: 'wallet' }])
const now = Date.now()
const [cycle] = await MembershipCycle.create([{
  memberId: user._id,
  currentMembershipId: membership._id,
  currentPlanId: plus._id,
  startDate: new Date(now - 10 * 86400000),
  endDate: new Date(now + 20 * 86400000),
  activatedAt: new Date(now - 10 * 86400000),
  expiresAt: new Date(now + 20 * 86400000),
  durationDays: 30,
  status: 'active',
}])

// Period ACTIVE + 2 PENDING
await MembershipPeriod.create([
  {
    membershipId: membership._id, planId: plus._id, memberId: user._id,
    startDate: new Date(now - 10 * 86400000), endDate: new Date(now + 20 * 86400000),
    totalDays: 30, price: 600000, status: 'ACTIVE',
  },
  {
    membershipId: membership._id, planId: plus._id, memberId: user._id,
    startDate: new Date(now + 20 * 86400000), endDate: new Date(now + 50 * 86400000),
    totalDays: 30, price: 600000, status: 'PENDING',
  },
  {
    membershipId: membership._id, planId: plus._id, memberId: user._id,
    startDate: new Date(now + 50 * 86400000), endDate: new Date(now + 80 * 86400000),
    totalDays: 30, price: 600000, status: 'PENDING',
  },
])

// PTAssignment active + ClassEnrollment active
await PTAssignment.create([{ memberId: user._id, ptId: pt._id, membershipId: membership._id, status: 'active', startDate: new Date() }])
await ClassEnrollment.create([{ classId: cls._id, memberId: user._id, status: 'active', sourceReason: 'assigned_by_pt' }])

// Booking confirmed (group) cho ngày tương lai
const bookingDate = new Date(now + 2 * 86400000)
await Booking.create([{
  memberId: user._id, ptId: pt._id, date: bookingDate, slot: '17:00-18:00',
  trainingType: 'group', totalAmount: 0, paymentStatus: 'paid', status: 'confirmed',
}])

// Waitlist entry
const slotId = `${pt._id}_${new Date(bookingDate).toISOString().slice(0, 10)}_17:00-18:00`
await Waitlist.create([{ bookingSlotId: slotId, memberId: user._id }])

// TrainingRequest pending
await TrainingRequest.create([{ memberId: user._id, type: 'group', status: 'pending', specialization: 'GYM' }])

console.log('SETUP DONE')
console.log('cycleId:', cycle._id)
console.log('slotId:', slotId)
await mongoose.disconnect()
