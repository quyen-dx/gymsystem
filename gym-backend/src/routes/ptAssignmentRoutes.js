import express from 'express'
import {
  assignWorkout,
  checkTimeConflict,
  createScheduleAndAssignWorkout,
  getMatchedClasses,
  getMemberTrainingPreferences,
  getMyAssignment,
  getMyActiveClients,
  getMyHistory,
  getSuggestedSlots,
} from '../controllers/ptAssignmentController.js'
import { authorize, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.get('/my', getMyAssignment)
router.get('/suggest-slots', getSuggestedSlots)
router.get('/member-preferences/:memberId', authorize('pt', 'admin', 'super_admin'), getMemberTrainingPreferences)
router.get('/matched-classes/:memberId', authorize('pt', 'admin', 'super_admin'), getMatchedClasses)
router.get('/check-time-conflict', checkTimeConflict)
router.get('/pt/clients', authorize('pt', 'admin', 'super_admin'), getMyActiveClients)
router.get('/pt/history', authorize('pt', 'admin', 'super_admin'), getMyHistory)
router.put('/:id/assign-workout', authorize('pt', 'admin', 'super_admin'), assignWorkout)
router.post('/:assignmentId/create-schedule-and-assign', authorize('pt', 'admin', 'super_admin'), createScheduleAndAssignWorkout)

export default router
