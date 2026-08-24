import express from 'express'
import { adminOrStaff, protect } from '../middlewares/authMiddleware.js'
import {
  approveTransferRequest,
  cancelTransferRequest,
  createTransferRequest,
  getMyTransferRequests,
  listTransferRequestsForStaff,
  rejectTransferRequest,
  respondToTransferRequest,
  searchTransferRecipients,
} from '../controllers/membershipTransferController.js'

const router = express.Router()
router.use(protect)
router.get('/my', getMyTransferRequests)
router.get('/recipients', searchTransferRecipients)
router.post('/', createTransferRequest)
router.post('/:id/respond', respondToTransferRequest)
router.post('/:id/cancel', cancelTransferRequest)
router.get('/staff', adminOrStaff, listTransferRequestsForStaff)
router.post('/staff/:id/approve', adminOrStaff, approveTransferRequest)
router.post('/staff/:id/reject', adminOrStaff, rejectTransferRequest)

export default router
