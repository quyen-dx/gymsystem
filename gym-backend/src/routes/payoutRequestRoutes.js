import express from 'express'
import { protect, adminOnly, authorize } from '../middlewares/authMiddleware.js'
import { payoutProofUpload } from '../config/cloudinary.js'
import {
  approvePayoutRequestController, cancelMyPayoutRequest, confirmMyPayoutReceived, createMyPayoutRequest, disputeMyPayoutRequest,
  getAdminPayoutRequestController, getMyPayoutRequest, getMyPayoutSummary, listAdminPayoutRequestsController, listMyPayoutRequests,
  markPayoutTransferredController, rejectPayoutRequestController, resolvePayoutDisputeController,
} from '../controllers/payoutRequestController.js'

const memberRouter = express.Router()
memberRouter.use(protect, authorize('member'))
memberRouter.get('/summary', getMyPayoutSummary)
memberRouter.post('/payout-requests', createMyPayoutRequest)
memberRouter.get('/payout-requests/me', listMyPayoutRequests)
memberRouter.get('/payout-requests/:id', getMyPayoutRequest)
memberRouter.post('/payout-requests/:id/cancel', cancelMyPayoutRequest)
memberRouter.post('/payout-requests/:id/confirm-received', confirmMyPayoutReceived)
memberRouter.post('/payout-requests/:id/dispute', disputeMyPayoutRequest)

const adminRouter = express.Router()
adminRouter.use(protect, adminOnly)
adminRouter.get('/payout-requests', listAdminPayoutRequestsController)
adminRouter.get('/payout-requests/:id', getAdminPayoutRequestController)
adminRouter.post('/payout-requests/:id/approve', approvePayoutRequestController)
adminRouter.post('/payout-requests/:id/reject', rejectPayoutRequestController)
adminRouter.post('/payout-requests/:id/mark-transferred', payoutProofUpload.single('transferProof'), markPayoutTransferredController)
adminRouter.post('/payout-requests/:id/resolve', payoutProofUpload.single('transferProof'), resolvePayoutDisputeController)

export { memberRouter, adminRouter }
