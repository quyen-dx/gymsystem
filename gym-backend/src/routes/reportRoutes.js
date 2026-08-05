import express from 'express'
import {
  getOverviewStats,
  getChartsData,
  getTransactionsHandler,
  getMemberActivityHandler,
  getBookingsHandler,
  getOrdersHandler,
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
router.get('/orders', getOrdersHandler)
router.get('/users', getSystemUsersHandler)
router.get('/export', exportReport)
router.get('/revenue', getRevenueReport)

export default router
