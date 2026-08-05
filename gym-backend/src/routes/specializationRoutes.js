import express from 'express'
import { protect, authorize } from '../middlewares/authMiddleware.js'
import * as ctrl from '../controllers/specializationController.js'

const router = express.Router()
router.use(protect)

// Mục tiêu theo chuyên môn — PT/admin đều cần (dùng trong form tạo/sửa giáo án)
router.get('/:id/goals', authorize('pt', 'admin', 'super_admin'), ctrl.getGoalsBySpecialization)

router.use(authorize('admin', 'super_admin'))

router.get('/', ctrl.getAll)
router.get('/:id', ctrl.getById)
router.post('/', ctrl.create)
router.put('/:id', ctrl.update)
router.patch('/:id/toggle', ctrl.toggleActive)

export default router
