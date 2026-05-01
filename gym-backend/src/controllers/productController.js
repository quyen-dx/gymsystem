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
      }))
      .filter((item) => item.label)
      .map((item) => ({
        ...item,
        priceDelta: Number.isFinite(item.priceDelta) && item.priceDelta > 0 ? item.priceDelta : 0,
      }))
  }

  if (Array.isArray(fallbackWeights) && fallbackWeights.length > 0) {
    return fallbackWeights
      .map((label) => String(label || '').trim())
      .filter(Boolean)
      .map((label) => ({ label, priceDelta: 0 }))
  }

  return []
}

const ensureSellerShop = async (user) => {
  if (user.shop_id || user.shopId) return user.shop_id || user.shopId

  let shop = await Shop.findOne({ user_id: user._id })
  if (!shop) {
    shop = await Shop.create({
      user_id: user._id,
      name: `${user.name || 'Seller'} Shop`,
    })
  }

  user.isSeller = true
  user.role = 'seller'
  user.shopId = shop._id
  user.shop_id = shop._id
  await user.save()

  return shop._id
}

export const getAllProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 12, search = '', category = '', shopId = '' } = req.query
    const filter = { isActive: true }
    if (search) filter.name = { $regex: search, $options: 'i' }
    if (category) filter.category = category
    if (shopId) filter.shop_id = shopId
    const total = await Product.countDocuments(filter)
    let query = Product.find(filter)
    if (shopId) {
      query = query.populate({
        path: 'shop_id',
        select: 'name avatar description user_id',
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

export const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate({
        path: 'shop_id',
        select: 'name avatar description user_id',
        populate: { path: 'user_id', select: 'name avatar' },
      })
    if (!product) return next(new AppError('Không tìm thấy sản phẩm', 404))

    // Sản phẩm liên quan cùng category
    const related = await Product.find({
      _id: { $ne: product._id },
      category: product.category,
      isActive: true,
    }).limit(6)

    res.json({ product, related })
  } catch (err) { next(err) }
}

export const createProduct = async (req, res, next) => {
  try {
    const { name, description, descriptionImages, price, image, images, weights, weightVariants, category, stock, partner } = req.body
    const normalizedVariants = normalizeWeightVariants(weightVariants, weights)
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
      stock,
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
    product.stock = stock
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
    res.status(201).json({ message: 'Đánh giá thành công', product })
  } catch (err) { next(err) }
}
