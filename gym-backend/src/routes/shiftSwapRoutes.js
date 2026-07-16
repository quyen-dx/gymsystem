import express from 'express'
import {
  approveRequest,
  createRequest,
  getAllRequests,
  getMyRequests,
  getRequestDetail,
  rejectRequest,
} from '../controllers/shiftSwapController.js'
import { authorize, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()
router.use(protect)

router.post('/', authorize('pt', 'admin', 'super_admin'), createRequest)
router.get('/my', authorize('pt', 'admin', 'super_admin'), getMyRequests)
router.get('/', authorize('admin', 'super_admin', 'staff'), getAllRequests)
router.get('/:id', authorize('admin', 'super_admin', 'staff'), getRequestDetail)
router.patch('/:id/approve', authorize('admin', 'super_admin'), approveRequest)
router.patch('/:id/reject', authorize('admin', 'super_admin'), rejectRequest)

export default router
