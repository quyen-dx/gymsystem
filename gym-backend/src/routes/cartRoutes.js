import express from 'express'
import { protect } from '../middleware/auth.js'
import {
  getCartController,
  addCartItemController,
  updateCartItemController,
  removeCartItemController,
  clearCartController,
  checkoutFromCartController,
} from '../controllers/cartController.js'

const router = express.Router()

router.use(protect)

router.get('/', getCartController)
router.post('/items', addCartItemController)
router.put('/items/:itemId', updateCartItemController)
router.delete('/items/:itemId', removeCartItemController)
router.delete('/', clearCartController)
router.post('/checkout', checkoutFromCartController)

export default router
