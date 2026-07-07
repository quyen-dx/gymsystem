import express from 'express'
import {
  getOverviewStats,
  getChartsData,
  getHeatmap,
  getForecast,
  getChurnRisk,
  exportMonthlyReport
} from '../controllers/reportController.js'
import { protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.get('/overview', protect, getOverviewStats)
router.get('/charts', protect, getChartsData)
router.get('/heatmap', protect, getHeatmap)
router.get('/forecast', protect, getForecast)
router.get('/churn-risk', protect, getChurnRisk)
router.get('/export', protect, exportMonthlyReport)

export default router