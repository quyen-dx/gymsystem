import express from 'express'
import {
  approvePartnershipRequest,
  createDiscountCode,
  createPartnershipRequest,
  getAdminPartnershipRequests,
  getDiscountCodes,
  getPendingPartnershipRequestCount,
  rejectPartnershipRequest,
  toggleDiscountCode,
} from '../controllers/partnershipRequestController.js'
import { adminOnly, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.post('/', createPartnershipRequest)
router.get('/admin', protect, adminOnly, getAdminPartnershipRequests)
router.get('/admin/pending-count', protect, adminOnly, getPendingPartnershipRequestCount)
router.get('/admin/discount-codes', protect, adminOnly, getDiscountCodes)
router.post('/admin/discount-codes', protect, adminOnly, createDiscountCode)
router.patch('/admin/discount-codes/:id/toggle', protect, adminOnly, toggleDiscountCode)
router.patch('/:id/approve', protect, adminOnly, approvePartnershipRequest)
router.patch('/:id/reject', protect, adminOnly, rejectPartnershipRequest)

export default router
