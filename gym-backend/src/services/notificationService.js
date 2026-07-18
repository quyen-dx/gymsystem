import Notification, { NOTIFICATION_TYPES, getCategory } from '../models/Notification.js'
import User from '../models/User.js'
import { getIO } from './socketService.js'
import { transporter } from './emailService.js'

const SITE_NAME = process.env.SITE_NAME || 'GymPro'
const FROM_EMAIL = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@gympro.com'

// Các notification type cần gửi email kèm
const EMAIL_EVENTS = new Set([
  NOTIFICATION_TYPES.PT_ASSIGNED,
  NOTIFICATION_TYPES.PT_CHANGED_APPROVED,
  NOTIFICATION_TYPES.PT_END_APPROVED,
  NOTIFICATION_TYPES.PT_END_REJECTED,
  NOTIFICATION_TYPES.SCHEDULE_CHANGED,
  NOTIFICATION_TYPES.MEMBERSHIP_EXPIRING_7D,
  NOTIFICATION_TYPES.MEMBERSHIP_EXPIRING_1D,
  NOTIFICATION_TYPES.MEMBERSHIP_EXPIRED,
  NOTIFICATION_TYPES.MEMBERSHIP_ACTIVATED,
  NOTIFICATION_TYPES.MEMBERSHIP_RENEWAL_SUCCESS,
  NOTIFICATION_TYPES.PAYMENT_SUCCESS,
  NOTIFICATION_TYPES.PAYMENT_FAILED,
  NOTIFICATION_TYPES.REFUND_APPROVED,
  NOTIFICATION_TYPES.REFUND_REJECTED,
  NOTIFICATION_TYPES.PT_END_REQUEST_APPROVED,
  NOTIFICATION_TYPES.PT_END_REQUEST_REJECTED,
  NOTIFICATION_TYPES.WORKOUT_REPORTED,
  NOTIFICATION_TYPES.WORKOUT_HIDDEN,
  NOTIFICATION_TYPES.WORKOUT_RESTORED,
  NOTIFICATION_TYPES.CLASS_ASSIGNED,
  NOTIFICATION_TYPES.PT_SCHEDULE_CHANGED,
  NOTIFICATION_TYPES.SHIFT_SWAP_APPROVED,
  NOTIFICATION_TYPES.SHIFT_SWAP_REJECTED,
  NOTIFICATION_TYPES.PARTNERSHIP_REQUEST,
  NOTIFICATION_TYPES.REFUND_REQUEST,
  NOTIFICATION_TYPES.BACKUP_FAILED,
  NOTIFICATION_TYPES.SYSTEM_ERROR,
  NOTIFICATION_TYPES.DISK_SPACE_LOW,
  NOTIFICATION_TYPES.STAFF_SCHEDULE_CHANGED,
  NOTIFICATION_TYPES.STAFF_WORK_ASSIGNMENT,
  NOTIFICATION_TYPES.STAFF_SYSTEM_NOTIFICATION,
])

async function sendPlainEmail(to, subject, htmlContent) {
  if (!to) return
  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to,
      subject: `${subject} - ${SITE_NAME}`,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px">
        <h2 style="color:#b8462f">${subject}</h2>
        <div style="line-height:1.6;white-space:pre-wrap">${htmlContent}</div>
        <hr style="margin:24px 0;border:none;border-top:1px solid #eee">
        <p style="font-size:12px;color:#999">${SITE_NAME}</p>
      </div>`,
    })
  } catch (err) {
    console.error('[NotificationService] Email send error:', err.message)
  }
}

/**
 * Tao notification va tu dong gui email + socket emit neu can
 */
export async function createNotification({
  receiverId,
  receiverRole = null,
  notificationType,
  title,
  content,
  relatedId = null,
  relatedType = null,
  redirectUrl = null,
  createdBy = 'System',
  sendEmail = null,
}) {
  const category = getCategory(notificationType)

  if (relatedId) {
    const existing = await Notification.findOne({
      receiverId,
      notificationType,
      relatedId,
      createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
      deletedAt: null,
    }).lean()
    if (existing) return existing
  }

  const doc = await Notification.create({
    receiverId,
    receiverRole,
    notificationType,
    category,
    title,
    content,
    userId: receiverId,
    relatedId,
    relatedType,
    requestId: relatedType === 'PTAssignmentEndRequest' ? relatedId : null,
    redirectUrl,
    createdBy,
  })

  // Socket emit
  const io = getIO()
  if (io) {
    const notifObj = doc.toObject ? doc.toObject() : doc
    if (receiverId) {
      io.to(receiverId.toString()).emit('notification:new', notifObj)
    }
    if (!receiverId || ['admin', 'staff', 'super_admin'].includes(receiverRole)) {
      io.to('staff').emit('notification:new', notifObj)
    }
  }

  // Email
  const shouldSendEmail = sendEmail !== null ? sendEmail : EMAIL_EVENTS.has(notificationType)
  if (shouldSendEmail && receiverId) {
    try {
      const user = await User.findById(receiverId).select('email name fullName role').lean()
      if (user?.email) {
        await sendPlainEmail(user.email, title, content.replace(/\n/g, '<br>'))
      }
    } catch (err) {
      console.error('[NotificationService] Email lookup failed:', err.message)
    }
  }

  return doc
}

export async function markAsRead(id) {
  return Notification.findByIdAndUpdate(id, { isRead: true, readAt: new Date() }, { new: true })
}

export async function markAsUnread(id) {
  return Notification.findByIdAndUpdate(id, { isRead: false, readAt: null }, { new: true })
}

export async function softDelete(id) {
  return Notification.findByIdAndUpdate(id, { deletedAt: new Date() }, { new: true })
}

export async function getNotificationsForUser(userId, role) {
  const filter = {
    deletedAt: null,
    $or: [
      { receiverId: userId },
      { receiverId: null, receiverRole: role },
      { receiverId: null, receiverRole: { $in: ['admin', 'staff', 'super_admin'] } },
    ],
  }
  return Notification.find(filter).sort({ createdAt: -1 }).lean()
}

export async function countUnread(userId, role) {
  const filter = {
    isRead: false,
    deletedAt: null,
    $or: [
      { receiverId: userId },
      { receiverId: null, receiverRole: role },
      { receiverId: null, receiverRole: { $in: ['admin', 'staff', 'super_admin'] } },
    ],
  }
  return Notification.countDocuments(filter)
}

export async function markAllAsRead(userId) {
  return Notification.updateMany(
    { receiverId: userId, isRead: false, deletedAt: null },
    { isRead: true, readAt: new Date() },
  )
}
