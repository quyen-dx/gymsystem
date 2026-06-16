import express from 'express'
import { selfieUpload } from '../config/cloudinary.js'
import {
  confirmCheckin,
  generateQRToken,
  getCheckinHeatmap,
  getCheckinStats,
  getMemberStreak,
  getTodayCheckins,
  uploadSelfie,
  verifyQRToken,
} from '../controllers/checkInController.js'
import { adminOnly, adminOrStaff, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.get('/qr', generateQRToken)
router.post('/verify', verifyQRToken)
router.post('/confirm', adminOrStaff, confirmCheckin)
router.post('/selfie', adminOrStaff, selfieUpload.fields([{ name: 'selfie', maxCount: 1 }]), uploadSelfie)

router.get('/streak/:memberId', getMemberStreak)
router.get('/today', adminOrStaff, getTodayCheckins)
router.get('/stats', adminOnly, getCheckinStats)
router.get('/heatmap', adminOnly, getCheckinHeatmap)

export default router
