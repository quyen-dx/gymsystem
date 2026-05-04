import express from 'express'
import {
  addShopReview,
  deleteShop,
  getAdminShops,
  getMyShop,
  getShopById,
  updateMyShop,
} from '../controllers/shopController.js'
import { protect, adminOnly, sellerOnly } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.get('/admin/all', protect, adminOnly, getAdminShops)
router.get('/me', protect, sellerOnly, getMyShop)
router.put('/me', protect, sellerOnly, updateMyShop)
router.get('/:id', getShopById)
router.post('/:id/reviews', protect, addShopReview)
router.delete('/:id', protect, adminOnly, deleteShop)

export default router
