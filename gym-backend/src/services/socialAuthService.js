import SocialAccount from '../models/SocialAccount.js'
import User from '../models/User.js'
import AppError from '../utils/appError.js'
import logger from '../config/logger.js'
import * as tokenService from './tokenService.js'

const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo?id_token='
const FACEBOOK_DEBUG_URL = 'https://graph.facebook.com/debug_token'

const fetchGoogleTokenInfo = async (idToken) => {
  try {
    const response = await fetch(`${GOOGLE_TOKENINFO_URL}${idToken}`)
    if (!response.ok) {
      throw new AppError('Google token không hợp lệ', 401, 'SOCIAL_INVALID_TOKEN')
    }
    return response.json()
  } catch (err) {
    if (err instanceof AppError) throw err
    throw new AppError('Không thể xác thực Google token', 502, 'SOCIAL_VERIFY_FAILED')
  }
}

const fetchFacebookTokenInfo = async (accessToken) => {
  try {
    const appAccessToken = `${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}`
    const url = `${FACEBOOK_DEBUG_URL}?input_token=${accessToken}&access_token=${appAccessToken}`
    const response = await fetch(url)
    if (!response.ok) {
      throw new AppError('Facebook token không hợp lệ', 401, 'SOCIAL_INVALID_TOKEN')
    }
    const data = await response.json()
    if (data.data?.error) {
      throw new AppError('Facebook token không hợp lệ', 401, 'SOCIAL_INVALID_TOKEN')
    }
    return data.data
  } catch (err) {
    if (err instanceof AppError) throw err
    throw new AppError('Không thể xác thực Facebook token', 502, 'SOCIAL_VERIFY_FAILED')
  }
}

export const loginWithGoogle = async (userId, passportProfile) => {
  const providerId = passportProfile?.id
  if (!providerId) {
    logger.warn('loginWithGoogle called without profile id', { userId })
    return
  }

  const existing = await SocialAccount.findOne({ provider: 'google', providerId })

  if (existing) {
    if (existing.userId.toString() !== userId.toString()) {
      logger.error('Google account already linked to different user', {
        providerId,
        existingUserId: existing.userId,
        requestedUserId: userId,
      })
      throw new AppError('Tài khoản Google này đã được liên kết với người dùng khác', 409, 'SOCIAL_ALREADY_LINKED')
    }

    existing.profileUrl = passportProfile.photos?.[0]?.value || existing.profileUrl
    existing.metadata = passportProfile._json || existing.metadata
    await existing.save()
    return existing
  }

  await SocialAccount.create({
    userId,
    provider: 'google',
    providerId,
    profileUrl: passportProfile.photos?.[0]?.value || null,
    metadata: passportProfile._json || {},
  })

  logger.info('Google SocialAccount created', { userId, providerId })
}

export const loginWithFacebook = async (userId, passportProfile) => {
  const providerId = passportProfile?.id
  if (!providerId) {
    logger.warn('loginWithFacebook called without profile id', { userId })
    return
  }

  const existing = await SocialAccount.findOne({ provider: 'facebook', providerId })

  if (existing) {
    if (existing.userId.toString() !== userId.toString()) {
      logger.error('Facebook account already linked to different user', {
        providerId,
        existingUserId: existing.userId,
        requestedUserId: userId,
      })
      throw new AppError('Tài khoản Facebook này đã được liên kết với người dùng khác', 409, 'SOCIAL_ALREADY_LINKED')
    }

    existing.profileUrl = passportProfile.profileUrl || passportProfile.photos?.[0]?.value || existing.profileUrl
    existing.metadata = passportProfile._json || existing.metadata
    await existing.save()
    return existing
  }

  await SocialAccount.create({
    userId,
    provider: 'facebook',
    providerId,
    profileUrl: passportProfile.profileUrl || passportProfile.photos?.[0]?.value || null,
    metadata: passportProfile._json || {},
  })

  logger.info('Facebook SocialAccount created', { userId, providerId })
}

export const linkSocialAccount = async (userId, provider, token) => {
  if (!['google', 'facebook'].includes(provider)) {
    throw new AppError('Nhà cung cấp không hợp lệ', 400, 'SOCIAL_INVALID_PROVIDER')
  }

  let providerId

  if (provider === 'google') {
    const tokenInfo = await fetchGoogleTokenInfo(token)
    providerId = tokenInfo.sub
    if (!providerId) {
      throw new AppError('Google token không chứa thông tin người dùng', 400, 'SOCIAL_INVALID_TOKEN')
    }
  } else {
    const tokenInfo = await fetchFacebookTokenInfo(token)
    providerId = tokenInfo.user_id
    if (!providerId) {
      throw new AppError('Facebook token không chứa thông tin người dùng', 400, 'SOCIAL_INVALID_TOKEN')
    }
  }

  const existing = await SocialAccount.findOne({ provider, providerId })
  if (existing) {
    if (existing.userId.toString() === userId.toString()) {
      throw new AppError('Tài khoản này đã được liên kết', 409, 'SOCIAL_ALREADY_LINKED')
    }
    throw new AppError('Tài khoản mạng xã hội này đã được liên kết với người dùng khác', 409, 'SOCIAL_ALREADY_LINKED')
  }

  const user = await User.findById(userId)
  if (!user) {
    throw new AppError('Người dùng không tồn tại', 404, 'AUTH_USER_NOT_FOUND')
  }

  await SocialAccount.create({
    userId,
    provider,
    providerId,
  })

  if (provider === 'google') {
    user.googleId = providerId
  } else {
    user.facebookId = providerId
  }
  user.provider = user.provider || provider
  await user.save({ validateBeforeSave: false })

  logger.info('Social account linked', { userId, provider, providerId })
}

export const unlinkSocialAccount = async (userId, provider) => {
  if (!['google', 'facebook'].includes(provider)) {
    throw new AppError('Nhà cung cấp không hợp lệ', 400, 'SOCIAL_INVALID_PROVIDER')
  }

  const socialAccount = await SocialAccount.findOne({ userId, provider })
  if (!socialAccount) {
    throw new AppError('Tài khoản mạng xã hội không tồn tại', 404, 'SOCIAL_NOT_FOUND')
  }

  const user = await User.findById(userId).select('+password +passwordHash')
  if (!user) {
    throw new AppError('Người dùng không tồn tại', 404, 'AUTH_USER_NOT_FOUND')
  }

  const hasPassword = !!(user.password || user.passwordHash)
  const otherSocialCount = await SocialAccount.countDocuments({
    userId,
    provider: { $ne: provider },
  })

  if (!hasPassword && otherSocialCount === 0) {
    throw new AppError(
      'Bạn cần có ít nhất một phương thức đăng nhập khác (mật khẩu hoặc tài khoản mạng xã hội khác) trước khi hủy liên kết',
      400,
      'SOCIAL_LAST_AUTH_METHOD',
    )
  }

  await SocialAccount.findByIdAndDelete(socialAccount._id)

  if (provider === 'google') {
    user.googleId = undefined
  } else {
    user.facebookId = undefined
    user.facebookProfileUrl = undefined
  }
  await user.save({ validateBeforeSave: false })

  logger.info('Social account unlinked', { userId, provider })
}
