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
const TrainingAssignment = (await import('../models/TrainingAssignment.js')).default
const ClassEnrollment = (await import('../models/ClassEnrollment.js')).default
const TrainingClass = (await import('../models/TrainingClass.js')).default
const Booking = (await import('../models/Booking.js')).default
const TrainingRequest = (await import('../models/TrainingRequest.js')).default
const WorkoutSchedule = (await import('../models/WorkoutSchedule.js')).default
const Workout = (await import('../models/Workout.js')).default
const Plan = (await import('../models/Plan.js')).default

const EMAIL = 'leave.test@example.com'
const PASSWORD = 'Test@1234'

let user = await User.findOne({ email: EMAIL })
if (user) {
  await PTAssignment.deleteMany({ memberId: user._id })
  await TrainingAssignment.deleteMany({ memberId: user._id })
  await ClassEnrollment.deleteMany({ memberId: user._id })
  await Booking.deleteMany({ memberId: user._id })
  await TrainingRequest.deleteMany({ memberId: user._id })
  await WorkoutSchedule.deleteMany({ memberId: user._id })
  await Membership.deleteMany({ memberId: user._id })
  await MembershipCycle.deleteMany({ memberId: user._id })
  await MembershipPeriod.deleteMany({ memberId: user._id })
  await Wallet.deleteMany({ userId: user._id })
  await User.deleteOne({ _id: user._id })
  console.log('reset old leave test user')
}

const hash = await bcrypt.hash(PASSWORD, 10)
const [created] = await User.create([{
  email: EMAIL, name: 'leave.test', fullName: 'Nguyễn Văn A', role: 'member',
  password: PASSWORD, provider: 'email', identityStatus: 'approved',
}])
user = created
console.log('member id:', user._id)

let pt = await User.findOne({ role: 'pt' }).lean()
if (!pt) {
  const [p] = await User.create([{ email: 'leave.pt@example.com', name: 'leave.pt', fullName: 'LeaveTest PT', role: 'pt', provider: 'email' }])
  pt = p
}
console.log('pt id:', pt._id)

const plus = await Plan.findOne({ nameVi: 'Plus' }).lean()
if (!plus) throw new Error('Plan Plus not found')

await Wallet.create([{ userId: user._id, balance: 1000000 }])

const now = Date.now()
const [membership] = await Membership.create([{ memberId: user._id, planId: plus._id, status: 'active', source: 'wallet' }])
await MembershipCycle.create([{
  memberId: user._id, currentMembershipId: membership._id, currentPlanId: plus._id,
  startDate: new Date(now - 10 * 86400000), endDate: new Date(now + 50 * 86400000),
  activatedAt: new Date(now - 10 * 86400000), expiresAt: new Date(now + 50 * 86400000),
  durationDays: 60, status: 'active',
}])
await MembershipPeriod.create([{
  membershipId: membership._id, planId: plus._id, memberId: user._id,
  startDate: new Date(now - 10 * 86400000), endDate: new Date(now + 50 * 86400000),
  totalDays: 60, price: 600000, status: 'ACTIVE',
}])

const [cls] = await TrainingClass.create([{ name: 'GYM CHIỀU', ptId: pt._id, status: 'active' }])
console.log('class id:', cls._id, 'name:', cls.name)

// PT 1-1 assignment
await PTAssignment.create([{ memberId: user._id, ptId: pt._id, membershipId: membership._id, status: 'active', startDate: new Date() }])
// Class assignment (member in PT class)
await TrainingAssignment.create([{ memberId: user._id, classId: cls._id, trainerId: pt._id, status: 'active', acceptedAt: new Date(), startDate: new Date() }])
await ClassEnrollment.create([{ classId: cls._id, memberId: user._id, status: 'active', sourceReason: 'assigned_by_pt' }])
// Booking + TrainingRequest + WorkoutSchedule
await Booking.create([{ memberId: user._id, ptId: pt._id, date: new Date(now + 2 * 86400000), slot: '17:00-18:00', trainingType: 'one_to_one', totalAmount: 100000, paymentStatus: 'paid', status: 'confirmed' }])
await TrainingRequest.create([{ memberId: user._id, type: 'pt1on1', status: 'pending', specialization: 'GYM' }])
let workout = await Workout.findOne({ isTemplate: true, name: 'WorkoutPageTestTemplate' }).lean()
if (workout) {
  await WorkoutSchedule.create([{
    memberId: user._id, templateId: workout._id, assignedBy: pt._id,
    startDate: new Date(now + 1 * 86400000), weekIndex: 1, totalWeeks: 4, status: 'active',
    sessions: [{ dayOrder: 1, date: new Date(now + 2 * 86400000), time: '17:00', endTime: '18:00', location: 'GYM', status: 'pending', title: 'Buổi Ngực' }],
  }])
}

console.log('\n=== SETUP DONE ===')
console.log('email:', EMAIL, '/ password:', PASSWORD)
console.log('ptId to verify notifications:', pt._id)
console.log('classId to verify notifications:', cls._id)

await mongoose.disconnect()
