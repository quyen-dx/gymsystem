import express from 'express'
import { getAdminShops, deleteShop } from '../controllers/shopController.js'
import { protect, adminOnly } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.get('/admin/all', protect, adminOnly, getAdminShops)
router.delete('/:id', protect, adminOnly, deleteShop)

export default router
