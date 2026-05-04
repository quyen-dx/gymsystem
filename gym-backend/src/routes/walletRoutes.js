import express from 'express'
import { createDeposit, getDeposit, } from '../controllers/paymentController.js'
import { fakeDeposit, getMyWallet, getMyWalletTransactions, transferWallet } from '../controllers/walletController.js'
import { protect } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.use(protect)
router.get('/', getMyWallet)
router.get('/transactions', getMyWalletTransactions)
router.post('/deposit', createDeposit)
router.post('/fake-deposit', fakeDeposit)
router.post('/transfer', transferWallet)
router.get('/deposit/:id', getDeposit)

export default router
