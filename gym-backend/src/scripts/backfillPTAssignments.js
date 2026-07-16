import mongoose from 'mongoose'
import TrainingClass from '../models/TrainingClass.js'
import TrainingAssignment from '../models/TrainingAssignment.js'
import PTAssignment from '../models/PTAssignment.js'

async function backfill() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gym')
    console.log('Connected to MongoDB')

    const classes = await TrainingClass.find({ ptId: { $ne: null } }).select('_id ptId').lean()
    console.log(`Found ${classes.length} classes with PT assigned`)

    let created = 0
    let skipped = 0

    for (const cls of classes) {
      const enrollments = await TrainingAssignment.find({ classId: cls._id, status: 'active' }).select('memberId').lean()
      for (const enr of enrollments) {
        const existing = await PTAssignment.findOne({ memberId: enr.memberId, status: 'active' })
        if (existing) {
          skipped++
          continue
        }
        await PTAssignment.create({
          memberId: enr.memberId,
          ptId: cls.ptId,
          status: 'active',
          startDate: new Date(),
        })
        created++
      }
    }

    console.log(`Done — Created ${created} PTAssignment records, skipped ${skipped} existing`)
    process.exit(0)
  } catch (err) {
    console.error('Error:', err)
    process.exit(1)
  }
}

backfill()
