import Cart from '../models/Cart.js'
import Product from '../models/Product.js'
import ProductVariant from '../models/ProductVariant.js'
import AppError from '../utils/appError.js'
import { getReservedQuantity } from './inventoryService.js'

export const getCart = async (userId) => {
  let cart = await Cart.findOne({ userId })
    .populate('items.productId', 'name image images price stock isActive shop_id')
    .populate('items.variantId', 'name sku price stock image')
    .populate('items.sellerId', 'name fullName')
    .lean()

  if (!cart) {
    cart = { userId, items: [] }
  }

  for (const item of cart.items) {
    if (!item.productId) {
      item._invalid = true
      continue
    }
    const product = item.productId
    if (!product.isActive) {
      item._inactive = true
    }
    const reservedQty = await getReservedQuantity(product._id, item.variantId?._id || null)
    item._available = Math.max(0, (product.stock || 0) - reservedQty)
  }

  return cart
}

export const addItemToCart = async ({ userId, productId, variantId, quantity }) => {
  const product = await Product.findById(productId).select('name image images price stock isActive shop_id').lean()
  if (!product || !product.isActive) {
    throw new AppError('Sản phẩm không khả dụng', 400)
  }

  if (!product.shop_id) {
    throw new AppError('Sản phẩm chưa thuộc shop', 400)
  }

  let price = product.price || 0
  let weight = 0

  if (variantId) {
    const variant = await ProductVariant.findById(variantId).select('name sku price stock weight image').lean()
    if (!variant || !variant.isActive) {
      throw new AppError('Biến thể sản phẩm không khả dụng', 400)
    }
    if (variant.price != null) price = variant.price
    if (variant.weight != null) weight = variant.weight
  }

  const sellerId = product.shop_id.user_id || product.shop_id
  const productName = product.name
  const productImage = product.image || product.images?.[0] || ''
  const normalizedVariantId = variantId || null

  const updated = await Cart.findOneAndUpdate(
    {
      userId,
      'items.productId': productId,
      'items.variantId': normalizedVariantId,
    },
    {
      $inc: { 'items.$.quantity': quantity },
      $set: {
        'items.$.price': price,
        'items.$.weight': weight,
        'items.$.productName': productName,
        'items.$.productImage': productImage,
        'items.$.sellerId': sellerId,
      },
    },
    { new: true },
  )

  if (updated) return updated

  return Cart.findOneAndUpdate(
    { userId },
    {
      $push: {
        items: {
          productId,
          variantId: normalizedVariantId,
          quantity,
          price,
          weight,
          productName,
          productImage,
          sellerId,
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
}

export const updateCartItemQuantity = async ({ userId, itemId, quantity }) => {
  const cart = await Cart.findOne({ userId })
  if (!cart) throw new AppError('Không tìm thấy giỏ hàng', 404)

  const item = cart.items.id(itemId)
  if (!item) throw new AppError('Không tìm thấy sản phẩm trong giỏ hàng', 404)

  if (quantity <= 0) {
    cart.items.pull({ _id: itemId })
  } else {
    item.quantity = quantity
  }

  return cart.save()
}

export const removeCartItem = async ({ userId, itemId }) => {
  const cart = await Cart.findOne({ userId })
  if (!cart) throw new AppError('Không tìm thấy giỏ hàng', 404)

  cart.items.pull({ _id: itemId })
  return cart.save()
}

export const clearCart = async (userId) => {
  return Cart.findOneAndDelete({ userId })
}

export const convertCartToOrderItems = async (userId) => {
  const cart = await Cart.findOne({ userId })
    .populate('items.productId', 'name image images price stock isActive shop_id')
    .populate('items.variantId', 'name price stock weight')
    .lean()

  if (!cart || !cart.items || cart.items.length === 0) {
    throw new AppError('Giỏ hàng trống', 400)
  }

  const items = cart.items.map((item) => {
    if (!item.productId || !item.productId.isActive) {
      throw new AppError(`Sản phẩm ${item.productName || ''} không còn khả dụng`, 400)
    }

    const product = item.productId
    const variant = item.variantId

    let price = item.price || product.price || 0
    let weight = 0
    let variantWeight = ''

    if (variant) {
      if (variant.price != null) price = variant.price
      if (variant.weight != null) {
        weight = variant.weight
        variantWeight = String(variant.weight)
      }
    }

    return {
      productId: product._id,
      sellerId: item.sellerId || product.shop_id?.user_id || product.shop_id,
      productName: product.name,
      productImage: item.productImage || product.image || product.images?.[0] || '',
      quantity: item.quantity,
      price,
      weight,
      variant: { weight: variantWeight },
    }
  })

  return items
}
