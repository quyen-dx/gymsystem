import { getCart, addItemToCart, updateCartItemQuantity, removeCartItem, clearCart, convertCartToOrderItems } from '../services/cartService.js'
import { createOrder } from '../services/orderService.js'
import { addCartItemSchema, updateCartItemSchema } from '../validators/orderValidator.js'

export const getCartController = async (req, res, next) => {
  try {
    const cart = await getCart(req.user._id)
    return res.json({ success: true, data: cart })
  } catch (error) {
    next(error)
  }
}

export const addCartItemController = async (req, res, next) => {
  try {
    const parsed = addCartItemSchema.parse(req.body)
    const cart = await addItemToCart({
      userId: req.user._id,
      productId: parsed.productId,
      variantId: parsed.variantId,
      quantity: parsed.quantity,
    })
    return res.status(201).json({ success: true, data: cart })
  } catch (error) {
    next(error)
  }
}

export const updateCartItemController = async (req, res, next) => {
  try {
    const parsed = updateCartItemSchema.parse(req.body)
    const cart = await updateCartItemQuantity({
      userId: req.user._id,
      itemId: req.params.itemId,
      quantity: parsed.quantity,
    })
    return res.json({ success: true, data: cart })
  } catch (error) {
    next(error)
  }
}

export const removeCartItemController = async (req, res, next) => {
  try {
    const cart = await removeCartItem({
      userId: req.user._id,
      itemId: req.params.itemId,
    })
    return res.json({ success: true, data: cart })
  } catch (error) {
    next(error)
  }
}

export const clearCartController = async (req, res, next) => {
  try {
    await clearCart(req.user._id)
    return res.json({ success: true, message: 'Đã xóa giỏ hàng' })
  } catch (error) {
    next(error)
  }
}

export const checkoutFromCartController = async (req, res, next) => {
  try {
    const items = await convertCartToOrderItems(req.user._id)
    const { address: requestAddress, paymentReference, discountCode } = req.body

    let address = requestAddress
    if (!address) {
      const { getDefaultAddress } = await import('../services/addressService.js')
      address = await getDefaultAddress(req.user._id)
    }
    if (!address) {
      throw new Error('Vui lòng thêm địa chỉ giao hàng trước khi thanh toán')
    }

    const orders = await createOrder({
      userId: req.user._id,
      items,
      address,
      paymentReference,
      discountCode,
    })

    await clearCart(req.user._id)

    return res.status(201).json({ success: true, data: orders, order: orders[0] })
  } catch (error) {
    next(error)
  }
}
