import express from 'express'
import { upload } from '../config/cloudinary.js'
import {
  createPT,
  deletePT,
  getPTById,
  getPTSchedule,
  getPTs,
  updatePT,
  updatePTSchedule,
} from '../controllers/ptController.js'
import { adminOrStaff, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

router.get('/', adminOrStaff, getPTs)
router.get('/schedule/:id', adminOrStaff, getPTSchedule)

router.get('/:id', adminOrStaff, getPTById)
router.post('/', adminOrStaff, upload.fields([{ name: 'avatar', maxCount: 1 }]), createPT)
router.patch('/:id', adminOrStaff, upload.fields([{ name: 'avatar', maxCount: 1 }]), updatePT)
router.patch('/:id/schedule', adminOrStaff, updatePTSchedule)
router.delete('/:id', adminOrStaff, deletePT)

export default router
