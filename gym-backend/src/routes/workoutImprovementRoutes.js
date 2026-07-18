import express from 'express'
import {
  submitImprovement,
  getReceivedImprovements,
  getSentImprovements,
  acceptImprovement,
  rejectImprovement,
} from '../controllers/workoutImprovementController.js'
import { authorize, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.post('/', authorize('pt', 'admin', 'super_admin'), submitImprovement)
router.get('/received', authorize('pt', 'admin', 'super_admin'), getReceivedImprovements)
router.get('/sent', authorize('pt', 'admin', 'super_admin'), getSentImprovements)
router.put('/:id/accept', authorize('pt', 'admin', 'super_admin'), acceptImprovement)
router.put('/:id/reject', authorize('pt', 'admin', 'super_admin'), rejectImprovement)

export default router
