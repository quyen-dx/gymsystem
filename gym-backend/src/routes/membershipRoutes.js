import express from 'express'
import { createMembership } from '../controllers/membershipController.js'
import { protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)
router.post('/', createMembership)

export default router
