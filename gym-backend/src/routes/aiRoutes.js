import express from 'express'
import {
    aiAssistant,
    aiAssistantStream,
    aiWebSearch,
    deleteAiChatSession,
    getAiChatHistory,
    renameAiChatSession,
    saveAiChatHistory,
} from '../controllers/aiAssistantController.js'
import { protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.get('/history', protect, getAiChatHistory)
router.put('/history', protect, saveAiChatHistory)
router.patch('/session/:sessionId', protect, renameAiChatSession)
router.delete('/session/:sessionId', protect, deleteAiChatSession)
router.post('/web-search', protect, aiWebSearch)
router.post('/stream', protect, aiAssistantStream)
router.post('/', protect, aiAssistant)

export default router
