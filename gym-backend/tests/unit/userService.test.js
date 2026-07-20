import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFindByIdFn = vi.fn()
const mockFindFn = vi.fn()
const mockCountFn = vi.fn()

function makeChain(promise) {
  return {
    then: (resolve, reject) => promise.then(resolve, reject),
    catch: (reject) => promise.catch(reject),
    select: function () { return this },
    lean: function () { return promise },
    sort: function () { return this },
    skip: function () { return this },
    limit: function () { return this },
  }
}

vi.mock('../../src/models/User.js', () => ({
  default: {
    findById: (...a) => makeChain(Promise.resolve(mockFindByIdFn(...a))),
    find: (...a) => makeChain(Promise.resolve(mockFindFn(...a))),
    countDocuments: (...a) => mockCountFn(...a),
    findByIdAndUpdate: vi.fn(),
  },
}))

vi.mock('../../src/utils/memberIdentity.js', () => ({
  extractMemberNumber: vi.fn(() => null),
  formatMemberCode: vi.fn(() => null),
  normalizeUserMemberIdentity: (u) => u,
  normalizeUserArrayMemberIdentity: (a) => a,
}))

vi.mock('../../src/config/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() },
}))

import * as userService from '../../src/services/userService.js'

describe('UserService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindByIdFn.mockReset()
    mockFindFn.mockReset()
    mockCountFn.mockReset()
  })

  describe('getMyProfile', () => {
    it('should return profile', async () => {
      mockFindByIdFn.mockResolvedValue({
        _id: 'u1', email: 'a@test.com', name: 'Test', role: 'member',
        toObject() { return { _id: 'u1', email: 'a@test.com', name: 'Test', role: 'member' } }, password: 'h',
      })
      const r = await userService.getMyProfile('u1')
      expect(r.user.email).toBe('a@test.com')
      expect(r.hasPassword).toBe(true)
    })

    it('should throw for missing user', async () => {
      mockFindByIdFn.mockResolvedValue(null)
      await expect(userService.getMyProfile('x')).rejects.toThrow('Người dùng không tồn tại')
    })

    it('should mask identityNumber for non-admin', async () => {
      mockFindByIdFn.mockResolvedValue({
        _id: 'u1', email: 'a@test.com', name: 'T', role: 'member',
        identityNumber: '123456789012', identityFrontImage: 'f.jpg', identityBackImage: 'b.jpg',
        toObject() { return { _id: 'u1', email: 'a@test.com', name: 'T', role: 'member', identityNumber: '123456789012', identityFrontImage: 'f.jpg', identityBackImage: 'b.jpg' } },
        password: 'h',
      })
      const r = await userService.getMyProfile('u1')
      expect(r.user.identityNumber).toBe('********9012')
      expect(r.user.identityFrontImage).toBeUndefined()
    })

    it('should NOT mask for admin', async () => {
      mockFindByIdFn.mockResolvedValue({
        _id: 'u1', email: 'admin@test.com', name: 'A', role: 'super_admin',
        identityNumber: '123456789012',
        toObject() { return { _id: 'u1', email: 'admin@test.com', name: 'A', role: 'super_admin', identityNumber: '123456789012' } },
        password: 'h',
      })
      const r = await userService.getMyProfile('u1')
      expect(r.user.identityNumber).toBe('123456789012')
    })
  })

  describe('getUserById', () => {
    it('should throw for non-existent', async () => {
      mockFindByIdFn.mockResolvedValue(null)
      await expect(userService.getUserById('x', 'admin')).rejects.toThrow('Người dùng không tồn tại')
    })

    it('should block non-admin viewing admin', async () => {
      mockFindByIdFn.mockResolvedValue({ _id: 'a1', role: 'super_admin', toObject() { return { _id: 'a1', role: 'super_admin' } } })
      await expect(userService.getUserById('a1', 'staff')).rejects.toThrow('Không có quyền xem')
    })

    it('should mask PII for staff', async () => {
      mockFindByIdFn.mockResolvedValue({
        _id: 'm1', email: 'm@test.com', name: 'M', role: 'member',
        identityNumber: '987654321098', identityFrontImage: 'f.jpg', identityBackImage: 'b.jpg',
        toObject() { return { ...this } },
      })
      const r = await userService.getUserById('m1', 'staff')
      expect(r.user.identityNumber).toBe('********1098')
      expect(r.user.identityFrontImage).toBeUndefined()
    })
  })

  describe('updateMyProfile', () => {
    it('should throw for missing user', async () => {
      mockFindByIdFn.mockResolvedValue(null)
      await expect(userService.updateMyProfile('x', { name: 'N' })).rejects.toThrow('Người dùng không tồn tại')
    })
  })

  describe('changeUserPassword', () => {
    it('should change with correct current', async () => {
      const u = {
        _id: { toString: () => 'u1' }, password: 'old-hash', passwordHash: 'old-hash',
        comparePassword: vi.fn().mockResolvedValue(true), save: vi.fn().mockResolvedValue(true),
      }
      mockFindByIdFn.mockResolvedValue(u)
      await expect(userService.changeUserPassword('u1', 'Old', 'NewPass123')).resolves.toBeUndefined()
    })

    it('should fail with wrong current', async () => {
      const u = {
        _id: { toString: () => 'u1' }, password: 'old-hash', passwordHash: 'old-hash',
        comparePassword: vi.fn().mockResolvedValue(false), save: vi.fn(),
      }
      mockFindByIdFn.mockResolvedValue(u)
      await expect(userService.changeUserPassword('u1', 'Wrong', 'NewPass123')).rejects.toThrow('Mật khẩu hiện tại')
    })

    it('should fail for no-password account', async () => {
      const u = {
        _id: { toString: () => 'u1' }, password: null, passwordHash: null,
        comparePassword: vi.fn(), save: vi.fn(),
      }
      mockFindByIdFn.mockResolvedValue(u)
      await expect(userService.changeUserPassword('u1', 'Any', 'NewPass123')).rejects.toThrow('chưa có mật khẩu')
    })
  })

  describe('getUsers', () => {
    it('should paginate', async () => {
      mockFindFn.mockResolvedValue([{ _id: 'u1' }, { _id: 'u2' }])
      mockCountFn.mockResolvedValue(2)
      const r = await userService.getUsers({ page: 1, limit: 20 })
      expect(r.users).toHaveLength(2)
      expect(r.pagination.total).toBe(2)
    })
  })

  describe('self-guards', () => {
    it('adminUpdateUser blocks self-edit', async () => {
      const u = { _id: { toString: () => 'user1' }, role: 'member', save: vi.fn() }
      mockFindByIdFn.mockResolvedValue(u)
      await expect(userService.adminUpdateUser('user1', { name: 'N' }, 'user1', 'admin')).rejects.toThrow('chính tài khoản')
    })

    it('changeUserRole blocks self', async () => {
      await expect(userService.changeUserRole('user1', 'admin', 'user1')).rejects.toThrow('chính mình')
    })

    it('softDeleteUser blocks self-delete', async () => {
      await expect(userService.softDeleteUser('user1', 'user1')).rejects.toThrow('chính tài khoản')
    })

    it('softDeleteUser blocks Super Admin deletion', async () => {
      const u = { _id: { toString: () => 'sa1' }, role: 'super_admin', deletedAt: null }
      mockFindByIdFn.mockResolvedValue(u)
      await expect(userService.softDeleteUser('sa1', 'admin1')).rejects.toThrow('Không thể xóa')
    })
  })
})
