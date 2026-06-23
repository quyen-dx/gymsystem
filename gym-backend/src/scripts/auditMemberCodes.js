import mongoose from 'mongoose'
import connectDB from '../config/db.js'

async function audit() {
  await connectDB()
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }))

  const users = await User.find({ memberCode: { $nin: [null, ''] } })
    .select('memberCode memberNumber name email role createdAt')
    .sort({ createdAt: 1 })
    .lean()

  console.log('=== All users with memberCode, sorted by createdAt ASC ===')
  console.log('# | memberCode | memberNumber | createdAt              | name')
  users.forEach((u, i) => {
    console.log(
      String(i + 1).padStart(2),
      String(u.memberCode).padEnd(10),
      String(u.memberNumber || '').padEnd(12),
      new Date(u.createdAt).toISOString().padEnd(25),
      u.name || u.email
    )
  })

  // Also check if there are users without memberCode
  const missing = await User.countDocuments({
    $or: [{ memberCode: null }, { memberCode: '' }, { memberCode: { $exists: false } }]
  })
  console.log(`\nUsers without memberCode: ${missing}`)

  await mongoose.disconnect()
}

audit().catch(err => { console.error(err); process.exit(1) })
