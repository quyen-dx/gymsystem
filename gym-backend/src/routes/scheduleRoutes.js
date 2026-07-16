import express from 'express'
import {
  createSchedule,
  getMySchedules,
  getMemberSchedules,
  updateSessionStatus,
  deleteSchedule,
} from '../controllers/scheduleController.js'
import { authorize, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.get('/my', getMySchedules)
router.get('/member/:memberId', authorize('pt', 'admin', 'super_admin'), getMemberSchedules)
router.post('/', authorize('pt', 'admin', 'super_admin'), createSchedule)
router.put('/:scheduleId/session/:dayOrder', updateSessionStatus)
router.delete('/:id', authorize('pt', 'admin', 'super_admin'), deleteSchedule)

export default router
