import mongoose from 'mongoose'

const NOTIFICATION_TYPES = {
  // Member
  PT_ASSIGNED: 'PT_ASSIGNED',
  PT_CHANGED_APPROVED: 'PT_CHANGED_APPROVED',
  PT_END_APPROVED: 'PT_END_APPROVED',
  PT_END_REJECTED: 'PT_END_REJECTED',
  PT_WORKOUT_ASSIGNED: 'PT_WORKOUT_ASSIGNED',
  PT_WORKOUT_CHANGED: 'PT_WORKOUT_CHANGED',
  PT_WORKOUT_COMPLETED: 'PT_WORKOUT_COMPLETED',
  PT_SESSION_COMPLETED: 'PT_SESSION_COMPLETED',
  BOOKING_CONFIRMED: 'BOOKING_CONFIRMED',
  BOOKING_REJECTED: 'BOOKING_REJECTED',
  CHECKIN_SUCCESS: 'CHECKIN_SUCCESS',
  SCHEDULE_CHANGED: 'SCHEDULE_CHANGED',
  MEMBERSHIP_EXPIRING_7D: 'MEMBERSHIP_EXPIRING_7D',
  MEMBERSHIP_EXPIRING_1D: 'MEMBERSHIP_EXPIRING_1D',
  MEMBERSHIP_EXPIRED: 'MEMBERSHIP_EXPIRED',
  MEMBERSHIP_ACTIVATED: 'MEMBERSHIP_ACTIVATED',
  MEMBERSHIP_RENEWAL_SUCCESS: 'MEMBERSHIP_RENEWAL_SUCCESS',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  REFUND_APPROVED: 'REFUND_APPROVED',
  REFUND_REJECTED: 'REFUND_REJECTED',

  // PT
  PT_END_REQUEST_APPROVED: 'PT_END_REQUEST_APPROVED',
  PT_END_REQUEST_REJECTED: 'PT_END_REQUEST_REJECTED',
  WORKOUT_REPORTED: 'WORKOUT_REPORTED',
  WORKOUT_HIDDEN: 'WORKOUT_HIDDEN',
  WORKOUT_RESTORED: 'WORKOUT_RESTORED',
  WORKOUT_IMPROVEMENT_SUGGESTION: 'WORKOUT_IMPROVEMENT_SUGGESTION',
  WORKOUT_IMPROVEMENT_ACCEPTED: 'WORKOUT_IMPROVEMENT_ACCEPTED',
  WORKOUT_IMPROVEMENT_REJECTED: 'WORKOUT_IMPROVEMENT_REJECTED',
  MEMBER_ASSIGNED: 'MEMBER_ASSIGNED',
  CLASS_ASSIGNED: 'CLASS_ASSIGNED',
  PT_SCHEDULE_CHANGED: 'PT_SCHEDULE_CHANGED',
  SHIFT_SWAP_APPROVED: 'SHIFT_SWAP_APPROVED',
  SHIFT_SWAP_REJECTED: 'SHIFT_SWAP_REJECTED',
  TRAINER_REPLACEMENT_ASSIGNED: 'TRAINER_REPLACEMENT_ASSIGNED',
  TRAINER_REPLACEMENT_REJECTED: 'TRAINER_REPLACEMENT_REJECTED',

  // Admin
  PT_END_REQUEST_CREATED: 'PT_END_REQUEST_CREATED',
  SHIFT_SWAP_REQUEST: 'SHIFT_SWAP_REQUEST',
  WORKOUT_REPORTED_ADMIN: 'WORKOUT_REPORTED_ADMIN',
  PARTNERSHIP_REQUEST: 'PARTNERSHIP_REQUEST',
  REFUND_REQUEST: 'REFUND_REQUEST',
  BACKUP_FAILED: 'BACKUP_FAILED',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  DISK_SPACE_LOW: 'DISK_SPACE_LOW',

  // Staff
  STAFF_WORK_ASSIGNMENT: 'STAFF_WORK_ASSIGNMENT',
  STAFF_SCHEDULE_CHANGED: 'STAFF_SCHEDULE_CHANGED',
  STAFF_SYSTEM_NOTIFICATION: 'STAFF_SYSTEM_NOTIFICATION',
  REFUND_REMINDER: 'REFUND_REMINDER',
  REFUND_EXPIRED: 'REFUND_EXPIRED',
}

const CATEGORIES = [
  'BOOKING_PT',
  'WORKOUT',
  'SCHEDULE',
  'CHECKIN',
  'MEMBERSHIP',
  'PAYMENT',
  'REFUND',
  'SYSTEM',
  'OTHER',
]

