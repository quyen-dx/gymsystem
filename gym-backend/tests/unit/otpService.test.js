import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockOtpFindOne = vi.fn()
const mockOtpFindOneAndUpdate = vi.fn()
const mockOtpUpdateOne = vi.fn()
const mockOtpAggregate = vi.fn()

vi.mock('../../src/models/Otp.js', () => ({
  default: {
    findOne: (...a) => mockOtpFindOne(...a),
    findOneAndUpdate: (...a) => mockOtpFindOneAndUpdate(...a),
    updateOne: (...a) => mockOtpUpdateOne(...a),
    aggregate: (...a) => mockOtpAggregate(...a),
  },
}))

vi.mock('../../src/services/emailService.js', () => ({
  sendOtpEmail: vi.fn(async () => {}),
}))

vi.mock('../../src/services/smsService.js', () => ({
  sendOtpSms: vi.fn(async () => {}),
}))

vi.mock('../../src/config/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() },
}))

import { verifyOtp } from '../../src/services/otpService.js'

const VALID_OTP_CODE = '123456'

describe('OtpService — BR-AUD-005', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('verifyOtp — rate limit', () => {
    it('should verify correct OTP successfully', async () => {
      mockOtpFindOne.mockResolvedValue({
        _id: 'otp1',
        code: VALID_OTP_CODE,
        consumedAt: null,
        lockedUntil: null,
        expiresAt: new Date(Date.now() + 300000),
      })

      const result = await verifyOtp({ identifier: 'user@test.com', purpose: 'email_verification', otp: VALID_OTP_CODE })
      expect(result._id).toBe('otp1')
    })

    it('should fail on 1st wrong OTP', async () => {
      mockOtpFindOne.mockResolvedValue({
        _id: 'otp1',
        code: VALID_OTP_CODE,
        consumedAt: null,
        lockedUntil: null,
        expiresAt: new Date(Date.now() + 300000),
        attempts: 0,
      })
      mockOtpFindOneAndUpdate.mockResolvedValue({ attempts: 1 })
      mockOtpAggregate.mockResolvedValue([{ totalAttempts: 0 }])

      await expect(
        verifyOtp({ identifier: 'user@test.com', purpose: 'email_verification', otp: '111111' }),
      ).rejects.toThrow('Mã OTP không hợp lệ')
    })

    it('should increment attempts counter on wrong OTP', async () => {
      mockOtpFindOne.mockResolvedValue({
        _id: 'otp1',
        code: VALID_OTP_CODE,
        consumedAt: null,
        lockedUntil: null,
        expiresAt: new Date(Date.now() + 300000),
      })
      mockOtpFindOneAndUpdate.mockResolvedValue({ attempts: 2 })
      mockOtpAggregate.mockResolvedValue([{ totalAttempts: 0 }])

      await expect(
        verifyOtp({ identifier: 'user@test.com', purpose: 'email_verification', otp: '222222' }),
      ).rejects.toThrow()

      expect(mockOtpFindOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'otp1' }),
        expect.objectContaining({ $inc: { attempts: 1 } }),
        expect.any(Object),
      )
    })

    it('should lock after 5 total failed attempts', async () => {
      mockOtpFindOne.mockResolvedValue({
        _id: 'otp1',
        code: VALID_OTP_CODE,
        consumedAt: null,
        lockedUntil: null,
        expiresAt: new Date(Date.now() + 300000),
      })
      mockOtpFindOneAndUpdate.mockResolvedValue({ attempts: 3 })
      mockOtpAggregate.mockResolvedValue([{ totalAttempts: 2 }])

      await expect(
        verifyOtp({ identifier: 'user@test.com', purpose: 'email_verification', otp: '333333' }),
      ).rejects.toThrow('Quá nhiều lần thử sai')

      expect(mockOtpUpdateOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'otp1' }),
        expect.objectContaining({ lockedUntil: expect.any(Date) }),
      )
    })

    it('should block if already locked', async () => {
      const futureDate = new Date(Date.now() + 600000)
      mockOtpFindOne.mockResolvedValue({
        _id: 'otp1',
        code: VALID_OTP_CODE,
        consumedAt: null,
        lockedUntil: futureDate,
        expiresAt: new Date(Date.now() + 300000),
      })

      await expect(
        verifyOtp({ identifier: 'user@test.com', purpose: 'email_verification', otp: VALID_OTP_CODE }),
      ).rejects.toThrow('Quá nhiều lần thử sai')
    })

    it('should allow after lockout expires', async () => {
      const pastDate = new Date(Date.now() - 600000)
      mockOtpFindOne.mockResolvedValue({
        _id: 'otp1',
        code: VALID_OTP_CODE,
        consumedAt: null,
        lockedUntil: pastDate,
        expiresAt: new Date(Date.now() + 300000),
      })

      const result = await verifyOtp({ identifier: 'user@test.com', purpose: 'email_verification', otp: VALID_OTP_CODE })
      expect(result._id).toBe('otp1')
    })

    it('should reject expired OTP', async () => {
      mockOtpFindOne.mockResolvedValue({
        _id: 'otp1',
        code: VALID_OTP_CODE,
        consumedAt: null,
        lockedUntil: null,
        expiresAt: new Date(Date.now() - 60000),
      })

      await expect(
        verifyOtp({ identifier: 'user@test.com', purpose: 'email_verification', otp: VALID_OTP_CODE }),
      ).rejects.toThrow('Mã OTP không hợp lệ hoặc đã hết hạn')
    })
  })
})
