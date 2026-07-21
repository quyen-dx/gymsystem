import express from 'express'
import {
  calculateBmi,
  calculateBmr,
  calculateTdee,
  calculateMacros,
} from '../controllers/healthCalculatorController.js'
import { authorize, protect } from '../middlewares/authMiddleware.js'
import {
  bmiCalculatorSchema,
  bmrCalculatorSchema,
  tdeeCalculatorSchema,
  macrosCalculatorSchema,
} from '../validators/healthValidator.js'
import { validateBody } from '../middlewares/validation.js'

const router = express.Router()

router.use(protect)
router.use(authorize('member', 'pt', 'admin', 'super_admin'))

router.post('/bmi', validateBody(bmiCalculatorSchema), calculateBmi)
router.post('/bmr', validateBody(bmrCalculatorSchema), calculateBmr)
router.post('/tdee', validateBody(tdeeCalculatorSchema), calculateTdee)
router.post('/macros', validateBody(macrosCalculatorSchema), calculateMacros)

export default router
