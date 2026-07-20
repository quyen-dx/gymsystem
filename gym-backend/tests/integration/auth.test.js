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

vi.mock('../../src/services/loginHistoryService.js', () => ({
  recordLoginHistory: vi.fn(async () => {}),
  getLoginHistory: vi.fn(async () => ({ entries: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } })),
  getActiveSessions: vi.fn(async () => ({ sessions: [], count: 0 })),
  revokeDevice: vi.fn(async () => {}),
  revokeAllSessions: vi.fn(async () => ({ revokedCount: 0 })),
  unlockAccount: vi.fn(async () => {}),
  cleanupExpiredRefreshTokens: vi.fn(async () => ({ deletedCount: 0 })),
}))

vi.mock('../../src/config/db.js', () => ({
  isFallbackActive: () => false, reconnectToPrimary: vi.fn(), getFallbackError: () => null,
}))

vi.mock('../../src/config/passport.js', () => ({
  default: { initialize: () => (req, res, next) => next(), session: () => (req, res, next) => next() },
  isGoogleOAuthConfigured: false, isFacebookOAuthConfigured: false,
}))

vi.mock('../../src/services/tokenService.js', () => ({
  generateAccessToken: () => 'mock-access',
  generateRefreshToken: async () => ({ token: 'mock-refresh', expiresAt: new Date(), family: 'f' }),
  verifyAccessToken: async (token) => {
    if (token === 'valid-token') return { user: { _id: 'user1', role: 'member', isActive: true, status: 'active', isLocked: false, changedPasswordAfter: () => false } }
    if (token === 'admin-token') return { user: { _id: 'admin1', role: 'super_admin', isActive: true, status: 'active', isLocked: false, changedPasswordAfter: () => false } }
    throw Object.assign(new Error('Invalid'), { name: 'JsonWebTokenError' })
  },
  rotateRefreshToken: vi.fn(), decodeToken: vi.fn(),
}))

vi.mock('../../src/config/cloudinary.js', () => ({
  upload: { single: () => (req, res, next) => next(), fields: () => (req, res, next) => next() },
  default: {},
}))

import { default as authV2Routes } from '../../src/routes/authV2Routes.js'
import { default as userRoutes } from '../../src/routes/userRoutes.js'

const createApp = () => {
  const app = express()
  app.use(express.json())
  app.use('/api/v1/auth', authV2Routes)
  app.use('/api/users', userRoutes)
  app.use((err, req, res, _next) => {
    const statusCode = err.statusCode || 500
    res.status(statusCode).json({ success: false, error: { code: err.errorCode || 'ERROR', message: err.message || 'Server error' } })
  })
  return app
}

describe('Auth API Integration', () => {
  let app
  beforeEach(() => { app = createApp(); vi.clearAllMocks() })

  describe('POST /api/v1/auth/login', () => {
    it('should reject empty body', async () => {
      const res = await supertest(app).post('/api/v1/auth/login').send({})
      expect(res.status).toBeGreaterThanOrEqual(400)
    })

    it('should reject invalid email', async () => {
      const res = await supertest(app).post('/api/v1/auth/login').send({ email: 'not-email', password: 'Pass123' })
      expect(res.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('POST /api/v1/auth/register', () => {
    it('should reject empty body', async () => {
      const res = await supertest(app).post('/api/v1/auth/register').send({})
      expect(res.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('POST /api/v1/auth/logout', () => {
    it('should require auth', async () => {
      const res = await supertest(app).post('/api/v1/auth/logout').send({})
      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/v1/auth/refresh', () => {
    it('should require refresh token', async () => {
      const res = await supertest(app).post('/api/v1/auth/refresh').send({})
      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/v1/auth/login-history', () => {
    it('should require auth', async () => {
      const res = await supertest(app).get('/api/v1/auth/login-history')
      expect(res.status).toBe(401)
    })

    it('should not return 401 when token is valid', async () => {
      const res = await supertest(app).get('/api/v1/auth/login-history').set('Authorization', 'Bearer valid-token')
      expect(res.status).not.toBe(401)
    })
  })

  describe('DELETE /api/v1/auth/devices/:id', () => {
    it('should require auth', async () => {
      const res = await supertest(app).delete('/api/v1/auth/devices/507f1f77bcf86cd799439011')
      expect(res.status).toBe(401)
    })

    it('should reject invalid device ID', async () => {
      const res = await supertest(app).delete('/api/v1/auth/devices/bad').set('Authorization', 'Bearer valid-token')
      expect(res.status).toBe(422)
    })
  })

  describe('DELETE /api/v1/auth/devices', () => {
    it('should require auth', async () => {
      const res = await supertest(app).delete('/api/v1/auth/devices')
      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/v1/auth/sessions', () => {
    it('should require auth', async () => {
      const res = await supertest(app).get('/api/v1/auth/sessions')
      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/v1/auth/unlock', () => {
    it('should require auth', async () => {
      const res = await supertest(app).post('/api/v1/auth/unlock').send({ userId: '507f1f77bcf86cd799439011' })
      expect(res.status).toBe(401)
    })

    it('should reject non-super-admin', async () => {
      const res = await supertest(app).post('/api/v1/auth/unlock').set('Authorization', 'Bearer valid-token').send({ userId: '507f1f77bcf86cd799439011' })
      expect(res.status).toBe(403)
    })

    it('should validate userId format', async () => {
      const res = await supertest(app).post('/api/v1/auth/unlock').set('Authorization', 'Bearer admin-token').send({ userId: 'bad' })
      expect(res.status).toBe(422)
    })
  })
})
