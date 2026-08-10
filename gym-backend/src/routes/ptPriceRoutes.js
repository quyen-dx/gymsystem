import express from 'express'
import {
  getPriceList,
  getPTPrice,
  updatePTPrice,
  getPriceHistory,
} from '../controllers/ptPriceController.js'
import { protect, adminOnly } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)

// Admin: danh sách + lịch sử + cập nhật giá
router.get('/', adminOnly, getPriceList)
router.get('/:ptId/history', adminOnly, getPriceHistory)
router.put('/:ptId', adminOnly, updatePTPrice)

// Member/PT/Admin: xem giá 1 PT (chỉ đọc, không sửa)
router.get('/:ptId', getPTPrice)

export default router
