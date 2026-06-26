import express from 'express'
import { upload } from '../config/cloudinary.js'
import {
  batchRenewMembers,
  confirmOfflinePlanPayment,
  createMember,
  createMemberAndRegister,
  createOfflinePlanPayment,
  getExpiringMembers,
  getOfflinePlanPayment,
  getMemberById,
  getMemberHealthScore,
  getMemberStats,
  getMemberTimeline,
  getMembers,
  offlineRegisterMembership,
  registerPlanForMember,
  renewPlanForMember,
  searchMembers,
  toggleMemberStatus,
  updateMember,
} from '../controllers/memberController.js'
import { adminOrStaff, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.get('/plan-payments/:paymentId', getOfflinePlanPayment)
router.post('/plan-payments/:paymentId/confirm', confirmOfflinePlanPayment)

router.use(protect)

router.get('/', adminOrStaff, getMembers)
router.get('/search', adminOrStaff, searchMembers)
router.get('/stats', adminOrStaff, getMemberStats)
router.get('/expiring', adminOrStaff, getExpiringMembers)

router.get('/:id', adminOrStaff, getMemberById)
router.get('/:id/timeline', adminOrStaff, getMemberTimeline)
router.get('/:id/health-score', adminOrStaff, getMemberHealthScore)

router.post('/', adminOrStaff, createMember)
router.patch('/:id', adminOrStaff, upload.fields([{ name: 'avatar', maxCount: 1 }]), updateMember)
router.patch('/:id/toggle-status', adminOrStaff, toggleMemberStatus)

router.post('/:id/offline-plan-payment', adminOrStaff, createOfflinePlanPayment)
router.post('/:id/register-plan', adminOrStaff, registerPlanForMember)
router.post('/:id/renew-plan', adminOrStaff, renewPlanForMember)
router.post('/batch-renew', adminOrStaff, batchRenewMembers)
router.post('/create-and-register', adminOrStaff, createMemberAndRegister)
router.post('/offline-register', adminOrStaff, offlineRegisterMembership)

export default router
