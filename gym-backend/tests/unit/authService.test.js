import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindOne = vi.fn()
const mockCreate = vi.fn()
const mockFindByIdAndDelete = vi.fn()
const mockFindByIdUser = vi.fn()

function makeChain(promise) {
  return {
    then: (resolve, reject) => promise.then(resolve, reject),
    catch: (reject) => promise.catch(reject),
    select: function () { return this },
    lean: function () { return promise },
  }
}

vi.mock('../../src/models/User.js', () => ({
  default: {
    findOne: (...a) => makeChain(Promise.resolve(mockFindOne(...a))),
    create: (...a) => mockCreate(...a),
    findByIdAndDelete: (...a) => mockFindByIdAndDelete(...a),
    findById: (...a) => makeChain(Promise.resolve(mockFindByIdUser(...a))),
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
}))

vi.mock('../../src/models/RefreshToken.js', () => ({
  default: {
    findOneAndUpdate: vi.fn(),
    revokeAllForUser: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    countActiveByUser: vi.fn(),
    countDocuments: vi.fn(),
    find: vi.fn(),
    deleteMany: vi.fn(),
    rotate: vi.fn(),
  },
}))

vi.mock('../../src/models/PasswordResetToken.js', () => ({
  default: { generate: vi.fn(), consume: vi.fn() },
}))

vi.mock('../../src/services/tokenService.js', () => ({
  generateAccessToken: vi.fn(() => 'mock-access-token'),
  generateRefreshToken: vi.fn(async () => ({
    token: 'mock-refresh',
    expiresAt: new Date(Date.now() + 7 * 86400000),
    family: 'mock-family',
  })),
  rotateRefreshToken: vi.fn(),
  verifyAccessToken: vi.fn(),
  decodeToken: vi.fn(),
  revokeAllUserTokens: vi.fn(),
}))

vi.mock('../../src/services/otpService.js', () => ({
  sendOtp: vi.fn(async () => {}),
  verifyOtp: vi.fn(),
  consumeOtp: vi.fn(),
}))

vi.mock('../../src/services/emailService.js', () => ({
  sendPasswordResetEmail: vi.fn(async () => {}),
}))

vi.mock('../../src/services/loginHistoryService.js', () => ({
  recordLoginHistory: vi.fn(async () => {}),
}))

vi.mock('../../src/config/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() },
}))

