import express from 'express'
import { calculateShippingController, checkoutOrder, deleteMyOrderHistory, getMyOrders, getOrder, getSellerOrders, trackOrder, updateSellerOrderStatusController, validateDiscountCode } from '../controllers/orderController.js'
import { protect, sellerOnly } from '../middlewares/authMiddleware.js'
import { requireFeature } from '../middlewares/systemSettingsMiddleware.js'

const router = express.Router()

router.use(protect)
router.post('/checkout', requireFeature('shop.cartEnabled'), checkoutOrder)
router.post('/calculate-shipping', calculateShippingController)
router.post('/validate-discount', requireFeature('billing.discountCodesEnabled'), validateDiscountCode)
router.get('/my', getMyOrders)
router.delete('/my/:id', deleteMyOrderHistory)
router.get('/seller', sellerOnly, requireFeature('shop.productStoreEnabled'), getSellerOrders)
router.patch('/seller/:id/status', sellerOnly, requireFeature('shop.productStoreEnabled'), updateSellerOrderStatusController)
router.get('/track/:id', trackOrder)
router.get('/:id', getOrder)

export default router
