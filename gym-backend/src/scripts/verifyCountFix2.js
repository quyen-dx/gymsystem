import 'dotenv/config'
import mongoose from 'mongoose'

const db = (await mongoose.connect(process.env.MONGO_URI)).connection.db

const activePAs = await db.collection('ptassignments').find({ status: 'active' }, { projection: { memberId: 1 } }).toArray()
const activeIds = activePAs.map(a => a.memberId)

// Only status=active + active PTAssignment
const active = await db.collection('workoutschedules').aggregate([
  { $match: { status: 'active', memberId: { $in: activeIds } } },
  { $unwind: '$sessions' },
  { $match: { 'sessions.classCode': { $ne: '', $exists: true } } },
  { $group: { _id: '$sessions.classCode', members: { $addToSet: '$memberId' } } },
]).toArray()

console.log('=== status=active only + PTAssignment active ===')
for (const c of active) console.log('  classCode='+c._id+' members='+c.members.length+' ids='+c.members.map(String))

// Also check what active WS exist for these members
const activeWS = await db.collection('workoutschedules').find(
  { status: 'active', memberId: { $in: activeIds } },
  { projection: { memberId: 1, status: 1, sessions: 1 } }
).toArray()
console.log('\nActive WorkoutSchedules for active members:', activeWS.length)
for (const s of activeWS) {
  console.log('  _id='+s._id+' memberId='+s.memberId+' status='+s.status)
  for (const sx of (s.sessions || [])) console.log('    classCode='+sx.classCode+' dow='+(sx.date?new Date(sx.date).getDay():'?'))
}

await mongoose.disconnect()
process.exit(0)
