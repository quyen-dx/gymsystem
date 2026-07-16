import express from 'express'
import * as ctrl from '../controllers/trainingGroupController.js'
import { authorize, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.get('/', ctrl.getAllGroups)
router.get('/:id', ctrl.getGroupById)
router.post('/', authorize('admin', 'super_admin', 'staff'), ctrl.createGroup)
router.patch('/:id', authorize('admin', 'super_admin', 'staff'), ctrl.updateGroup)
router.post('/:id/members', authorize('admin', 'super_admin', 'staff'), ctrl.addMember)
router.delete('/:id/members/:memberId', authorize('admin', 'super_admin', 'staff'), ctrl.removeMember)
router.patch('/:id/archive', authorize('admin', 'super_admin', 'staff'), ctrl.archiveGroup)

export default router
