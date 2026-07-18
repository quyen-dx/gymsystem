/**
 * Backfill: Tạo Notification cho các PTAssignmentEndRequest cũ chưa có notification.
 *
 * Chạy: node src/scripts/backfillEndRequestNotifications.js
 */
import mongoose from 'mongoose'
import PTAssignmentEndRequest from '../models/PTAssignmentEndRequest.js'
import Notification, { NOTIFICATION_TYPES } from '../models/Notification.js'
import User from '../models/User.js'
import { createNotification } from '../services/notificationService.js'

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gym-system'

const REASON_LABELS = {
  MEMBER_COMPLETED: 'Hội viên hoàn thành khóa học',
  MEMBER_REQUEST_CHANGE_PT: 'Hội viên yêu cầu đổi PT',
  MEMBER_QUIT: 'Hội viên xin nghỉ tập',
  PT_NO_LONGER_TEACHES: 'PT không còn phụ trách lớp',
  OTHER: null,
}

const getReasonText = (reasonType, reasonDetail) => {
  if (reasonType === 'OTHER') return reasonDetail || 'Khác'
  return REASON_LABELS[reasonType] || reasonType
}

const getMemberName = async (memberId) => {
  const u = await User.findById(memberId).select('name fullName memberCode').lean()
  return u?.fullName || u?.name || 'Hội viên'
}

const getPtName = async (ptId) => {
  const u = await User.findById(ptId).select('name fullName').lean()
  return u?.fullName || u?.name || 'PT'
}

async function run() {
  await mongoose.connect(MONGO_URI)
  console.log('Connected to MongoDB')

  const requests = await PTAssignmentEndRequest.find({}).lean()
  let created = 0
  let skipped = 0

  for (const req of requests) {
    // Check if notification with this requestId already exists
    const existing = await Notification.findOne({ relatedId: req._id, relatedType: 'PTAssignmentEndRequest' }).lean()
    if (existing) {
      skipped++
      continue
    }

    const ptName = await getPtName(req.ptId)
    const memberName = await getMemberName(req.memberId)
    const reason = getReasonText(req.reasonType, req.reasonDetail)

    await createNotification({
      receiverId: null,
      receiverRole: 'admin',
      notificationType: NOTIFICATION_TYPES.PT_END_REQUEST_CREATED,
      title: 'Yêu cầu kết thúc phụ trách',
      content: `PT ${ptName} đã gửi yêu cầu kết thúc phụ trách hội viên ${memberName}.\n\nLý do:\n${reason}`,
      relatedId: req._id,
      relatedType: 'PTAssignmentEndRequest',
      redirectUrl: '/admin/trainer-end-requests',
      createdBy: 'System',
      sendEmail: false,
    })
    created++
  }

  console.log(`Done: ${created} notifications created, ${skipped} skipped`)
  await mongoose.disconnect()
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
