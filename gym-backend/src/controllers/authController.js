import Shop from '../models/Shop.js'
import User from '../models/User.js'
import { recordAuditLog } from '../services/auditLogService.js'
import {
  consumeOtp,
  hashPendingPassword,
  sendOtp,
  verifyOtp,
} from '../services/otpService.js'
import AppError from '../utils/appError.js'
import {
  generateAccessToken,
  generateRefreshToken,
  generateResetToken,
  verifyRefreshToken,
  verifyResetToken,
} from '../utils/generateToken.js'
import {
  detectIdentifierType,
  isValidEmail,
  isValidPhone,
  normalizeIdentifier,
  normalizePhone,
} from '../utils/identifier.js'

const sendError = (res, error) => {
  console.error(error)

  if (error?.code === 11000) {
    if (error.keyPattern?.email) {
      return res.status(400).json({ message: 'Email đã được sử dụng' })
    }
    if (error.keyPattern?.phone) {
      return res.status(400).json({ message: 'Số điện thoại đã được sử dụng' })
    }
  }

  return res.status(error.statusCode || 500).json({
    message: error.message || 'Lỗi máy chủ',
  })
}

const validateMockOAuthToken = (provider, token) => {
  if (!token || typeof token !== 'string') return false
  return token.startsWith(`${provider}-demo-`) || token === `${provider}-demo-token`
}

const buildAuthResponse = async (user) => {
  const accessToken = generateAccessToken(user._id, user.role)
  const refreshToken = generateRefreshToken(user._id)

  user.refreshToken = refreshToken
  await user.save({ validateBeforeSave: false })

  return {
    message: 'Đăng nhập thành công',
    accessToken,
    refreshToken,
    user,
  }
}

const createVerifiedUser = async (payload) => {
  const user = new User({
    name: payload.name,
    email: payload.email || null,
    phone: payload.phone || null,
    provider: payload.provider,
    isVerified: true,
    password: payload.passwordHash || null,
    role: 'member',
  })

  if (payload.passwordHash) {
    user.$locals.skipPasswordHashing = true
  }

  await user.save()
  return user
}

