import express from 'express'
import {
  sendNotification,
  getMyNotifications,
  handleMarkAsRead,
  handleMarkAsUnread,
  handleMarkAllAsRead,
  handleDeleteNotification,
  getUnreadCount,
  getMyPreferences,
  updateMyPreferences,
  handleGetTemplates,
  handleCreateTemplate,
  handleUpdateTemplate,
  handleDeleteTemplate,
  registerPushToken,
  unregisterPushToken,
} from '../controllers/notificationController.js'
import { protect } from '../middlewares/authMiddleware.js'
import { adminOrStaff } from '../middlewares/authMiddleware.js'
import { validateBody } from '../middlewares/validation.js'
import {
  sendNotificationSchema,
  updatePreferenceSchema,
  createTemplateSchema,
  updateTemplateSchema,
  registerPushTokenSchema,
} from '../validators/notificationValidator.js'

const router = express.Router()

router.post('/send', protect, validateBody(sendNotificationSchema), sendNotification)
router.get('/my', protect, getMyNotifications)
router.get('/unread-count', protect, getUnreadCount)
router.put('/read-all', protect, handleMarkAllAsRead)

router.get('/preferences', protect, getMyPreferences)
router.put('/preferences', protect, validateBody(updatePreferenceSchema), updateMyPreferences)

router.get('/templates', protect, adminOrStaff, handleGetTemplates)
router.post('/templates', protect, adminOrStaff, validateBody(createTemplateSchema), handleCreateTemplate)
router.put('/templates/:id', protect, adminOrStaff, validateBody(updateTemplateSchema), handleUpdateTemplate)
router.delete('/templates/:id', protect, adminOrStaff, handleDeleteTemplate)

router.post('/push-tokens', protect, validateBody(registerPushTokenSchema), registerPushToken)
router.delete('/push-tokens/:token', protect, unregisterPushToken)

router.put('/:id/read', protect, handleMarkAsRead)
router.put('/:id/unread', protect, handleMarkAsUnread)
router.delete('/:id', protect, handleDeleteNotification)

export default router
