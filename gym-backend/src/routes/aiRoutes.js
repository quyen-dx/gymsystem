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
import { aiController as aiGymActionController } from '../ai/aiController.js'
import { requireFeature } from '../middlewares/systemSettingsMiddleware.js'

const router = express.Router()

router.get('/history', protect, requireFeature('ai.floatingChatbotEnabled'), getAiChatHistory)
router.put('/history', protect, requireFeature('ai.floatingChatbotEnabled'), saveAiChatHistory)
router.patch('/session/:sessionId', protect, requireFeature('ai.floatingChatbotEnabled'), renameAiChatSession)
router.delete('/session/:sessionId', protect, requireFeature('ai.floatingChatbotEnabled'), deleteAiChatSession)
router.post('/actions', protect, requireFeature('ai.floatingChatbotEnabled'), aiGymActionController)
router.post('/web-search', protect, requireFeature('ai.floatingChatbotEnabled'), aiWebSearch)
router.post('/stream', protect, requireFeature('ai.floatingChatbotEnabled'), aiAssistantStream)
router.post('/', protect, requireFeature('ai.floatingChatbotEnabled'), aiAssistant)

export default router
