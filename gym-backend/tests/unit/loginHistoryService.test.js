import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLHFind = vi.fn()
const mockLHCount = vi.fn()
const mockLHCreate = vi.fn()

vi.mock('../../src/models/LoginHistory.js', () => ({
  default: {
    find: (...a) => {
      const chain = { sort: () => chain, skip: () => chain, limit: () => ({ lean: () => mockLHFind(...a) }) }
      return chain
    },
    countDocuments: (...a) => mockLHCount(...a),
    create: (...a) => mockLHCreate(...a),
  },
}))

const mockRTFind = vi.fn()
const mockRTFindOne = vi.fn()
const mockRTRevokeAll = vi.fn()
const mockRTDeleteMany = vi.fn()

vi.mock('../../src/models/RefreshToken.js', () => ({
  default: {
    find: (...a) => ({ sort: () => ({ select: () => ({ lean: () => mockRTFind(...a) }) }) }),
    findOne: (...a) => mockRTFindOne(...a),
    revokeAllForUser: (...a) => mockRTRevokeAll(...a),
    deleteMany: (...a) => mockRTDeleteMany(...a),
  },
}))

const mockUFindById = vi.fn()

vi.mock('../../src/models/User.js', () => ({
  default: { findById: (...a) => mockUFindById(...a) },
}))

import {
  recordLoginHistory, getLoginHistory, getActiveSessions,
  revokeDevice, revokeAllSessions, unlockAccount, cleanupExpiredRefreshTokens,
} from '../../src/services/loginHistoryService.js'

describe('LoginHistoryService', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('recordLoginHistory', () => {
    it('should create record', async () => {
      await recordLoginHistory({ userId: 'u1', action: 'login', ip: '::1', userAgent: 't' })
      expect(mockLHCreate).toHaveBeenCalled()
    })

    it('should handle null userId', async () => {
      await recordLoginHistory({ action: 'login_failed', failureReason: 'user_not_found' })
      expect(mockLHCreate).toHaveBeenCalledWith(expect.objectContaining({ userId: null }))
    })
  })

  describe('getLoginHistory', () => {
    it('should return paginated', async () => {
      mockLHFind.mockResolvedValue([{ _id: 'h1', action: 'login' }])
      mockLHCount.mockResolvedValue(1)
      const r = await getLoginHistory('u1', { page: 1, limit: 10 })
      expect(r.entries).toHaveLength(1)
      expect(r.pagination.total).toBe(1)
    })

    it('should filter by action', async () => {
      mockLHFind.mockResolvedValue([])
      mockLHCount.mockResolvedValue(0)
      await getLoginHistory('u1', { page: 1, limit: 10, action: 'login_failed' })
      expect(mockLHFind.mock.calls[0][0].action).toBe('login_failed')
    })
  })

  describe('getActiveSessions', () => {
    it('should return sessions', async () => {
      mockRTFind.mockResolvedValue([{ _id: 's1', deviceInfo: { userAgent: 'C' }, createdAt: new Date(), expiresAt: new Date() }])
      const r = await getActiveSessions('u1')
      expect(r.sessions).toHaveLength(1)
      expect(r.count).toBe(1)
    })

    it('should return empty', async () => {
      mockRTFind.mockResolvedValue([])
      const r = await getActiveSessions('u1')
      expect(r.sessions).toHaveLength(0)
    })
  })

  describe('revokeDevice', () => {
    it('should revoke session', async () => {
      mockRTFindOne.mockResolvedValue({ _id: 's1', userId: 'u1', isRevoked: false, save: vi.fn().mockResolvedValue(true) })
      await expect(revokeDevice('s1', 'u1')).resolves.toBeUndefined()
    })

    it('should throw for not found', async () => {
      mockRTFindOne.mockResolvedValue(null)
      await expect(revokeDevice('s1', 'u1')).rejects.toThrow('Phiên đăng nhập không tồn tại')
    })

    it('should throw for already revoked', async () => {
      mockRTFindOne.mockResolvedValue({ _id: 's1', userId: 'u1', isRevoked: true, save: vi.fn() })
      await expect(revokeDevice('s1', 'u1')).rejects.toThrow('đã bị hủy')
    })
  })

  describe('revokeAllSessions', () => {
    it('should revoke all', async () => {
      mockRTRevokeAll.mockResolvedValue({ modifiedCount: 3 })
      const r = await revokeAllSessions('u1')
      expect(r.revokedCount).toBe(3)
    })
  })

  describe('unlockAccount', () => {
    it('should unlock locked account', async () => {
      mockUFindById.mockResolvedValue({
        _id: { toString: () => 'u2' }, isLocked: true, status: 'locked',
        isActive: false, role: 'member', save: vi.fn().mockResolvedValue(true),
      })
      await expect(unlockAccount('u2', 'admin1')).resolves.toBeUndefined()
    })

    it('should block self-unlock', async () => {
      await expect(unlockAccount('a1', 'a1')).rejects.toThrow('chính tài khoản của mình')
    })

    it('should block Super Admin unlock', async () => {
      mockUFindById.mockResolvedValue({
        _id: { toString: () => 'sa1' }, isLocked: true, status: 'locked',
        isActive: false, role: 'super_admin', save: vi.fn(),
      })
      await expect(unlockAccount('sa1', 'admin1')).rejects.toThrow('Super Admin')
    })

    it('should fail for already unlocked', async () => {
      mockUFindById.mockResolvedValue({
        _id: { toString: () => 'u2' }, isLocked: false, status: 'active',
        isActive: true, role: 'member', save: vi.fn(),
      })
      await expect(unlockAccount('u2', 'admin1')).rejects.toThrow('không bị khóa')
    })
  })

  describe('cleanupExpiredRefreshTokens', () => {
    it('should delete tokens', async () => {
      mockRTDeleteMany.mockResolvedValue({ deletedCount: 5 })
      const r = await cleanupExpiredRefreshTokens()
      expect(r.deletedCount).toBe(5)
    })
  })
})
