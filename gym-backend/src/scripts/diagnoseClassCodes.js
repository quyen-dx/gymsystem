import 'dotenv/config'
import mongoose from 'mongoose'

async function diagnose() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gym')

  const db = mongoose.connection.db

  // ============================
  // 1. ALL TrainingClasses
  // ============================
  console.log('=== 1. ALL TrainingClasses ===')
  const allClasses = await db.collection('trainingclasses').find({}, {
    projection: { name: 1, code: 1, ptId: 1, daysOfWeek: 1, startTime: 1, endTime: 1 }
  }).toArray()
  console.log('Count:', allClasses.length)
  for (const c of allClasses) {
    console.log(`  [${c.code}] ${c.name}  ptId=${c.ptId}  days=${JSON.stringify(c.daysOfWeek)}  ${c.startTime}-${c.endTime}`)
  }

  // ============================
  // 2. WorkoutSchedules with classCode=C001
  // ============================
  console.log('\n=== 2. WorkoutSchedules with sessions.classCode = "C001" ===')
  const c001Schedules = await db.collection('workoutschedules').find({
    'sessions.classCode': 'C001'
  }).toArray()
  console.log('Count:', c001Schedules.length)
  for (const s of c001Schedules) {
    console.log(`  _id=${s._id}  status=${s.status}  memberId=${s.memberId}  assignedBy=${s.assignedBy}`)
    for (const sx of (s.sessions || [])) {
      const dow = sx.date ? new Date(sx.date).getDay() : 'N/A'
      const dateStr = sx.date ? new Date(sx.date).toISOString().slice(0, 10) : 'N/A'
      console.log(`    dayOrder=${sx.dayOrder}  date=${dateStr}  dow=${dow}  time=${sx.time}  endTime=${sx.endTime}  classCode=${sx.classCode}  className=${sx.className}`)
    }
  }

  // ============================
  // 3. ALL WorkoutSchedules (all statuses)
  // ============================
  console.log('\n=== 3. ALL WorkoutSchedules ===')
  const allWS = await db.collection('workoutschedules').find({}, {
    projection: { status: 1, memberId: 1, assignedBy: 1, sessions: 1 }
  }).toArray()
  console.log('Total:', allWS.length)
  for (const s of allWS) {
    console.log(`  _id=${s._id}  status=${s.status}  memberId=${s.memberId}  assignedBy=${s.assignedBy}`)
    for (const sx of (s.sessions || [])) {
      const dow = sx.date ? new Date(sx.date).getDay() : 'N/A'
      const dateStr = sx.date ? new Date(sx.date).toISOString().slice(0, 10) : 'N/A'
      console.log(`    dayOrder=${sx.dayOrder}  dow=${dow}  date=${dateStr}  time=${sx.time}  endTime=${sx.endTime}  classCode=${sx.classCode}  className=${sx.className}`)
    }
  }

  // ============================
  // 4. Aggregate count (exactly what getAllClasses does)
  // ============================
  console.log('\n=== 4. Aggregate count (active+completed, by classCode, distinct memberIds) ===')
  const counts = await db.collection('workoutschedules').aggregate([
    { $match: { status: { $in: ['active', 'completed'] } } },
    { $unwind: '$sessions' },
    { $match: { 'sessions.classCode': { $ne: '', $exists: true } } },
    { $group: { _id: '$sessions.classCode', members: { $addToSet: '$memberId' } } },
  ]).toArray()
  console.log('Result:')
  for (const c of counts) {
    console.log(`  classCode=${c._id}  distinctMembers=${c.members.length}  ids=${c.members}`)
  }

  // ============================
  // 5. Also check TrainingAssignments (old counting source)
  // ============================
  console.log('\n=== 5. TrainingAssignments (active, grouped by classId) ===')
  const taCounts = await db.collection('trainingassignments').aggregate([
    { $match: { status: 'active' } },
    { $group: { _id: '$classId', count: { $sum: 1 } } },
  ]).toArray()
  console.log('Count:', taCounts.length, 'groups')
  for (const t of taCounts) {
    console.log(`  classId=${t._id}  count=${t.count}`)
  }

  await mongoose.disconnect()
  process.exit(0)
}

diagnose().catch(err => { console.error(err); process.exit(1) })
