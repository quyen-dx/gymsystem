import express from 'express'
import { cancelDeposit, confirmDeposit, createDepositTransaction, createStripePaymentIntent, fakeDeposit, getMyWallet, getMyWalletTransactions, getStripeExchangeRate, transferWallet } from '../controllers/walletController.js'
import { protect } from '../middlewares/authMiddleware.js'
import { requireFeature } from '../middlewares/systemSettingsMiddleware.js'

const router = express.Router()

router.use(protect)
router.get('/', getMyWallet)
router.get('/transactions', getMyWalletTransactions)
router.get('/stripe-exchange-rate', getStripeExchangeRate)
router.post('/deposit', requireFeature('billing.qrPaymentEnabled'), createDepositTransaction)
router.post('/create-payment-intent', requireFeature('billing.qrPaymentEnabled'), createStripePaymentIntent)
router.post('/deposit/confirm', requireFeature('billing.qrPaymentEnabled'), confirmDeposit)
router.patch('/deposit/:transactionId/cancel', requireFeature('billing.qrPaymentEnabled'), cancelDeposit)
router.post('/fake-deposit', requireFeature('billing.qrPaymentEnabled'), fakeDeposit)
router.post('/transfer', transferWallet)

export default router
