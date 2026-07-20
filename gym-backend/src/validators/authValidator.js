import { z } from 'zod'

const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
  .regex(/[A-Z]/, 'Mật khẩu phải có ít nhất 1 chữ hoa')
  .regex(/[a-z]/, 'Mật khẩu phải có ít nhất 1 chữ thường')
  .regex(/[0-9]/, 'Mật khẩu phải có ít nhất 1 số')

export const registerSchema = z.object({
  email: z.string().email('Email không hợp lệ').toLowerCase().trim(),
  password: passwordSchema,
  name: z.string().trim().min(2, 'Tên phải có ít nhất 2 ký tự'),
})

export const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ').toLowerCase().trim(),
  password: z.string().min(1, 'Mật khẩu là bắt buộc'),
})

export const verifyEmailSchema = z.object({
  email: z.string().email('Email không hợp lệ').toLowerCase().trim(),
  otp: z.string().length(6, 'Mã OTP phải có 6 ký tự'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email không hợp lệ').toLowerCase().trim(),
})

export const resendVerificationSchema = z.object({
  email: z.string().email('Email không hợp lệ').toLowerCase().trim(),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token là bắt buộc'),
  password: passwordSchema,
})
