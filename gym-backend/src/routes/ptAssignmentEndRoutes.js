import express from 'express'
import {
  approveEndRequest,
  createEndRequest,
  getEndRequests,
  getMyEndRequests,
  rejectEndRequest,
} from '../controllers/ptAssignmentEndController.js'
import { authorize, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

// PT
router.post('/', authorize('pt', 'admin', 'super_admin'), createEndRequest)
router.get('/my', authorize('pt'), getMyEndRequests)

// Admin
router.get('/', authorize('admin', 'super_admin'), getEndRequests)
router.put('/:id/approve', authorize('admin', 'super_admin'), approveEndRequest)
router.put('/:id/reject', authorize('admin', 'super_admin'), rejectEndRequest)

export default router
