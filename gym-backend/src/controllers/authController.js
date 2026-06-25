import { invalidateAiPTCache } from '../ai/services/context/contextDataService.js'
import { buildClientUrl } from '../config/appUrls.js'
import Address from '../models/Address.js'
import Booking from '../models/Booking.js'
import Membership from '../models/Membership.js'
import Order from '../models/Order.js'
import Shop from '../models/Shop.js'
import User from '../models/User.js'
import { recordAuditLog } from '../services/auditLogService.js'
import { invalidateContextCache } from '../services/conversationContextCache.js'
import {
  consumeOtp,
  hashPendingPassword,
  sendOtp,
  verifyOtp,
} from '../services/otpService.js'
import { assertFeatureEnabled, getSystemSettingsValue } from '../services/systemSettingsService.js'
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
import { normalizeUserArrayMemberIdentity, normalizeUserMemberIdentity } from '../utils/memberIdentity.js'

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
    ...(error.code ? { code: error.code } : {}),
    message: error.message || 'Lỗi máy chủ',
  })
}

export const isAccountLocked = (user) =>
  user?.status === 'locked' || user?.isLocked === true || user?.isActive === false

const accountLockedError = () => new AppError('Account is locked', 403, 'ACCOUNT_LOCKED')

const getMaintenancePayload = (settings) => ({
  code: 'MAINTENANCE_MODE',
  message: {
    vi: 'Hệ thống đang bảo trì. Vui lòng quay lại sau.',
    en: 'The system is currently under maintenance. Please come back later.',
  },
  maintenanceMessage: settings.general.maintenanceMessage,
})

const isAdminUser = (user) => ['super_admin', 'admin'].includes(String(user?.role || '').toLowerCase())

const isMaintenanceBlocked = async (user) => {
  const settings = await getSystemSettingsValue()
  return settings.general.maintenanceMode && !isAdminUser(user) ? settings : null
}

const validateMockOAuthToken = (provider, token) => {
  if (!token || typeof token !== 'string') return false
  return token.startsWith(`${provider}-demo-`) || token === `${provider}-demo-token`
}

const refreshCookieName = 'refreshToken'

const getRefreshCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/api/auth',
  }
}

const setRefreshCookie = (res, token) => {
  res.cookie(refreshCookieName, token, getRefreshCookieOptions())
}

const clearRefreshCookie = (res) => {
  res.clearCookie(refreshCookieName, getRefreshCookieOptions())
}

const sanitizeUser = (user) => {
  const responseUser = normalizeUserMemberIdentity(user)
  delete responseUser.password
  delete responseUser.refreshToken
  return responseUser
}

const getUserDisplayName = (user, fallback = '') =>
  String(user?.fullName || user?.displayName || user?.name || user?.username || user?.email || fallback || '').trim()

const buildAuthResponse = async (user, res) => {
  const accessToken = generateAccessToken(user._id, user.role)
  const refreshToken = generateRefreshToken(user._id)

  user.refreshToken = refreshToken
  await user.save({ validateBeforeSave: false })
  if (res) setRefreshCookie(res, refreshToken)

  return {
    message: 'Đăng nhập thành công',
    accessToken,
    user: sanitizeUser(user),
  }
}

const createVerifiedUser = async (payload) => {
  const fullName = String(payload.fullName || payload.name || '').trim()
  const userPayload = {
    name: fullName,
    fullName,
    provider: payload.provider,
    isVerified: true,
    password: payload.passwordHash || null,
    role: 'member',
  }

  if (payload.email) userPayload.email = payload.email
  if (payload.phone) userPayload.phone = payload.phone

  const user = new User(userPayload)

  if (payload.passwordHash) {
    user.$locals.skipPasswordHashing = true
  }

  await user.save()
  return user
}

