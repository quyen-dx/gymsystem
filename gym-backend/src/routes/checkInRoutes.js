import express from 'express'
import {
  generateQRToken,
  getCheckinHeatmap,
  getStaffCheckinHistory,
  getCheckinStats,
  getMemberStreak,
  getTodayCheckins,
  staffVerifyCheckin,
} from '../controllers/checkInController.js'
import { adminOnly, adminOrStaff, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.get('/qr', generateQRToken)
router.post('/verify', adminOrStaff, staffVerifyCheckin)
router.get('/staff/history', adminOrStaff, getStaffCheckinHistory)
router.get('/history', adminOrStaff, getStaffCheckinHistory)

router.get('/streak/:memberId', getMemberStreak)
router.get('/today', adminOrStaff, getTodayCheckins)
router.get('/stats', adminOnly, getCheckinStats)
router.get('/heatmap', adminOnly, getCheckinHeatmap)

export default router
