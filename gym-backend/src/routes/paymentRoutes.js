import express from 'express'
import { createSandboxPayment, getSandboxPayment, handlePaymentWebhook, simulateSandboxPayment } from '../controllers/paymentController.js'
import { protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.post('/create', protect, createSandboxPayment)
router.post('/simulate-success', protect, simulateSandboxPayment)
router.get('/:orderId', protect, getSandboxPayment)
router.post('/webhook/:provider', handlePaymentWebhook)

export default router
