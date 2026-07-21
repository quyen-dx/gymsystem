import Product from '../models/Product.js'
import ProductVariant from '../models/ProductVariant.js'
import mongoose from 'mongoose'

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id)

const buildSearchRegex = (value = '') => {
  const terms = String(value)
    .split(/[\s,;|]+/)
    .map((term) => term.trim())
    .filter(Boolean)
  if (terms.length === 0) return /.*/i
  return new RegExp(terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i')
}

const goalMap = {
  'tăng cơ': ['whey', 'protein', 'mass', 'creatine', 'tăng cơ'],
  'giam can': ['fat burn', 'giảm cân', 'cardio', 'l-carnitine'],
  'giảm cân': ['fat burn', 'giảm cân', 'cardio', 'l-carnitine'],
  cardio: ['cardio', 'giày', 'nước', 'đai'],
}

export const getRecommendedProducts = async ({ goal = '' } = {}) => {
  const keyword = String(goal || '').trim()
  const normalized = keyword.toLowerCase()
  const terms = goalMap[normalized] || [keyword]
  const queryRegex = buildSearchRegex(terms.join(' '))

  const products = await Product.find({
    isActive: true,
    stock: { $gt: 0 },
    $or: [
      { name: queryRegex },
      { category: queryRegex },
      { description: queryRegex },
    ],
  })
    .select('name price category image images stock rating reviewCount')
    .sort({ rating: -1, stock: -1, createdAt: -1 })
    .limit(50)
    .lean()

  return {
    count: products.length,
    goal: keyword,
    products: products.map((product) => ({
      id: product._id,
      name: product.name,
      price: product.price,
      category: product.category,
      image: product.image || product.images?.[0] || '',
      stock: product.stock,
      rating: product.rating || 0,
      reviewCount: product.reviewCount || 0,
      link: `/dashboard/member/store/${product._id}`,
    })),
  }
}

export const getVariants = async (productId) => {
  if (!isValidObjectId(productId)) return []
  const variants = await ProductVariant.find({ productId, isActive: true })
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean()
  return variants
}

export const createVariant = async (productId, data) => {
  const variant = await ProductVariant.create({
    productId,
    name: data.name,
    sku: data.sku,
    price: data.price || 0,
    stock: data.stock || 0,
    sortOrder: data.sortOrder || 0,
  })
  return variant
}

export const updateVariant = async (variantId, data) => {
  if (!isValidObjectId(variantId)) return null
  const variant = await ProductVariant.findById(variantId)
  if (!variant) return null

  const fields = ['name', 'sku', 'price', 'stock', 'reserved', 'isActive', 'sortOrder']
  for (const field of fields) {
    if (data[field] !== undefined) {
      variant[field] = data[field]
    }
  }

  await variant.save()
  return variant
}

export const deleteVariant = async (variantId) => {
  if (!isValidObjectId(variantId)) return null
  const variant = await ProductVariant.findByIdAndUpdate(variantId, { isActive: false }, { new: true })
  return variant
}
