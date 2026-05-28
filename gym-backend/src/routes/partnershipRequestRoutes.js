import express from 'express'
import {
  approvePartnershipRequest,
  createPartnershipRequest,
  getAdminPartnershipRequests,
  getPendingPartnershipRequestCount,
  rejectPartnershipRequest,
} from '../controllers/partnershipRequestController.js'
import { adminOnly, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.post('/', createPartnershipRequest)
router.get('/admin', protect, adminOnly, getAdminPartnershipRequests)
router.get('/admin/pending-count', protect, adminOnly, getPendingPartnershipRequestCount)
router.patch('/:id/approve', protect, adminOnly, approvePartnershipRequest)
router.patch('/:id/reject', protect, adminOnly, rejectPartnershipRequest)

export default router
