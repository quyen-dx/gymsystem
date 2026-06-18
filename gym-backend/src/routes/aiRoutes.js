import express from 'express'
import {
    aiAssistant,
    aiAssistantStream,
    aiWebSearch,
    analyzeBody,
    analyzeInBody,
    deleteAiChatSession,
    getAiChatHistory,
    renameAiChatSession,
    saveAiChatHistory,
    uploadAiChatImage,
} from '../controllers/aiAssistantController.js'
import { protect } from '../middlewares/authMiddleware.js'
import { aiController as aiGymActionController } from '../ai/aiController.js'
import { requireFeature } from '../middlewares/systemSettingsMiddleware.js'
import { aiChatImageUpload } from '../config/cloudinary.js'

const router = express.Router()

router.get('/history', protect, requireFeature('ai.floatingChatbotEnabled'), getAiChatHistory)
router.put('/history', protect, requireFeature('ai.floatingChatbotEnabled'), saveAiChatHistory)
router.patch('/session/:sessionId', protect, requireFeature('ai.floatingChatbotEnabled'), renameAiChatSession)
router.delete('/session/:sessionId', protect, requireFeature('ai.floatingChatbotEnabled'), deleteAiChatSession)
router.post('/upload-image', protect, requireFeature('ai.floatingChatbotEnabled'), aiChatImageUpload.single('image'), uploadAiChatImage)
router.post('/actions', protect, requireFeature('ai.floatingChatbotEnabled'), aiGymActionController)
router.post('/analyze-body', protect, requireFeature('ai.floatingChatbotEnabled'), analyzeBody)
router.post('/analyze-inbody', protect, requireFeature('ai.floatingChatbotEnabled'), analyzeInBody)
router.post('/web-search', protect, requireFeature('ai.floatingChatbotEnabled'), aiWebSearch)
router.post('/stream', protect, requireFeature('ai.floatingChatbotEnabled'), aiAssistantStream)
router.post('/', protect, requireFeature('ai.floatingChatbotEnabled'), aiAssistant)

export default router
