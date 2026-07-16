import Notification from '../models/Notification.js'

export const sendNotification = async (req, res) => {
  try {
    const { title, content, userId } = req.body
    const notification = new Notification({ title, content, userId })
    await notification.save()
    res.status(201).json({ success: true, data: notification })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user._id
    const notifications = await Notification.find({
      $or: [{ userId: userId }, { userId: null }],
    }).sort({ createdAt: -1 })

    res.status(200).json({ success: true, data: notifications })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params
    await Notification.findByIdAndUpdate(id, { isRead: true })
    res.status(200).json({ success: true, message: 'Đã đánh dấu đọc' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id
    await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true }
    )
    res.status(200).json({ success: true, message: 'Đã đánh dấu tất cả đã đọc' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}