import Product from '../models/Product.js'
import Shop from '../models/Shop.js'
import { recordAuditLog } from '../services/auditLogService.js'
import AppError from '../utils/appError.js'

const normalizeWeightVariants = (variants, fallbackWeights) => {
  if (Array.isArray(variants) && variants.length > 0) {
    return variants
      .map((item) => ({
        label: String(item?.label || '').trim(),
        priceDelta: Number(item?.priceDelta || 0),
        stock: Number(item?.stock || 0),
      }))
      .filter((item) => item.label)
      .map((item) => ({
        ...item,
        priceDelta: Number.isFinite(item.priceDelta) && item.priceDelta > 0 ? item.priceDelta : 0,
        stock: Number.isFinite(item.stock) && item.stock > 0 ? item.stock : 0,
      }))
  }

  if (Array.isArray(fallbackWeights) && fallbackWeights.length > 0) {
    return fallbackWeights
      .map((label) => String(label || '').trim())
      .filter(Boolean)
      .map((label) => ({ label, priceDelta: 0, stock: 0 }))
  }

  return []
}

const normalizeCategoryKey = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

const getCategoryFilter = async (category, baseFilter = {}) => {
  const normalized = normalizeCategoryKey(category)
  if (!normalized) return null

  const products = await Product.find({ ...baseFilter, category: { $exists: true, $ne: '' } })
    .select('category')
    .lean()
  const matchedCategories = [...new Set(products
    .map((product) => String(product.category || '').trim())
    .filter((item) => normalizeCategoryKey(item) === normalized))]

  return matchedCategories.length > 0 ? { $in: matchedCategories } : category
}

const ensureSellerShop = async (user) => {
  const shopId = user.shop_id || user.shopId
  if (!shopId) {
    throw new AppError('Bạn cần có shop để tạo sản phẩm', 403)
  }

  const shop = await Shop.findById(shopId)
  if (!shop || shop.user_id.toString() !== user._id.toString()) {
    throw new AppError('Shop không hợp lệ hoặc không tồn tại', 403)
  }

  return shop._id
}

const hydrateProductReviews = (product) => {
  const productObject = product.toObject ? product.toObject() : product
  productObject.reviews = (productObject.reviews || []).map((review) => {
    const reviewer = review.userId && typeof review.userId === 'object' ? review.userId : null
    return {
      ...review,
      userId: reviewer?._id || review.userId,
      name: reviewer?.name || review.name,
      avatar: reviewer?.avatar || review.avatar || '',
    }
  })
  return productObject
}

export const getAllProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 12, search = '', category = '', shopId = '' } = req.query
    const filter = { isActive: true }
    if (search) filter.name = { $regex: search, $options: 'i' }
    if (shopId) filter.shop_id = shopId
    if (category) filter.category = await getCategoryFilter(category, shopId ? { isActive: true, shop_id: shopId } : { isActive: true })
    const total = await Product.countDocuments(filter)
    let query = Product.find(filter)
    if (shopId) {
      query = query.populate({
        path: 'shop_id',
        select: 'name avatar description address rating reviewCount user_id',
        populate: { path: 'user_id', select: 'name avatar' },
      })
    }
    const products = await query
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
    res.json({ products, total, page: Number(page), totalPages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

export const getProductCategories = async (req, res, next) => {
  try {
    const { shopId = '' } = req.query
    const filter = { isActive: true, category: { $exists: true, $ne: '' } }
    if (shopId) filter.shop_id = shopId

    const products = await Product.find(filter)
      .select('category')
      .sort({ createdAt: -1 })
      .lean()

    const categoryMap = new Map()
    products.forEach((product) => {
      const raw = String(product.category || '').trim()
      const key = normalizeCategoryKey(raw)
      if (!raw || !key || categoryMap.has(key)) return
      categoryMap.set(key, {
        label: raw,
        value: key,
      })
    })

    res.json({ categories: [...categoryMap.values()].sort((a, b) => a.label.localeCompare(b.label, 'vi')) })
  } catch (err) { next(err) }
}

export const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate({
        path: 'shop_id',
        select: 'name avatar description address rating reviewCount user_id',
        populate: { path: 'user_id', select: 'name avatar' },
      })
      .populate('reviews.userId', 'name avatar')
    if (!product) return next(new AppError('Không tìm thấy sản phẩm', 404))

    // Sản phẩm liên quan cùng category
    const related = await Product.find({
      _id: { $ne: product._id },
      category: product.category,
      isActive: true,
    }).limit(6)

    res.json({ product: hydrateProductReviews(product), related })
  } catch (err) { next(err) }
}

