import mongoose from 'mongoose'
import User from '../models/User.js'
import connectDB from '../config/db.js'

async function fixMemberCodes() {
  await connectDB()

  const users = await User.find({})
    .sort({ createdAt: 1 })
    .select('_id memberCode name email createdAt')
    .lean()

  console.log(`Found ${users.length} users, sorted by createdAt ASC:\n`)

  // Phase 1: clear all memberCodes to avoid unique index conflicts on swap
  const ids = users.map((u) => u._id)
  await User.updateMany({ _id: { $in: ids } }, { $unset: { memberCode: '' } })
  console.log('  Phase 1: cleared all memberCodes\n')

  // Phase 2: assign sequentially in createdAt order
  for (const [index, user] of users.entries()) {
    const newCode = `GP${String(index + 1).padStart(6, '0')}`
    await User.updateOne({ _id: user._id }, { $set: { memberCode: newCode } })
    console.log(`  ${String(index + 1).padStart(2)}. ${newCode}  |  ${user.name || user.email}`)
  }

  console.log(`\n✅ Updated ${users.length} users successfully`)
  process.exit(0)
}

fixMemberCodes().catch((err) => {
  console.error(err)
  process.exit(1)
})
