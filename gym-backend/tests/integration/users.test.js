import { describe, it, expect, vi, beforeEach } from 'vitest'
import supertest from 'supertest'
import express from 'express'

vi.mock('../../src/models/User.js', () => ({
  default: {
    findOne: vi.fn(), findById: vi.fn(), find: vi.fn(), create: vi.fn(),
    findByIdAndUpdate: vi.fn(), findByIdAndDelete: vi.fn(), countDocuments: vi.fn(),
  },
}))

vi.mock('../../src/models/RefreshToken.js', () => ({
  default: {
    findOne: vi.fn(), findOneAndUpdate: vi.fn(), revokeAllForUser: vi.fn(),
    countActiveByUser: vi.fn(), countDocuments: vi.fn(), find: vi.fn(),
    deleteMany: vi.fn(), rotate: vi.fn(), create: vi.fn(),
  },
}))

vi.mock('../../src/models/PasswordResetToken.js', () => ({
  default: { generate: vi.fn(), consume: vi.fn() },
}))

vi.mock('../../src/models/LoginHistory.js', () => ({
  default: { create: vi.fn(), find: vi.fn(), countDocuments: vi.fn() },
}))

vi.mock('../../src/services/tokenService.js', () => ({
  generateAccessToken: () => 'mock-access',
  generateRefreshToken: async () => ({ token: 'mock-refresh', expiresAt: new Date(), family: 'f' }),
  verifyAccessToken: async (token) => {
    if (token === 'valid-token') return { user: { _id: 'user1', role: 'member', isActive: true, status: 'active', isLocked: false, changedPasswordAfter: () => false } }
    if (token === 'admin-token') return { user: { _id: 'admin1', role: 'super_admin', isActive: true, status: 'active', isLocked: false, changedPasswordAfter: () => false } }
    if (token === 'staff-token') return { user: { _id: 'staff1', role: 'staff', isActive: true, status: 'active', isLocked: false, changedPasswordAfter: () => false } }
    throw Object.assign(new Error('Invalid'), { name: 'JsonWebTokenError' })
  },
  rotateRefreshToken: vi.fn(), decodeToken: vi.fn(),
}))

vi.mock('../../src/services/loginHistoryService.js', () => ({
  recordLoginHistory: vi.fn(async () => {}),
}))

vi.mock('../../src/config/cloudinary.js', () => ({
  upload: { single: () => (req, res, next) => next(), fields: () => (req, res, next) => next() },
  default: {},
}))

vi.mock('../../src/config/db.js', () => ({
  isFallbackActive: () => false, reconnectToPrimary: vi.fn(), getFallbackError: () => null,
}))

vi.mock('../../src/config/passport.js', () => ({
  default: { initialize: () => (req, res, next) => next(), session: () => (req, res, next) => next() },
  isGoogleOAuthConfigured: false, isFacebookOAuthConfigured: false,
}))

import { default as userRoutes } from '../../src/routes/userRoutes.js'

describe('User API Integration', () => {
  let app
  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use('/api/users', userRoutes)
    vi.clearAllMocks()
  })

  describe('GET /api/users/me', () => {
    it('should require auth', async () => {
      const res = await supertest(app).get('/api/users/me')
      expect(res.status).toBe(401)
    })
  })

  describe('PATCH /api/users/me', () => {
    it('should require auth', async () => {
      const res = await supertest(app).patch('/api/users/me').send({ name: 'New' })
      expect(res.status).toBe(401)
    })
  })

  describe('PATCH /api/users/me/password', () => {
    it('should require auth', async () => {
      const res = await supertest(app).patch('/api/users/me/password').send({ currentPassword: 'Old', newPassword: 'NewPass123' })
      expect(res.status).toBe(401)
    })

    it('should validate password strength', async () => {
      const res = await supertest(app).patch('/api/users/me/password').set('Authorization', 'Bearer valid-token').send({ currentPassword: 'Old', newPassword: 'short' })
      expect(res.status).toBe(422)
    })

    it('should require currentPassword', async () => {
      const res = await supertest(app).patch('/api/users/me/password').set('Authorization', 'Bearer valid-token').send({ newPassword: 'NewPass123' })
      expect(res.status).toBe(422)
    })
  })

  describe('GET /api/users (admin list)', () => {
    it('should require auth', async () => {
      const res = await supertest(app).get('/api/users')
      expect(res.status).toBe(401)
    })

    it('should reject member', async () => {
      const res = await supertest(app).get('/api/users').set('Authorization', 'Bearer valid-token')
      expect(res.status).toBe(403)
    })
  })

  describe('GET /api/users/:id', () => {
    it('should reject invalid ID', async () => {
      const res = await supertest(app).get('/api/users/bad').set('Authorization', 'Bearer admin-token')
      expect(res.status).toBe(422)
    })
  })

  describe('RBAC enforcement', () => {
    it('member blocked from role change', async () => {
      const res = await supertest(app).patch('/api/users/507f1f77bcf86cd799439011/role').set('Authorization', 'Bearer valid-token').send({ role: 'admin' })
      expect(res.status).toBe(403)
    })

    it('member blocked from delete', async () => {
      const res = await supertest(app).delete('/api/users/507f1f77bcf86cd799439011').set('Authorization', 'Bearer valid-token')
      expect(res.status).toBe(403)
    })

    it('member blocked from restore', async () => {
      const res = await supertest(app).post('/api/users/507f1f77bcf86cd799439011/restore').set('Authorization', 'Bearer valid-token')
      expect(res.status).toBe(403)
    })

    it('member blocked from user list', async () => {
      const res = await supertest(app).get('/api/users').set('Authorization', 'Bearer valid-token')
      expect(res.status).toBe(403)
    })
  })
})
