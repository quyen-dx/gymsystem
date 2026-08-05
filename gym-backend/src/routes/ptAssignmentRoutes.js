import express from 'express'
import {
  assignWorkout,
  checkTimeConflict,
  createScheduleAndAssignWorkout,
  endWorkout,
  getMatchedClasses,
  getMemberTrainingPreferences,
  getMyAssignment,
  getMyActiveClients,
  getMyHistory,
  getPendingApprovals,
  getSuggestedSlots,
  getWorkoutProgress,
  getMemberEnrollmentPreview,
  transferMemberClass,
  leaveMemberClass,
  leaveCurrentTraining,
  requestClassAssignment,
  acceptClassAssignment,
  declineClassAssignment,
  bulkReleasePt,
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
router.get('/pt/pending-approvals', authorize('pt', 'admin', 'super_admin'), getPendingApprovals)
router.get('/pt/history', authorize('pt', 'admin', 'super_admin'), getMyHistory)
router.get('/:id/progress', authorize('pt', 'admin', 'super_admin'), getWorkoutProgress)
router.post('/:id/end-workout', authorize('pt', 'admin', 'super_admin'), endWorkout)
router.put('/:id/assign-workout', authorize('pt', 'admin', 'super_admin'), assignWorkout)
router.post('/:assignmentId/create-schedule-and-assign', authorize('pt', 'admin', 'super_admin'), createScheduleAndAssignWorkout)

// PT class request / accept / decline / release
router.post('/request-class', authorize('admin', 'super_admin'), requestClassAssignment)
router.post('/accept-class', authorize('pt'), acceptClassAssignment)
router.post('/decline-class', authorize('pt'), declineClassAssignment)
router.post('/bulk-release', authorize('admin', 'super_admin'), bulkReleasePt)

// Class enrollment: transfer / leave class (tường minh)
router.get('/enrollment/preview', authorize('pt', 'admin', 'super_admin', 'member'), getMemberEnrollmentPreview)
router.post('/enrollment/transfer', authorize('pt', 'admin', 'super_admin'), transferMemberClass)
router.post('/enrollment/leave', authorize('pt', 'admin', 'super_admin', 'member'), leaveMemberClass)
router.post('/enrollment/leave-current-training', authorize('member'), leaveCurrentTraining)

export default router
