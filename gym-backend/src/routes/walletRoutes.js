import express from 'express'
import { cancelDeposit, confirmDeposit, createDepositTransaction, createManualQrDepositPayment, createStripePaymentIntent, createVnpayDepositPayment, fakeDeposit, getManualQrDepositInfo, getMyDepositPayments, getMyWallet, getMyWalletTransactions, getStripeExchangeRate, handleManualQrScan, handleVnpayReturn, transferWallet } from '../controllers/walletController.js'
import { protect } from '../middlewares/authMiddleware.js'
import { requireFeature } from '../middlewares/systemSettingsMiddleware.js'

const router = express.Router()

router.get('/vnpay-return', handleVnpayReturn)
router.get('/manual-qr-scan/:txnRef', handleManualQrScan)
router.get('/manual-qr-info/:txnRef', getManualQrDepositInfo)

router.use(protect)
router.get('/', getMyWallet)
router.get('/transactions', getMyWalletTransactions)
router.get('/deposit-payments', getMyDepositPayments)
router.get('/stripe-exchange-rate', getStripeExchangeRate)
router.post('/vnpay-deposit', requireFeature('billing.qrPaymentEnabled'), createVnpayDepositPayment)
router.post('/manual-qr-deposit', requireFeature('billing.qrPaymentEnabled'), createManualQrDepositPayment)
router.post('/deposit', requireFeature('billing.qrPaymentEnabled'), createDepositTransaction)
router.post('/create-payment-intent', requireFeature('billing.qrPaymentEnabled'), createStripePaymentIntent)
router.post('/deposit/confirm', requireFeature('billing.qrPaymentEnabled'), confirmDeposit)
router.patch('/deposit/:transactionId/cancel', requireFeature('billing.qrPaymentEnabled'), cancelDeposit)
router.post('/fake-deposit', requireFeature('billing.qrPaymentEnabled'), fakeDeposit)
router.post('/transfer', transferWallet)

export default router
