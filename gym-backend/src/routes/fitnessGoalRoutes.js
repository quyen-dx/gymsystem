import express from 'express'
import {
  createFitnessGoal,
  getFitnessGoals,
  getFitnessGoalById,
  updateFitnessGoal,
  deleteFitnessGoal,
} from '../controllers/fitnessGoalController.js'
import { authorize, protect } from '../middlewares/authMiddleware.js'
import {
  createFitnessGoalSchema,
  updateFitnessGoalSchema,
  fitnessGoalQuerySchema,
} from '../validators/healthValidator.js'
import { validateBody, validateQuery } from '../middlewares/validation.js'

const router = express.Router()

router.use(protect)

router.post('/', authorize('member', 'pt', 'admin', 'super_admin'), validateBody(createFitnessGoalSchema), createFitnessGoal)
router.get('/', authorize('member', 'pt', 'admin', 'super_admin'), validateQuery(fitnessGoalQuerySchema), getFitnessGoals)

router.get('/:id', authorize('member', 'pt', 'admin', 'super_admin'), getFitnessGoalById)
router.put('/:id', authorize('member', 'pt', 'admin', 'super_admin'), validateBody(updateFitnessGoalSchema), updateFitnessGoal)
router.delete('/:id', authorize('member', 'pt', 'admin', 'super_admin'), deleteFitnessGoal)

export default router
