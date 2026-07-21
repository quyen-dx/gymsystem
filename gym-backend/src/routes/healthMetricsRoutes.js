import express from 'express'
import {
  createHealthMetric,
  getHealthMetrics,
  getHealthMetricById,
  updateHealthMetric,
  deleteHealthMetric,
  getHealthTrends,
  createBodyComposition,
  getBodyCompositions,
  getBodyCompositionById,
} from '../controllers/healthMetricController.js'
import { authorize, protect } from '../middlewares/authMiddleware.js'
import {
  createHealthMetricSchema,
  updateHealthMetricSchema,
  healthMetricQuerySchema,
  healthTrendsQuerySchema,
  createBodyCompositionSchema,
  bodyCompositionQuerySchema,
} from '../validators/healthValidator.js'
import { validateBody, validateQuery } from '../middlewares/validation.js'

const router = express.Router()

router.use(protect)

router.get('/trends', authorize('member', 'pt', 'admin', 'super_admin'), validateQuery(healthTrendsQuerySchema), getHealthTrends)

router.post('/inbody-scan', authorize('member', 'pt', 'admin', 'super_admin'), validateBody(createBodyCompositionSchema), createBodyComposition)

router.post('/', authorize('member', 'pt', 'admin', 'super_admin'), validateBody(createHealthMetricSchema), createHealthMetric)
router.get('/', authorize('member', 'pt', 'admin', 'super_admin'), validateQuery(healthMetricQuerySchema), getHealthMetrics)

router.get('/:id', authorize('member', 'pt', 'admin', 'super_admin'), getHealthMetricById)
router.put('/:id', authorize('member', 'pt', 'admin', 'super_admin'), validateBody(updateHealthMetricSchema), updateHealthMetric)
router.delete('/:id', authorize('member', 'pt', 'admin', 'super_admin'), deleteHealthMetric)

// Body Composition endpoints (under /body-composition prefix, registered separately)
const bodyCompRouter = express.Router()
bodyCompRouter.use(protect)

bodyCompRouter.get('/', authorize('member', 'pt', 'admin', 'super_admin'), validateQuery(bodyCompositionQuerySchema), getBodyCompositions)
bodyCompRouter.get('/:id', authorize('member', 'pt', 'admin', 'super_admin'), getBodyCompositionById)

export default router
export { bodyCompRouter }
