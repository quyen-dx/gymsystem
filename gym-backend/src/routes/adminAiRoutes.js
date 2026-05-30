import express from 'express'
import { adminAiChat } from '../controllers/adminAiController.js'
import { protect, adminOnly } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.post('/chat', protect, adminOnly, adminAiChat)

export default router