export const createProduct = async (req, res, next) => {
  try {
    const { name, description, descriptionImages, price, image, images, weights, weightVariants, category, stock, partner } = req.body
    const normalizedVariants = normalizeWeightVariants(weightVariants, weights)
    const normalizedStock = normalizedVariants.length > 0
      ? normalizedVariants.reduce((sum, item) => sum + Number(item.stock || 0), 0)
      : stock
    const shopId = await ensureSellerShop(req.user)
    const product = await Product.create({
      shop_id: shopId,
      name,
      description,
      descriptionImages,
      price,
      image,
      images,
      weights: normalizedVariants.map((item) => item.label),
      weightVariants: normalizedVariants,
      category,
      stock: normalizedStock,
      partner,
    })
    await recordAuditLog({
      req,
      module: 'products',
      action: 'create',
      entity: product,
      details: 'Thêm sản phẩm',
    })
    res.status(201).json(product)
  } catch (err) { next(err) }
}

export const getAdminProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 12, search = '', category = '', shopId = '' } = req.query
    const filter = {}
    if (search) filter.name = { $regex: search, $options: 'i' }
    if (category) filter.category = category
    if (shopId) filter.shop_id = shopId
    const total = await Product.countDocuments(filter)
    const products = await Product.find(filter)
      .populate('shop_id', 'name user_id')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
    res.json({ products, total, page: Number(page), totalPages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

export const getMyProducts = async (req, res, next) => {
  try {
    const shopId = req.user.shop_id || req.user.shopId
    if (!shopId) {
      return res.json({ products: [], total: 0, page: 1, totalPages: 0 })
    }

    const { page = 1, limit = 12, search = '', category = '' } = req.query
    const filter = { shop_id: shopId }
    if (search) filter.name = { $regex: search, $options: 'i' }
    if (category) filter.category = category
    const total = await Product.countDocuments(filter)
    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
    res.json({ products, total, page: Number(page), totalPages: Math.ceil(total / limit) })
  } catch (err) { next(err) }
}

export const updateProduct = async (req, res, next) => {
  try {
    const { name, description, descriptionImages, price, image, images, weights, weightVariants, category, stock, partner } = req.body
    const normalizedVariants = normalizeWeightVariants(weightVariants, weights)
    const normalizedStock = normalizedVariants.length > 0
      ? normalizedVariants.reduce((sum, item) => sum + Number(item.stock || 0), 0)
      : stock
    const product = req.product || await Product.findById(req.params.id)
    if (!product) return next(new AppError('Không tìm thấy sản phẩm', 404))

    product.name = name
    product.description = description
    product.descriptionImages = descriptionImages
    product.price = price
    product.image = image
    product.images = images
    product.weights = normalizedVariants.map((item) => item.label)
    product.weightVariants = normalizedVariants
    product.category = category
    product.stock = normalizedStock
    product.partner = partner
    await product.save()
    await recordAuditLog({
      req,
      module: 'products',
      action: 'update',
      entity: product,
      details: 'Cập nhật thông tin sản phẩm',
    })
    res.json(product)
  } catch (err) { next(err) }
}

export const deleteProduct = async (req, res, next) => {
  try {
    const product = req.product || await Product.findById(req.params.id)
    if (!product) return next(new AppError('Không tìm thấy sản phẩm', 404))
    await product.deleteOne()
    await recordAuditLog({
      req,
      module: 'products',
      action: 'delete',
      entity: product,
      details: 'Xóa sản phẩm',
    })
    res.json({ message: 'Đã xoá sản phẩm' })
  } catch (err) { next(err) }
}

export const addReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body
    const product = await Product.findById(req.params.id)
    if (!product) return next(new AppError('Không tìm thấy sản phẩm', 404))

    // Kiểm tra đã review chưa
    const already = product.reviews.find(r => r.userId.toString() === req.user._id.toString())
    if (already) return next(new AppError('Bạn đã đánh giá sản phẩm này rồi', 400))

    product.reviews.push({
      userId: req.user._id,
      name: req.user.name,
      avatar: req.user.avatar || '',
      rating,
      comment,
    })

    // Tính lại rating trung bình
    product.reviewCount = product.reviews.length
    product.rating = product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviewCount

    await product.save()
    await product.populate([
      {
        path: 'shop_id',
        select: 'name avatar description address rating reviewCount user_id',
        populate: { path: 'user_id', select: 'name avatar' },
      },
      { path: 'reviews.userId', select: 'name avatar' },
    ])
    res.status(201).json({ message: 'Đánh giá thành công', product: hydrateProductReviews(product) })
  } catch (err) { next(err) }
}
