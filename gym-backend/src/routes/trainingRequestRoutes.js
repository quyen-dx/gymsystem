import express from 'express'
import * as ctrl from '../controllers/trainingRequestController.js'
import { authorize, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.post('/', authorize('member'), ctrl.createRequest)
router.get('/my', ctrl.getMyRequests)
router.patch('/my/:id/cancel', authorize('member'), ctrl.cancelMyRequest)
router.get('/pt1on1/counts', authorize('admin', 'super_admin', 'staff'), ctrl.getPt1on1Counts)
router.get('/:id', ctrl.getRequestById)
router.patch('/:id/assign', authorize('admin', 'super_admin', 'staff'), ctrl.assignToClass)
router.patch('/:id/assign-trainer', authorize('admin', 'super_admin', 'staff'), ctrl.assignTrainer)
router.post('/:id/send-message', authorize('admin', 'super_admin', 'staff'), ctrl.sendMessage)
router.post('/:id/respond', authorize('member'), ctrl.respondToMessage)
router.post('/:id/pt-respond', authorize('pt'), ctrl.respondPtAssignment)
router.get('/', authorize('admin', 'super_admin', 'staff'), ctrl.getAllRequests)

export default router
