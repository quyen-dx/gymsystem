import express from 'express'
import { protect, authorize } from '../middlewares/authMiddleware.js'
import { getRevenue, getMemberships, getCheckins, getTrainers, getProducts } from '../controllers/reportController.js'

const router = express.Router()

router.use(protect, authorize('admin', 'super_admin'))

router.get('/revenue', getRevenue)
router.get('/memberships', getMemberships)
router.get('/checkins', getCheckins)
router.get('/trainers', getTrainers)
router.get('/products', getProducts)

export default router
