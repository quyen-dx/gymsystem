import Notification from '../models/Notification.js'
import {
  createNotification,
  markAsRead,
  markAsUnread,
  softDelete,
  getNotificationsForUser,
  countUnread,
  markAllAsRead as markAllRead,
} from '../services/notificationService.js'

export const sendNotification = async (req, res) => {
  try {
    const { title, content, userId, receiverId, receiverRole, notificationType, category, relatedId, relatedType, redirectUrl, requiresAction, actions } = req.body
    const doc = await createNotification({
      receiverId: userId || receiverId,
      receiverRole: receiverRole || req.user?.role || null,
      notificationType: notificationType || 'OTHER',
      title,
      content,
      relatedId,
      relatedType,
      redirectUrl,
      requiresAction,
      actions,
      createdBy: 'Admin',
      sendEmail: false,
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
    const notifications = await getNotificationsForUser(userId, role)
    res.status(200).json({ success: true, data: notifications })
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
