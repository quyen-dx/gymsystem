import express from 'express'
import { calculateShippingController, checkoutOrder, deleteMyOrderHistory, getMyOrders, getOrder, getSellerOrders, trackOrder, updateSellerOrderStatusController } from '../controllers/orderController.js'
import { protect, sellerOnly } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)
router.post('/checkout', checkoutOrder)
router.post('/calculate-shipping', calculateShippingController)
router.get('/my', getMyOrders)
router.delete('/my/:id', deleteMyOrderHistory)
router.get('/seller', sellerOnly, getSellerOrders)
router.patch('/seller/:id/status', sellerOnly, updateSellerOrderStatusController)
router.get('/track/:id', trackOrder)
router.get('/:id', getOrder)

export default router
