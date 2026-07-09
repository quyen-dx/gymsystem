import express from 'express'
import { reIndexAll, reIndexSource, getStats, searchVector } from '../controllers/vectorStoreController.js'
import { protect, adminOnly } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.get('/stats', protect, adminOnly, getStats)
router.post('/reindex', protect, adminOnly, reIndexAll)
router.post('/reindex/:source', protect, adminOnly, reIndexSource)
router.post('/search', protect, adminOnly, searchVector)

export default router
