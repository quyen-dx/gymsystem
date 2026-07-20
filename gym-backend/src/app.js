import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'
import session from 'express-session'
import helmet from 'helmet'
import { getClientUrls } from './config/appUrls.js'
import passport from './config/passport.js'
import { handleStripeWebhook } from './controllers/walletController.js'
import { stripeMembershipWebhook } from './controllers/membershipController.js'
import { getMyProducts } from './controllers/productController.js'
import { protect, sellerOnly } from './middlewares/authMiddleware.js'
import { maintenanceModeGuard } from './middlewares/maintenanceMiddleware.js'
import requestId from './middlewares/requestId.js'
import requestLogger from './middlewares/requestLogger.js'
import rateLimiter from './middlewares/rateLimiter.js'
import notFound from './middlewares/notFound.js'
import errorHandler from './middlewares/errorHandler.js'
import { isFallbackActive, reconnectToPrimary, getFallbackError } from './config/db.js'
import infraRoutes from './routes/infraRoutes.js'

import addressRoutes from './routes/addressRoutes.js'
import auditLogRoutes from './routes/auditLogRoutes.js'
import authRoutes from './routes/authRoutes.js'
import checkInRoutes from './routes/checkInRoutes.js'
import cmsRoutes from './routes/cmsRoutes.js'
import memberRoutes from './routes/memberRoutes.js'
import membershipRoutes from './routes/membershipRoutes.js'
import ptRoutes from './routes/ptRoutes.js'
import orderRoutes from './routes/orderRoutes.js'
import partnershipRequestRoutes from './routes/partnershipRequestRoutes.js'
import planRoutes from './routes/planRoutes.js'
import planFeatureRoutes from './routes/planFeatureRoutes.js'
import productRoutes from './routes/productRoutes.js'
import sellerRoutes from './routes/sellerRoutes.js'
import shopRoutes from './routes/shopRoutes.js'
import systemExperienceRoutes from './routes/systemExperienceRoutes.js'
import systemSettingsRoutes from './routes/systemSettingsRoutes.js'
import walletRoutes from './routes/walletRoutes.js'
import bookingRoutes from './routes/bookingRoutes.js'
import policyConsentRoutes from './routes/policyConsentRoutes.js'
import healthRoutes from './routes/healthRoutes.js'
import workoutRoutes from './routes/workoutRoutes.js'
import workoutLibraryRoutes from './routes/workoutLibraryRoutes.js'
import workoutImprovementRoutes from './routes/workoutImprovementRoutes.js'
import workoutReportRoutes from './routes/workoutReportRoutes.js'
import specializationRoutes from './routes/specializationRoutes.js'
import scheduleRoutes from './routes/scheduleRoutes.js'
import ptAssignmentRoutes from './routes/ptAssignmentRoutes.js'
import ptAssignmentEndRoutes from './routes/ptAssignmentEndRoutes.js'
import trainingRequestRoutes from './routes/trainingRequestRoutes.js'
import trainingAssignmentRoutes from './routes/trainingAssignmentRoutes.js'
import trainingClassRoutes from './routes/trainingClassRoutes.js'
import floorZoneRoutes from './routes/floorZoneRoutes.js'
import trainerScheduleRoutes from './routes/trainerScheduleRoutes.js'
import trainerReplacementRoutes from './routes/trainerReplacementRoutes.js'
import shiftSwapRoutes from './routes/shiftSwapRoutes.js'
import groupClassRoutes from './routes/groupClassRoutes.js'
import reportRoutes from './routes/reportRoutes.js'
import notificationRoutes from './routes/notificationRoutes.js'

const createApp = () => {
  const app = express()

  const allowedOrigins = [...new Set([
    'http://localhost:5173',
    ...getClientUrls(),
  ])]

  app.use(helmet())

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`))
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  }))

  app.post('/api/wallet/stripe-webhook', express.raw({ type: 'application/json' }), handleStripeWebhook)
  app.post('/api/memberships/stripe-webhook', express.raw({ type: 'application/json' }), stripeMembershipWebhook)

  app.use(express.json({ limit: '5mb' }))
  app.use(express.urlencoded({ extended: true, limit: '5mb' }))
  app.use(cookieParser())

  app.use(requestId)
  app.use(requestLogger)
  app.use(rateLimiter)

  app.use(
    session({
      secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'gym-system-session',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false },
    }),
  )

  app.use(passport.initialize())
  app.use(passport.session())
  app.use(maintenanceModeGuard)

  app.use('/api/v1', infraRoutes)

  app.use('/api/auth', authRoutes)
  app.use('/api/cms', cmsRoutes)
  app.use('/api/members', memberRoutes)
  app.use('/api/staff/members', memberRoutes)
  app.use('/api/checkin', checkInRoutes)
  app.use('/api/staff/checkin', checkInRoutes)
  app.use('/api/audit-logs', auditLogRoutes)
  app.get('/api/my-products', protect, sellerOnly, getMyProducts)
  app.use('/api/plans', planRoutes)
  app.use('/api/plan-features', planFeatureRoutes)
  app.use('/api/products', productRoutes)
  app.use('/api/shops', shopRoutes)
  app.use('/api/wallet', walletRoutes)
  app.use('/api/addresses', addressRoutes)
  app.use('/api/orders', orderRoutes)
  app.use('/api/seller', sellerRoutes)
  app.use('/api/memberships', membershipRoutes)
  app.use('/api/partnership-requests', partnershipRequestRoutes)
  app.use('/api/pts', ptRoutes)
  app.use('/api/system-experience', systemExperienceRoutes)
  app.use('/api/system-settings', systemSettingsRoutes)
  app.use('/api/bookings', bookingRoutes)
  app.use('/api/policy-consents', policyConsentRoutes)
  app.use('/api/workouts', workoutRoutes)
  app.use('/api/workout', workoutRoutes)
  app.use('/api/workout-library', workoutLibraryRoutes)
  app.use('/api/workout-improvements', workoutImprovementRoutes)
  app.use('/api/workout-reports', workoutReportRoutes)
  app.use('/api/specializations', specializationRoutes)
  app.use('/api/schedules', scheduleRoutes)
  app.use('/api/pt-assignments', ptAssignmentRoutes)
  app.use('/api/pt-assignment-end-requests', ptAssignmentEndRoutes)
  app.use('/api/training-requests', trainingRequestRoutes)
  app.use('/api/training-assignments', trainingAssignmentRoutes)
  app.use('/api/training-classes', trainingClassRoutes)
  app.use('/api/floors-zones', floorZoneRoutes)
  app.use('/api/trainer-schedules', trainerScheduleRoutes)
  app.use('/api/trainer-replacements', trainerReplacementRoutes)
  app.use('/api/shift-swaps', shiftSwapRoutes)
  app.use('/api/health', healthRoutes)
  app.use('/api/group-classes', groupClassRoutes)
  app.use('/api/admin/reports', reportRoutes)
  app.use('/api/notifications', notificationRoutes)

  app.get('/api/system/status', (_req, res) => {
    res.json({
      status: 'OK',
      database: isFallbackActive() ? 'local_fallback' : 'atlas',
      fallbackActive: isFallbackActive(),
      fallbackError: getFallbackError(),
    })
  })

  app.post('/api/system/reconnect', async (_req, res) => {
    const result = await reconnectToPrimary()
    if (result.success) {
      res.json({ message: 'Đã kết nối lại Atlas', database: 'atlas' })
    } else {
      res.status(503).json({ message: 'Không thể kết nối Atlas', database: 'local_fallback' })
    }
  })

  app.use(notFound)
  app.use(errorHandler)

  return app
}

export default createApp
