import express from 'express'
import {
  createClass,
  getAllClasses,
  enrollInClass,
  cancelEnrollment
} from '../controllers/groupClassController.js'
import { protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.post('/', protect, createClass)
router.get('/', protect, getAllClasses)
router.post('/:classId/enroll', protect, enrollInClass)
router.post('/:classId/cancel', protect, cancelEnrollment)

export default router