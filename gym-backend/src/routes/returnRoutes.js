import express from 'express'
import { requestReturnController, listMyReturns, getReturn, approveReturnController, rejectReturnController, listSellerReturns } from '../controllers/returnController.js'
import { protect, sellerOnly } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)
router.post('/', requestReturnController)
router.get('/', listMyReturns)
router.get('/seller/list', sellerOnly, listSellerReturns)
router.get('/:id', getReturn)
router.post('/:id/approve', sellerOnly, approveReturnController)
router.post('/:id/reject', sellerOnly, rejectReturnController)

export default router