export const buildGoogleOauthRedirect = async (user, res) => {
  const maintenanceSettings = await isMaintenanceBlocked(user)
  if (maintenanceSettings) {
    return buildClientUrl('/oauth-success', { error: 'MAINTENANCE_MODE' })
  }

  const accessToken = generateAccessToken(user._id, user.role)
  const refreshToken = generateRefreshToken(user._id)

  user.refreshToken = refreshToken
  await user.save({ validateBeforeSave: false })
  if (res) setRefreshCookie(res, refreshToken)

  return buildClientUrl('/oauth-success', { token: accessToken })
}
export const buildFacebookOauthRedirect = async (user, res) => {
  const maintenanceSettings = await isMaintenanceBlocked(user)
  if (maintenanceSettings) {
    return buildClientUrl('/oauth-success', { error: 'MAINTENANCE_MODE' })
  }

  const accessToken = generateAccessToken(user._id, user.role)
  const refreshToken = generateRefreshToken(user._id)

  user.refreshToken = refreshToken
  await user.save({ validateBeforeSave: false })
  if (res) setRefreshCookie(res, refreshToken)

  return buildClientUrl('/oauth-success', { token: accessToken })
}
export const sendRegisterOtp = async (req, res) => {
  try {
    const settings = await getSystemSettingsValue()
    await assertFeatureEnabled('auth.allowRegistration')
    const { provider, name, fullName, phone, password } = req.body
    const displayName = String(fullName || name || '').trim()

    if (provider !== 'phone' && provider !== 'email') {
      throw new AppError('Chỉ đăng ký bằng số điện thoại hoặc email mới cần OTP', 400)
    }
    if (provider === 'phone' && !settings.auth.allowPhoneLogin) {
      await assertFeatureEnabled('auth.allowPhoneLogin')
    }
    if (provider === 'email' && !settings.auth.allowEmailUsernameLogin) {
      await assertFeatureEnabled('auth.allowEmailUsernameLogin')
    }

    if (!displayName) {
      throw new AppError('Họ tên là bắt buộc', 400)
    }

    if (!password || password.length < 6) {
      throw new AppError('Mật khẩu phải có ít nhất 6 ký tự', 400)
    }

    if (!phone?.trim()) {
      throw new AppError('Email hoặc số điện thoại là bắt buộc', 400)
    }

    const isEmail = provider === 'email'
    let normalizedIdentifier
    if (isEmail) {
      normalizedIdentifier = phone.trim().toLowerCase()
      if (!isValidEmail(normalizedIdentifier)) {
        throw new AppError('Email không hợp lệ', 400)
      }
    } else {
      normalizedIdentifier = normalizePhone(phone)
      if (!normalizedIdentifier) {
        throw new AppError('Số điện thoại là bắt buộc', 400)
      }
    }

    const existingUser = isEmail
      ? await User.findOne({ email: normalizedIdentifier })
      : await User.findOne({ phone: normalizedIdentifier })
    if (existingUser) {
      throw new AppError(isEmail ? 'Email đã được sử dụng' : 'Số điện thoại đã được sử dụng', 400)
    }

    const passwordHash = await hashPendingPassword(password)
    const otpResult = await sendOtp({
      identifier: normalizedIdentifier,
      purpose: 'register',
      channel: isEmail ? 'email' : 'sms',
      provider: isEmail ? 'email' : 'phone',
      ttlSeconds: settings.auth.otpExpiresInSeconds,
      exposePreview: settings.auth.demoOtpEnabled,
      payload: {
        name: displayName,
        fullName: displayName,
        ...(isEmail ? { email: normalizedIdentifier } : { phone: normalizedIdentifier }),
        passwordHash,
        provider: isEmail ? 'email' : 'phone',
      },
    })

    return res.json({
      message: isEmail ? 'Mã OTP đã được gửi qua email' : 'Mã OTP đã được gửi qua SMS',
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
    await assertFeatureEnabled('auth.allowRegistration')
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
      const duplicatedField = otpRecord.payload.email ? 'email' : 'phone'
      throw new AppError(
        duplicatedField === 'email'
          ? 'Email đã được sử dụng'
          : 'Số điện thoại đã được sử dụng',
        400,
      )
    }

    const user = await createVerifiedUser(otpRecord.payload)
    await consumeOtp(otpRecord._id)

    const authPayload = await buildAuthResponse(user, res)

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
    await assertFeatureEnabled('auth.allowRegistration')
    await assertFeatureEnabled('auth.facebookOAuthEnabled')
    const { name, fullName, email, password, oauthToken } = req.body
    const normalizedEmail = email?.trim().toLowerCase()
    const displayName = String(fullName || name || '').trim()

    if (!displayName) {
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
      name: displayName,
      fullName: displayName,
      email: normalizedEmail,
      password: password || null,
      provider: 'facebook',
      isVerified: true,
      role: 'member',
    })

    await user.save()

    const authPayload = await buildAuthResponse(user, res)

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
    const settings = await getSystemSettingsValue()
    const { identifier, password, oauthToken, provider } = req.body

    if (!identifier) {
      throw new AppError('Thiếu thông tin đăng nhập', 400)
    }

    const trimmed = identifier.trim()
    const isPhoneLogin = /^(0|\+84)\d{9}$/.test(trimmed.replace(/\s/g, ''))
    if (isPhoneLogin && !settings.auth.allowPhoneLogin) {
      await assertFeatureEnabled('auth.allowPhoneLogin')
    }
    if (!isPhoneLogin && !settings.auth.allowEmailUsernameLogin) {
      await assertFeatureEnabled('auth.allowEmailUsernameLogin')
    }
    if (oauthToken) {
      await assertFeatureEnabled(provider === 'facebook' ? 'auth.facebookOAuthEnabled' : 'auth.googleOAuthEnabled')
    }

    // Tự detect loại identifier
    let query
    if (trimmed.includes('@')) {
      // Email đầy đủ hoặc username dạng xxx@gmail.com
      query = { email: trimmed.toLowerCase() }
    } else if (isPhoneLogin) {
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

    if (isAccountLocked(user)) {
      throw accountLockedError()
    }

    if (oauthToken) {
      if (!validateMockOAuthToken(provider, oauthToken)) {
        throw new AppError('OAuth token không hợp lệ', 401)
      }
      const maintenanceSettings = await isMaintenanceBlocked(user)
      if (maintenanceSettings) {
        return res.status(503).json(getMaintenancePayload(maintenanceSettings))
      }
      return res.json(await buildAuthResponse(user, res))
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

    const maintenanceSettings = await isMaintenanceBlocked(user)
    if (maintenanceSettings) {
      return res.status(503).json(getMaintenancePayload(maintenanceSettings))
    }

    return res.json(await buildAuthResponse(user, res))
  } catch (error) {
    return sendError(res, error)
  }
}
export const refreshToken = async (req, res) => {
  try {
    const token = req.cookies?.[refreshCookieName] || req.body?.refreshToken

    if (!token) {
      throw new AppError('Refresh token là bắt buộc', 401)
    }

    const decoded = verifyRefreshToken(token)
    if (!decoded) {
      throw new AppError('Refresh token không hợp lệ hoặc đã hết hạn', 401)
    }

    const user = await User.findById(decoded.id).select('+refreshToken')
    if (!user || user.refreshToken !== token) {
      clearRefreshCookie(res)
      throw new AppError('Refresh token không hợp lệ hoặc đã hết hạn', 401)
    }

    if (isAccountLocked(user)) {
      user.refreshToken = null
      await user.save({ validateBeforeSave: false })
      clearRefreshCookie(res)
      throw accountLockedError()
    }

    const accessToken = generateAccessToken(user._id, user.role)
    const refreshTokenValue = generateRefreshToken(user._id)

    user.refreshToken = refreshTokenValue
    await user.save({ validateBeforeSave: false })
    setRefreshCookie(res, refreshTokenValue)

    return res.json({
      accessToken,
      user: sanitizeUser(user),
    })
  } catch (error) {
    clearRefreshCookie(res)
    return sendError(res, error)
  }
}

export const logout = async (req, res) => {
  try {
    const token = req.cookies?.[refreshCookieName] || req.body?.refreshToken
    if (token) {
      const decoded = verifyRefreshToken(token)
      if (decoded?.id) {
        await User.findByIdAndUpdate(decoded.id, { refreshToken: null })
      } else {
        await User.findOneAndUpdate({ refreshToken: token }, { refreshToken: null })
      }
    } else if (req.user?._id) {
      await User.findByIdAndUpdate(req.user._id, { refreshToken: null })
    }
    clearRefreshCookie(res)
    return res.json({ message: 'Đăng xuất thành công' })
  } catch (error) {
    clearRefreshCookie(res)
    return sendError(res, error)
  }
}

const passwordStrengthRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

const validatePasswordStrength = (password) => {
  if (!passwordStrengthRegex.test(password)) {
    throw new AppError(
      'Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số',
      400,
    )
  }
}

export const getMe = async (req, res) => {
  const user = await User.findById(req.user._id).select('+password')
  const hasPassword = !!user?.password
  const responseUser = normalizeUserMemberIdentity(user || req.user)
  delete responseUser.password
  delete responseUser.refreshToken

  // Privacy: only admin/super_admin can see full identity numbers; others see masked
  if (!['super_admin', 'admin'].includes(req.user.role) && responseUser.identityNumber) {
    const num = responseUser.identityNumber
    responseUser.identityNumber = num.length > 4 ? '*'.repeat(num.length - 4) + num.slice(-4) : '****'
  }
  // Strip sensitive identity fields for non-admin/super_admin
  if (!['super_admin', 'admin'].includes(req.user.role)) {
    delete responseUser.identityFrontImage
    delete responseUser.identityBackImage
  }

  return res.json({ user: { ...responseUser, hasPassword } })
}

export const hasPassword = async (req, res) => {
  const user = await User.findById(req.user._id).select('+password')
  return res.json({ hasPassword: !!user?.password })
}

export const updateProfile = async (req, res) => {
  try {
    await assertFeatureEnabled('members.allowProfileUpdate')
    const {
      name, phone, email, dateOfBirth, themePreference, accentColor,
      fullName, gender, nationality, language, timezone,
      country, province, detailedAddress,
      emergencyName, emergencyPhone,
      height, weight, goals, activityLevel, healthNotes,
      documentType, documentNumber,
      identityType, identityNumber, identityCountry,
      emergencyRelationship,
    } = req.body
    const updateData = {}

    const normalizedFullName = fullName !== undefined ? fullName.trim() : undefined
    if (name) updateData.name = name.trim()
    if (normalizedFullName !== undefined) {
      updateData.fullName = normalizedFullName
      if (!name && normalizedFullName) updateData.name = normalizedFullName
    }
    if (gender !== undefined) updateData.gender = gender
    if (nationality !== undefined) updateData.nationality = nationality.trim()
    if (language !== undefined) updateData.language = language
    if (timezone !== undefined) updateData.timezone = timezone.trim()
    if (country !== undefined) updateData.country = country.trim()
    if (province !== undefined) updateData.province = province.trim()
    if (detailedAddress !== undefined) updateData.detailedAddress = detailedAddress.trim()

    if (emergencyName !== undefined || emergencyPhone !== undefined || emergencyRelationship !== undefined) {
      updateData['emergencyContact.name'] = (emergencyName || '').trim()
      updateData['emergencyContact.phone'] = (emergencyPhone || '').trim()
      updateData['emergencyContact.relationship'] = (emergencyRelationship || '').trim()
    }

    if (height !== undefined) updateData['healthInfo.height'] = height === '' ? null : Number(height)
    if (weight !== undefined) updateData['healthInfo.weight'] = weight === '' ? null : Number(weight)
    if (goals !== undefined) {
      updateData['healthInfo.goals'] = Array.isArray(goals) ? goals : goals ? [goals] : []
    }
    if (activityLevel !== undefined) updateData['healthInfo.activityLevel'] = activityLevel
    if (healthNotes !== undefined) updateData['healthInfo.notes'] = healthNotes.trim()

    if (documentType !== undefined) updateData.identityType = documentType
    if (documentNumber !== undefined) updateData.identityNumber = documentNumber.trim()
    if (identityType !== undefined) updateData.identityType = identityType
    if (identityNumber !== undefined) updateData.identityNumber = identityNumber.trim()
    if (identityCountry !== undefined) updateData.identityCountry = identityCountry.trim()

    if (req.files?.identityFrontImage?.[0]) {
      updateData.identityFrontImage = req.files.identityFrontImage[0].path
    }
    if (req.files?.identityBackImage?.[0]) {
      updateData.identityBackImage = req.files.identityBackImage[0].path
    }

    if (email !== undefined) {
      const normalizedEmail = email?.trim().toLowerCase()
      if (!normalizedEmail) {
        throw new AppError('Email không được để trống', 400)
      }
      if (!isValidEmail(normalizedEmail)) {
        throw new AppError('Email không hợp lệ', 400)
      }
      if (req.user.email && req.user.email !== normalizedEmail) {
        throw new AppError('Email của tài khoản này không thể chỉnh sửa', 400)
      }
      const existingEmailUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: req.user._id },
      })
      if (existingEmailUser) {
        throw new AppError('Email đã được sử dụng', 400)
      }
      updateData.email = normalizedEmail
    }

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

    if (themePreference !== undefined) {
      if (!['system', 'light', 'dark'].includes(themePreference)) {
        throw new AppError('Tuỳ chọn giao diện không hợp lệ', 400)
      }
      updateData.themePreference = themePreference
    }

    if (accentColor !== undefined) {
      const normalizedAccent = String(accentColor).trim()
      if (normalizedAccent === '') {
        updateData.accentColor = ''
      } else if (!/^#[0-9A-Fa-f]{6}$/.test(normalizedAccent)) {
        throw new AppError('Màu chủ đạo không hợp lệ', 400)
      } else {
        updateData.accentColor = normalizedAccent.toUpperCase()
      }
    }

    if (req.files?.avatar?.[0]) {
      await assertFeatureEnabled('members.allowAvatarUpload')
      updateData.avatar = req.files.avatar[0].path
    } else if (req.file) {
      await assertFeatureEnabled('members.allowAvatarUpload')
      updateData.avatar = req.file.path
    }

    if (req.files?.coverImage?.[0]) {
      updateData.coverImage = req.files.coverImage[0].path
    }

    if (req.body.removeCoverImage === 'true') {
      updateData.coverImage = null
    }

    const user = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true,
    })
    if (!user) {
      throw new AppError('Không tìm thấy người dùng để cập nhật', 404)
    }
    // Invalidate AI cache if user is PT and profile was updated
    if (user.role === 'pt') {
      invalidateAiPTCache()
      invalidateContextCache('ptAvailability', { userId: String(user._id) })
    }
    return res.json({ message: 'Cập nhật thông tin thành công', user })
  } catch (error) {
    return sendError(res, error)
  }
}

