import express from 'express'
import { acceptConsent, acceptMultipleConsent, getConsentStatus } from '../controllers/policyConsentController.js'
import { protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.get('/status', protect, getConsentStatus)
router.post('/accept', protect, acceptConsent)
router.post('/accept-multiple', protect, acceptMultipleConsent)

export default router
