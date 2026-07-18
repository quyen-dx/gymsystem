/**
 * One-time script to clean up dangling PT data for members whose cancellation was
 * approved before the automatic cleanup logic was in place.
 *
 * Usage: node scripts/cleanupMemberPTData.js <memberId>
 * Example: node scripts/cleanupMemberPTData.js x21
 */
import mongoose from 'mongoose'
import ClassEnrollment from '../src/models/ClassEnrollment.js'
import PTAssignment from '../src/models/PTAssignment.js'
import User from '../src/models/User.js'
import { NOTIFICATION_TYPES } from '../src/models/Notification.js'
import { createNotification } from '../src/services/notificationService.js'

async function main() {
  const lookup = process.argv[2]
  if (!lookup) {
    console.error('Usage: node scripts/cleanupMemberPTData.js <memberCode|memberId>')
    process.exit(1)
  }

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gym')
  console.log('Connected to MongoDB')

  const member = await User.findOne({
    $or: [
      { memberCode: lookup },
      { _id: mongoose.Types.ObjectId.isValid(lookup) ? lookup : undefined },
    ].filter(Boolean),
  }).lean()

  if (!member) {
    console.error(`Member not found: ${lookup}`)
    await mongoose.disconnect()
    process.exit(1)
  }

  const memberId = member._id
  const mName = member.fullName || member.name || 'Hội viên'
  console.log(`Found: ${mName} (${member.memberCode || memberId})`)

  const [activeEnrollment, activeAssignment] = await Promise.all([
    ClassEnrollment.findOne({ memberId, status: 'active' })
      .populate('classId', 'code name').lean(),
    PTAssignment.findOne({ memberId, status: 'active' })
      .populate('ptId', 'name fullName').lean(),
  ])

  if (!activeEnrollment && !activeAssignment) {
    console.log('No active enrollment or assignment found. Nothing to clean up.')
    await mongoose.disconnect()
    return
  }

  if (activeEnrollment) {
    await ClassEnrollment.updateOne(
      { _id: activeEnrollment._id },
      {
        $set: {
          status: 'ended',
          leftAt: new Date(),
          sourceReason: 'member_cancelled_plan',
          note: 'Hội viên hủy gói tập (dọn dẹp thủ công)',
        },
      },
    )
    const cls = activeEnrollment.classId
    console.log(`Ended enrollment: ${cls ? `[${cls.code}] ${cls.name}` : activeEnrollment._id}`)
  }

  if (activeAssignment) {
    await PTAssignment.updateOne(
      { _id: activeAssignment._id },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelReason: 'Hội viên hủy gói tập (dọn dẹp thủ công)',
        },
      },
    )
    console.log(`Cancelled PT assignment: ${activeAssignment.ptId?.fullName || activeAssignment.ptId?.name || activeAssignment._id}`)
  }

  // Notify PT
  if (activeAssignment?.ptId?._id) {
    await createNotification({
      receiverId: activeAssignment.ptId._id,
      receiverRole: 'pt',
      notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
      title: 'Hội viên đã hủy gói tập',
      content: `Hội viên ${mName} đã hủy gói tập. Vui lòng xác nhận kết thúc phụ trách đối với hội viên này.`,
      relatedId: memberId,
      relatedType: 'User',
      redirectUrl: '/pt/clients',
      createdBy: 'System',
    })
    console.log(`Notification sent to PT: ${activeAssignment.ptId.fullName || activeAssignment.ptId.name}`)
  }

  console.log('Cleanup complete.')
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