import * as authService from '../../src/services/authService.js'

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindOne.mockReset()
    mockCreate.mockReset()
    mockFindByIdUser.mockReset()
  })

  describe('register', () => {
    it('should register a new user', async () => {
      mockFindOne.mockResolvedValue(null)
      mockCreate.mockResolvedValue({ _id: { toString: () => 'user1' }, email: 'new@test.com', name: 'New', role: 'member' })

      const user = await authService.register({ email: 'new@test.com', password: 'Pass123', name: 'New' })
      expect(user.email).toBe('new@test.com')
    })

    it('should reject duplicate email', async () => {
      mockFindOne.mockResolvedValue({ _id: 'exists' })
      await expect(
        authService.register({ email: 'dup@test.com', password: 'Pass123', name: 'Dup' }),
      ).rejects.toThrow('Email đã được sử dụng')
    })
  })

  describe('login', () => {
    it('should login with valid credentials', async () => {
      mockFindOne.mockResolvedValue({
        _id: { toString: () => 'u1' },
        email: 'a@test.com',
        comparePassword: vi.fn().mockResolvedValue(true),
        isActive: true, status: 'active', isLocked: false, isVerified: true, provider: 'email',
        role: 'member',
      })
      const result = await authService.login('a@test.com', 'Pass123', { userAgent: 't', ip: '::1', platform: 'n' })
      expect(result.accessToken).toBe('mock-access-token')
      expect(result.refreshToken).toBe('mock-refresh')
    })

    it('should fail with wrong password', async () => {
      mockFindOne.mockResolvedValue({
        _id: { toString: () => 'u1' },
        comparePassword: vi.fn().mockResolvedValue(false),
        isActive: true, status: 'active', isLocked: false, isVerified: true, provider: 'email',
      })
      await expect(authService.login('a@test.com', 'wrong', {})).rejects.toThrow('Email hoặc mật khẩu không đúng')
    })

    it('should fail for non-existent user', async () => {
      mockFindOne.mockResolvedValue(null)
      await expect(authService.login('no@test.com', 'Pass123', {})).rejects.toThrow('Email hoặc mật khẩu không đúng')
    })

    it('should fail for locked account', async () => {
      mockFindOne.mockResolvedValue({
        _id: { toString: () => 'u1' }, comparePassword: vi.fn(),
        isActive: true, status: 'locked', isLocked: true, isVerified: true, provider: 'email',
      })
      await expect(authService.login('lock@test.com', 'Pass123', {})).rejects.toThrow('Tài khoản đã bị khóa')
    })

    it('should fail for inactive account', async () => {
      mockFindOne.mockResolvedValue({
        _id: { toString: () => 'u1' }, comparePassword: vi.fn(),
        isActive: false, status: 'active', isLocked: false, isVerified: true, provider: 'email',
      })
      await expect(authService.login('inact@test.com', 'Pass123', {})).rejects.toThrow('Tài khoản đã bị vô hiệu hóa')
    })

    it('should fail for unverified email', async () => {
      mockFindOne.mockResolvedValue({
        _id: { toString: () => 'u1' }, comparePassword: vi.fn(),
        isActive: true, status: 'active', isLocked: false, isVerified: false, provider: 'email',
      })
      await expect(authService.login('unver@test.com', 'Pass123', {})).rejects.toThrow('Vui lòng xác thực email')
    })
  })

  describe('logout', () => {
    it('should handle null token', async () => {
      await expect(authService.logout(null)).resolves.toBeUndefined()
    })
  })

  describe('logoutAll', () => {
    it('should revoke all tokens', async () => {
      const RefreshToken = (await import('../../src/models/RefreshToken.js')).default
      await authService.logoutAll('user1')
      expect(RefreshToken.revokeAllForUser).toHaveBeenCalledWith('user1')
    })
  })

  describe('forgotPassword', () => {
    it('should return generic message for unknown email', async () => {
      mockFindOne.mockResolvedValue(null)
      const r = await authService.forgotPassword('no@test.com')
      expect(r.message).toContain('Nếu email tồn tại')
    })
  })

  describe('resendVerificationOtp', () => {
    it('should return generic message for unknown email', async () => {
      mockFindOne.mockResolvedValue(null)
      const r = await authService.resendVerificationOtp('no@test.com')
      expect(r.message).toContain('Nếu email tồn tại')
    })
  })

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      const otpSvc = await import('../../src/services/otpService.js')
      otpSvc.verifyOtp.mockResolvedValue({ _id: 'otp1', userId: 'u1' })
      otpSvc.consumeOtp.mockResolvedValue(true)

      const u = { _id: { toString: () => 'u1' }, email: 'u@test.com', isVerified: false, save: vi.fn().mockResolvedValue(true) }
      mockFindByIdUser.mockResolvedValue(u)

      const result = await authService.verifyEmail('u@test.com', '123456')
      expect(u.isVerified).toBe(true)
      expect(result.isVerified).toBe(true)
    })

    it('should fail with invalid OTP', async () => {
      const otpSvc = await import('../../src/services/otpService.js')
      otpSvc.verifyOtp.mockRejectedValue(new (await import('../../src/utils/appError.js')).default('Mã OTP không hợp lệ hoặc đã hết hạn.', 400, 'OTP_INVALID'))

      await expect(authService.verifyEmail('u@test.com', 'wrong')).rejects.toThrow('Mã OTP không hợp lệ')
    })

    it('should fail with expired OTP', async () => {
      const otpSvc = await import('../../src/services/otpService.js')
      otpSvc.verifyOtp.mockRejectedValue(new (await import('../../src/utils/appError.js')).default('Mã OTP không hợp lệ hoặc đã hết hạn.', 400, 'OTP_EXPIRED'))

      await expect(authService.verifyEmail('u@test.com', 'expired')).rejects.toThrow()
    })

    it('should fail if already verified', async () => {
      const otpSvc = await import('../../src/services/otpService.js')
      otpSvc.verifyOtp.mockResolvedValue({ _id: 'otp1', userId: 'u1' })
      otpSvc.consumeOtp.mockResolvedValue(true)

      const u = { _id: { toString: () => 'u1' }, email: 'u@test.com', isVerified: true, save: vi.fn() }
      mockFindByIdUser.mockResolvedValue(u)

      await expect(authService.verifyEmail('u@test.com', '123456')).rejects.toThrow('Email đã được xác thực')
    })
  })

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const prt = (await import('../../src/models/PasswordResetToken.js')).default
      prt.consume.mockResolvedValue({ userId: 'u1' })

      const u = { _id: { toString: () => 'u1' }, passwordHash: 'old', save: vi.fn().mockResolvedValue(true) }
      mockFindByIdUser.mockResolvedValue(u)

      await expect(authService.resetPassword('valid-token', 'NewPass123')).resolves.toBeUndefined()
    })

    it('should fail with invalid token', async () => {
      const prt = (await import('../../src/models/PasswordResetToken.js')).default
      prt.consume.mockResolvedValue(null)

      await expect(authService.resetPassword('invalid', 'NewPass123')).rejects.toThrow('Token không hợp lệ')
    })

    it('should fail with expired token', async () => {
      const prt = (await import('../../src/models/PasswordResetToken.js')).default
      prt.consume.mockResolvedValue(null)

      await expect(authService.resetPassword('expired', 'NewPass123')).rejects.toThrow('Token không hợp lệ')
    })

    it('should fail if user not found after valid token', async () => {
      const prt = (await import('../../src/models/PasswordResetToken.js')).default
      prt.consume.mockResolvedValue({ userId: 'u1' })

      mockFindByIdUser.mockResolvedValue(null)

      await expect(authService.resetPassword('valid-token', 'NewPass123')).rejects.toThrow('Người dùng không tồn tại')
    })
  })
})
