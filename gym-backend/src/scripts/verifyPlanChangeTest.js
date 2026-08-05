import mongoose from 'mongoose'

const uri = process.env.MONGO_URI || process.env.MONGODB_URI
await mongoose.connect(uri)

const User = (await import('../models/User.js')).default
const Wallet = (await import('../models/Wallet.js')).default
const Membership = (await import('../models/Membership.js')).default
const MembershipCycle = (await import('../models/MembershipCycle.js')).default
const MembershipPeriod = (await import('../models/MembershipPeriod.js')).default
const PTAssignment = (await import('../models/PTAssignment.js')).default
const ClassEnrollment = (await import('../models/ClassEnrollment.js')).default
const Booking = (await import('../models/Booking.js')).default
const Waitlist = (await import('../models/Waitlist.js')).default
const TrainingRequest = (await import('../models/TrainingRequest.js')).default
const PlanChangeHistory = (await import('../models/PlanChangeHistory.js')).default
const Transaction = (await import('../models/Transaction.js')).default
const Plan = (await import('../models/Plan.js')).default

const user = await User.findOne({ email: 'planc.test@example.com' }).lean()
if (!user) { console.log('user not found'); process.exit(1) }
const uid = user._id

const wallet = await Wallet.findOne({ userId: uid }).lean()
const membership = await Membership.findOne({ memberId: uid }).populate('planId', 'nameVi').lean()
const cycle = await MembershipCycle.findOne({ memberId: uid, status: 'active' }).populate('currentPlanId', 'nameVi').lean()

const ptAss = await PTAssignment.find({ memberId: uid }).lean()
const enrolls = await ClassEnrollment.find({ memberId: uid }).lean()
const bookings = await Booking.find({ memberId: uid }).lean()
const waitlist = await Waitlist.find({ memberId: uid }).lean()
const requests = await TrainingRequest.find({ memberId: uid }).lean()
const periods = await MembershipPeriod.find({ memberId: uid }).populate('planId', 'nameVi').sort({ startDate: 1 }).lean()
const history = await PlanChangeHistory.find({ memberId: uid }).populate('fromPlanId', 'nameVi').populate('toPlanId', 'nameVi').sort({ createdAt: -1 }).lean()
const txns = await Transaction.find({ userId: uid }).lean()

console.log('wallet.balance =', wallet?.balance, '(expect 2,200,000)')
console.log('membership.planId =', membership?.planId?.nameVi, '(expect Basic)')
console.log('cycle.currentPlanId =', cycle?.currentPlanId?.nameVi, 'status=', cycle?.status)
console.log('PTAssignment:', ptAss.map(a => ({ status: a.status, cancelReason: a.cancelReason })))
console.log('ClassEnrollment:', enrolls.map(e => ({ status: e.status, sourceReason: e.sourceReason })))
console.log('Booking:', bookings.map(b => ({ status: b.status, cancelReason: b.cancelReason, trainingType: b.trainingType })))
console.log('Waitlist count =', waitlist.length, '(expect 0)')
console.log('TrainingRequest:', requests.map(r => ({ status: r.status, cancelReason: r.cancelReason })))
console.log('Periods:')
for (const p of periods) {
  console.log(`  ${p.status} | plan=${p.planId?.nameVi} | price=${p.price} | ${new Date(p.startDate).toISOString().slice(0,10)} -> ${new Date(p.endDate).toISOString().slice(0,10)}`)
}
console.log('History:')
for (const h of history) {
  console.log(`  ${h.changeType} | ${h.fromPlanId?.nameVi} -> ${h.toPlanId?.nameVi} | cycleId=${h.cycleId} | amount=${h.amount} | walletCredit=${h.walletCredit}`)
  console.log(`    featureSnapshot.from=[${h.featureSnapshot?.from?.join(',')}]`)
  console.log(`    featureSnapshot.to=[${h.featureSnapshot?.to?.join(',')}]`)
}
console.log('Transactions:', txns.map(t => ({ type: t.type, source: t.source, amount: t.amount })))

await mongoose.disconnect()
