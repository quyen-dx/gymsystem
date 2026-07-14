import express from 'express'
import {
  completeExercise,
  createSessionFeedback,
  createWorkout,
  deleteSessionFeedback,
  deleteWorkout,
  getAllWorkouts,
  getPTProgress,
  getSessionFeedbacks,
  getWorkoutById,
  getWorkoutProgressById,
  saveSessionFeedback,
  startWorkoutSession,
  updateSessionFeedback,
  updateWorkout,
} from '../controllers/workoutController.js'
import { authorize, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.post('/session/start', startWorkoutSession)
router.post('/exercise/complete', completeExercise)
router.post('/session/feedback', authorize('pt', 'admin', 'super_admin'), saveSessionFeedback)

router.get('/pt/progress', authorize('pt', 'admin', 'super_admin'), getPTProgress)

router.get('/feedback/all', getSessionFeedbacks)
router.post('/feedback', authorize('pt', 'admin', 'super_admin'), createSessionFeedback)
router.put('/feedback/:id', authorize('pt', 'admin', 'super_admin'), updateSessionFeedback)
router.delete('/feedback/:id', authorize('pt', 'admin', 'super_admin'), deleteSessionFeedback)

router.get('/', getAllWorkouts)
router.get('/:id', getWorkoutById)
router.get('/:id/progress', getWorkoutProgressById)
router.post('/', authorize('pt', 'admin', 'super_admin'), createWorkout)
router.put('/:id', authorize('pt', 'admin', 'super_admin'), updateWorkout)
router.delete('/:id', authorize('pt', 'admin', 'super_admin'), deleteWorkout)

export default router
