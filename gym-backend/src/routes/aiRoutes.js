import express from 'express'
import { postChat } from '../controllers/aiController.js'
import { postChatStream } from '../controllers/aiStreamController.js'
import { protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.post('/chat', protect, postChat)
router.post('/chat/stream', protect, postChatStream)

export default router
