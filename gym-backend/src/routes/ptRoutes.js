import express from 'express'
import { upload } from '../config/cloudinary.js'
import {
  createPT,
  deletePT,
  getPTById,
  getPTSchedule,
  getPTs,
  getPTMyClasses,
  updatePT,
  updatePTSchedule,
  getPTAvailability,
} from '../controllers/ptController.js'
import { adminOrStaff, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

// Member routes
router.get('/available', getPTs)
router.get('/available/:id', getPTById)
router.get('/my-classes', getPTMyClasses)
router.get('/:id/availability', getPTAvailability)

// Admin / Staff routes
router.get('/', adminOrStaff, getPTs)
router.get('/schedule/:id', adminOrStaff, getPTSchedule)
router.get('/:id', adminOrStaff, getPTById)
router.post('/', adminOrStaff, upload.fields([{ name: 'avatar', maxCount: 1 }]), createPT)
router.patch('/:id', adminOrStaff, upload.fields([{ name: 'avatar', maxCount: 1 }]), updatePT)
router.patch('/:id/schedule', adminOrStaff, updatePTSchedule)
router.delete('/:id', adminOrStaff, deletePT)

export default router
