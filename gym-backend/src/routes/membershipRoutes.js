import express from 'express'
import {
  cancelMembershipRegistration,
  cancelMyPeriod,
  cancelMyRenewal,
  confirmMembershipRegistration,
  createMembership,
  getCancelInfoHandler,
  getMembershipDetailHandler,
  getMembershipHistory,
  getMembershipPayments,
  getMembershipPeriodsHandler,
  getMembershipRegistrations,
  getMyMembership,
  getMyPeriodsHandler,
  getMyRenewalsHandler,
  renewMembershipByWallet,
  renewMembershipByWalletWithDuration,
  renewMyMembership,
  subscribeMembership,
} from '../controllers/membershipController.js'
import {
  approveCancellationRequest,
  createCancellationRequest,
  getMyCancellationRequest,
  listCancellationRequests,
  rejectCancellationRequest,
} from '../controllers/cancellationController.js'
import {
  approveRefundRequestHandler,
  countPendingRefundRequestsHandler,
  createRefundRequestHandler,
  listRefundRequestsHandler,
  rejectRefundRequestHandler,
} from '../controllers/refundRequestController.js'
import { adminOrStaff, protect } from '../middlewares/authMiddleware.js'
import { requireFeature } from '../middlewares/systemSettingsMiddleware.js'

const router = express.Router()

router.use(protect)
router.get('/my', getMyMembership)
router.post('/subscribe', requireFeature('billing.allowPlanPurchase'), subscribeMembership)
router.post('/', requireFeature('billing.allowPlanPurchase'), createMembership)
router.post('/my/renew', requireFeature('billing.allowPlanRenewal'), renewMyMembership)
router.post('/my/renew-wallet', requireFeature('billing.allowPlanRenewal'), renewMembershipByWallet)
router.post('/my/renew-plan', requireFeature('billing.allowPlanRenewal'), renewMembershipByWalletWithDuration)
router.get('/my/periods', getMyPeriodsHandler)
router.get('/my/cancel-info', getCancelInfoHandler)
router.get('/my/renewals', getMyRenewalsHandler)
router.post('/my/cancel-renewal/:renewalId', cancelMyRenewal)
router.post('/my/periods/:periodId/cancel', cancelMyPeriod)

router.get('/history', getMembershipHistory)

router.post('/my/refund-request', createRefundRequestHandler)

router.get('/registrations', adminOrStaff, getMembershipRegistrations)
router.patch('/registrations/:id/confirm', adminOrStaff, confirmMembershipRegistration)
router.patch('/registrations/:id/cancel', adminOrStaff, cancelMembershipRegistration)
router.get('/payments', adminOrStaff, getMembershipPayments)

router.post('/cancel-request', createCancellationRequest)
router.get('/my-cancel-request', getMyCancellationRequest)

router.get('/staff/cancellations', adminOrStaff, listCancellationRequests)
router.post('/staff/cancellations/:id/approve', adminOrStaff, approveCancellationRequest)
router.post('/staff/cancellations/:id/reject', adminOrStaff, rejectCancellationRequest)

router.get('/staff/refund-requests/count', adminOrStaff, countPendingRefundRequestsHandler)
router.get('/staff/refund-requests', adminOrStaff, listRefundRequestsHandler)
router.post('/staff/refund-requests/:id/approve', adminOrStaff, approveRefundRequestHandler)
router.post('/staff/refund-requests/:id/reject', adminOrStaff, rejectRefundRequestHandler)

// Routes có tham số động — đặt cuối cùng để tránh nuốt route tĩnh
router.get('/:membershipId', getMembershipDetailHandler)
router.get('/:membershipId/periods', getMembershipPeriodsHandler)

export default router
