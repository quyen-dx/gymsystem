import Notification from '../models/Notification.js'
import PushToken from '../models/PushToken.js'
import {
  createNotification,
  markAsRead,
  markAsUnread,
  softDelete,
  getNotificationsForUser,
  countUnread,
  markAllAsRead as markAllRead,
  getPreferences,
  updatePreferences,
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from '../services/notificationService.js'

export const sendNotification = async (req, res) => {
  try {
    const { title, content, userId, receiverId, receiverRole, notificationType, category, relatedId, relatedType, redirectUrl, sendEmail, sendSms, sendPush, priority } = req.body
    const doc = await createNotification({
      receiverId: userId || receiverId,
      receiverRole: receiverRole || req.user?.role || null,
      notificationType: notificationType || 'OTHER',
      title,
      content,
      relatedId,
      relatedType,
      redirectUrl,
      createdBy: 'Admin',
      sendEmail: sendEmail ?? false,
      sendSms: sendSms ?? false,
      sendPush: sendPush ?? false,
      priority: priority || 'medium',
    })
    res.status(201).json({ success: true, data: doc })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user._id
    const role = req.user.role
    const { page, limit, type, category, isRead } = req.query
    const result = await getNotificationsForUser(userId, role, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      type: type || null,
      category: category || null,
      isRead: isRead !== undefined ? isRead === 'true' : null,
    })
    res.status(200).json({
      success: true,
      data: result.notifications,
      pagination: result.pagination,
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const handleMarkAsRead = async (req, res) => {
  try {
    const { id } = req.params
    await markAsRead(id)
    res.status(200).json({ success: true, message: 'Đã đánh dấu đọc' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const handleMarkAsUnread = async (req, res) => {
  try {
    const { id } = req.params
    await markAsUnread(id)
    res.status(200).json({ success: true, message: 'Đã đánh dấu chưa đọc' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const handleDeleteNotification = async (req, res) => {
  try {
    const { id } = req.params
    await softDelete(id)
    res.status(200).json({ success: true, message: 'Đã xóa thông báo' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const handleMarkAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id
    await markAllRead(userId)
    res.status(200).json({ success: true, message: 'Đã đánh dấu tất cả đã đọc' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id
    const role = req.user.role
    const count = await countUnread(userId, role)
    res.status(200).json({ success: true, count })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const getMyPreferences = async (req, res) => {
  try {
    const pref = await getPreferences(req.user._id)
    res.status(200).json({ success: true, data: pref })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const updateMyPreferences = async (req, res) => {
  try {
    const pref = await updatePreferences(req.user._id, req.body)
    res.status(200).json({ success: true, data: pref })
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message })
  }
}

export const handleGetTemplates = async (req, res) => {
  try {
    const { page, limit, isActive } = req.query
    const result = await getTemplates({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      isActive: isActive !== undefined ? isActive === 'true' : null,
    })
    res.status(200).json({ success: true, data: result.data, pagination: result.pagination })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const handleCreateTemplate = async (req, res) => {
  try {
    const doc = await createTemplate(req.body)
    res.status(201).json({ success: true, data: doc })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const handleUpdateTemplate = async (req, res) => {
  try {
    const doc = await updateTemplate(req.params.id, req.body)
    res.status(200).json({ success: true, data: doc })
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message })
  }
}

export const handleDeleteTemplate = async (req, res) => {
  try {
    await deleteTemplate(req.params.id)
    res.status(200).json({ success: true, message: 'Đã xóa mẫu thông báo' })
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message })
  }
}

export const registerPushToken = async (req, res) => {
  try {
    const { token, platform, deviceId } = req.body
    const existing = await PushToken.findOne({ userId: req.user._id, token })
    if (existing) {
      existing.lastUsedAt = new Date()
      existing.isActive = true
      await existing.save()
      return res.status(200).json({ success: true, data: existing })
    }
    const doc = await PushToken.create({
      userId: req.user._id,
      token,
      platform,
      deviceId: deviceId || '',
    })
    res.status(201).json({ success: true, data: doc })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const unregisterPushToken = async (req, res) => {
  try {
    await PushToken.deactivateToken(req.params.token)
    res.status(200).json({ success: true, message: 'Đã hủy đăng ký push token' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}
