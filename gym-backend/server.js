import 'dotenv/config'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import session from 'express-session'
import { getClientUrls } from './src/config/appUrls.js'
import connectDB from './src/config/db.js'
import passport from './src/config/passport.js'
import { getMyProducts } from './src/controllers/productController.js'
import { handleStripeWebhook } from './src/controllers/walletController.js'
import { stripeMembershipWebhook } from './src/controllers/membershipController.js'
import { protect, sellerOnly } from './src/middlewares/authMiddleware.js'
import { maintenanceModeGuard } from './src/middlewares/maintenanceMiddleware.js'
import addressRoutes from './src/routes/addressRoutes.js'
import adminAiRoutes from './src/routes/adminAiRoutes.js'
import aiRoutes from './src/routes/aiRoutes.js'
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
import productRoutes from './src/routes/productRoutes.js'
import sellerRoutes from './src/routes/sellerRoutes.js'
import shopRoutes from './src/routes/shopRoutes.js'
import systemExperienceRoutes from './src/routes/systemExperienceRoutes.js'
import systemSettingsRoutes from './src/routes/systemSettingsRoutes.js'
import walletRoutes from './src/routes/walletRoutes.js'
import bookingRoutes from './src/routes/bookingRoutes.js'
import policyConsentRoutes from './src/routes/policyConsentRoutes.js'
import groupClassRoutes from "./src/routes/groupClassRoutes.js"
import reportRoutes from "./src/routes/reportRoutes.js"
import notificationRoutes from "./src/routes/notificationRoutes.js"

const app = express()
app.use(cors({
    origin: 'http://localhost:5173', 
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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
app.use('/api/products', productRoutes)
app.use('/api/shops', shopRoutes)
app.use('/api/wallet', walletRoutes)
app.use('/api/addresses', addressRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/seller', sellerRoutes)
app.use('/api/memberships', membershipRoutes)
app.use('/api/partnership-requests', partnershipRequestRoutes)
app.use('/api/pts', ptRoutes)
app.use('/api/ai-assistant', aiRoutes)
app.use('/api/admin/ai', adminAiRoutes)
app.use('/api/system-experience', systemExperienceRoutes)
app.use('/api/system-settings', systemSettingsRoutes)
app.use('/api/bookings', bookingRoutes)
app.use('/api/policy-consents', policyConsentRoutes)
app.use("/api/group-classes", groupClassRoutes)
app.use("/api/admin/reports", reportRoutes)
app.use("/api/notifications", notificationRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', message: 'GymPro API is running' })
})

app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} không tồn tại` })
})

app.use((err, req, res, next) => {
  console.error(err.stack)

  if (err.code === 11000 || err.code === 11001) {
    const field = Object.keys(err.keyPattern || {}).join(', ')
    return res.status(409).json({
      success: false,
      message: field === 'referenceId'
        ? 'Dữ liệu bị trùng lặp. Vui lòng thử lại.'
        : `Dữ liệu bị trùng lặp ở trường "${field}". Vui lòng kiểm tra lại.`,
      code: 409,
    })
  }

  const status = err.statusCode || err.status || 500
  res.status(status).json({
    success: false,
    message: err.message || 'Lỗi server',
    code: status,
  })
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log('Gemini:', !!process.env.GEMINI_API_KEY)
  console.log('Gemini Admin:', !!process.env.GEMINI_API_KEY_ADMIN)
  console.log('OpenRouter:', !!process.env.OPENROUTER_API_KEY)
  console.log('Groq:', !!process.env.GROQ_API_KEY)
})

connectDB().catch((error) => {
  console.error('Kết nối MongoDB thất bại:', error.message)
})
//kmmmaaxz