const errorMap: Record<string, string> = {
  ACCOUNT_LOCKED: 'auth.accountLocked',
  'Email đã được sử dụng': 'auth.emailAlreadyExists',
  'Số điện thoại đã được sử dụng': 'auth.phoneAlreadyExists',
  'Họ tên là bắt buộc': 'auth.fullNameRequired',
  'Mật khẩu phải có ít nhất 6 ký tự': 'auth.passwordMinLength',
  'Mật khẩu mới phải có ít nhất 6 ký tự': 'auth.passwordMinLength',
  'Email không hợp lệ': 'auth.invalidEmail',
  'Số điện thoại không hợp lệ': 'auth.invalidPhone',
  'Email hoặc số điện thoại là bắt buộc': 'auth.emailOrPhoneRequired',
  'Số điện thoại là bắt buộc': 'auth.phoneRequired',
  'Chỉ đăng ký bằng số điện thoại hoặc email mới cần OTP': 'auth.providerRequired',
  'Tài khoản đã tồn tại': 'auth.phoneAlreadyExists',
  'Thiếu thông tin đăng nhập': 'auth.missingLoginInfo',
  'Tài khoản không tồn tại': 'auth.accountNotFound',
  'Tài khoản đã bị khóa': 'auth.accountLocked',
  'Account is locked': 'auth.accountLocked',
  'OAuth token không hợp lệ': 'auth.invalidCredentials',
  'Thiếu mật khẩu': 'auth.passwordMissing',
  'Tài khoản chưa có mật khẩu. Vui lòng đăng nhập Google rồi vào Profile để đặt mật khẩu': 'auth.noPasswordSet',
  'Mật khẩu không đúng': 'auth.incorrectPassword',
  'Không tìm thấy tài khoản': 'auth.accountNotFound',
  'Tài khoản Facebook không hỗ trợ quên mật khẩu bằng OTP': 'auth.facebookOnly',
  'Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn': 'auth.sessionExpired',
  'Mã OTP đã hết hạn': 'auth.otpExpired',
  'OTP không hợp lệ': 'auth.invalidOtp',
  'Mã OTP đã được gửi qua email': 'auth.otpSent',
  'Mã OTP đã được gửi qua SMS': 'auth.otpSent',
  'Đăng ký tài khoản thành công': 'auth.registrationSuccessful',
  'Lỗi máy chủ': 'auth.unexpectedError',
}

export function getErrorMessageKey(backendMessage?: string, backendCode?: string): string | undefined {
  if (backendCode && errorMap[backendCode]) return errorMap[backendCode]
  if (!backendMessage) return undefined
  const key = errorMap[backendMessage]
  if (key) return key
  const lower = backendMessage.toLowerCase()
  if (lower.includes('network error') || lower.includes('network') || lower.includes('mạng')) {
    return 'auth.networkError'
  }
  if (lower.includes('expired') || (lower.includes('hết hạn') && lower.includes('otp'))) {
    return 'auth.otpExpired'
  }
  if (lower.includes('invalid otp') || lower.includes('incorrect otp') || (lower.includes('otp') && lower.includes('không hợp lệ'))) {
    return 'auth.invalidOtp'
  }
  return undefined
}

export function getErrorMessage(t: (key: string) => string, backendMessage?: string, fallbackKey = 'auth.unexpectedError', backendCode?: string): string {
  const key = getErrorMessageKey(backendMessage, backendCode)
  if (key) return t(key)
  if (backendMessage) return backendMessage
  return t(fallbackKey)
}
