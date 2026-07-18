import express from 'express'
import {
  getSharedTemplates,
  getDistinctSpecializations,
  getDistinctGoals,
  getDistinctGoalsBySpecialization,
  getDistinctTrainersWithWorkouts,
  assignWorkoutToMember,
  getWorkoutAssignments,
  hideWorkout,
  restoreWorkout,
} from '../controllers/workoutController.js'
import { authorize, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.get('/templates', authorize('pt', 'admin', 'super_admin'), getSharedTemplates)
router.get('/specializations', authorize('pt', 'admin', 'super_admin'), getDistinctSpecializations)
router.get('/goals', authorize('pt', 'admin', 'super_admin'), getDistinctGoals)
router.get('/goals-by-specialization', authorize('pt', 'admin', 'super_admin'), getDistinctGoalsBySpecialization)
router.get('/trainers-with-workouts', authorize('pt', 'admin', 'super_admin'), getDistinctTrainersWithWorkouts)
router.post('/assign', authorize('pt', 'admin', 'super_admin'), assignWorkoutToMember)
router.get('/:id/assignments', getWorkoutAssignments)
router.put('/:id/hide', authorize('admin', 'super_admin'), hideWorkout)
router.put('/:id/restore', authorize('admin', 'super_admin'), restoreWorkout)

export default router
