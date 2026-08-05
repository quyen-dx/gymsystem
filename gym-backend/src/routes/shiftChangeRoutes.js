import express from 'express'
import * as ctrl from '../controllers/shiftChangeController.js'
import { authorize, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()
router.use(protect)

// Lưu ý: các route tĩnh khai báo trước route động :id
router.get('/my', authorize('pt'), ctrl.getMyRequests)
router.get('/my-assignments', authorize('pt'), ctrl.getMyAssignments)
router.get('/my-replacements', authorize('pt'), ctrl.getMyReplacements)
router.post('/respond', authorize('pt'), ctrl.respondItem)
router.get('/', authorize('admin', 'super_admin', 'staff'), ctrl.getAllRequests)
router.get('/:id', authorize('admin', 'super_admin', 'staff'), ctrl.getRequestDetail)
router.get('/:id/available-pts', authorize('admin', 'super_admin'), ctrl.getAvailablePTs)
router.post('/', authorize('pt'), ctrl.createRequest)
router.patch('/:id/assign', authorize('admin', 'super_admin'), ctrl.assignPTs)
router.patch('/:id/reject', authorize('admin', 'super_admin'), ctrl.rejectRequest)
router.patch('/:id/cancel', authorize('pt'), ctrl.cancelRequest)

export default router
