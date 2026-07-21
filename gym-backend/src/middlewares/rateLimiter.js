import rateLimit from 'express-rate-limit'

const skipInDev = () => process.env.NODE_ENV === 'development'

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

const defaults = {
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInDev,
}

export const authLoginLimiter = rateLimit({
  ...defaults,
  windowMs: 60 * 1000,
  max: 10,
  handler: makeHandler(60 * 1000),
})

export const authRegisterLimiter = rateLimit({
  ...defaults,
  windowMs: 60 * 1000,
  max: 5,
  handler: makeHandler(60 * 1000),
})

export const authOtpLimiter = rateLimit({
  ...defaults,
  windowMs: 15 * 60 * 1000,
  max: 5,
  handler: makeHandler(15 * 60 * 1000),
})

export const authPasswordResetLimiter = rateLimit({
  ...defaults,
  windowMs: 60 * 60 * 1000,
  max: 3,
  handler: makeHandler(60 * 60 * 1000),
})

export const authRefreshLimiter = rateLimit({
  ...defaults,
  windowMs: 60 * 1000,
  max: 30,
  handler: makeHandler(60 * 1000),
})
