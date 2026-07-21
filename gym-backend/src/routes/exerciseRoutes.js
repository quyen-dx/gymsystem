import express from 'express'
import {
  createExercise,
  getExercises,
  getExerciseById,
  updateExercise,
  deleteExercise,
  getMuscleGroups,
  getEquipments,
  createWorkoutLog,
  getWorkoutLogs,
  getWorkoutLogById,
  updateWorkoutLog,
  deleteWorkoutLog,
} from '../controllers/exerciseController.js'
import { authorize, protect } from '../middlewares/authMiddleware.js'
import {
  createExerciseSchema,
  updateExerciseSchema,
  exerciseQuerySchema,
  createWorkoutLogSchema,
  updateWorkoutLogSchema,
  workoutLogQuerySchema,
} from '../validators/exerciseValidator.js'
import { validateBody, validateQuery } from '../middlewares/validation.js'

const router = express.Router()

router.use(protect)

router.get('/muscle-groups', getMuscleGroups)
router.get('/equipments', getEquipments)
router.get('/', validateQuery(exerciseQuerySchema), getExercises)

router.post('/', authorize('pt', 'admin', 'super_admin'), validateBody(createExerciseSchema), createExercise)

router.post('/logs', authorize('member', 'pt', 'admin', 'super_admin'), validateBody(createWorkoutLogSchema), createWorkoutLog)
router.get('/logs', authorize('member', 'pt', 'admin', 'super_admin'), validateQuery(workoutLogQuerySchema), getWorkoutLogs)
router.get('/logs/:id', authorize('member', 'pt', 'admin', 'super_admin'), getWorkoutLogById)
router.put('/logs/:id', authorize('member', 'pt', 'admin', 'super_admin'), validateBody(updateWorkoutLogSchema), updateWorkoutLog)
router.delete('/logs/:id', authorize('member', 'pt', 'admin', 'super_admin'), deleteWorkoutLog)

router.get('/:id', getExerciseById)
router.put('/:id', authorize('pt', 'admin', 'super_admin'), validateBody(updateExerciseSchema), updateExercise)
router.delete('/:id', authorize('pt', 'admin', 'super_admin'), deleteExercise)

export default router
