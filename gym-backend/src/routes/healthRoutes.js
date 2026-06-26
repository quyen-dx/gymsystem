import express from 'express'
import { healthPhotoUpload } from '../config/cloudinary.js'
import {
  compareHealthLogs,
  createHealthLog,
  getBmiHistory,
  getMonthlyMeasurements,
  getWeightHistory,
  uploadHealthPhoto,
} from '../controllers/healthController.js'
import { authorize, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.get('/status', (_req, res) => {
  res.json({ status: 'OK', message: 'GymPro API is running' })
})

router.use(protect)
router.use(authorize('member', 'pt', 'admin', 'super_admin'))

router.post('/logs', createHealthLog)
router.post('/photo', healthPhotoUpload.single('photo'), uploadHealthPhoto)
router.get('/bmi-history', getBmiHistory)
router.get('/weight-history', getWeightHistory)
router.get('/compare', compareHealthLogs)
router.get('/measurements/monthly', getMonthlyMeasurements)

export default router
