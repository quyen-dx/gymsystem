import express from 'express'
import {
  sendNotification,
  getMyNotifications,
  handleMarkAsRead,
  handleMarkAsUnread,
  handleMarkAllAsRead,
  handleDeleteNotification,
  getUnreadCount,
} from '../controllers/notificationController.js'
import { protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.post('/send', protect, sendNotification)
router.get('/my', protect, getMyNotifications)
router.get('/unread-count', protect, getUnreadCount)
router.put('/read-all', protect, handleMarkAllAsRead)
router.put('/:id/read', protect, handleMarkAsRead)
router.put('/:id/unread', protect, handleMarkAsUnread)
router.delete('/:id', protect, handleDeleteNotification)

export default router
