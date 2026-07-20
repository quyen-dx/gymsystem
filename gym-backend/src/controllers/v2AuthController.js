import AppError from '../utils/appError.js'
import { sendSuccess } from '../utils/responseHelper.js'
import catchAsync from '../utils/catchAsync.js'
import * as authService from '../services/authService.js'

const REFRESH_COOKIE_NAME = 'refreshToken'

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/v1/auth',
}

const setRefreshCookie = (res, token, expiresAt) => {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...REFRESH_COOKIE_OPTIONS,
    expires: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  })
}

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS)
}

export const register = catchAsync(async (req, res) => {
  const user = await authService.register(req.body)
  sendSuccess(res, { user }, 201)
})

export const login = catchAsync(async (req, res) => {
  const result = await authService.login(req.body.email, req.body.password, {
    userAgent: req.headers['user-agent'] || '',
    ip: req.ip || '',
    platform: req.headers['sec-ch-ua-platform'] || '',
  })

  setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt)

  sendSuccess(res, {
    accessToken: result.accessToken,
    user: result.user,
  })
})

export const refresh = catchAsync(async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME]
  if (!rawToken) {
    throw new AppError('Refresh token is required', 401, 'AUTH_INVALID_TOKEN')
  }

  const result = await authService.refreshAccessToken(rawToken)

  setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt)

  sendSuccess(res, {
    accessToken: result.accessToken,
  })
})

export const logout = catchAsync(async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME]
  await authService.logout(rawToken)
  clearRefreshCookie(res)
  sendSuccess(res, { message: 'Đăng xuất thành công' })
})

export const logoutAll = catchAsync(async (req, res) => {
  await authService.logoutAll(req.user._id)
  clearRefreshCookie(res)
  sendSuccess(res, { message: 'Đã đăng xuất khỏi tất cả thiết bị' })
})

export const verifyEmail = catchAsync(async (req, res) => {
  const { email, otp } = req.body
  await authService.verifyEmail(email, otp)
  sendSuccess(res, { message: 'Xác thực email thành công' })
})

export const resendVerification = catchAsync(async (req, res) => {
  const result = await authService.resendVerificationOtp(req.body.email)
  sendSuccess(res, result)
})

export const forgotPassword = catchAsync(async (req, res) => {
  const result = await authService.forgotPassword(req.body.email)
  sendSuccess(res, result)
})

export const resetPassword = catchAsync(async (req, res) => {
  const { token, password } = req.body
  await authService.resetPassword(token, password)
  sendSuccess(res, { message: 'Đặt lại mật khẩu thành công' })
})
