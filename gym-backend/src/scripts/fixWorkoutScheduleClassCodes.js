import mongoose from 'mongoose'
import WorkoutSchedule from '../models/WorkoutSchedule.js'
import TrainingClass from '../models/TrainingClass.js'

async function fixClassCodes() {
  try {
    const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/gym'
    await mongoose.connect(dbUri)
    console.log('Connected to MongoDB')

    const schedules = await WorkoutSchedule.find({
      status: { $in: ['active', 'completed'] },
    }).lean()

    console.log(`Found ${schedules.length} WorkoutSchedule documents`)

    let checkedCount = 0
    let fixedCount = 0
    let clearedCount = 0
    const fixLog = []

    for (const schedule of schedules) {
      if (!schedule.sessions || schedule.sessions.length === 0) continue
      if (!schedule.assignedBy) continue

      const updatedSessions = []
      let scheduleChanged = false

      for (const session of schedule.sessions) {
        const newSession = { ...session }

        if (!session.date || !session.time) {
          updatedSessions.push(newSession)
          continue
        }

        checkedCount++
        const dayOfWeek = new Date(session.date).getDay()
        const time = session.time
        const endTime = session.endTime || ''

        const matchQuery = {
          ptId: schedule.assignedBy,
          daysOfWeek: dayOfWeek,
          startTime: time,
        }
        if (endTime) matchQuery.endTime = endTime

        const matchedClass = await TrainingClass.findOne(matchQuery).lean()

        const expectedCode = matchedClass?.code || ''
        const expectedName = matchedClass?.name || ''

        const currentCode = session.classCode || ''
        const currentName = session.className || ''

        if (currentCode !== expectedCode || currentName !== expectedName) {
          newSession.classCode = expectedCode
          newSession.className = expectedName
          scheduleChanged = true

          if (!expectedCode) {
            clearedCount++
            fixLog.push({
              scheduleId: schedule._id,
              sessionDay: dayOfWeek,
              sessionTime: time,
              sessionEndTime: endTime,
              oldCode: currentCode,
              oldName: currentName,
              newCode: '',
              newName: '',
              action: 'CLEARED (no matching class found)',
            })
          } else {
            fixedCount++
            fixLog.push({
              scheduleId: schedule._id,
              sessionDay: dayOfWeek,
              sessionTime: time,
              sessionEndTime: endTime,
              oldCode: currentCode,
              oldName: currentName,
              newCode: expectedCode,
              newName: expectedName,
              action: 'FIXED',
            })
          }
        }

        updatedSessions.push(newSession)
      }

      if (scheduleChanged) {
        await WorkoutSchedule.updateOne(
          { _id: schedule._id },
          { $set: { sessions: updatedSessions } }
        )
      }
    }

    console.log('\n=== Migration Summary ===')
    console.log(`Total sessions checked: ${checkedCount}`)
    console.log(`Fixed (corrected): ${fixedCount}`)
    console.log(`Cleared (no match): ${clearedCount}`)
    console.log(`Unchanged: ${checkedCount - fixedCount - clearedCount}`)

    if (fixLog.length > 0) {
      console.log('\n=== Fix Details ===')
      for (const entry of fixLog) {
        console.log(
          `\nSchedule: ${entry.scheduleId}\n` +
          `  Session: day=${entry.sessionDay} time=${entry.sessionTime} endTime=${entry.sessionEndTime}\n` +
          `  Old: code="${entry.oldCode}" name="${entry.oldName}"\n` +
          `  New: code="${entry.newCode}" name="${entry.newName}"\n` +
          `  => ${entry.action}`
        )
      }
    } else {
      console.log('\n✓ All class codes are already correct — no changes needed.')
    }

    console.log('\nMigration complete.')
    process.exit(0)
  } catch (err) {
    console.error('Migration error:', err)
    process.exit(1)
  }
}

fixClassCodes()
