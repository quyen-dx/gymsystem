import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCountActive = vi.fn()
const mockFindOldest = vi.fn()
const mockCreate = vi.fn()
const mockFindByIdAndUpdate = vi.fn()

vi.mock('../../src/models/RefreshToken.js', () => ({
  default: {
    countActiveByUser: (...a) => mockCountActive(...a),
    findOne: (...a) => ({
      sort: () => mockFindOldest(...a),
    }),
    create: (...a) => mockCreate(...a),
    findByIdAndUpdate: (...a) => mockFindByIdAndUpdate(...a),
    revokeAllForUser: vi.fn(),
  },
}))

vi.mock('../../src/models/User.js', () => ({
  default: {
    findByIdAndUpdate: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('../../src/config/env.js', () => ({
  jwt: { secret: 'test-secret', expiresIn: '15m', issuer: 'test', audience: 'test' },
}))

import { generateRefreshToken, revokeAllUserTokens } from '../../src/services/tokenService.js'

describe('TokenService — BR-AUD-004', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('generateRefreshToken — session limit', () => {
    it('should create token when under limit (0 active)', async () => {
      mockCountActive.mockResolvedValue(0)
      mockCreate.mockResolvedValue({ _id: 'rt1' })

      const result = await generateRefreshToken({ _id: 'u1', role: 'member' }, { userAgent: 'UA', ip: '1.2.3.4', platform: 'web' })
      expect(result.token).toBeDefined()
      expect(mockCreate).toHaveBeenCalled()
    })

    it('should create token when under limit (2 active)', async () => {
      mockCountActive.mockResolvedValue(2)
      mockCreate.mockResolvedValue({ _id: 'rt1' })

      await generateRefreshToken({ _id: 'u1', role: 'member' }, {})
      expect(mockFindOldest).not.toHaveBeenCalled()
      expect(mockCreate).toHaveBeenCalled()
    })

    it('should evict oldest when at limit (3 active)', async () => {
      mockCountActive.mockResolvedValue(3)
      const oldest = { isRevoked: false, save: vi.fn().mockResolvedValue(true) }
      mockFindOldest.mockResolvedValue(oldest)
      mockCreate.mockResolvedValue({ _id: 'rt1' })

      await generateRefreshToken({ _id: 'u1', role: 'member' }, {})

      expect(oldest.isRevoked).toBe(true)
      expect(mockCreate).toHaveBeenCalled()
      expect(mockFindOldest).toHaveBeenCalled()
    })

    it('should not evict if count >= 3 but oldest not found', async () => {
      mockCountActive.mockResolvedValue(3)
      mockFindOldest.mockResolvedValue(null)
      mockCreate.mockResolvedValue({ _id: 'rt1' })

      await generateRefreshToken({ _id: 'u1', role: 'member' }, {})
      expect(mockCreate).toHaveBeenCalled()
    })

    it('should set deviceInfo on created token', async () => {
      mockCountActive.mockResolvedValue(0)
      mockCreate.mockResolvedValue({ _id: 'rt1' })

      await generateRefreshToken({ _id: 'u1', role: 'member' }, { userAgent: 'Chrome', ip: '10.0.0.1', platform: 'win' })

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'u1',
        deviceInfo: expect.objectContaining({ userAgent: 'Chrome', ip: '10.0.0.1', platform: 'win' }),
      }))
    })
  })

  describe('revokeAllUserTokens', () => {
    it('should revoke all tokens for user', async () => {
      const RefreshToken = (await import('../../src/models/RefreshToken.js')).default
      await revokeAllUserTokens('u1')
      expect(RefreshToken.revokeAllForUser).toHaveBeenCalledWith('u1')
    })
  })
})
