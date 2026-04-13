import express from 'express';
import {
  createPlan,
  getPlans,
  getPlanById,
  updatePlan,
  deletePlan,
  togglePlanStatus,
} from '../controllers/planController.js';
import { protect, adminOnly } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Xem danh sách và chi tiết: tất cả đều xem được (kể cả chưa login)
// Nhưng admin mới thấy cả gói inactive → protect để biết role
router.get('/', protect, getPlans);
router.get('/:id', protect, getPlanById);

// Chỉ Admin mới được tạo / sửa / xoá / toggle
router.post('/', protect, adminOnly, createPlan);
router.put('/:id', protect, adminOnly, updatePlan);
router.delete('/:id', protect, adminOnly, deletePlan);
router.patch('/:id/toggle-status', protect, adminOnly, togglePlanStatus);

export default router;