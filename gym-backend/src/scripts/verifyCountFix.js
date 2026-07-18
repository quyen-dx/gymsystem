import 'dotenv/config'
import mongoose from 'mongoose'

const db = (await mongoose.connect(process.env.MONGO_URI)).connection.db

// Active PTAssignment memberIds
const activePAs = await db.collection('ptassignments').find({ status: 'active' }, { projection: { memberId: 1 } }).toArray()
const activeIds = activePAs.map(a => a.memberId)
console.log('Active PTAssignment memberIds:', activeIds.map(id => String(id)))

// Count with active-member filter (same as new getAllClasses logic)
const counts = await db.collection('workoutschedules').aggregate([
  { $match: { status: { $in: ['active', 'completed'] }, memberId: { $in: activeIds } } },
  { $unwind: '$sessions' },
  { $match: { 'sessions.classCode': { $ne: '', $exists: true } } },
  { $group: { _id: '$sessions.classCode', members: { $addToSet: '$memberId' } } },
]).toArray()

console.log('\nNew count (only active PTAssignment members):')
for (const c of counts) {
  console.log(`  classCode=${c._id}  members=${c.members.length}  ids=${c.members.map(String)}`)
}

// Compare with old count
const oldCounts = await db.collection('workoutschedules').aggregate([
  { $match: { status: { $in: ['active', 'completed'] } } },
  { $unwind: '$sessions' },
  { $match: { 'sessions.classCode': { $ne: '', $exists: true } } },
  { $group: { _id: '$sessions.classCode', members: { $addToSet: '$memberId' } } },
]).toArray()

console.log('\nOld count (all members):')
for (const c of oldCounts) {
  console.log(`  classCode=${c._id}  members=${c.members.length}  ids=${c.members.map(String)}`)
}

await mongoose.disconnect()
process.exit(0)
