import express from 'express';
import { protect, authorize } from '../middlewares/authMiddleware.js';
import * as ctrl from '../controllers/planFeatureController.js';

const router = express.Router();
router.use(protect);

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);

router.use(authorize('super_admin', 'admin'));
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.patch('/:id/toggle', ctrl.toggleActive);

export default router;
