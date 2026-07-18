import 'dotenv/config'
import http from 'http'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import session from 'express-session'
import { getClientUrls } from './src/config/appUrls.js'
import connectDB, { isFallbackActive, reconnectToPrimary, getFallbackError } from './src/config/db.js'
import passport from './src/config/passport.js'
import { getMyProducts } from './src/controllers/productController.js'
import { handleStripeWebhook } from './src/controllers/walletController.js'
import { stripeMembershipWebhook } from './src/controllers/membershipController.js'
import { protect, sellerOnly } from './src/middlewares/authMiddleware.js'
import { maintenanceModeGuard } from './src/middlewares/maintenanceMiddleware.js'
import sendError from './src/utils/sendError.js'
import addressRoutes from './src/routes/addressRoutes.js'
import auditLogRoutes from './src/routes/auditLogRoutes.js'
import authRoutes from './src/routes/authRoutes.js'
import checkInRoutes from './src/routes/checkInRoutes.js'
import cmsRoutes from './src/routes/cmsRoutes.js'
import memberRoutes from './src/routes/memberRoutes.js'
import membershipRoutes from './src/routes/membershipRoutes.js'
import ptRoutes from './src/routes/ptRoutes.js'
import orderRoutes from './src/routes/orderRoutes.js'
import partnershipRequestRoutes from './src/routes/partnershipRequestRoutes.js'
import planRoutes from './src/routes/planRoutes.js'
import planFeatureRoutes from './src/routes/planFeatureRoutes.js'
import productRoutes from './src/routes/productRoutes.js'
import sellerRoutes from './src/routes/sellerRoutes.js'
import shopRoutes from './src/routes/shopRoutes.js'
import systemExperienceRoutes from './src/routes/systemExperienceRoutes.js'
import systemSettingsRoutes from './src/routes/systemSettingsRoutes.js'
import walletRoutes from './src/routes/walletRoutes.js'
import bookingRoutes from './src/routes/bookingRoutes.js'
import policyConsentRoutes from './src/routes/policyConsentRoutes.js'
import healthRoutes from './src/routes/healthRoutes.js'
import workoutRoutes from './src/routes/workoutRoutes.js'
import workoutLibraryRoutes from './src/routes/workoutLibraryRoutes.js'
import workoutImprovementRoutes from './src/routes/workoutImprovementRoutes.js'
import workoutReportRoutes from './src/routes/workoutReportRoutes.js'
import specializationRoutes from './src/routes/specializationRoutes.js'
import scheduleRoutes from './src/routes/scheduleRoutes.js'
import ptAssignmentRoutes from './src/routes/ptAssignmentRoutes.js'
import ptAssignmentEndRoutes from './src/routes/ptAssignmentEndRoutes.js'
import trainingRequestRoutes from './src/routes/trainingRequestRoutes.js'
import trainingAssignmentRoutes from './src/routes/trainingAssignmentRoutes.js'
import trainingClassRoutes from './src/routes/trainingClassRoutes.js'
import floorZoneRoutes from './src/routes/floorZoneRoutes.js'
import trainerScheduleRoutes from './src/routes/trainerScheduleRoutes.js'
import trainerReplacementRoutes from './src/routes/trainerReplacementRoutes.js'
import shiftSwapRoutes from './src/routes/shiftSwapRoutes.js'

import groupClassRoutes from "./src/routes/groupClassRoutes.js"
import reportRoutes from "./src/routes/reportRoutes.js"
import notificationRoutes from "./src/routes/notificationRoutes.js"
import { startMembershipReminderScheduler } from './src/services/membershipReminderScheduler.js'
import { initSocketIO } from './src/services/socketService.js'

const app = express()
const allowedOrigins = [...new Set([
    'http://localhost:5173',
    ...getClientUrls()
])]

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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.post('/api/wallet/stripe-webhook', express.raw({ type: 'application/json' }), handleStripeWebhook)
app.post('/api/memberships/stripe-webhook', express.raw({ type: 'application/json' }), stripeMembershipWebhook)
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: true, limit: '5mb' }))
app.use(cookieParser())

app.use(
  session({
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'gym-system-session',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
    },
  }),
)

app.use(passport.initialize())
app.use(passport.session())

app.use(maintenanceModeGuard)

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
app.use("/api/group-classes", groupClassRoutes)
app.use("/api/admin/reports", reportRoutes)
app.use("/api/notifications", notificationRoutes)

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

app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} không tồn tại` })
})

app.use((err, req, res, next) => {
  console.error(err.stack)
  sendError(res, err)
})

const PORT = process.env.PORT || 5000

const httpServer = http.createServer(app)
initSocketIO(httpServer)

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

connectDB()
  .then(() => {
    startMembershipReminderScheduler()
  })
  .catch((error) => {
    console.error('Kết nối MongoDB thất bại:', error.message)
  })