const CATEGORY_MAP = {
  // Member
  PT_ASSIGNED: 'BOOKING_PT',
  PT_CHANGED_APPROVED: 'BOOKING_PT',
  PT_END_APPROVED: 'BOOKING_PT',
  PT_END_REJECTED: 'BOOKING_PT',
  PT_WORKOUT_ASSIGNED: 'WORKOUT',
  PT_WORKOUT_CHANGED: 'WORKOUT',
  PT_WORKOUT_COMPLETED: 'WORKOUT',
  PT_SESSION_COMPLETED: 'BOOKING_PT',
  BOOKING_CONFIRMED: 'BOOKING_PT',
  BOOKING_REJECTED: 'BOOKING_PT',
  CHECKIN_SUCCESS: 'CHECKIN',
  SCHEDULE_CHANGED: 'SCHEDULE',
  MEMBERSHIP_EXPIRING_7D: 'MEMBERSHIP',
  MEMBERSHIP_EXPIRING_1D: 'MEMBERSHIP',
  MEMBERSHIP_EXPIRED: 'MEMBERSHIP',
  MEMBERSHIP_ACTIVATED: 'MEMBERSHIP',
  MEMBERSHIP_RENEWAL_SUCCESS: 'MEMBERSHIP',
  PAYMENT_SUCCESS: 'PAYMENT',
  PAYMENT_FAILED: 'PAYMENT',
  REFUND_APPROVED: 'REFUND',
  REFUND_REJECTED: 'REFUND',

  // PT
  PT_END_REQUEST_APPROVED: 'BOOKING_PT',
  PT_END_REQUEST_REJECTED: 'BOOKING_PT',
  WORKOUT_REPORTED: 'WORKOUT',
  WORKOUT_HIDDEN: 'WORKOUT',
  WORKOUT_RESTORED: 'WORKOUT',
  WORKOUT_IMPROVEMENT_SUGGESTION: 'WORKOUT',
  WORKOUT_IMPROVEMENT_ACCEPTED: 'WORKOUT',
  WORKOUT_IMPROVEMENT_REJECTED: 'WORKOUT',
  MEMBER_ASSIGNED: 'BOOKING_PT',
  CLASS_ASSIGNED: 'BOOKING_PT',
  PT_SCHEDULE_CHANGED: 'SCHEDULE',
  SHIFT_SWAP_APPROVED: 'SCHEDULE',
  SHIFT_SWAP_REJECTED: 'SCHEDULE',
  TRAINER_REPLACEMENT_ASSIGNED: 'SCHEDULE',
  TRAINER_REPLACEMENT_REJECTED: 'SCHEDULE',

  // Admin
  PT_END_REQUEST_CREATED: 'BOOKING_PT',
  SHIFT_SWAP_REQUEST: 'SCHEDULE',
  WORKOUT_REPORTED_ADMIN: 'WORKOUT',
  PARTNERSHIP_REQUEST: 'SYSTEM',
  REFUND_REQUEST: 'REFUND',
  BACKUP_FAILED: 'SYSTEM',
  SYSTEM_ERROR: 'SYSTEM',
  DISK_SPACE_LOW: 'SYSTEM',

  // Staff
  STAFF_WORK_ASSIGNMENT: 'SYSTEM',
  STAFF_SCHEDULE_CHANGED: 'SCHEDULE',
  STAFF_SYSTEM_NOTIFICATION: 'SYSTEM',
}

function getCategory(type) {
  return CATEGORY_MAP[type] || 'OTHER'
}

const notificationSchema = new mongoose.Schema(
  {
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    receiverRole: {
      type: String,
      enum: ['member', 'pt', 'admin', 'staff', 'super_admin'],
      default: null,
    },
    notificationType: {
      type: String,
      enum: Object.values(NOTIFICATION_TYPES),
      default: 'OTHER',
    },
    category: {
      type: String,
      enum: CATEGORIES,
      default: 'OTHER',
    },
    title: {
      type: String,
      required: [true, 'Tiêu đề thông báo là bắt buộc'],
      trim: true,
    },
    content: {
      type: String,
      required: [true, 'Nội dung thông báo là bắt buộc'],
      trim: true,
    },
    // Legacy field - vẫn giữ để backward compatibility
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    relatedType: {
      type: String,
      default: null,
    },
    // Legacy field - vẫn giữ để backward compatibility
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PTAssignmentEndRequest',
      default: null,
    },
    redirectUrl: {
      type: String,
      default: null,
    },
    createdBy: {
      type: String,
      enum: ['System', 'Admin', 'PT', 'Staff'],
      default: 'System',
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

notificationSchema.index({ receiverId: 1, isRead: 1, createdAt: -1 })
notificationSchema.index({ receiverRole: 1, createdAt: -1 })
notificationSchema.index({ notificationType: 1 })

// Middleware: tự động set category dựa trên notificationType
notificationSchema.pre('validate', function () {
  if (this.notificationType && !this.category) {
    this.category = getCategory(this.notificationType)
  }
  // Đồng bộ receiverId với userId legacy nếu cần
  if (!this.receiverId && this.userId) {
    this.receiverId = this.userId
  }
  if (!this.userId && this.receiverId) {
    this.userId = this.receiverId
  }
})

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema)

export default Notification
export { NOTIFICATION_TYPES, CATEGORIES, CATEGORY_MAP, getCategory }
