import cors from 'cors'
import express from 'express'
import session from 'express-session'
import connectDB from './src/config/db.js'
import passport from './src/config/passport.js'
import { getMyProducts } from './src/controllers/productController.js'
import { protect, sellerOnly } from './src/middlewares/authMiddleware.js'
import addressRoutes from './src/routes/addressRoutes.js'
import aiRoutes from './src/routes/aiRoutes.js'
import auditLogRoutes from './src/routes/auditLogRoutes.js'
import authRoutes from './src/routes/authRoutes.js'
import orderRoutes from './src/routes/orderRoutes.js'
import paymentRoutes from './src/routes/paymentRoutes.js'
import planRoutes from './src/routes/planRoutes.js'
import productRoutes from './src/routes/productRoutes.js'
import sellerRoutes from './src/routes/sellerRoutes.js'
import shopRoutes from './src/routes/shopRoutes.js'
import walletRoutes from './src/routes/walletRoutes.js'
import { getClientUrls } from './src/config/appUrls.js'

const app = express()

app.use(
  cors({
    origin: getClientUrls(),
    credentials: true,
  }),
)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(
  session({
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'gym-system-session',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
)

app.use(passport.initialize())
app.use(passport.session())

app.use('/api/auth', authRoutes)
app.use('/api/audit-logs', auditLogRoutes)
app.get('/api/my-products', protect, sellerOnly, getMyProducts)
app.use('/api/plans', planRoutes)
app.use('/api/products', productRoutes)
app.use('/api/shops', shopRoutes)
app.use('/api/wallet', walletRoutes)
app.use('/api/addresses', addressRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/payment', paymentRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/seller', sellerRoutes)
app.use('/api/ai-assistant', aiRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', message: 'GymSystem API is running' })
})

app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} không tồn tại` })
})

app.use((err, req, res, next) => {
  console.error(err.stack)
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
})

connectDB().catch((error) => {
  console.error('Kết nối MongoDB thất bại:', error.message)
})
