import PartnershipRequest from '../models/PartnershipRequest.js'
import Shop from '../models/Shop.js'
import User from '../models/User.js'
import { sendPartnershipRequestEmail } from '../services/emailService.js'
import AppError from '../utils/appError.js'

const REQUIRED_FIELDS = ['brand_name', 'category', 'contact_name', 'phone', 'email']
const EMAIL_REGEX = /^\S+@\S+\.\S+$/
const CATEGORIES = ['Thiết bị gym', 'Thực phẩm thể thao', 'Phụ kiện', 'Trang phục', 'Khác']

const sanitize = (value) => String(value || '').trim()

const normalizePayload = (body) => ({
  brand_name: sanitize(body.brand_name || body.brandName),
  category: sanitize(body.category),
  contact_name: sanitize(body.contact_name || body.contactName),
  phone: sanitize(body.phone),
  email: sanitize(body.email).toLowerCase(),
  website: sanitize(body.website),
  description: sanitize(body.description),
})

export const createPartnershipRequest = async (req, res, next) => {
  try {
    const payload = normalizePayload(req.body)
    const missing = REQUIRED_FIELDS.filter((field) => !payload[field])

    if (missing.length > 0) {
      return next(new AppError('Vui lòng nhập đầy đủ thông tin bắt buộc', 400))
    }

    if (!EMAIL_REGEX.test(payload.email)) {
      return next(new AppError('Email không hợp lệ', 400))
    }

    if (!CATEGORIES.includes(payload.category)) {
      return next(new AppError('Lĩnh vực sản phẩm không hợp lệ', 400))
    }

    const partnershipRequest = await PartnershipRequest.create(payload)

    try {
      await sendPartnershipRequestEmail({
        toEmail: process.env.ADMIN_EMAIL || process.env.EMAIL_USER || 'admin@gympro.local',
        request: partnershipRequest,
      })
    } catch (emailErr) {
      console.error('Failed to send partnership request email:', emailErr)
    }

    res.status(201).json({
      message: 'Chúng tôi sẽ liên hệ với bạn trong 1-3 ngày làm việc',
      request: partnershipRequest,
    })
  } catch (err) {
    next(err)
  }
}

export const getAdminPartnershipRequests = async (_req, res, next) => {
  try {
    const requests = await PartnershipRequest.find()
      .populate('shop_id', 'name')
      .sort({ created_at: -1 })
    res.json({ requests })
  } catch (err) {
    next(err)
  }
}

export const getPendingPartnershipRequestCount = async (_req, res, next) => {
  try {
    const count = await PartnershipRequest.countDocuments({ status: 'pending' })
    res.json({ count })
  } catch (err) {
    next(err)
  }
}

export const approvePartnershipRequest = async (req, res, next) => {
  try {
    const request = await PartnershipRequest.findById(req.params.id)
    if (!request) return next(new AppError('Không tìm thấy yêu cầu hợp tác', 404))

    if (request.status === 'approved' && request.shop_id) {
      await request.populate('shop_id', 'name')
      return res.json({ message: 'Yêu cầu đã được duyệt', request, shop: request.shop_id })
    }

    let user = await User.findOne({
      $or: [
        { email: request.email },
        { phone: request.phone },
      ],
    })

    if (!user) {
      user = await User.create({
        name: request.contact_name,
        email: request.email,
        phone: request.phone,
        provider: 'phone',
        isVerified: true,
        role: 'seller',
        isSeller: true,
      })
    }

    let shop = await Shop.findOne({ user_id: user._id })
    if (!shop) {
      shop = await Shop.create({
        user_id: user._id,
        name: request.brand_name,
        description: request.description || `Thương hiệu ${request.category} hợp tác cùng GymPro.`,
      })
    }

    user.role = 'seller'
    user.isSeller = true
    user.shopId = shop._id
    user.shop_id = shop._id
    if (!user.email) user.email = request.email
    if (!user.phone) user.phone = request.phone
    await user.save()

    request.status = 'approved'
    request.shop_id = shop._id
    await request.save()
    await request.populate('shop_id', 'name')

    res.json({ message: 'Đã duyệt yêu cầu và tạo shop', request, shop })
  } catch (err) {
    next(err)
  }
}

export const rejectPartnershipRequest = async (req, res, next) => {
  try {
    const request = await PartnershipRequest.findById(req.params.id)
    if (!request) return next(new AppError('Không tìm thấy yêu cầu hợp tác', 404))

    request.status = 'rejected'
    await request.save()

    res.json({ message: 'Đã từ chối yêu cầu hợp tác', request })
  } catch (err) {
    next(err)
  }
}
