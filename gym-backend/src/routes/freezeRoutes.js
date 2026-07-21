import express from 'express'
import { protect, authorize } from '../middlewares/authMiddleware.js'
import { validateBody, validateParams, validateQuery } from '../middlewares/validation.js'
import {
  createFreezeSchema,
  freezeIdParamsSchema,
  freezeQuerySchema,
} from '../validators/freezeValidator.js'
import {
  createFreeze,
  getMyFreezeList,
  getFreezeList,
  approveFreezeRequest,
  rejectFreezeRequest,
} from '../controllers/freezeController.js'

const router = express.Router()

router.use(protect)

router.post('/freezes', validateBody(createFreezeSchema), createFreeze)
router.get('/freezes/my', validateQuery(freezeQuerySchema), getMyFreezeList)

router.get('/staff/freezes', authorize('super_admin', 'admin'), validateQuery(freezeQuerySchema), getFreezeList)
router.patch('/staff/freezes/:id/approve', authorize('super_admin', 'admin'), validateParams(freezeIdParamsSchema), approveFreezeRequest)
router.patch('/staff/freezes/:id/reject', authorize('super_admin', 'admin'), validateParams(freezeIdParamsSchema), rejectFreezeRequest)

export default router
