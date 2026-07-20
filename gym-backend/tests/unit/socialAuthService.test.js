import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSocialFindOne = vi.fn()
const mockSocialCreate = vi.fn()
const mockSocialFindByIdAndDelete = vi.fn()
const mockSocialCountDocs = vi.fn()

vi.mock('../../src/models/SocialAccount.js', () => ({
  default: {
    findOne: (...a) => mockSocialFindOne(...a),
    create: (...a) => mockSocialCreate(...a),
    findByIdAndDelete: (...a) => mockSocialFindByIdAndDelete(...a),
    countDocuments: (...a) => mockSocialCountDocs(...a),
  },
}))

const mockUserFindById = vi.fn()

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
    findById: (...a) => makeChain(Promise.resolve(mockUserFindById(...a))),
  },
}))

vi.mock('../../src/services/tokenService.js', () => ({
  generateAccessToken: vi.fn(() => 'mock-access'),
  generateRefreshToken: vi.fn(async () => ({ token: 'mock-refresh', expiresAt: new Date(), family: 'f' })),
}))

vi.mock('../../src/config/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() },
}))

import {
  loginWithGoogle,
  loginWithFacebook,
  linkSocialAccount,
  unlinkSocialAccount,
} from '../../src/services/socialAuthService.js'

describe('SocialAuthService', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('loginWithGoogle', () => {
    it('should create SocialAccount on first login', async () => {
      mockSocialFindOne.mockResolvedValue(null)
      const profile = { id: 'g123', photos: [{ value: 'http://photo.jpg' }], _json: { sub: 'g123' } }

      await loginWithGoogle('user1', profile)
      expect(mockSocialCreate).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user1', provider: 'google', providerId: 'g123',
      }))
    })

    it('should update existing SocialAccount on re-login', async () => {
      const existing = { userId: 'user1', provider: 'google', providerId: 'g123', save: vi.fn().mockResolvedValue(true) }
      mockSocialFindOne.mockResolvedValue(existing)

      await loginWithGoogle('user1', { id: 'g123', photos: [{ value: 'http://new.jpg' }], _json: {} })
      expect(mockSocialCreate).not.toHaveBeenCalled()
    })

    it('should throw if already linked to different user', async () => {
      const existing = { userId: { toString: () => 'user2' }, provider: 'google', providerId: 'g123' }
      mockSocialFindOne.mockResolvedValue(existing)

      await expect(loginWithGoogle('user1', { id: 'g123' })).rejects.toThrow('đã được liên kết với người dùng khác')
    })

    it('should skip if no profile id', async () => {
      await loginWithGoogle('user1', {})
      expect(mockSocialCreate).not.toHaveBeenCalled()
    })
  })

  describe('loginWithFacebook', () => {
    it('should create SocialAccount on first login', async () => {
      mockSocialFindOne.mockResolvedValue(null)
      const profile = { id: 'fb456', photos: [{ value: 'http://fb.jpg' }], _json: {} }

      await loginWithFacebook('user1', profile)
      expect(mockSocialCreate).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user1', provider: 'facebook', providerId: 'fb456',
      }))
    })

    it('should update existing on re-login', async () => {
      const existing = { userId: { toString: () => 'user1' }, provider: 'facebook', providerId: 'fb456', save: vi.fn().mockResolvedValue(true) }
      mockSocialFindOne.mockResolvedValue(existing)

      await loginWithFacebook('user1', { id: 'fb456', photos: [{ value: 'http://fb.jpg' }], _json: {} })
      expect(mockSocialCreate).not.toHaveBeenCalled()
    })
  })

  describe('linkSocialAccount', () => {
    it('should throw for invalid provider', async () => {
      await expect(linkSocialAccount('u1', 'invalid', 'token')).rejects.toThrow('Nhà cung cấp không hợp lệ')
    })
  })

  describe('unlinkSocialAccount', () => {
    it('should throw for invalid provider', async () => {
      await expect(unlinkSocialAccount('u1', 'invalid')).rejects.toThrow('Nhà cung cấp không hợp lệ')
    })

    it('should throw if social account not found', async () => {
      mockSocialFindOne.mockResolvedValue(null)
      await expect(unlinkSocialAccount('u1', 'google')).rejects.toThrow('không tồn tại')
    })

    it('should throw if no other auth method', async () => {
      mockSocialFindOne.mockResolvedValue({ _id: 'sa1', userId: 'u1', provider: 'google' })
      mockUserFindById.mockResolvedValue({ _id: { toString: () => 'u1' }, password: null, passwordHash: null })
      mockSocialCountDocs.mockResolvedValue(0)

      await expect(unlinkSocialAccount('u1', 'google')).rejects.toThrow('cần có ít nhất một phương thức đăng nhập khác')
    })

    it('should unlink if user has password', async () => {
      mockSocialFindOne.mockResolvedValue({ _id: 'sa1', userId: 'u1', provider: 'google' })
      mockUserFindById.mockResolvedValue({
        _id: { toString: () => 'u1' }, password: null, passwordHash: 'hashed',
        save: vi.fn().mockResolvedValue(true),
      })
      mockSocialCountDocs.mockResolvedValue(0)
      mockSocialFindByIdAndDelete.mockResolvedValue({ _id: 'sa1' })

      await expect(unlinkSocialAccount('u1', 'google')).resolves.toBeUndefined()
    })
  })
})
