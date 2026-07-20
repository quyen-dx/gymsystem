import rateLimit from 'express-rate-limit'
import { rateLimit as rateLimitConfig } from '../config/env.js'

const makeHandler = (windowMs) => (req, res) => {
  res.status(429).json({
    success: false,
    message: 'Too many requests. Please try again later.',
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
      retryAfter: Math.ceil(windowMs / 1000),
    },
  })
}

const rateLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: rateLimitConfig.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler(rateLimitConfig.windowMs),
})

export const authLoginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler(60 * 1000),
})

export const authRegisterLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler(60 * 1000),
})

export const authOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler(15 * 60 * 1000),
})

export const authPasswordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler(60 * 60 * 1000),
})

export const authRefreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: makeHandler(60 * 1000),
})

export default rateLimiter
