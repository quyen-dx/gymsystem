import express from 'express'
import { adminAiChat } from '../controllers/adminAiController.js'
import { protect, adminOnly } from '../middlewares/authMiddleware.js'
import { requireFeature } from '../middlewares/systemSettingsMiddleware.js'

const router = express.Router()

router.post('/chat', protect, adminOnly, requireFeature('ai.systemAiEnabled'), requireFeature('ai.adminAiEnabled', 'Admin AI Assistant is currently disabled.'), adminAiChat)

export default router
