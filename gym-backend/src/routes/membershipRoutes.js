import express from 'express'
import {
  cancelMembershipRegistration,
  confirmMembershipRegistration,
  createMembership,
  getMembershipPayments,
  getMembershipRegistrations,
  getMyMembership,
  renewMembershipByWallet,
  renewMembershipByWalletWithDuration,
  renewMyMembership,
  subscribeMembership,
  toggleAutoRenew,
} from '../controllers/membershipController.js'
import {
  approveCancellationRequest,
  createCancellationRequest,
  getMyCancellationRequest,
  listCancellationRequests,
  rejectCancellationRequest,
} from '../controllers/cancellationController.js'
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
router.post('/my/auto-renew', toggleAutoRenew)

router.get('/registrations', adminOrStaff, getMembershipRegistrations)
router.patch('/registrations/:id/confirm', adminOrStaff, confirmMembershipRegistration)
router.patch('/registrations/:id/cancel', adminOrStaff, cancelMembershipRegistration)
router.get('/payments', adminOrStaff, getMembershipPayments)

router.post('/cancel-request', createCancellationRequest)
router.get('/my-cancel-request', getMyCancellationRequest)

router.get('/staff/cancellations', adminOrStaff, listCancellationRequests)
router.post('/staff/cancellations/:id/approve', adminOrStaff, approveCancellationRequest)
router.post('/staff/cancellations/:id/reject', adminOrStaff, rejectCancellationRequest)

export default router
