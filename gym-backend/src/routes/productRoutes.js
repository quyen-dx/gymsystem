import express from 'express'
import {
  getAllProducts, getProductById, getProductCategories,
  getAdminProducts, getMyProducts,
  createProduct, updateProduct, deleteProduct, uploadProductImage, addReview
} from '../controllers/productController.js'
import { protect, adminOnly, sellerOnly } from '../middlewares/authMiddleware.js'
import { checkProductOwner } from '../middlewares/productOwnershipMiddleware.js'
import { requireFeature } from '../middlewares/systemSettingsMiddleware.js'
import { productImageUpload } from '../config/cloudinary.js'

const router = express.Router()

router.post('/upload', protect, sellerOnly, requireFeature('shop.productStoreEnabled'), productImageUpload.single('image'), uploadProductImage)
router.get('/', requireFeature('shop.productStoreEnabled'), getAllProducts)
router.get('/categories', requireFeature('shop.productStoreEnabled'), getProductCategories)
router.get('/admin/all', protect, adminOnly, requireFeature('shop.productStoreEnabled'), getAdminProducts)
router.get('/my-products', protect, sellerOnly, requireFeature('shop.productStoreEnabled'), getMyProducts)
router.get('/:id', requireFeature('shop.productStoreEnabled'), requireFeature('shop.productDetailPageEnabled'), getProductById)
router.post('/', protect, sellerOnly, requireFeature('shop.productStoreEnabled'), createProduct)
router.put('/:id', protect, sellerOnly, requireFeature('shop.productStoreEnabled'), checkProductOwner, updateProduct)
router.delete('/:id', protect, sellerOnly, requireFeature('shop.productStoreEnabled'), checkProductOwner, deleteProduct)
router.post('/:id/reviews', protect, requireFeature('shop.productStoreEnabled'), requireFeature('shop.productReviewsEnabled'), addReview)

export default router
