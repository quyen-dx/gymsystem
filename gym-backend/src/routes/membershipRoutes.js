import express from 'express'
import { createMembership } from '../controllers/membershipController.js'
import { protect } from '../middlewares/authMiddleware.js'
import { requireFeature } from '../middlewares/systemSettingsMiddleware.js'

const router = express.Router()

router.use(protect)
router.post('/', requireFeature('billing.allowPlanPurchase'), createMembership)

export default router
