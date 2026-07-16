import express from 'express'
import * as ctrl from '../controllers/trainingRequestController.js'
import { authorize, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.post('/', authorize('member'), ctrl.createRequest)
router.get('/my', ctrl.getMyRequests)
router.patch('/my/:id/cancel', authorize('member'), ctrl.cancelMyRequest)
router.get('/:id', ctrl.getRequestById)
router.patch('/:id/assign', authorize('admin', 'super_admin', 'staff'), ctrl.assignToClass)
router.get('/', authorize('admin', 'super_admin', 'staff'), ctrl.getAllRequests)

export default router
