import express from 'express'
import {
  getOverviewStats,
  getChartsData,
  getTransactionsHandler,
  getMemberActivityHandler,
  getBookingsHandler,
  getCheckinsHandler,
  getSystemUsersHandler,
  exportReport,
  getRevenueReport,
} from '../controllers/reportController.js'
import { protect, adminOnly } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect, adminOnly)

router.get('/summary', getOverviewStats)
router.get('/charts', getChartsData)
router.get('/transactions', getTransactionsHandler)
router.get('/member-activity', getMemberActivityHandler)
router.get('/bookings', getBookingsHandler)
router.get('/checkins', getCheckinsHandler)
router.get('/users', getSystemUsersHandler)
router.get('/export', exportReport)
router.get('/revenue', getRevenueReport)

export default router
