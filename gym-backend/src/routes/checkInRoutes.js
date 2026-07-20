import express from 'express'
import {
  generateQRToken,
  getCheckinHeatmap,
  getMyCheckinHistory,
  getStaffCheckinHistory,
  getCheckinStats,
  getMemberStreak,
  getTodayCheckins,
  searchMemberForCheckin,
  staffVerifyCheckin,
} from '../controllers/checkInController.js'
import {
  generateDailyQR,
  getActiveDailyQR,
  verifyDailyQRAndGetSessions,
  submitDailyQRCheckin,
} from '../controllers/dailyQRCodeController.js'
import { adminOnly, adminOrStaff, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.get('/qr', generateQRToken)

// Daily QR (new check-in flow)
router.post('/daily-qr/generate', adminOrStaff, generateDailyQR)
router.get('/daily-qr/active', adminOrStaff, getActiveDailyQR)
router.post('/daily-qr/verify', verifyDailyQRAndGetSessions)
router.post('/daily-qr/checkin', submitDailyQRCheckin)

// Member's own check-in history
router.get('/my-history', getMyCheckinHistory)

router.get('/staff/search-member', adminOrStaff, searchMemberForCheckin)
router.post('/verify', adminOrStaff, staffVerifyCheckin)
router.get('/staff/history', adminOrStaff, getStaffCheckinHistory)
router.get('/history', adminOrStaff, getStaffCheckinHistory)

router.get('/streak/:memberId', getMemberStreak)
router.get('/today', adminOrStaff, getTodayCheckins)
router.get('/stats', adminOnly, getCheckinStats)
router.get('/heatmap', adminOnly, getCheckinHeatmap)

export default router
