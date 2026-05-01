import api from './api'
import type { AuthProviderType, LoginPayload } from '../context/auth.context'

export const authService = {
  sendRegisterOtp: (data: {
    provider: Extract<AuthProviderType, 'phone'>
    name: string
    phone?: string
    password?: string
  }) => api.post('/auth/register/send-otp', data),

  verifyRegisterOtp: (data: {
    identifier: string
    otp: string
  }) => api.post('/auth/register/verify-otp', data),

  registerFacebook: (data: {
    name: string
    email: string
    password?: string
    oauthToken: string
  }) => api.post('/auth/register/facebook', data),

  login: (data: LoginPayload) => api.post('/auth/login', data),

  logout: () => api.post('/auth/logout'),

  getProfile: () => api.get('/auth/me'),

  updateProfile: (data: FormData) =>
    api.put('/auth/update-profile', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  setPassword: (data: { newPassword: string }) =>
    api.put('/auth/set-password', data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put('/auth/change-password', data),

  enableSellerMode: (data?: { shopName?: string; description?: string }) =>
    api.post('/auth/seller/enable', data || {}),

  sendForgotPasswordOtp: (identifier: string) =>
    api.post('/auth/forgot-password/send-otp', { identifier }),

  verifyForgotPasswordOtp: (data: { identifier: string; otp: string }) =>
    api.post('/auth/forgot-password/verify-otp', data),

  resetPassword: (data: { resetToken: string; newPassword: string }) =>
    api.post('/auth/forgot-password/reset', data),
}
