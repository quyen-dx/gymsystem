/**
 * Migration: cập nhật notifications cũ sang model mới
 * Thêm: receiverId, receiverRole, notificationType, category, readAt, createdBy
 * Chạy: node src/scripts/migrateNotifications.js
 */
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })

// Map title -> notificationType
const TITLE_TYPE_MAP = {
  'Yêu cầu kết thúc phụ trách': 'PT_END_REQUEST_CREATED',
  'Yêu cầu kết thúc phụ trách đã được phê duyệt': 'PT_END_REQUEST_APPROVED',
  'Yêu cầu kết thúc phụ trách bị từ chối': 'PT_END_REQUEST_REJECTED',
  'Thay đổi PT phụ trách': 'PT_END_APPROVED',
  'Yêu cầu thay đổi PT phụ trách': 'PT_END_REJECTED',
  'Giáo án của bạn đã bị Ẩn': 'WORKOUT_HIDDEN',
  'Giáo án của bạn đã được khôi phục': 'WORKOUT_RESTORED',
  'Đề xuất cải tiến mới': 'WORKOUT_IMPROVEMENT_SUGGESTION',
  'Đề xuất cải tiến đã được chấp nhận': 'WORKOUT_IMPROVEMENT_ACCEPTED',
  'Đề xuất cải tiến bị từ chối': 'WORKOUT_IMPROVEMENT_REJECTED',
  'Báo cáo vi phạm giáo án mới': 'WORKOUT_REPORTED_ADMIN',
  'Giáo án của bạn đã nhận thêm báo cáo': 'WORKOUT_REPORTED',
  'Lịch dạy thay mới': 'TRAINER_REPLACEMENT_ASSIGNED',
  'Đã có PT dạy thay': 'SHIFT_SWAP_APPROVED',
  'Yêu cầu thay ca bị từ chối': 'SHIFT_SWAP_REJECTED',
  'Yêu cầu đổi ca đã được duyệt': 'SHIFT_SWAP_APPROVED',
  'Yêu cầu đổi ca bị từ chối': 'SHIFT_SWAP_REJECTED',
  'Gói tập sắp hết hạn': 'MEMBERSHIP_EXPIRING_1D',
  'Lịch dạy thay': 'TRAINER_REPLACEMENT_ASSIGNED',
}

const ROLE_TYPE_MAP = {
  'pt_end_request_created': 'admin',
  'pt_end_request_approved': 'pt',
  'pt_end_request_rejected': 'pt',
  'pt_end_approved': 'member',
  'pt_end_rejected': 'member',
  'workout_hidden': 'pt',
  'workout_restored': 'pt',
  'workout_improvement_suggestion': 'pt',
  'workout_improvement_accepted': 'pt',
  'workout_improvement_rejected': 'pt',
  'workout_reported_admin': 'admin',
  'workout_reported': 'pt',
  'trainer_replacement_assigned': 'pt',
  'trainer_replacement_rejected': 'pt',
  'shift_swap_approved': 'pt',
  'shift_swap_rejected': 'pt',
  'membership_expiring_1d': 'member',
  'membership_expiring_7d': 'member',
}

const CATEGORY_MAP = {
  pt_end_request_created: 'BOOKING_PT',
  pt_end_request_approved: 'BOOKING_PT',
  pt_end_request_rejected: 'BOOKING_PT',
  pt_end_approved: 'BOOKING_PT',
  pt_end_rejected: 'BOOKING_PT',
  workout_hidden: 'WORKOUT',
  workout_restored: 'WORKOUT',
  workout_improvement_suggestion: 'WORKOUT',
  workout_improvement_accepted: 'WORKOUT',
  workout_improvement_rejected: 'WORKOUT',
  workout_reported_admin: 'WORKOUT',
  workout_reported: 'WORKOUT',
  trainer_replacement_assigned: 'SCHEDULE',
  trainer_replacement_rejected: 'SCHEDULE',
  shift_swap_approved: 'SCHEDULE',
  shift_swap_rejected: 'SCHEDULE',
  membership_expiring_1d: 'MEMBERSHIP',
  membership_expiring_7d: 'MEMBERSHIP',
}

// Detect sub-type for membership expiry based on content
function detectMembershipDays(content) {
  const match = content.match(/sau (\d+) ngày/)
  if (match) {
    const days = parseInt(match[1])
    return days <= 1 ? 'MEMBERSHIP_EXPIRING_1D' : 'MEMBERSHIP_EXPIRING_7D'
  }
  return 'MEMBERSHIP_EXPIRING_1D'
}

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI)
  console.log('Connected to MongoDB')

  const Notification = mongoose.model('Notification')
  const User = mongoose.model('User')

  const all = await Notification.find({}).lean()
  console.log(`Found ${all.length} notifications to migrate`)

  let updated = 0
  for (const n of all) {
    const updates = {}

    // receiverId = userId
    if (!n.receiverId && n.userId) {
      updates.receiverId = n.userId
    }

    // receiverRole
    if (!n.receiverRole) {
      if (!n.userId) {
        updates.receiverRole = 'admin'
      } else {
        const user = await User.findById(n.userId).select('role').lean()
        if (user) updates.receiverRole = user.role
      }
    }

    // notificationType
    if (!n.notificationType) {
      let type = TITLE_TYPE_MAP[n.title]
      if (n.title === 'Gói tập sắp hết hạn') {
        type = detectMembershipDays(n.content)
      }
      updates.notificationType = type || 'OTHER'
    }

    // category
    if (!n.category && updates.notificationType) {
      const key = updates.notificationType.toLowerCase()
      updates.category = CATEGORY_MAP[key] || 'OTHER'
    }

    // readAt
    if (n.isRead && !n.readAt) {
      updates.readAt = n.updatedAt || n.createdAt
    }

    // createdBy
    if (!n.createdBy) {
      updates.createdBy = 'System'
    }

    if (Object.keys(updates).length > 0) {
      await Notification.updateOne({ _id: n._id }, { $set: updates })
      updated++
    }
  }

  console.log(`Migrated ${updated} / ${all.length} notifications`)
  await mongoose.disconnect()
  console.log('Done')
}

migrate().catch((e) => { console.error(e); process.exit(1) })
