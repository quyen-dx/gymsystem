import Notification, { NOTIFICATION_TYPES, getCategory } from '../models/Notification.js'
import NotificationPreference from '../models/NotificationPreference.js'
import NotificationTemplate from '../models/NotificationTemplate.js'
import User from '../models/User.js'
import { getIO } from './socketService.js'
import { transporter } from './emailService.js'
import { sendNotificationSms } from './smsService.js'
import { sendPushNotification, getMessaging } from './pushService.js'
// TODO: Consider adding a retry/queue mechanism for notification delivery failures
// Currently, fire-and-forget notification calls at ~30+ call sites silently drop errors.
// A background queue (e.g., Bull/BullMQ) would ensure reliable delivery.

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

const SMS_ELIGIBLE_TYPES = new Set([
  NOTIFICATION_TYPES.MEMBERSHIP_EXPIRING_7D,
  NOTIFICATION_TYPES.MEMBERSHIP_EXPIRING_1D,
  NOTIFICATION_TYPES.MEMBERSHIP_EXPIRED,
  NOTIFICATION_TYPES.MEMBERSHIP_ACTIVATED,
  NOTIFICATION_TYPES.MEMBERSHIP_RENEWAL_SUCCESS,
  NOTIFICATION_TYPES.PAYMENT_SUCCESS,
  NOTIFICATION_TYPES.PAYMENT_FAILED,
  NOTIFICATION_TYPES.REFUND_APPROVED,
  NOTIFICATION_TYPES.REFUND_REJECTED,
  NOTIFICATION_TYPES.BOOKING_CONFIRMED,
  NOTIFICATION_TYPES.BOOKING_REJECTED,
  NOTIFICATION_TYPES.CHECKIN_SUCCESS,
  NOTIFICATION_TYPES.PT_ASSIGNED,
  NOTIFICATION_TYPES.PT_CHANGED_APPROVED,
  NOTIFICATION_TYPES.STAFF_WORK_ASSIGNMENT,
  NOTIFICATION_TYPES.STAFF_SCHEDULE_CHANGED,
])

const TRANSACTIONAL_CATEGORIES = new Set(['MEMBERSHIP', 'PAYMENT', 'REFUND', 'BOOKING_PT', 'CHECKIN', 'SYSTEM'])

async function getUserPreferences(userId) {
  if (!userId) return null
  return NotificationPreference.findOne({ userId }).lean()
}

async function shouldBypassBatching(notificationType, priority) {
  if (priority === 'high') return true
  const category = getCategory(notificationType)
  if (TRANSACTIONAL_CATEGORIES.has(category)) return true
  return false
}

