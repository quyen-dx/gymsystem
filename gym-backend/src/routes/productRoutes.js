import express from 'express'
import {
  getAllProducts, getProductById, getProductCategories,
  getAdminProducts, getMyProducts,
  createProduct, updateProduct, deleteProduct, uploadProductImage, addReview,
  createCategory, getCategories, getCategoryTree, getCategoryById, updateCategory, deleteCategory,
  getProductVariants, createProductVariant, updateProductVariant, deleteProductVariant,
} from '../controllers/productController.js'
import { protect, adminOnly, sellerOnly } from '../middlewares/authMiddleware.js'
import { checkProductOwner } from '../middlewares/productOwnershipMiddleware.js'
import { requireFeature } from '../middlewares/systemSettingsMiddleware.js'
import { productImageUpload } from '../config/cloudinary.js'
import {
  createCategorySchema,
  updateCategorySchema,
  createProductVariantSchema,
  updateProductVariantSchema,
} from '../validators/productValidator.js'
import { validateBody } from '../middlewares/validation.js'

const router = express.Router()

router.post('/upload', protect, sellerOnly, requireFeature('shop.productStoreEnabled'), productImageUpload.single('image'), uploadProductImage)
router.get('/', requireFeature('shop.productStoreEnabled'), getAllProducts)
router.get('/categories', requireFeature('shop.productStoreEnabled'), getProductCategories)
router.get('/categories/tree', getCategoryTree)
router.post('/categories', protect, adminOnly, validateBody(createCategorySchema), createCategory)
router.put('/categories/:id', protect, adminOnly, validateBody(updateCategorySchema), updateCategory)
router.delete('/categories/:id', protect, adminOnly, deleteCategory)
router.get('/admin/all', protect, adminOnly, requireFeature('shop.productStoreEnabled'), getAdminProducts)
router.get('/my-products', protect, sellerOnly, requireFeature('shop.productStoreEnabled'), getMyProducts)
router.get('/:id', requireFeature('shop.productStoreEnabled'), requireFeature('shop.productDetailPageEnabled'), getProductById)
router.post('/', protect, sellerOnly, requireFeature('shop.productStoreEnabled'), createProduct)
router.put('/:id', protect, sellerOnly, requireFeature('shop.productStoreEnabled'), checkProductOwner, updateProduct)
router.delete('/:id', protect, sellerOnly, requireFeature('shop.productStoreEnabled'), checkProductOwner, deleteProduct)
router.post('/:id/reviews', protect, requireFeature('shop.productStoreEnabled'), requireFeature('shop.productReviewsEnabled'), addReview)

router.get('/:id/variants', getProductVariants)
router.post('/:id/variants', protect, sellerOnly, requireFeature('shop.productStoreEnabled'), checkProductOwner, validateBody(createProductVariantSchema), createProductVariant)
router.put('/:id/variants/:variantId', protect, sellerOnly, requireFeature('shop.productStoreEnabled'), validateBody(updateProductVariantSchema), updateProductVariant)
router.delete('/:id/variants/:variantId', protect, sellerOnly, requireFeature('shop.productStoreEnabled'), deleteProductVariant)

export default router
