import express from 'express'
import {
  getAllProducts, getProductById, getProductCategories,
  getAdminProducts, getMyProducts,
  createProduct, updateProduct, deleteProduct, addReview
} from '../controllers/productController.js'
import { protect, adminOnly, sellerOnly } from '../middlewares/authMiddleware.js'
import { checkProductOwner } from '../middlewares/productOwnershipMiddleware.js'

const router = express.Router()

router.get('/', getAllProducts)
router.get('/categories', getProductCategories)
router.get('/admin/all', protect, adminOnly, getAdminProducts)
router.get('/my-products', protect, sellerOnly, getMyProducts)
router.get('/:id', getProductById)
router.post('/', protect, sellerOnly, createProduct)
router.put('/:id', protect, sellerOnly, checkProductOwner, updateProduct)
router.delete('/:id', protect, sellerOnly, checkProductOwner, deleteProduct)
router.post('/:id/reviews', protect, addReview)

export default router