async function hasRecentEmail(receiverId) {
  const recent = await Notification.findOne({
    receiverId,
    channels: 'email',
    createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    deletedAt: null,
  }).sort({ createdAt: -1 }).lean()
  return !!recent
}

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
  sendSms = null,
  sendPush = null,
  channels = null,
  priority = 'medium',
  expiresAt = null,
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

  const shouldEmail = sendEmail !== null ? sendEmail : EMAIL_EVENTS.has(notificationType)
  const shouldSms = sendSms !== null ? sendSms : SMS_ELIGIBLE_TYPES.has(notificationType)
  const shouldPush = sendPush !== null ? sendPush : false

  const pref = await getUserPreferences(receiverId)

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
    status: 'sent',
    channels: channels || ['in_app'],
    priority,
    expiresAt,
  })

  const usedChannels = ['in_app']

  const io = getIO()
  if (io) {
    const inAppEnabled = !pref || pref.isChannelEnabled('in_app')
    if (inAppEnabled) {
      const notifObj = doc.toObject ? doc.toObject() : doc
      if (receiverId) {
        io.to(receiverId.toString()).emit('notification:new', notifObj)
      }
      if (!receiverId || ['admin', 'staff', 'super_admin'].includes(receiverRole)) {
        io.to('staff').emit('notification:new', notifObj)
      }
    }
  }

  let user = null
  if (receiverId && (shouldEmail || shouldSms)) {
    try {
      user = await User.findById(receiverId).select('email name fullName role phone').lean()
    } catch (_) { /* user lookup failed */ }
  }

  const emailEnabled = !pref || pref.isChannelEnabled('email')
  const smsEnabled = !pref || pref.isChannelEnabled('sms')
  const typeNotDisabled = !pref || !pref.isTypeDisabled(notificationType)
  const bypassBatching = await shouldBypassBatching(notificationType, priority)
  const skipEmailBatching = bypassBatching || !(await hasRecentEmail(receiverId))

  if (shouldEmail && receiverId && emailEnabled && typeNotDisabled && skipEmailBatching) {
    if (user?.email) {
      try {
        await sendPlainEmail(user.email, title, content.replace(/\n/g, '<br>'))
        usedChannels.push('email')
      } catch (err) {
        console.error('[NotificationService] Email send error:', err.message)
      }
    }
  }

  if (shouldSms && receiverId && (bypassBatching || (smsEnabled && typeNotDisabled))) {
    const phone = user?.phone
    if (phone) {
      try {
        await sendNotificationSms({ phone, content })
        usedChannels.push('sms')
      } catch (err) {
        console.error('[NotificationService] SMS send error:', err.message)
      }
    }
  }

  const pushEnabled = !pref || pref.isChannelEnabled('push')
  if (shouldPush && receiverId && pushEnabled && typeNotDisabled) {
    try {
      await sendPushNotification(receiverId, { title, body: content, data: {} })
      usedChannels.push('push')
    } catch (err) {
      console.error('[NotificationService] Push send error:', err.message)
    }
  }

  if (usedChannels.length > doc.channels.length || usedChannels.some((c, i) => c !== doc.channels[i])) {
    await Notification.findByIdAndUpdate(doc._id, { channels: usedChannels })
  }

  return doc
}

export async function markAsRead(id) {
  return Notification.findByIdAndUpdate(id, { isRead: true, readAt: new Date(), status: 'read' }, { new: true })
}

export async function markAsUnread(id) {
  return Notification.findByIdAndUpdate(id, { isRead: false, readAt: null, status: 'delivered' }, { new: true })
}

export async function softDelete(id) {
  return Notification.findByIdAndUpdate(id, { deletedAt: new Date() }, { new: true })
}

export async function getNotificationsForUser(userId, role, options = {}) {
  const {
    page = 1,
    limit = 20,
    type = null,
    category = null,
    isRead = null,
  } = options

  const roleOr = [{ receiverId: null, receiverRole: role }]
  if (['admin', 'staff', 'super_admin'].includes(role)) {
    roleOr.push({ receiverId: null, receiverRole: { $in: ['admin', 'staff', 'super_admin'] } })
  }

  const filter = {
    deletedAt: null,
    $or: [
      { receiverId: userId },
      ...roleOr,
    ],
  }

  if (type) filter.notificationType = type
  if (category) filter.category = category
  if (isRead !== null) filter.isRead = isRead

  const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit))

  const [notifications, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Math.min(100, Math.max(1, limit))).lean(),
    Notification.countDocuments(filter),
  ])

  return {
    notifications,
    pagination: {
      page: Math.max(1, page),
      limit: Math.min(100, Math.max(1, limit)),
      total,
      totalPages: Math.ceil(total / Math.min(100, Math.max(1, limit))),
    },
  }
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
    { isRead: true, readAt: new Date(), status: 'read' },
  )
}

export async function getPreferences(userId) {
  let pref = await NotificationPreference.findOne({ userId })
  if (!pref) {
    pref = await NotificationPreference.create({ userId })
  }
  return pref
}

