import express from 'express'
import { exportUserData, anonymizeUserData } from '../controllers/gdprExportController.js'
import { protect, adminOnly } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)
router.use(adminOnly)
router.get('/export/:userId', exportUserData)
router.post('/anonymize/:userId', anonymizeUserData)

export default router
