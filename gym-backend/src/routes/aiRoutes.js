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

const memberAiDisabledMessage = 'AI Assistant for members is currently disabled.'

router.get('/history', protect, requireFeature('ai.systemAiEnabled'), requireFeature('ai.memberAiEnabled', memberAiDisabledMessage), getAiChatHistory)
router.put('/history', protect, requireFeature('ai.systemAiEnabled'), requireFeature('ai.memberAiEnabled', memberAiDisabledMessage), saveAiChatHistory)
router.patch('/session/:sessionId', protect, requireFeature('ai.systemAiEnabled'), requireFeature('ai.memberAiEnabled', memberAiDisabledMessage), renameAiChatSession)
router.delete('/session/:sessionId', protect, requireFeature('ai.systemAiEnabled'), requireFeature('ai.memberAiEnabled', memberAiDisabledMessage), deleteAiChatSession)
router.post('/upload-image', protect, requireFeature('ai.systemAiEnabled'), requireFeature('ai.memberAiEnabled', memberAiDisabledMessage), aiChatImageUpload.single('image'), uploadAiChatImage)
router.post('/actions', protect, requireFeature('ai.systemAiEnabled'), requireFeature('ai.memberAiEnabled', memberAiDisabledMessage), aiGymActionController)
router.post('/analyze-body', protect, requireFeature('ai.systemAiEnabled'), requireFeature('ai.memberAiEnabled', memberAiDisabledMessage), analyzeBody)
router.post('/analyze-inbody', protect, requireFeature('ai.systemAiEnabled'), requireFeature('ai.memberAiEnabled', memberAiDisabledMessage), analyzeInBody)
router.post('/web-search', protect, requireFeature('ai.systemAiEnabled'), requireFeature('ai.memberAiEnabled', memberAiDisabledMessage), aiWebSearch)
router.post('/stream', protect, requireFeature('ai.systemAiEnabled'), requireFeature('ai.memberAiEnabled', memberAiDisabledMessage), aiAssistantStream)
router.post('/', protect, requireFeature('ai.systemAiEnabled'), requireFeature('ai.memberAiEnabled', memberAiDisabledMessage), aiAssistant)

export default router
