import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),

  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  MONGO_URI: z.string().min(1, 'MONGO_URI is required for database connection'),
  MONGODB_URI: z.string().optional(),
  MONGODB_LOCAL_URI: z.string().default('mongodb://127.0.0.1:27017/gym'),

  JWT_SECRET: z.string().min(1).default('gympro-dev-jwt-secret'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(1).default('gympro-dev-refresh-secret'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  GEMINI_MAX_TOKENS: z.coerce.number().int().min(1).default(2048),
  GEMINI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.7),

  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  VNPAY_TMN_CODE: z.string().optional(),
  VNPAY_HASH_SECRET: z.string().optional(),
  VNPAY_PAYMENT_URL: z.string().default('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'),

  GHN_TOKEN: z.string().optional(),
  GHN_SHOP_ID: z.string().optional(),

  MAINTENANCE_MODE: z.coerce.boolean().default(false),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(100),
})

let parsed = null

try {
  parsed = envSchema.parse(process.env)
} catch (error) {
  console.error('❌ Invalid environment configuration:')
  if (error instanceof z.ZodError) {
    for (const issue of error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
    }
  }
  process.exit(1)
}

const env = parsed

export const isProduction = env.NODE_ENV === 'production'
export const isStaging = env.NODE_ENV === 'staging'
export const isDevelopment = env.NODE_ENV === 'development'

export const mongoUri = env.MONGODB_URI || env.MONGO_URI
export const mongoLocalUri = env.MONGODB_LOCAL_URI

export const jwt = {
  secret: env.JWT_SECRET,
  expiresIn: env.JWT_EXPIRES_IN,
  refreshSecret: env.JWT_REFRESH_SECRET,
  refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
}

export const gemini = {
  apiKey: env.GEMINI_API_KEY,
  model: env.GEMINI_MODEL,
  maxTokens: env.GEMINI_MAX_TOKENS,
  temperature: env.GEMINI_TEMPERATURE,
}

export const cors = {
  origins: env.CORS_ORIGINS,
}

export const log = {
  level: env.LOG_LEVEL,
}

export const stripe = {
  secretKey: env.STRIPE_SECRET_KEY,
  webhookSecret: env.STRIPE_WEBHOOK_SECRET,
}

export const vnpay = {
  tmnCode: env.VNPAY_TMN_CODE,
  hashSecret: env.VNPAY_HASH_SECRET,
  paymentUrl: env.VNPAY_PAYMENT_URL,
}

export const ghn = {
  token: env.GHN_TOKEN,
  shopId: env.GHN_SHOP_ID,
}

export const maintenance = {
  mode: env.MAINTENANCE_MODE,
}

export const rateLimit = {
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
}

export default {
  env: env.NODE_ENV,
  port: env.PORT,
  isProduction,
  isStaging,
  isDevelopment,
  mongodb: { uri: mongoUri, localUri: mongoLocalUri },
  jwt,
  gemini,
  cors,
  log,
  stripe,
  vnpay,
  ghn,
  maintenance,
  rateLimit,
}
