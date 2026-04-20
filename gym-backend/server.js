import cors from 'cors'
import express from 'express'
import session from 'express-session'
import connectDB from './src/config/db.js'
import passport from './src/config/passport.js'
import authRoutes from './src/routes/authRoutes.js'
import planRoutes from './src/routes/planRoutes.js'

const app = express()

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
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
app.use('/api/plans', planRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', message: 'GymSystem API is running' })
})

app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} không tồn tại` })
})

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(err.status || 500).json({
    message: err.message || 'Lỗi server',
  })
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

connectDB().catch((error) => {
  console.error('Kết nối MongoDB thất bại:', error.message)
})
