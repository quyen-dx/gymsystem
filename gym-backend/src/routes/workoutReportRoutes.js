import express from 'express'
import {
  reportWorkout,
  getReports,
  getReportSummary,
  resolveReport,
  rejectReport,
} from '../controllers/workoutReportController.js'
import { authorize, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.post('/', authorize('pt', 'admin', 'super_admin'), reportWorkout)
router.get('/', authorize('admin', 'super_admin'), getReports)
router.get('/summary', authorize('admin', 'super_admin'), getReportSummary)
router.put('/:id/resolve', authorize('admin', 'super_admin'), resolveReport)
router.put('/:id/reject', authorize('admin', 'super_admin'), rejectReport)

export default router
