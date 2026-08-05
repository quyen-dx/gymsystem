import mongoose from 'mongoose'
import bcrypt from 'bcrypt'

const uri = process.env.MONGO_URI || process.env.MONGODB_URI
await mongoose.connect(uri)

const User = (await import('../models/User.js')).default
const Wallet = (await import('../models/Wallet.js')).default
const Membership = (await import('../models/Membership.js')).default
const MembershipCycle = (await import('../models/MembershipCycle.js')).default
const MembershipPeriod = (await import('../models/MembershipPeriod.js')).default
const WorkoutSchedule = (await import('../models/WorkoutSchedule.js')).default
const Workout = (await import('../models/Workout.js')).default
const Plan = (await import('../models/Plan.js')).default

const EMAIL = 'workout.test@example.com'
const PASSWORD = 'Test@1234'

const SCENARIO = process.argv[2] || 'current'

await WorkoutSchedule.deleteMany({ memberId: (await User.findOne({ email: EMAIL }))?._id })

let user = await User.findOne({ email: EMAIL })
if (user) {
  await Membership.deleteMany({ memberId: user._id })
  await MembershipCycle.deleteMany({ memberId: user._id })
  await MembershipPeriod.deleteMany({ memberId: user._id })
  await Wallet.deleteMany({ userId: user._id })
  await WorkoutSchedule.deleteMany({ memberId: user._id })
  await User.deleteOne({ _id: user._id })
  console.log('reset old workout test user')
}

const hash = await bcrypt.hash(PASSWORD, 10)
const [created] = await User.create([{
  email: EMAIL,
  name: 'workout.test',
  fullName: 'Workout Page Test',
  role: 'member',
  password: PASSWORD,
  provider: 'email',
  identityStatus: 'approved',
}])
user = created
console.log('user id:', user._id)

let pt = await User.findOne({ role: 'pt' }).lean()
if (!pt) {
  const [p] = await User.create([{ email: 'workout.pt@example.com', name: 'workout.pt', fullName: 'WorkoutPage PT', role: 'pt', provider: 'email' }])
  pt = p
}
console.log('pt id:', pt._id)

const plus = await Plan.findOne({ nameVi: 'Plus' }).lean()
if (!plus) throw new Error('Plan Plus not found')

await Wallet.create([{ userId: user._id, balance: 1000000 }])

const now = Date.now()
const [membership] = await Membership.create([{ memberId: user._id, planId: plus._id, status: 'active', source: 'wallet' }])
const [cycle] = await MembershipCycle.create([{
  memberId: user._id,
  currentMembershipId: membership._id,
  currentPlanId: plus._id,
  startDate: new Date(now - 10 * 86400000),
  endDate: new Date(now + 50 * 86400000),
  activatedAt: new Date(now - 10 * 86400000),
  expiresAt: new Date(now + 50 * 86400000),
  durationDays: 60,
  status: 'active',
}])
await MembershipPeriod.create([{
  membershipId: membership._id, planId: plus._id, memberId: user._id,
  startDate: new Date(now - 10 * 86400000), endDate: new Date(now + 50 * 86400000),
  totalDays: 60, price: 600000, status: 'ACTIVE',
}])

let workout = await Workout.findOne({ isTemplate: true, name: 'WorkoutPageTestTemplate' }).lean()
if (!workout) {
  const [w] = await Workout.create([{
    name: 'WorkoutPageTestTemplate',
    goal: 'Test workout page',
    duration: 4,
    isTemplate: true,
    templateStatus: 'published',
    days: [
      { dayOfWeek: 2, muscleGroup: 'Ngực', exercises: [{ name: 'Bench Press' }] },
      { dayOfWeek: 4, muscleGroup: 'Lưng', exercises: [{ name: 'Deadlift' }] },
    ],
  }])
  workout = w
}
console.log('workout id:', workout._id)

const dayMs = 86400000
const startOfToday = new Date()
startOfToday.setHours(0, 0, 0, 0)
const at = (offsetDays, hour = 17) => {
  const d = new Date(startOfToday.getTime() + offsetDays * dayMs)
  d.setHours(hour, 0, 0, 0)
  return d
}

const sessionTemplates = (offsetDays) => [0, 1].map((i) => ({
  dayOrder: i + 1,
  date: at(offsetDays + i),
  time: '17:00',
  endTime: '18:00',
  location: 'Phòng GYM 1',
  status: 'pending',
  title: i === 0 ? 'Buổi Ngực' : 'Buổi Lưng',
  muscleGroup: i === 0 ? 'Ngực' : 'Lưng',
}))

const scenarios = {
  current: () => sessionTemplates(0),       // hôm nay + ngày mai → trong 7 ngày tới
  future: () => sessionTemplates(20),       // +20..+21 → ngoài 7 ngày tới, tự nhảy tới
  past: () => sessionTemplates(-10),        // -10..-9 → chỉ lịch quá khứ
  none: () => [],                            // không có lịch
}

const sessions = scenarios[SCENARIO]()
if (!sessions) throw new Error(`Unknown scenario: ${SCENARIO}`)

if (sessions.length > 0) {
  await WorkoutSchedule.create([{
    memberId: user._id,
    templateId: workout._id,
    assignedBy: pt._id,
    startDate: sessions[0].date,
    weekIndex: 1,
    totalWeeks: 4,
    status: 'active',
    sessions,
  }])
}

console.log('\n=== SETUP DONE ===')
console.log('scenario:', SCENARIO)
console.log('email:', EMAIL, '/ password:', PASSWORD)
console.log('session dates:')
for (const s of sessions) console.log(' -', s.date.toISOString().slice(0, 10), s.title)

await mongoose.disconnect()
