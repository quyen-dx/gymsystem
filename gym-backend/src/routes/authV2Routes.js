import express from 'express'
import { protect } from '../middlewares/authMiddleware.js'
import { validateBody } from '../middlewares/validation.js'
import {
  authLoginLimiter,
  authRegisterLimiter,
  authOtpLimiter,
  authPasswordResetLimiter,
  authRefreshLimiter,
} from '../middlewares/rateLimiter.js'
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resendVerificationSchema,
  resetPasswordSchema,
} from '../validators/authValidator.js'
import * as authController from '../controllers/v2AuthController.js'

const router = express.Router()

router.post('/register', authRegisterLimiter, validateBody(registerSchema), authController.register)
router.post('/login', authLoginLimiter, validateBody(loginSchema), authController.login)
router.post('/refresh', authRefreshLimiter, authController.refresh)
router.post('/logout', protect, authController.logout)
router.post('/logout-all', protect, authController.logoutAll)
router.post('/verify-email', authOtpLimiter, validateBody(verifyEmailSchema), authController.verifyEmail)
router.post('/resend-verification', authOtpLimiter, validateBody(resendVerificationSchema), authController.resendVerification)
router.post('/forgot-password', authPasswordResetLimiter, validateBody(forgotPasswordSchema), authController.forgotPassword)
router.post('/reset-password', authPasswordResetLimiter, validateBody(resetPasswordSchema), authController.resetPassword)

export default router
