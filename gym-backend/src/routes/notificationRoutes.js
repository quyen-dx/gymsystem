import express from 'express'
import {
  sendNotification,
  getMyNotifications,
  markAsRead
} from '../controllers/notificationController.js'
import { protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.post('/send', protect, sendNotification)
router.get('/my', protect, getMyNotifications)
router.put('/:id/read', protect, markAsRead)

export default router