export async function updatePreferences(userId, updates) {
  const allowed = ['emailEnabled', 'smsEnabled', 'pushEnabled', 'inAppEnabled', 'disabledTypes', 'quietHoursEnabled', 'quietHoursStart', 'quietHoursEnd']
  const $set = {}
  for (const key of allowed) {
    if (updates[key] !== undefined) $set[key] = updates[key]
  }
  if (Object.keys($set).length === 0) {
    const error = new Error('Không có trường hợp lệ để cập nhật')
    error.statusCode = 400
    throw error
  }
  return NotificationPreference.findOneAndUpdate(
    { userId },
    { $set },
    { upsert: true, new: true, runValidators: true },
  )
}

export async function getTemplates({ page = 1, limit = 20, isActive = null } = {}) {
  const filter = {}
  if (isActive !== null) filter.isActive = isActive

  const skip = (Math.max(1, page) - 1) * Math.min(50, Math.max(1, limit))
  const [data, total] = await Promise.all([
    NotificationTemplate.find(filter).sort({ name: 1 }).skip(skip).limit(Math.min(50, Math.max(1, limit))).lean(),
    NotificationTemplate.countDocuments(filter),
  ])

  return { data, pagination: { page: Math.max(1, page), limit: Math.min(50, Math.max(1, limit)), total } }
}

export async function createTemplate(data) {
  return NotificationTemplate.create(data)
}

export async function updateTemplate(id, data) {
  const doc = await NotificationTemplate.findByIdAndUpdate(id, data, { new: true, runValidators: true })
  if (!doc) {
    const error = new Error('Không tìm thấy mẫu thông báo')
    error.statusCode = 404
    throw error
  }
  return doc
}

export async function deleteTemplate(id) {
  const doc = await NotificationTemplate.findByIdAndDelete(id)
  if (!doc) {
    const error = new Error('Không tìm thấy mẫu thông báo')
    error.statusCode = 404
    throw error
  }
  return doc
}

/**
 * Notify PT when a member is added to or removed from their class.
 * Only sends if the class has an active PT (TrainingClass.status === 'active').
 *
 * @param {Object} params
 * @param {'joined'|'left'|'transferred_in'|'transferred_out'|'class_closed'|'membership_ended'} params.action
 * @param {string} params.memberName - display name of the member
 * @param {string} params.className - name of the class
 * @param {string} params.classId - ObjectId of the class
 * @param {string|null} params.ptId - ObjectId of the PT (null = skip)
 */
export async function notifyPtMemberChanged({ action, memberName, className, classId, ptId }) {
  if (!ptId || !classId) return

  // Check class status — chỉ gửi nếu class đang active
  const { default: TrainingClass } = await import('../models/TrainingClass.js')
  const cls = await TrainingClass.findById(classId).select('status').lean()
  if (!cls || cls.status !== 'active') return

  const TITLES = {
    joined: 'Hội viên mới được thêm vào lớp',
    left: 'Hội viên đã rời lớp',
    transferred_in: 'Hội viên được chuyển vào lớp của bạn',
    transferred_out: 'Hội viên được chuyển sang lớp khác',
    class_closed: 'Lớp tập đã kết thúc',
    membership_ended: 'Hội viên không còn thuộc lớp do gói tập đã kết thúc',
  }

  const CONTENTS = {
    joined: `Hội viên ${memberName} đã được thêm vào lớp ${className}.`,
    left: `Hội viên ${memberName} đã rời lớp ${className}.`,
    transferred_in: `Hội viên ${memberName} đã được chuyển vào lớp ${className} của bạn.`,
    transferred_out: `Hội viên ${memberName} đã được chuyển từ lớp ${className} sang lớp khác.`,
    class_closed: `Lớp ${className} đã kết thúc.`,
    membership_ended: `Hội viên ${memberName} không còn thuộc lớp ${className} do gói tập đã kết thúc.`,
  }

  const title = TITLES[action]
  const content = CONTENTS[action]
  if (!title || !content) return

  createNotification({
    receiverId: ptId,
    receiverRole: 'pt',
    notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
    title,
    content,
    relatedId: classId,
    relatedType: 'TrainingClass',
    redirectUrl: '/pt/clients',
    createdBy: 'System',
  }).catch(err => console.error('Notify PT member changed failed:', err.message))
}