// Đặt mật khẩu lần đầu (dành cho tài khoản Google chưa có password)
export const setPassword = async (req, res) => {
  try {
    const { newPassword } = req.body

    if (!newPassword) {
      throw new AppError('Mật khẩu mới là bắt buộc', 400)
    }

    validatePasswordStrength(newPassword)

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

    if (!currentPassword) {
      throw new AppError('Mật khẩu hiện tại là bắt buộc', 400)
    }
    if (!newPassword) {
      throw new AppError('Mật khẩu mới là bắt buộc', 400)
    }

    validatePasswordStrength(newPassword)

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
    const settings = await getSystemSettingsValue()
    const { identifier } = req.body
    const type = detectIdentifierType(identifier)
    const normalizedIdentifier = normalizeIdentifier(identifier)

    if (type === 'email' && !isValidEmail(normalizedIdentifier)) {
      throw new AppError('Email không hợp lệ', 400)
    }
    if (type === 'email' && !settings.auth.forgotPasswordEmailEnabled) {
      await assertFeatureEnabled('auth.forgotPasswordEmailEnabled')
    }

    if (type === 'phone' && !isValidPhone(normalizedIdentifier)) {
      throw new AppError('Số điện thoại không hợp lệ', 400)
    }
    if (type === 'phone' && !settings.auth.forgotPasswordSmsOtpEnabled) {
      await assertFeatureEnabled('auth.forgotPasswordSmsOtpEnabled')
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
      ttlSeconds: settings.auth.otpExpiresInSeconds,
      exposePreview: settings.auth.demoOtpEnabled,
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

export const requestPasswordResetOtp = async (req, res) => {
  try {
    const settings = await getSystemSettingsValue()
    const { method } = req.body

    if (!method || !['email', 'phone'].includes(method)) {
      throw new AppError('Phương thức không hợp lệ', 400)
    }

    const user = await User.findById(req.user._id)
    if (!user) {
      throw new AppError('Không tìm thấy tài khoản', 404)
    }

    const identifier = method === 'email' ? user.email : user.phone
    if (!identifier) {
      throw new AppError(
        method === 'email' ? 'Tài khoản chưa có email' : 'Tài khoản chưa có số điện thoại',
        400,
      )
    }

    const channel = method === 'email' ? 'email' : 'sms'

    const otpResult = await sendOtp({
      identifier,
      purpose: 'password_reset',
      channel,
      provider: user.provider,
      ttlSeconds: settings.auth.otpExpiresInSeconds,
      exposePreview: settings.auth.demoOtpEnabled,
      payload: {
        userId: user._id.toString(),
      },
    })

    return res.json({
      message: method === 'email' ? 'Mã OTP đã được gửi về email' : 'Mã OTP đã được gửi qua SMS',
      expiresIn: otpResult.expiresIn,
      resendAfter: otpResult.resendAfter,
      otpPreview: otpResult.otpPreview,
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const resetPasswordWithOtp = async (req, res) => {
  try {
    const { method, otp, newPassword } = req.body

    if (!method || !['email', 'phone'].includes(method)) {
      throw new AppError('Phương thức không hợp lệ', 400)
    }
    if (!otp) {
      throw new AppError('Mã OTP là bắt buộc', 400)
    }
    if (!newPassword || newPassword.length < 6) {
      throw new AppError('Mật khẩu mới phải có ít nhất 6 ký tự', 400)
    }

    validatePasswordStrength(newPassword)

    const user = await User.findById(req.user._id)
    if (!user) {
      throw new AppError('Không tìm thấy tài khoản', 404)
    }

    const identifier = method === 'email' ? user.email : user.phone
    if (!identifier) {
      throw new AppError(
        method === 'email' ? 'Tài khoản chưa có email' : 'Tài khoản chưa có số điện thoại',
        400,
      )
    }

    const otpRecord = await verifyOtp({
      identifier,
      purpose: 'password_reset',
      otp,
    })

    await consumeOtp(otpRecord._id)

    user.password = newPassword
    await user.save()

    return res.json({ message: 'Đặt lại mật khẩu thành công' })
  } catch (error) {
    return sendError(res, error)
  }
}

export const requestEmailChangeOtp = async (req, res) => {
  try {
    const settings = await getSystemSettingsValue()
    const { newEmail } = req.body

    if (!newEmail || !isValidEmail(newEmail)) {
      throw new AppError('Email mới không hợp lệ', 400)
    }

    const user = await User.findById(req.user._id)
    if (!user) {
      throw new AppError('Không tìm thấy tài khoản', 404)
    }

    if (newEmail.toLowerCase() === user.email?.toLowerCase()) {
      throw new AppError('Email mới trùng với email hiện tại', 400)
    }

    const existingUser = await User.findOne({ email: newEmail.toLowerCase() })
    if (existingUser) {
      throw new AppError('Email đã được sử dụng bởi tài khoản khác', 400)
    }

    if (!user.email) {
      throw new AppError('Tài khoản chưa có email để nhận OTP', 400)
    }

    const otpResult = await sendOtp({
      identifier: user.email,
      purpose: 'email_change',
      channel: 'email',
      provider: user.provider,
      ttlSeconds: settings.auth.otpExpiresInSeconds,
      exposePreview: settings.auth.demoOtpEnabled,
      payload: {
        userId: user._id.toString(),
        newEmail: newEmail.toLowerCase(),
      },
    })

    return res.json({
      message: 'Mã OTP đã được gửi về email hiện tại',
      expiresIn: otpResult.expiresIn,
      resendAfter: otpResult.resendAfter,
      otpPreview: otpResult.otpPreview,
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const confirmEmailChange = async (req, res) => {
  try {
    const { newEmail, otp } = req.body

    if (!newEmail || !isValidEmail(newEmail)) {
      throw new AppError('Email mới không hợp lệ', 400)
    }
    if (!otp) {
      throw new AppError('Mã OTP là bắt buộc', 400)
    }

    const user = await User.findById(req.user._id)
    if (!user) {
      throw new AppError('Không tìm thấy tài khoản', 404)
    }

    if (!user.email) {
      throw new AppError('Tài khoản chưa có email', 400)
    }

    const otpRecord = await verifyOtp({
      identifier: user.email,
      purpose: 'email_change',
      otp,
    })

    const storedNewEmail = otpRecord.payload?.newEmail
    if (!storedNewEmail || storedNewEmail.toLowerCase() !== newEmail.toLowerCase()) {
      throw new AppError('Email không khớp với yêu cầu đổi email', 400)
    }

    await consumeOtp(otpRecord._id)

    user.email = newEmail.toLowerCase()
    await user.save()

    return res.json({ message: 'Đổi email thành công', email: user.email })
  } catch (error) {
    return sendError(res, error)
  }
}

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
    return res.json({ users: normalizeUserArrayMemberIdentity(users) })
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
        name: req.body?.shopName?.trim() || `${getUserDisplayName(req.user, 'Seller')} Shop`,
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

  const settings = await getSystemSettingsValue()
  if (settings.members.protectPrimaryAdmin && user.email?.toLowerCase() === PROTECTED_ADMIN_EMAIL) {
    throw new AppError('Tài khoản Super Admin này được bảo vệ và không thể chỉnh sửa', 403)
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
    if (!['super_admin', 'admin', 'pt', 'staff', 'member', 'seller'].includes(normalizedRole)) {
      throw new AppError('Role không hợp lệ', 400)
    }

    const user = await findEditableUserById(req.params.id)
    const previousRole = user.role

    // Only super_admin can modify admin or super_admin users
    if (['super_admin', 'admin'].includes(user.role) && req.user.role !== 'super_admin') {
      throw new AppError('Chỉ Super Admin mới có quyền thao tác với Admin khác', 403)
    }
    // Only super_admin can set role to admin or super_admin
    if (['super_admin', 'admin'].includes(normalizedRole) && req.user.role !== 'super_admin') {
      throw new AppError('Chỉ Super Admin mới có quyền cấp quyền Admin hoặc Super Admin', 403)
    }

    if (normalizedRole === 'seller') {
      let shop = await Shop.findOne({ user_id: user._id })
      if (!shop) {
        shop = await Shop.create({
          user_id: user._id,
          name: `${getUserDisplayName(user, 'Seller')} Shop`,
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

    // Invalidate AI PT cache if role changed to/from PT
    if (previousRole === 'pt' || normalizedRole === 'pt') {
      invalidateAiPTCache()
      invalidateContextCache('ptAvailability', { userId: String(user._id) })
    }

    return res.json({ message: 'Cập nhật role thành công', user })
  } catch (error) {
    return sendError(res, error)
  }
}

export const toggleUserStatus = async (req, res) => {
  try {
    await assertFeatureEnabled('members.allowAccountLockToggle')
    if (isCurrentUser(req)) {
      throw new AppError('Bạn không thể khóa hoặc mở khóa chính tài khoản của mình', 403)
    }

    const user = await findEditableUserById(req.params.id)

    // Only super_admin can lock/unlock admin or super_admin users
    if (['super_admin', 'admin'].includes(user.role) && req.user.role !== 'super_admin') {
      throw new AppError('Chỉ Super Admin mới có quyền thao tác với Admin khác', 403)
    }

    user.isActive = !user.isActive
    user.isLocked = !user.isActive
    user.status = user.isActive ? 'active' : 'locked'
    await user.save()
    await recordAuditLog({
      req,
      module: 'users',
      action: 'update',
      entity: user,
      details: user.isActive ? 'Mở khóa tài khoản' : 'Khóa tài khoản',
    })

    // Invalidate AI cache if PT is locked/unlocked (changes visibility in AI response)
    if (user.role === 'pt') {
      invalidateAiPTCache()
      invalidateContextCache('ptAvailability', { userId: String(user._id) })
    }

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

    // Only super_admin can delete admin or super_admin users
    if (['super_admin', 'admin'].includes(user.role) && req.user.role !== 'super_admin') {
      throw new AppError('Chỉ Super Admin mới có quyền thao tác với Admin khác', 403)
    }

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

export const getPendingVerifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query
    const query = {
      identityType: { $ne: '' },
      identityStatus: { $in: ['', 'pending'] },
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { identityNumber: { $regex: search, $options: 'i' } },
      ]
    }
    const skip = (Number(page) - 1) * Number(limit)
    const [users, total] = await Promise.all([
      User.find(query)
        .select('name fullName displayName email avatar identityType identityNumber identityCountry identityFrontImage identityBackImage identityStatus identityRejectReason createdAt')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(query),
    ])
    return res.json({
      data: users,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const approveVerification = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) throw new AppError('Không tìm thấy người dùng', 404)
    if (!user.identityType) throw new AppError('Người dùng chưa gửi giấy tờ xác minh', 400)

    user.identityStatus = 'approved'
    user.identityReviewedBy = req.user._id
    user.identityReviewedAt = new Date()
    await user.save()

    await recordAuditLog({
      req,
      module: 'users',
      action: 'update',
      entity: user,
      details: `Duyệt xác minh giấy tờ: ${user.identityType} - ${user.identityNumber ? '***' + user.identityNumber.slice(-4) : ''}`,
    })

    return res.json({ message: 'Xác minh giấy tờ đã được duyệt', user })
  } catch (error) {
    return sendError(res, error)
  }
}

export const rejectVerification = async (req, res) => {
  try {
    const { reason } = req.body
    if (!reason) throw new AppError('Vui lòng nhập lý do từ chối', 400)

    const user = await User.findById(req.params.id)
    if (!user) throw new AppError('Không tìm thấy người dùng', 404)
    if (!user.identityType) throw new AppError('Người dùng chưa gửi giấy tờ xác minh', 400)

    user.identityStatus = 'rejected'
    user.identityRejectReason = reason.trim()
    user.identityReviewedBy = req.user._id
    user.identityReviewedAt = new Date()
    await user.save()

    await recordAuditLog({
      req,
      module: 'users',
      action: 'update',
      entity: user,
      details: `Từ chối xác minh giấy tờ: ${reason}`,
    })

    return res.json({ message: 'Đã từ chối xác minh giấy tờ', user })
  } catch (error) {
    return sendError(res, error)
  }
}

export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) {
      throw new AppError('Không tìm thấy người dùng', 404)
    }

    // Permission check: Admin cannot view details of other Admins or Super Admins
    if (req.user.role === 'admin') {
      if (user.role === 'admin' || user.role === 'super_admin') {
        if (req.user._id.toString() !== user._id.toString()) {
          throw new AppError('Bạn không có quyền xem chi tiết quản trị viên khác', 403)
        }
      }
    }

    // Fetch related data
    const addresses = await Address.find({ userId: user._id })
    const activeMembership = await Membership.findOne({
      memberId: user._id,
      status: 'active',
    }).populate('planId')

    const membershipHistory = await Membership.find({
      memberId: user._id,
    }).populate('planId').sort({ createdAt: -1 })

    const recentBookings = await Booking.find({
      memberId: user._id,
    }).populate('ptId', 'name fullName displayName email avatar phone').sort({ date: -1 }).limit(10)

    const orderHistory = await Order.find({
      userId: user._id,
    }).sort({ createdAt: -1 }).limit(10)

    const totalWorkouts = await Booking.countDocuments({
      memberId: user._id,
      status: 'completed',
    })

    return res.json({
      user: normalizeUserMemberIdentity(user),
      addresses,
      activeMembership,
      membershipHistory,
      recentBookings,
      orderHistory,
      totalWorkouts,
    })
  } catch (error) {
    return sendError(res, error)
  }
}
