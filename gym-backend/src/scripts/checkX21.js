import 'dotenv/config'
import mongoose from 'mongoose'

const db = (await mongoose.connect(process.env.MONGO_URI)).connection.db

const memberId = await mongoose.Types.ObjectId.createFromHexString('69f3090dfc07b8327e5bc8a4')

console.log('=== x21 active WorkoutSchedules ===')
const active = await db.collection('workoutschedules').find({ memberId, status: 'active' }).toArray()
console.log('Count:', active.length)
for (const s of active) {
  console.log('  _id='+s._id+' templateId='+s.templateId)
}

console.log('\n=== x21 PTAssignment (active) ===')
const pa = await db.collection('ptassignments').findOne({ memberId, status: 'active' })
console.log(pa ? ('  _id='+pa._id+' workoutId='+pa.workoutId+' status='+pa.status) : '  NONE')

await mongoose.disconnect()
process.exit(0)
