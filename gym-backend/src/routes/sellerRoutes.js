import express from 'express'
import { getSellerOrder, getSellerOrders, updateSellerOrderStatusController } from '../controllers/orderController.js'
import { getRevenue, getStats, getPayouts } from '../controllers/sellerController.js'
import { protect, sellerOnly } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect, sellerOnly)

router.get('/orders', getSellerOrders)
router.get('/orders/:id', getSellerOrder)
router.patch('/orders/:id/status', updateSellerOrderStatusController)

router.get('/revenue', getRevenue)
router.get('/stats', getStats)
router.get('/payouts', getPayouts)

export default router
