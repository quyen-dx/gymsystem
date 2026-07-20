import rateLimit from 'express-rate-limit'
import { rateLimit as rateLimitConfig } from '../config/env.js'

const rateLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  max: rateLimitConfig.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again later.',
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        statusCode: 429,
        retryAfter: Math.ceil(rateLimitConfig.windowMs / 1000),
      },
    })
  },
})

export default rateLimiter
