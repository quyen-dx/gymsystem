import type { AuthProviderType, LoginPayload } from '../context/auth.context'
import api, { getRefreshToken } from './api'

export const authService = {
  sendRegisterOtp: (data: {
    provider: Extract<AuthProviderType, 'phone' | 'email'>
    name?: string
    fullName?: string
    phone?: string
    password?: string
  }) => api.post('/auth/register/send-otp', data),

  verifyRegisterOtp: (data: {
    identifier: string
    otp: string
  }) => api.post('/auth/register/verify-otp', data),

  registerFacebook: (data: {
    name?: string
    fullName?: string
    email: string
    password?: string
    oauthToken: string
  }) => api.post('/auth/register/facebook', data),

  login: (data: LoginPayload) => api.post('/auth/login', data),

  logout: () => api.post('/auth/logout', { refreshToken: getRefreshToken() }),

  refresh: () => api.post('/auth/refresh', undefined, { skipAuthRefresh: true } as any),

  getProfile: () => api.get('/auth/me', { timeout: 10000 }),

  updateProfile: (data: FormData | Record<string, unknown>) =>
    api.put(
      '/auth/update-profile',
      data,
      data instanceof FormData
        ? { headers: { 'Content-Type': 'multipart/form-data' } }
        : undefined,
    ),

  addPassword: (data: { newPassword: string }) =>
    api.post('/auth/add-password', data),

  setPassword: (data: { newPassword: string }) =>
    api.put('/auth/set-password', data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put('/auth/change-password', data),

  hasPassword: () => api.get('/auth/has-password'),

  enableSellerMode: (data?: { shopName?: string; description?: string }) =>
    api.post('/auth/seller/enable', data || {}),

  sendForgotPasswordOtp: (identifier: string) =>
    api.post('/auth/forgot-password/send-otp', { identifier }),

  verifyForgotPasswordOtp: (data: { identifier: string; otp: string }) =>
    api.post('/auth/forgot-password/verify-otp', data),

  resetPassword: (data: { resetToken: string; newPassword: string }) =>
    api.post('/auth/forgot-password/reset', data),

  requestEmailChange: (data: { newEmail: string }) =>
    api.post('/auth/change-email/request', data),

  confirmEmailChange: (data: { newEmail: string; otp: string }) =>
    api.post('/auth/change-email/confirm', data),

  requestPasswordResetOtp: (data: { method: 'email' | 'phone' }) =>
    api.post('/auth/request-password-reset-otp', data),

  resetPasswordWithOtp: (data: { method: 'email' | 'phone'; otp: string; newPassword: string }) =>
    api.post('/auth/reset-password-with-otp', data),
}
