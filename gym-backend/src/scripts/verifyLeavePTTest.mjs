import mongoose from 'mongoose'

const uri = process.env.MONGO_URI || process.env.MONGODB_URI
await mongoose.connect(uri)

const User = (await import('../models/User.js')).default
const PTAssignment = (await import('../models/PTAssignment.js')).default
const TrainingAssignment = (await import('../models/TrainingAssignment.js')).default
const ClassEnrollment = (await import('../models/ClassEnrollment.js')).default
const TrainingClass = (await import('../models/TrainingClass.js')).default
const Booking = (await import('../models/Booking.js')).default
const TrainingRequest = (await import('../models/TrainingRequest.js')).default
const WorkoutSchedule = (await import('../models/WorkoutSchedule.js')).default
const Notification = (await import('../models/Notification.js')).default

const API = process.env.API_BASE || 'http://localhost:5000/api'

const user = await User.findOne({ email: 'leave.test@example.com' }).lean()
if (!user) { console.error('member not found'); process.exit(1) }

const login = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'leave.test@example.com', password: 'Test@1234' }),
})
const loginJson = await login.json()
const token = loginJson.accessToken
console.log('login ok:', !!token)

const res = await fetch(`${API}/pt-assignments/enrollment/leave-current-training`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ reason: 'Hội viên muốn rời toàn bộ dịch vụ PT' }),
})
console.log('leave status:', res.status)
console.log('leave body:', JSON.stringify(await res.json(), null, 2))

const [pt, cls, ta, ce, b, tr, ws] = await Promise.all([
  PTAssignment.findOne({ memberId: user._id }).lean(),
  TrainingClass.findOne({ name: 'GYM CHIỀU' }).lean(),
  TrainingAssignment.findOne({ memberId: user._id }).lean(),
  ClassEnrollment.findOne({ memberId: user._id }).lean(),
  Booking.findOne({ memberId: user._id }).lean(),
  TrainingRequest.findOne({ memberId: user._id }).lean(),
  WorkoutSchedule.findOne({ memberId: user._id }).lean(),
])
console.log('\n=== DATA AFTER LEAVE ===')
console.log('PTAssignment:', pt)
console.log('TrainingAssignment:', ta)
console.log('ClassEnrollment:', ce)
console.log('Booking:', b)
console.log('TrainingRequest:', tr)
console.log('WorkoutSchedule:', ws)

const [ptNotifs, memberNotifs] = await Promise.all([
  Notification.find({ receiverId: pt.ptId }).sort({ createdAt: -1 }).limit(10).lean(),
  Notification.find({ receiverId: user._id }).sort({ createdAt: -1 }).limit(10).lean(),
])
console.log('\n=== NOTIFICATIONS FOR PT ===')
for (const n of ptNotifs) console.log(`[${n.notificationType}/${n.category}] "${n.title}" | content: ${n.content} | relatedId: ${n.relatedId} | redirect: ${n.redirectUrl}`)
console.log('\n=== NOTIFICATIONS FOR MEMBER ===')
for (const n of memberNotifs) console.log(`[${n.notificationType}/${n.category}] "${n.title}" | content: ${n.content} | redirect: ${n.redirectUrl}`)

await mongoose.disconnect()
