import express from 'express'
import { protect, superAdminOnly } from '../middlewares/authMiddleware.js'
import { validateBody, validateQuery, validateParams } from '../middlewares/validation.js'
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
import {
  loginHistoryQuerySchema,
  deviceIdParamsSchema,
  unlockBodySchema,
} from '../validators/loginHistoryValidator.js'
import * as authController from '../controllers/v2AuthController.js'
import * as hardeningController from '../controllers/loginHistoryController.js'

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

router.get('/login-history', protect, validateQuery(loginHistoryQuerySchema), hardeningController.getHistory)
router.get('/sessions', protect, hardeningController.getSessions)
router.delete('/devices/:id', protect, validateParams(deviceIdParamsSchema), hardeningController.revokeDeviceHandler)
router.delete('/devices', protect, hardeningController.revokeAllHandler)
router.post('/unlock', protect, superAdminOnly, validateBody(unlockBodySchema), hardeningController.unlockHandler)

export default router
