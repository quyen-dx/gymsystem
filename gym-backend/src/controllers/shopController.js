import Product from '../models/Product.js'
import Shop from '../models/Shop.js'
import User from '../models/User.js'
import { recordAuditLog } from '../services/auditLogService.js'
import { sendShopDeletionEmail } from '../services/emailService.js'
import AppError from '../utils/appError.js'

const hydrateShopReviews = (shop) => {
  const shopObject = shop.toObject ? shop.toObject() : shop
  shopObject.reviews = (shopObject.reviews || []).map((review) => {
    const reviewer = review.userId && typeof review.userId === 'object' ? review.userId : null
    return {
      ...review,
      userId: reviewer?._id || review.userId,
      name: reviewer?.name || review.name,
      avatar: reviewer?.avatar || review.avatar || '',
    }
  })
  return shopObject
}

export const getAdminShops = async (req, res, next) => {
  try {
    const shops = await Shop.find().populate('user_id', 'name email phone role isSeller')
    res.json(shops)
  } catch (err) {
    next(err)
  }
}

export const getShopById = async (req, res, next) => {
  try {
    const shop = await Shop.findById(req.params.id)
      .populate('user_id', 'name email phone role isSeller avatar')
      .populate('reviews.userId', 'name avatar')
    if (!shop) return next(new AppError('Không tìm thấy shop', 404))
    res.json({ shop: hydrateShopReviews(shop) })
  } catch (err) {
    next(err)
  }
}

export const getMyShop = async (req, res, next) => {
  try {
    const shop = await Shop.findOne({ user_id: req.user._id })
      .populate('user_id', 'name email phone role isSeller avatar')
    if (!shop) return next(new AppError('Không tìm thấy shop', 404))
    res.json({ shop })
  } catch (err) {
    next(err)
  }
}

export const updateMyShop = async (req, res, next) => {
  try {
    const shop = await Shop.findOne({ user_id: req.user._id })
    if (!shop) return next(new AppError('Không tìm thấy shop', 404))

    const { name, description, avatar, address } = req.body
    if (name !== undefined) shop.name = String(name || '').trim()
    if (description !== undefined) shop.description = String(description || '').trim()
    if (avatar !== undefined) shop.avatar = String(avatar || '').trim()
    if (address && typeof address === 'object') {
      shop.address = {
        street: String(address.street || '').trim(),
        ward: String(address.ward || '').trim(),
        district: String(address.district || '').trim(),
        city: String(address.city || '').trim(),
      }
    }

    await shop.save()
    res.json({ message: 'Cập nhật shop thành công', shop })
  } catch (err) {
    next(err)
  }
}

export const addShopReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body
    const shop = await Shop.findById(req.params.id)
    if (!shop) return next(new AppError('Không tìm thấy shop', 404))
    if (shop.user_id.toString() === req.user._id.toString()) {
      return next(new AppError('Bạn không thể đánh giá shop của chính mình', 400))
    }

    const numericRating = Number(rating)
    if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      return next(new AppError('Số sao đánh giá không hợp lệ', 400))
    }

    const existing = shop.reviews.find((review) => review.userId.toString() === req.user._id.toString())
    if (existing) {
      existing.rating = numericRating
      existing.comment = comment || ''
      existing.name = req.user.name
      existing.avatar = req.user.avatar || ''
    } else {
      shop.reviews.push({
        userId: req.user._id,
        name: req.user.name,
        avatar: req.user.avatar || '',
        rating: numericRating,
        comment: comment || '',
      })
    }

    shop.reviewCount = shop.reviews.length
    shop.rating = shop.reviews.reduce((sum, review) => sum + review.rating, 0) / shop.reviewCount
    await shop.save()
    await shop.populate([
      { path: 'user_id', select: 'name email phone role isSeller avatar' },
      { path: 'reviews.userId', select: 'name avatar' },
    ])

    res.status(201).json({ message: 'Đánh giá shop thành công', shop: hydrateShopReviews(shop) })
  } catch (err) {
    next(err)
  }
}

export const deleteShop = async (req, res, next) => {
  try {
    const { id } = req.params
    const { reason } = req.body

    if (!reason) {
      return next(new AppError('Vui lòng cung cấp lý do xóa shop', 400))
    }

    const shop = await Shop.findById(id)
    if (!shop) {
      return next(new AppError('Không tìm thấy shop', 404))
    }

    const ownerId = shop.user_id
    const shopName = shop.name

    // 1. Fetch owner details for email and audit log BEFORE deleting shop
    const owner = await User.findById(ownerId)
    const userEmail = owner?.email

    // 2. Delete all products of this shop
    await Product.deleteMany({ shop_id: id })

    // 3. Delete the shop
    await shop.deleteOne()

    // 4. Update user role and shop references
    // We use findByIdAndUpdate to bypass potential validation issues with other fields
    // and ensure the update is performed directly in the database.
    if (ownerId) {
      await User.findByIdAndUpdate(ownerId, {
        $set: {
          role: 'member',
          isSeller: false,
          shopId: null,
          shop_id: null
        }
      })
    }

    // 5. Send email if email exists
    if (userEmail) {
      try {
        await sendShopDeletionEmail({ toEmail: userEmail, shopName, reason })
      } catch (emailErr) {
        console.error('Failed to send shop deletion email:', emailErr)
      }
    }

    // 6. Audit log
    await recordAuditLog({
      req,
      module: 'shops',
      action: 'delete',
      entity: { _id: id, name: shopName, owner: owner?.name },
      details: `Xóa shop với lý do: ${reason}`,
    })

    res.json({ message: 'Đã xóa shop thành công' })
  } catch (err) {
    next(err)
  }
}
