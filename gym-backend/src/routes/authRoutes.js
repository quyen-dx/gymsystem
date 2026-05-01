import express from 'express'
import passport from '../config/passport.js'
import { upload } from '../config/cloudinary.js'
import { isGoogleOAuthConfigured, isFacebookOAuthConfigured } from '../config/passport.js'
import {
  buildGoogleOauthRedirect,
  buildFacebookOauthRedirect,
  changePassword,
  deleteUser,
  enableSellerMode,
  getAllUsers,
  getMe,
  login,
  logout,
  refreshToken,
  registerFacebook,
  resetPassword,
  sendForgotPasswordOtp,
  sendRegisterOtp,
  setPassword,
  toggleUserStatus,
  updateProfile,
  updateUserRole,
  verifyForgotPasswordOtp,
  verifyRegisterOtp,
} from '../controllers/authController.js'
import { adminOnly, protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

const ensureGoogleOAuthConfigured = (_req, res, next) => {
  if (!isGoogleOAuthConfigured) {
    return res.status(500).json({ message: 'Google OAuth chưa được cấu hình' })
  }
  next()
}

const ensureFacebookOAuthConfigured = (_req, res, next) => {
  if (!isFacebookOAuthConfigured) {
    return res.status(500).json({ message: 'Facebook OAuth chưa được cấu hình' })
  }
  next()
}

// Google
router.get('/google', ensureGoogleOAuthConfigured, passport.authenticate('google', { scope: ['profile', 'email'] }))
router.get(
  '/google/callback',
  ensureGoogleOAuthConfigured,
  (req, res, next) => {
    passport.authenticate('google', { session: false }, async (err, user) => {
      if (err) return next(err)
      if (!user) return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=google_oauth_failed`)
      try {
        const redirectUrl = await buildGoogleOauthRedirect(user)
        return res.redirect(redirectUrl)
      } catch (error) {
        return next(error)
      }
    })(req, res, next)
  }
)

// Facebook
router.get('/facebook', ensureFacebookOAuthConfigured, passport.authenticate('facebook'))
router.get(
  '/facebook/callback',
  ensureFacebookOAuthConfigured,
  (req, res, next) => {
    passport.authenticate('facebook', { session: false }, async (err, user) => {
      if (err) return next(err)
      if (!user) return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=facebook_oauth_failed`)
      try {
        const redirectUrl = await buildFacebookOauthRedirect(user)
        return res.redirect(redirectUrl)
      } catch (error) {
        return next(error)
      }
    })(req, res, next)
  }
)

router.post('/register/send-otp', sendRegisterOtp)
router.post('/register/verify-otp', verifyRegisterOtp)
router.post('/register/facebook', registerFacebook)
router.post('/login', login)
router.post('/refresh-token', refreshToken)

router.post('/forgot-password/send-otp', sendForgotPasswordOtp)
router.post('/forgot-password/verify-otp', verifyForgotPasswordOtp)
router.post('/forgot-password/reset', resetPassword)

router.get('/me', protect, getMe)
router.put('/update-profile', protect, upload.single('avatar'), updateProfile)
router.put('/change-password', protect, changePassword)
router.put('/set-password', protect, setPassword)
router.post('/logout', protect, logout)
router.post('/seller/enable', protect, enableSellerMode)

router.get('/users', protect, adminOnly, getAllUsers)
router.patch('/users/:id/role', protect, adminOnly, updateUserRole)
router.patch('/users/:id/toggle-status', protect, adminOnly, toggleUserStatus)
router.delete('/users/:id', protect, adminOnly, deleteUser)

export default router
