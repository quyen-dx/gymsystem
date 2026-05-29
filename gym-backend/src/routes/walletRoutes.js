import express from 'express'
import { cancelDeposit, confirmDeposit, createDepositTransaction, createStripePaymentIntent, fakeDeposit, getMyWallet, getMyWalletTransactions, getStripeExchangeRate, transferWallet } from '../controllers/walletController.js'
import { protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)
router.get('/', getMyWallet)
router.get('/transactions', getMyWalletTransactions)
router.get('/stripe-exchange-rate', getStripeExchangeRate)
router.post('/deposit', createDepositTransaction)
router.post('/create-payment-intent', createStripePaymentIntent)
router.post('/deposit/confirm', confirmDeposit)
router.patch('/deposit/:transactionId/cancel', cancelDeposit)
router.post('/fake-deposit', fakeDeposit)
router.post('/transfer', transferWallet)

export default router
