import express from 'express'
import {
  createRequest,
  getMyRequests,
  cancelMyRequest,
  getRequestById,
  getAllRequests,
  assignPT,
  cancelByAdmin,
} from '../controllers/personalTrainingRequestController.js'
import { protect, adminOrStaff } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.post('/', protect, createRequest)
router.get('/my', protect, getMyRequests)
router.patch('/my/:id/cancel', protect, cancelMyRequest)
router.get('/', protect, adminOrStaff, getAllRequests)
router.get('/:id', protect, getRequestById)
router.patch('/:id/assign', protect, adminOrStaff, assignPT)
router.patch('/:id/cancel', protect, adminOrStaff, cancelByAdmin)

export default router
