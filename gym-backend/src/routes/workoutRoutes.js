import express from 'express'
import {
  completeExercise,
  createWorkout,
  deleteWorkout,
  getAllWorkouts,
  getPTProgress,
  getWorkoutById,
  getWorkoutProgressById,
  saveSessionFeedback,
  startWorkoutSession,
  updateWorkout,
} from '../controllers/workoutController.js'
import { authorize, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.post('/session/start', startWorkoutSession)
router.post('/exercise/complete', completeExercise)
router.post('/session/feedback', authorize('pt', 'admin', 'super_admin'), saveSessionFeedback)

router.get('/pt/progress', authorize('pt', 'admin', 'super_admin'), getPTProgress)
router.get('/:id/progress', getWorkoutProgressById)

router.get('/', getAllWorkouts)
router.get('/:id', getWorkoutById)
router.post('/', authorize('pt', 'admin', 'super_admin'), createWorkout)
router.put('/:id', authorize('pt', 'admin', 'super_admin'), updateWorkout)
router.delete('/:id', authorize('pt', 'admin', 'super_admin'), deleteWorkout)

export default router
