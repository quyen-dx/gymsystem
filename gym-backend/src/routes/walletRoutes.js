import express from 'express'
import { cancelDeposit, confirmDeposit, confirmStripeCardPayment, createDepositTransaction, createManualQrDepositPayment, createStripePaymentIntent, createVnpayDepositPayment, fakeDeposit, getManualQrDepositInfo, getMyDepositPayments, getMyWallet, getMyWalletTransactions, getStripeExchangeRate, handleManualQrScan, handleVnpayIpn, handleVnpayReturn, simulateManualQrPayment, staffListAllPayments, staffListAllTransactions, transferWallet } from '../controllers/walletController.js'
import { protect, adminOrStaff } from '../middlewares/authMiddleware.js'
import { requireFeature } from '../middlewares/systemSettingsMiddleware.js'

const router = express.Router()

router.get('/vnpay-return', handleVnpayReturn)
router.get('/vnpay-ipn', handleVnpayIpn)
router.post('/vnpay-ipn', handleVnpayIpn)
router.get('/manual-qr-scan/:txnRef', handleManualQrScan)
router.get('/manual-qr-info/:txnRef', getManualQrDepositInfo)
router.post('/manual-qr-demo-pay/:txnRef', simulateManualQrPayment)

router.use(protect)
router.get('/', getMyWallet)
router.get('/transactions', getMyWalletTransactions)
router.get('/deposit-payments', getMyDepositPayments)
router.get('/stripe-exchange-rate', getStripeExchangeRate)
router.post('/vnpay-deposit', requireFeature('billing.qrPaymentEnabled'), createVnpayDepositPayment)
router.post('/manual-qr-deposit', requireFeature('billing.qrPaymentEnabled'), createManualQrDepositPayment)
router.post('/deposit', requireFeature('billing.qrPaymentEnabled'), createDepositTransaction)
router.post('/create-payment-intent', requireFeature('billing.qrPaymentEnabled'), createStripePaymentIntent)
router.post('/payments/card/confirm', requireFeature('billing.qrPaymentEnabled'), confirmStripeCardPayment)
router.post('/deposit/confirm', requireFeature('billing.qrPaymentEnabled'), confirmDeposit)
router.patch('/deposit/:transactionId/cancel', requireFeature('billing.qrPaymentEnabled'), cancelDeposit)
router.post('/fake-deposit', requireFeature('billing.qrPaymentEnabled'), fakeDeposit)
router.post('/transfer', transferWallet)

router.get('/staff/transactions', adminOrStaff, staffListAllTransactions)
router.get('/staff/payments', adminOrStaff, staffListAllPayments)

export default router
