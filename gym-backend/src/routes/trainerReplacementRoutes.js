import express from 'express'
import * as ctrl from '../controllers/trainerReplacementController.js'
import { authorize, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.post('/', authorize('pt'), ctrl.createRequest)
router.get('/my', authorize('pt'), ctrl.getMyRequests)
router.get('/pending', authorize('admin', 'super_admin', 'staff'), ctrl.getAllPendingRequests)
router.patch('/:id/approve', authorize('admin', 'super_admin'), ctrl.approveRequest)
router.patch('/:id/reject', authorize('admin', 'super_admin'), ctrl.rejectRequest)

export default router
