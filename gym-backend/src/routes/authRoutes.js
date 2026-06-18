import express from 'express'
import { upload } from '../config/cloudinary.js'
import passport, { isFacebookOAuthConfigured, isGoogleOAuthConfigured } from '../config/passport.js'
import {
  buildFacebookOauthRedirect,
  buildGoogleOauthRedirect,
  changePassword,
  confirmEmailChange,
  deleteUser,
  enableSellerMode,
  getAllUsers,
  getMe,
  getUserById,
  hasPassword,
  isAccountLocked,
  login,
  logout,
  refreshToken,
  registerFacebook,
  requestEmailChangeOtp,
  requestPasswordResetOtp,
  resetPassword,
  resetPasswordWithOtp,
  sendForgotPasswordOtp,
  sendRegisterOtp,
  setPassword,
  toggleUserStatus,
  updateProfile,
  updateUserRole,
  verifyForgotPasswordOtp,
  verifyRegisterOtp,
  getPendingVerifications,
  approveVerification,
  rejectVerification,
} from '../controllers/authController.js'
import { adminOnly, protect } from '../middlewares/authMiddleware.js'
import { buildClientUrl } from '../config/appUrls.js'
import { disabledFeatureMessage, isFeatureEnabled } from '../services/systemSettingsService.js'

const router = express.Router()

const ensureGoogleOAuthConfigured = (_req, res, next) => {
  if (!isGoogleOAuthConfigured) {
    return res.status(500).json({ message: 'Google OAuth chưa được cấu hình' })
  }
  next()
}

const ensureGoogleOAuthEnabled = async (_req, res, next) => {
  if (!(await isFeatureEnabled('auth.googleOAuthEnabled'))) {
    return res.status(403).json({ code: 'FEATURE_DISABLED', message: disabledFeatureMessage })
  }
  next()
}

const ensureFacebookOAuthConfigured = (_req, res, next) => {
  if (!isFacebookOAuthConfigured) {
    return res.status(500).json({ message: 'Facebook OAuth chưa được cấu hình' })
  }
  next()
}

const ensureFacebookOAuthEnabled = async (_req, res, next) => {
  if (!(await isFeatureEnabled('auth.facebookOAuthEnabled'))) {
    return res.status(403).json({ code: 'FEATURE_DISABLED', message: disabledFeatureMessage })
  }
  next()
}

// Google
router.get('/google', ensureGoogleOAuthConfigured, ensureGoogleOAuthEnabled, passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' }))
router.get(
  '/google/callback',
  ensureGoogleOAuthConfigured,
  ensureGoogleOAuthEnabled,
  (req, res, next) => {
    passport.authenticate('google', { session: false }, async (err, user) => {
      if (err) return res.redirect(buildClientUrl('/oauth-success', { error: 'SERVER_ERROR' }))
      if (!user) return res.redirect(buildClientUrl('/oauth-success', { error: 'GOOGLE_AUTH_FAILED' }))
      if (isAccountLocked(user)) return res.redirect(buildClientUrl('/oauth-success', { error: 'ACCOUNT_LOCKED' }))
      try {
        const redirectUrl = await buildGoogleOauthRedirect(user, res)
        return res.redirect(redirectUrl)
      } catch (error) {
        return res.redirect(buildClientUrl('/oauth-success', { error: 'SERVER_ERROR' }))
      }
    })(req, res, next)
  }
)

// Facebook
router.get('/facebook', ensureFacebookOAuthConfigured, ensureFacebookOAuthEnabled, passport.authenticate('facebook'))
router.get(
  '/facebook/callback',
  ensureFacebookOAuthConfigured,
  ensureFacebookOAuthEnabled,
  (req, res, next) => {
    passport.authenticate('facebook', { session: false }, async (err, user) => {
      if (err) return next(err)
      if (!user) return res.redirect(buildClientUrl('/login', { error: 'facebook_oauth_failed' }))
      try {
        const redirectUrl = await buildFacebookOauthRedirect(user, res)
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
router.post('/refresh', refreshToken)
router.post('/refresh-token', refreshToken)

router.post('/forgot-password/send-otp', sendForgotPasswordOtp)
router.post('/forgot-password/verify-otp', verifyForgotPasswordOtp)
router.post('/forgot-password/reset', resetPassword)

router.get('/me', protect, getMe)
router.get('/has-password', protect, hasPassword)
router.put('/update-profile', protect, upload.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 },
  { name: 'identityFrontImage', maxCount: 1 },
  { name: 'identityBackImage', maxCount: 1 },
]), updateProfile)
router.put('/change-password', protect, changePassword)
router.post('/request-password-reset-otp', protect, requestPasswordResetOtp)
router.post('/reset-password-with-otp', protect, resetPasswordWithOtp)
router.post('/change-email/request', protect, requestEmailChangeOtp)
router.post('/change-email/confirm', protect, confirmEmailChange)
router.post('/add-password', protect, setPassword)
router.put('/set-password', protect, setPassword)
router.post('/logout', logout)
router.post('/seller/enable', protect, enableSellerMode)

router.get('/users', protect, adminOnly, getAllUsers)
router.get('/users/:id', protect, adminOnly, getUserById)
router.patch('/users/:id/role', protect, adminOnly, updateUserRole)
router.patch('/users/:id/toggle-status', protect, adminOnly, toggleUserStatus)
router.delete('/users/:id', protect, adminOnly, deleteUser)

router.get('/verifications/pending', protect, adminOnly, getPendingVerifications)
router.post('/verifications/:id/approve', protect, adminOnly, approveVerification)
router.post('/verifications/:id/reject', protect, adminOnly, rejectVerification)

export default router
