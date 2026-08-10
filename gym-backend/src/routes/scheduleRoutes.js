import express from 'express'
import {
  createSchedule,
  bulkCreateSchedules,
  addScheduleSession,
  getMySchedules,
  getMemberSchedules,
  getMyTeachingSchedules,
  getScheduleById,
  getClassSchedules,
  groupAssignWorkout,
  updateSessionStatus,
  updateSessionPlan,
  rescheduleSession,
  cancelSession,
  deleteSchedule,
} from '../controllers/scheduleController.js'
import { authorize, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.get('/my', getMySchedules)
router.get('/pt/my', authorize('pt', 'admin', 'super_admin'), getMyTeachingSchedules)
router.post('/group-assign', authorize('pt', 'admin', 'super_admin'), groupAssignWorkout)
router.post('/bulk-create', authorize('pt', 'admin', 'super_admin'), bulkCreateSchedules)
router.post('/:scheduleId/sessions', authorize('pt', 'admin', 'super_admin'), addScheduleSession)
router.get('/class/:classId', authorize('pt', 'admin', 'super_admin'), getClassSchedules)
router.get('/member/:memberId', authorize('pt', 'admin', 'super_admin'), getMemberSchedules)
router.get('/:scheduleId', getScheduleById)
router.post('/', authorize('pt', 'admin', 'super_admin'), createSchedule)
router.put('/:scheduleId/session/:dayOrder', authorize('pt', 'admin', 'super_admin'), updateSessionStatus)
router.put('/:scheduleId/session/:dayOrder/plan', authorize('pt', 'admin', 'super_admin'), updateSessionPlan)
router.patch('/:scheduleId/session/:dayOrder/reschedule', authorize('member'), rescheduleSession)
router.patch('/:scheduleId/session/:dayOrder/cancel', authorize('member'), cancelSession)
router.delete('/:id', authorize('pt', 'admin', 'super_admin'), deleteSchedule)

export default router
