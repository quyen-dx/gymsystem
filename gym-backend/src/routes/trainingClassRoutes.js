import express from 'express'
import * as ctrl from '../controllers/trainingClassController.js'
import { authorize, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.get('/', ctrl.getAllClasses)
router.get('/:id', ctrl.getClassById)
router.post('/', authorize('admin', 'super_admin', 'staff'), ctrl.createClass)
router.patch('/:id', authorize('admin', 'super_admin', 'staff'), ctrl.updateClass)
router.delete('/:id', authorize('admin', 'super_admin', 'staff'), ctrl.deleteClass)

export default router
