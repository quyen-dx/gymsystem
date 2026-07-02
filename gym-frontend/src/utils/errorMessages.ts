const errorMap: Record<string, string> = {
  ACCOUNT_LOCKED: 'Tài khoản đã bị khóa',
  'Email đã được sử dụng': 'Email đã được sử dụng',
  'Số điện thoại đã được sử dụng': 'Số điện thoại đã được sử dụng',
  'Họ tên là bắt buộc': 'Họ tên là bắt buộc',
  'Mật khẩu phải có ít nhất 6 ký tự': 'Mật khẩu phải có ít nhất 6 ký tự',
  'Mật khẩu mới phải có ít nhất 6 ký tự': 'Mật khẩu mới phải có ít nhất 6 ký tự',
  'Email không hợp lệ': 'Email không hợp lệ',
  'Số điện thoại không hợp lệ': 'Số điện thoại không hợp lệ',
  'Email hoặc số điện thoại là bắt buộc': 'Email hoặc số điện thoại là bắt buộc',
  'Số điện thoại là bắt buộc': 'Số điện thoại là bắt buộc',
  'Chỉ đăng ký bằng số điện thoại hoặc email mới cần OTP': 'Chỉ đăng ký bằng số điện thoại hoặc email mới cần OTP',
  'Tài khoản đã tồn tại': 'Tài khoản đã tồn tại',
  'Thiếu thông tin đăng nhập': 'Thiếu thông tin đăng nhập',
  'Tài khoản không tồn tại': 'Tài khoản không tồn tại',
  'Tài khoản đã bị khóa': 'Tài khoản đã bị khóa',
  'Account is locked': 'Tài khoản đã bị khóa',
  'OAuth token không hợp lệ': 'Token OAuth không hợp lệ',
  'Thiếu mật khẩu': 'Thiếu mật khẩu',
  'Tài khoản chưa có mật khẩu. Vui lòng đăng nhập Google rồi vào Profile để đặt mật khẩu': 'Tài khoản chưa có mật khẩu. Vui lòng đăng nhập Google rồi vào Profile để đặt mật khẩu',
  'Mật khẩu không đúng': 'Mật khẩu không đúng',
  'Không tìm thấy tài khoản': 'Không tìm thấy tài khoản',
  'Tài khoản Facebook không hỗ trợ quên mật khẩu bằng OTP': 'Tài khoản Facebook không hỗ trợ quên mật khẩu bằng OTP',
  'Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn': 'Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
  'Mã OTP đã hết hạn': 'Mã OTP đã hết hạn',
  'OTP không hợp lệ': 'OTP không hợp lệ',
  'Mã OTP đã được gửi qua email': 'Mã OTP đã được gửi qua email',
  'Mã OTP đã được gửi qua SMS': 'Mã OTP đã được gửi qua SMS',
  'Đăng ký tài khoản thành công': 'Đăng ký tài khoản thành công',
  'Lỗi máy chủ': 'Lỗi máy chủ',
}

const fallbackMessages: Record<string, string> = {
  networkError: 'Lỗi kết nối mạng. Vui lòng thử lại',
  otpExpired: 'Mã OTP đã hết hạn',
  invalidOtp: 'OTP không hợp lệ',
  unexpectedError: 'Lỗi máy chủ',
}

export function getErrorMessageKey(backendMessage?: string, backendCode?: string): string | undefined {
  if (backendCode && errorMap[backendCode]) return errorMap[backendCode]
  if (!backendMessage) return undefined
  const key = errorMap[backendMessage]
  if (key) return key
  const lower = backendMessage.toLowerCase()
  if (lower.includes('network error') || lower.includes('network') || lower.includes('mạng')) {
    return 'networkError'
  }
  if (lower.includes('expired') || (lower.includes('hết hạn') && lower.includes('otp'))) {
    return 'otpExpired'
  }
  if (lower.includes('invalid otp') || lower.includes('incorrect otp') || (lower.includes('otp') && lower.includes('không hợp lệ'))) {
    return 'invalidOtp'
  }
  return undefined
}

export function getErrorMessage(backendMessage?: string, fallbackKey: string = 'unexpectedError', backendCode?: string): string {
  const key = getErrorMessageKey(backendMessage, backendCode)
  if (key) {
    if (errorMap[key]) return errorMap[key]
    return fallbackMessages[key] || key
  }
  if (backendMessage) return backendMessage
  return fallbackMessages[fallbackKey] || fallbackMessages.unexpectedError
}
