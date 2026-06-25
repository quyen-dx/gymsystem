import express from 'express'
import { selfieUpload } from '../config/cloudinary.js'
import {
  confirmCheckin,
  generateQRToken,
  getCheckinHeatmap,
  getStaffCheckinHistory,
  getCheckinStats,
  getMemberStreak,
  getTodayCheckins,
  staffVerifyCheckin,
  uploadSelfie,
  verifyQRToken,
} from '../controllers/checkInController.js'
import { adminOnly, adminOrStaff, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.get('/qr', generateQRToken)
router.post('/verify', (req, res, next) => (
  req.originalUrl.startsWith('/api/staff/checkin')
    ? adminOrStaff(req, res, () => staffVerifyCheckin(req, res, next))
    : verifyQRToken(req, res, next)
))
router.post('/confirm', adminOrStaff, confirmCheckin)
router.post('/staff/verify', adminOrStaff, staffVerifyCheckin)
router.get('/staff/history', adminOrStaff, getStaffCheckinHistory)
router.get('/history', adminOrStaff, getStaffCheckinHistory)
router.post('/selfie', adminOrStaff, selfieUpload.fields([{ name: 'selfie', maxCount: 1 }]), uploadSelfie)

router.get('/streak/:memberId', getMemberStreak)
router.get('/today', adminOrStaff, getTodayCheckins)
router.get('/stats', adminOnly, getCheckinStats)
router.get('/heatmap', adminOnly, getCheckinHeatmap)

export default router
