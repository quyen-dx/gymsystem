import express from 'express'
import * as ctrl from '../controllers/trainingAssignmentController.js'
import { authorize, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.get('/my', ctrl.getMyAssignment)
router.get('/pt/clients', authorize('pt', 'admin', 'super_admin'), ctrl.getMyActiveClients)
router.get('/pt/history', authorize('pt', 'admin', 'super_admin'), ctrl.getMyHistory)
router.post('/', authorize('admin', 'super_admin', 'staff'), ctrl.createAssignment)

export default router
