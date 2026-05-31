import express from 'express'
import {
  getSystemSettings,
  resetSystemSettings,
  updateSystemSettings,
} from '../controllers/systemSettingsController.js'
import { adminOnly, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.get('/', getSystemSettings)
router.put('/', protect, adminOnly, updateSystemSettings)
router.post('/reset-default', protect, adminOnly, resetSystemSettings)

export default router