export const buildGoogleOauthRedirect = async (user) => {
  const accessToken = generateAccessToken(user._id, user.role)
  const refreshToken = generateRefreshToken(user._id)

  user.refreshToken = refreshToken
  await user.save({ validateBeforeSave: false })

  const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173'
  const redirectUrl = new URL('/oauth-success', frontendUrl)
  redirectUrl.searchParams.set('token', accessToken)

  return redirectUrl.toString()
}
export const buildFacebookOauthRedirect = async (user) => {
  const accessToken = generateAccessToken(user._id, user.role)
  const refreshToken = generateRefreshToken(user._id)

  user.refreshToken = refreshToken
  await user.save({ validateBeforeSave: false })

  const frontendUrl = process.env.CLIENT_URL || 'http://localhost:5173'
  const redirectUrl = new URL('/oauth-success', frontendUrl)
  redirectUrl.searchParams.set('token', accessToken)

  return redirectUrl.toString()
}
export const sendRegisterOtp = async (req, res) => {
  try {
    const { provider, name, phone, password } = req.body

    if (provider !== 'phone') {
      throw new AppError('Chỉ đăng ký bằng số điện thoại mới cần OTP', 400)
    }

    if (!name?.trim()) {
      throw new AppError('Họ tên là bắt buộc', 400)
    }

    const normalizedPhone = normalizePhone(phone)

    if (!isValidPhone(normalizedPhone)) {
      throw new AppError('Số điện thoại không hợp lệ', 400)
    }

    if (!password || password.length < 6) {
      throw new AppError('Mật khẩu phải có ít nhất 6 ký tự', 400)
    }

    const existingUser = await User.findOne({ phone: normalizedPhone })
    if (existingUser) {
      throw new AppError('Số điện thoại đã được sử dụng', 400)
    }

    const passwordHash = await hashPendingPassword(password)
    const otpResult = await sendOtp({
      identifier: normalizedPhone,
      purpose: 'register',
      channel: 'sms',
      provider: 'phone',
      payload: {
        name: name.trim(),
        phone: normalizedPhone,
        passwordHash,
        provider: 'phone',
      },
    })

    return res.json({
      message: 'Mã OTP đã được gửi qua SMS',
      expiresIn: otpResult.expiresIn,
      resendAfter: otpResult.resendAfter,
      otpPreview: otpResult.otpPreview,
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const verifyRegisterOtp = async (req, res) => {
  try {
    const { identifier, otp } = req.body
    const normalizedIdentifier = normalizeIdentifier(identifier)

    const otpRecord = await verifyOtp({
      identifier: normalizedIdentifier,
      purpose: 'register',
      otp,
    })

    const identityChecks = []
    if (otpRecord.payload.email) identityChecks.push({ email: otpRecord.payload.email })
    if (otpRecord.payload.phone) identityChecks.push({ phone: otpRecord.payload.phone })

    const existingUser = identityChecks.length
      ? await User.findOne({ $or: identityChecks })
      : null

    if (existingUser) {
      await consumeOtp(otpRecord._id)
      throw new AppError('Tài khoản đã tồn tại', 400)
    }

    const user = await createVerifiedUser(otpRecord.payload)
    await consumeOtp(otpRecord._id)

    const authPayload = await buildAuthResponse(user)

    return res.status(201).json({
      ...authPayload,
      message: 'Đăng ký tài khoản thành công',
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const registerFacebook = async (req, res) => {
  try {
    const { name, email, password, oauthToken } = req.body
    const normalizedEmail = email?.trim().toLowerCase()

    if (!name?.trim()) {
      throw new AppError('Họ tên là bắt buộc', 400)
    }

    if (!isValidEmail(normalizedEmail)) {
      throw new AppError('Email Facebook không hợp lệ', 400)
    }

    if (!validateMockOAuthToken('facebook', oauthToken)) {
      throw new AppError('Facebook token không hợp lệ', 401)
    }

    const existingUser = await User.findOne({ email: normalizedEmail })
    if (existingUser) {
      throw new AppError('Email đã được sử dụng', 400)
    }

    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      password: password || null,
      provider: 'facebook',
      isVerified: true,
      role: 'member',
    })

    await user.save()

    const authPayload = await buildAuthResponse(user)

    return res.status(201).json({
      ...authPayload,
      message: 'Đăng ký Facebook thành công',
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const login = async (req, res) => {
  try {
    const { identifier, password, oauthToken, provider } = req.body

    if (!identifier) {
      throw new AppError('Thiếu thông tin đăng nhập', 400)
    }

    const trimmed = identifier.trim()

    // Tự detect loại identifier
    let query
    if (trimmed.includes('@')) {
      // Email đầy đủ hoặc username dạng xxx@gmail.com
      query = { email: trimmed.toLowerCase() }
    } else if (/^(0|\+84)\d{9}$/.test(trimmed.replace(/\s/g, ''))) {
      // Số điện thoại
      query = { phone: normalizePhone(trimmed) }
    } else {
      // Username — tìm theo phần trước @ của email
      // VD: "daoxuanquyen333" → tìm email bắt đầu bằng "daoxuanquyen333@"
      query = { email: new RegExp(`^${trimmed}@`, 'i') }
    }

    const user = await User.findOne(query).select('+password +refreshToken')

    if (!user) {
      throw new AppError('Tài khoản không tồn tại', 401)
    }

    if (!user.isActive) {
      throw new AppError('Tài khoản đã bị khóa', 403)
    }

    if (oauthToken) {
      if (!validateMockOAuthToken(provider, oauthToken)) {
        throw new AppError('OAuth token không hợp lệ', 401)
      }
      return res.json(await buildAuthResponse(user))
    }

    if (!password) {
      throw new AppError('Thiếu mật khẩu', 400)
    }

    if (!user.password) {
      throw new AppError('Tài khoản chưa có mật khẩu. Vui lòng đăng nhập Google rồi vào Profile để đặt mật khẩu', 400)
    }

    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      throw new AppError('Mật khẩu không đúng', 401)
    }

    return res.json(await buildAuthResponse(user))
  } catch (error) {
    return sendError(res, error)
  }
}
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body

    if (!token) {
      throw new AppError('Refresh token là bắt buộc', 400)
    }

    const decoded = verifyRefreshToken(token)
    if (!decoded) {
      throw new AppError('Refresh token không hợp lệ hoặc đã hết hạn', 401)
    }

    const user = await User.findById(decoded.id).select('+refreshToken')
    if (!user || user.refreshToken !== token) {
      throw new AppError('Refresh token không hợp lệ hoặc đã hết hạn', 401)
    }

    const accessToken = generateAccessToken(user._id, user.role)
    const refreshTokenValue = generateRefreshToken(user._id)

    user.refreshToken = refreshTokenValue
    await user.save({ validateBeforeSave: false })

    return res.json({
      accessToken,
      refreshToken: refreshTokenValue,
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null })
    return res.json({ message: 'Đăng xuất thành công' })
  } catch (error) {
    return sendError(res, error)
  }
}

export const getMe = async (req, res) => {
  return res.json({ user: req.user })
}

export const updateProfile = async (req, res) => {
  try {
    const { name, phone, dateOfBirth } = req.body
    const updateData = {}

    if (name) updateData.name = name.trim()

    if (phone) {
      const normalizedPhone = normalizePhone(phone)
      if (!isValidPhone(normalizedPhone)) {
        throw new AppError('Số điện thoại không hợp lệ', 400)
      }
      updateData.phone = normalizedPhone
    }

    if (dateOfBirth) {
      const parsedDate = new Date(dateOfBirth)
      if (Number.isNaN(parsedDate.getTime())) {
        throw new AppError('Ngày sinh không hợp lệ', 400)
      }
      updateData.dateOfBirth = parsedDate
    }

    if (req.file) {
      updateData.avatar = req.file.path
    }

    const user = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true,
    })

    return res.json({ message: 'Cập nhật thông tin thành công', user })
  } catch (error) {
    return sendError(res, error)
  }
}

// Đặt mật khẩu lần đầu (dành cho tài khoản Google chưa có password)
export const setPassword = async (req, res) => {
  try {
    const { newPassword } = req.body

    if (!newPassword || newPassword.length < 6) {
      throw new AppError('Mật khẩu phải có ít nhất 6 ký tự', 400)
    }

    const user = await User.findById(req.user._id).select('+password')

    if (user.password) {
      throw new AppError('Tài khoản đã có mật khẩu, hãy dùng chức năng đổi mật khẩu', 400)
    }

    user.password = newPassword
    await user.save()

    return res.json({ message: 'Đặt mật khẩu thành công' })
  } catch (error) {
    return sendError(res, error)
  }
}

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!newPassword || newPassword.length < 6) {
      throw new AppError('Mật khẩu mới phải có ít nhất 6 ký tự', 400)
    }

    const user = await User.findById(req.user._id).select('+password')

    if (!user.password) {
      throw new AppError('Tài khoản chưa có mật khẩu, hãy dùng chức năng đặt mật khẩu', 400)
    }

    const isMatch = await user.comparePassword(currentPassword)
    if (!isMatch) {
      throw new AppError('Mật khẩu hiện tại không đúng', 400)
    }

    user.password = newPassword
    await user.save()

    return res.json({ message: 'Đổi mật khẩu thành công' })
  } catch (error) {
    return sendError(res, error)
  }
}

export const sendForgotPasswordOtp = async (req, res) => {
  try {
    const { identifier } = req.body
    const type = detectIdentifierType(identifier)
    const normalizedIdentifier = normalizeIdentifier(identifier)

    if (type === 'email' && !isValidEmail(normalizedIdentifier)) {
      throw new AppError('Email không hợp lệ', 400)
    }

    if (type === 'phone' && !isValidPhone(normalizedIdentifier)) {
      throw new AppError('Số điện thoại không hợp lệ', 400)
    }

    const user = await User.findOne(
      type === 'email' ? { email: normalizedIdentifier } : { phone: normalizedIdentifier },
    )

    if (!user) {
      throw new AppError('Không tìm thấy tài khoản', 404)
    }

    if (user.provider === 'facebook') {
      throw new AppError('Tài khoản Facebook không hỗ trợ quên mật khẩu bằng OTP', 400)
    }

    const otpResult = await sendOtp({
      identifier: normalizedIdentifier,
      purpose: 'forgot_password',
      channel: type === 'email' ? 'email' : 'sms',
      provider: user.provider,
      payload: {
        userId: user._id.toString(),
      },
    })

    return res.json({
      message: type === 'email' ? 'Mã OTP đã được gửi về email' : 'Mã OTP đã được gửi qua SMS',
      expiresIn: otpResult.expiresIn,
      resendAfter: otpResult.resendAfter,
      otpPreview: otpResult.otpPreview,
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const verifyForgotPasswordOtp = async (req, res) => {
  try {
    const { identifier, otp } = req.body
    const normalizedIdentifier = normalizeIdentifier(identifier)
    const otpRecord = await verifyOtp({
      identifier: normalizedIdentifier,
      purpose: 'forgot_password',
      otp,
    })

    const resetToken = generateResetToken({
      userId: otpRecord.payload.userId,
      identifier: normalizedIdentifier,
    })

    await consumeOtp(otpRecord._id)

    return res.json({
      message: 'Xác thực OTP thành công',
      resetToken,
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body

    if (!newPassword || newPassword.length < 6) {
      throw new AppError('Mật khẩu mới phải có ít nhất 6 ký tự', 400)
    }

    const decoded = verifyResetToken(resetToken)
    if (!decoded) {
      throw new AppError('Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn', 401)
    }

    const user = await User.findById(decoded.userId).select('+password')
    if (!user) {
      throw new AppError('Không tìm thấy tài khoản', 404)
    }

    user.password = newPassword
    user.isVerified = true
    await user.save()

    return res.json({ message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' })
  } catch (error) {
    return sendError(res, error)
  }
}

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
    return res.json({ users })
  } catch (error) {
    return sendError(res, error)
  }
}

export const enableSellerMode = async (req, res) => {
  try {
    if (!req.user.dateOfBirth) {
      throw new AppError('Vui lòng cập nhật ngày sinh trước khi bật chế độ bán hàng', 400)
    }

    const today = new Date()
    const birthDate = new Date(req.user.dateOfBirth)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age -= 1
    }

    if (age <= 20) {
      throw new AppError('Bạn phải trên 20 tuổi mới có thể bật chế độ bán hàng', 403)
    }

    let shop = await Shop.findOne({ user_id: req.user._id })

    if (!shop) {
      shop = await Shop.create({
        user_id: req.user._id,
        name: req.body?.shopName?.trim() || `${req.user.name || 'Seller'} Shop`,
        description: req.body?.description || '',
      })
    }

    req.user.isSeller = true
    req.user.role = 'seller'
    req.user.shopId = shop._id
    req.user.shop_id = shop._id
    await req.user.save()

    return res.json({
      message: 'Đã bật chế độ bán hàng',
      user: req.user,
      shop,
    })
  } catch (error) {
    return sendError(res, error)
  }
}

const isCurrentUser = (req) => req.user?._id?.toString() === req.params.id
const PROTECTED_ADMIN_EMAIL = 'daoxuanquyen333@gmail.com'

const findEditableUserById = async (id) => {
  const user = await User.findById(id)
  if (!user) {
    throw new AppError('Không tìm thấy người dùng', 404)
  }

  if (user.email?.toLowerCase() === PROTECTED_ADMIN_EMAIL) {
    throw new AppError('Tài khoản admin này được bảo vệ và không thể chỉnh sửa', 403)
  }

  return user
}

export const updateUserRole = async (req, res) => {
  try {
    if (isCurrentUser(req)) {
      throw new AppError('Bạn không thể chỉnh sửa chính tài khoản của mình', 403)
    }

    const { role } = req.body

    const normalizedRole = role === 'user' ? 'member' : role
    if (!['admin', 'pt', 'staff', 'member', 'seller'].includes(normalizedRole)) {
      throw new AppError('Role không hợp lệ', 400)
    }

    const user = await findEditableUserById(req.params.id)
    const previousRole = user.role

    if (normalizedRole === 'seller') {
      let shop = await Shop.findOne({ user_id: user._id })
      if (!shop) {
        shop = await Shop.create({
          user_id: user._id,
          name: `${user.name || 'Seller'} Shop`,
          description: '',
        })
      }
      user.isSeller = true
      user.shopId = shop._id
      user.shop_id = shop._id
    } else if (previousRole === 'seller' && normalizedRole !== 'seller') {
      user.isSeller = false
      user.shopId = null
      user.shop_id = null
    }

    user.role = normalizedRole
    await user.save()
    await recordAuditLog({
      req,
      module: 'users',
      action: 'update',
      entity: user,
      details: `Đổi role từ ${previousRole} sang ${normalizedRole}`,
    })

    return res.json({ message: 'Cập nhật role thành công', user })
  } catch (error) {
    return sendError(res, error)
  }
}

export const toggleUserStatus = async (req, res) => {
  try {
    if (isCurrentUser(req)) {
      throw new AppError('Bạn không thể khóa hoặc mở khóa chính tài khoản của mình', 403)
    }

    const user = await findEditableUserById(req.params.id)
    user.isActive = !user.isActive
    await user.save()
    await recordAuditLog({
      req,
      module: 'users',
      action: 'update',
      entity: user,
      details: user.isActive ? 'Mở khóa tài khoản' : 'Khóa tài khoản',
    })

    return res.json({
      message: `Tài khoản đã được ${user.isActive ? 'mở khóa' : 'khóa'}`,
      user,
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const deleteUser = async (req, res) => {
  try {
    if (isCurrentUser(req)) {
      throw new AppError('Bạn không thể xóa chính tài khoản của mình', 403)
    }

    const user = await findEditableUserById(req.params.id)
    await user.deleteOne()
    await recordAuditLog({
      req,
      module: 'users',
      action: 'delete',
      entity: user,
      details: 'Xóa tài khoản người dùng',
    })

    return res.json({ message: 'Xóa người dùng thành công' })
  } catch (error) {
    return sendError(res, error)
  }
}
