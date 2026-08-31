import crypto from 'crypto'
import mongoose from 'mongoose'
import bcrypt from 'bcrypt'

await mongoose.connect(process.env.MONGO_URI)

const User = (await import('../models/User.js')).default
const Wallet = (await import('../models/Wallet.js')).default
const Payment = (await import('../models/Payment.js')).default
const Transaction = (await import('../models/Transaction.js')).default
const Policy = (await import('../models/Policy.js')).default
const PolicyConsent = (await import('../models/PolicyConsent.js')).default
const Notification = (await import('../models/Notification.js')).default
const { generateAccessToken } = await import('../utils/generateToken.js')

const API = 'http://localhost:5000/api'
const EMAIL = 'deposit.test@example.com'

const assert = (cond, msg) => {
  if (!cond) {
    console.error('ASSERT FAILED:', msg)
    process.exitCode = 1
    throw new Error(msg)
  }
  console.log('  OK:', msg)
}

// ---------- signing helpers ----------
const vnpaySign = (params, secret) => {
  const keys = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
  const str = keys.map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k])).replace(/%20/g, '+')}`).join('&')
  return crypto.createHmac('sha512', secret).update(Buffer.from(str, 'utf-8')).digest('hex')
}

// ---------- setup ----------
console.log('=== SETUP ===')
let member = await User.findOne({ email: EMAIL })
if (member) {
  await Payment.deleteMany({ userId: member._id })
  await Transaction.deleteMany({ userId: member._id })
  await Wallet.deleteMany({ userId: member._id })
  await PolicyConsent.deleteMany({ userId: member._id })
  await Notification.deleteMany({ receiverId: member._id })
  await User.deleteOne({ _id: member._id })
}
const hash = await bcrypt.hash('Test@1234', 10)
member = await User.create({ email: EMAIL, name: 'deposit.test', fullName: 'Deposit Test', role: 'member', provider: 'email', password: hash, identityStatus: 'approved' })
const wallet = await Wallet.create({ userId: member._id, balance: 0 })
console.log('member:', member._id.toString(), 'wallet:', wallet._id.toString(), 'balance 0')

const policies = await Policy.find({ type: { $in: ['payment', 'refund'] }, isPublished: true }).lean()
await PolicyConsent.create(policies.map((p) => ({
  userId: member._id, policyType: p.type, policyVersion: p.version, policyId: p._id, context: 'deposit', acceptedAt: new Date(),
})))

const memberToken = generateAccessToken(member._id, 'member')
const staff = await User.findOne({ role: { $in: ['admin', 'staff', 'super_admin'] }, isActive: true }).lean()
const staffToken = generateAccessToken(staff._id, staff.role)

const getWallet = async (id) => Wallet.findById(id).lean()
const getBalance = async (id) => (await getWallet(id)).balance

// ---------- CASE 1: VNPay ----------
console.log('\n=== CASE 1: VNPAY 100,000 VND ===')
const vnRes = await fetch(`${API}/wallet/vnpay-deposit`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` },
  body: JSON.stringify({ amount: 100000 }),
})
const vnJson = await vnRes.json()
assert(vnRes.status === 201, `createVnpayDepositPayment -> ${vnRes.status}`)
const txnRef1 = vnJson.data.txnRef
console.log('  txnRef:', txnRef1)

const vnReturnParams = {
  vnp_TmnCode: process.env.VNPAY_TMN_CODE,
  vnp_Amount: '10000000',
  vnp_BankCode: 'VNPAYQR',
  vnp_BankTranNo: 'VNPAY' + Date.now(),
  vnp_CardType: 'QRONLY',
  vnp_OrderInfo: `Nap tien vi GymPro ${txnRef1}`,
  vnp_PayDate: new Date().toISOString().replace(/[-:.TZ]/g, ''),
  vnp_ResponseCode: '00',
  vnp_TxnRef: txnRef1,
  vnp_TransactionNo: 'TX' + Date.now(),
  vnp_TransactionStatus: '00',
}
const sig1 = vnpaySign(vnReturnParams, process.env.VNPAY_HASH_SECRET)
const returnUrl1 = `${API}/wallet/vnpay-return?${new URLSearchParams({ ...vnReturnParams, vnp_SecureHash: sig1 })}`
const redir1 = await fetch(returnUrl1, { redirect: 'manual' })
assert(redir1.status === 302, `vnpay-return redirect ${redir1.status}`)
assert(redir1.headers.get('location').includes('payment=success'), 'redirect to payment=success')

const pay1 = await Payment.findOne({ txnRef: txnRef1 }).lean()
assert(pay1.status === 'PAID', 'VNPay Payment status PAID')
assert(pay1.paymentMethod === 'VNPAY', 'Payment.paymentMethod VNPAY')
assert(pay1.transactionId, 'Payment.transactionId set')
assert(pay1.completedAt, 'Payment.completedAt set')
const txn1 = await Transaction.findById(pay1.transactionId).lean()
assert(txn1?.paymentMethod === 'VNPAY', 'Transaction.paymentMethod VNPAY')
assert(txn1?.paymentId?.toString() === pay1._id.toString(), 'Transaction.paymentId links to Payment')
assert(txn1?.currency === 'VND', 'Transaction.currency VND')
assert(txn1?.amount === 100000, `Transaction.amount 100000 (got ${txn1?.amount})`)
assert(await getBalance(wallet._id) === 100000, `wallet balance 100000 (got ${await getBalance(wallet._id)})`)

// ---------- CASE 2: International Card ----------
console.log('\n=== CASE 2: STRIPE INTERNATIONAL CARD 10 USD ===')
const rateRes = await fetch(`${API}/wallet/stripe-exchange-rate`, { headers: { Authorization: `Bearer ${memberToken}` } })
const rateJson = await rateRes.json()
const rate = Number(rateJson.data.rate)
const amountVnd = Math.round(10 * rate)
console.log('  rate:', rate, '-> amountVnd:', amountVnd)

const piId = 'pi_deposit_test_' + Date.now()
const event = {
  id: 'evt_deposit_test_' + Date.now(),
  object: 'event',
  api_version: '2023-10-16',
  created: Math.floor(Date.now() / 1000),
  data: {
    object: {
      id: piId,
      object: 'payment_intent',
      amount: 1000,
      amount_received: 1000,
      currency: 'usd',
      payment_method: 'pm_card_visa_test',
      metadata: {
        userId: member._id.toString(),
        walletAmountVnd: String(amountVnd),
        exchangeRate: String(rate),
      },
    },
  },
  livemode: false,
  pending_webhooks: 1,
  request: { id: null, idempotency_key: null },
  type: 'payment_intent.succeeded',
}
const payload = JSON.stringify(event)
const ts = Math.floor(Date.now() / 1000)
const signedPayload = `${ts}.${payload}`
const sig = crypto.createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET).update(signedPayload).digest('hex')
const header = `t=${ts},v1=${sig}`

const whRes = await fetch(`${API}/wallet/stripe-webhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'stripe-signature': header },
  body: payload,
})
assert(whRes.status === 200, `stripe webhook status ${whRes.status}`)

const pay2 = await Payment.findOne({ userId: member._id, paymentMethod: 'INTERNATIONAL_CARD' }).lean()
assert(pay2, 'International Card Payment created')
assert(pay2.status === 'PAID', 'IC Payment PAID')
assert(pay2.txnRef === piId, 'Payment.txnRef = PI id')
assert(Number(pay2.exchangeRate) === rate, `Payment.exchangeRate ${rate}`)
assert(pay2.transactionId, 'Payment.transactionId set')
assert(pay2.completedAt, 'Payment.completedAt set')
assert(pay2.metadata?.purpose === 'WALLET_DEPOSIT', 'Payment.metadata.purpose WALLET_DEPOSIT')
const txn2 = await Transaction.findById(pay2.transactionId).lean()
assert(txn2?.paymentMethod === 'INTERNATIONAL_CARD', 'Transaction.paymentMethod INTERNATIONAL_CARD')
assert(txn2?.paymentId?.toString() === pay2._id.toString(), 'Transaction.paymentId links to IC Payment')
assert(txn2?.currency === 'VND', 'Transaction.currency VND')
assert(txn2?.exchangeRate === rate, `Transaction.exchangeRate ${rate}`)
assert(txn2?.amount === amountVnd, `Transaction.amount ${amountVnd} (got ${txn2?.amount})`)
const balAfterCard = await getBalance(wallet._id)
assert(balAfterCard === 100000 + amountVnd, `wallet balance after card ${balAfterCard}`)

console.log('  --- idempotency (repeat webhook) ---')
const whRes2 = await fetch(`${API}/wallet/stripe-webhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'stripe-signature': header },
  body: payload,
})
assert(whRes2.status === 200, 'repeated webhook accepted')
assert(await getBalance(wallet._id) === balAfterCard, `wallet unchanged after replay (${await getBalance(wallet._id)})`)

// ---------- CASE 3: Failure ----------
console.log('\n=== CASE 3: FAILED PAYMENT ===')
const failRes = await fetch(`${API}/wallet/vnpay-deposit`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` },
  body: JSON.stringify({ amount: 50000 }),
})
const failJson = await failRes.json()
const txnRef3 = failJson.data.txnRef
console.log('  txnRef:', txnRef3)

const failParams = {
  vnp_TmnCode: process.env.VNPAY_TMN_CODE,
  vnp_Amount: '5000000',
  vnp_BankCode: 'VNPAYQR',
  vnp_BankTranNo: 'VNPAYFAIL' + Date.now(),
  vnp_CardType: 'QRONLY',
  vnp_OrderInfo: `Nap tien vi GymPro ${txnRef3}`,
  vnp_PayDate: new Date().toISOString().replace(/[-:.TZ]/g, ''),
  vnp_ResponseCode: '99',
  vnp_TxnRef: txnRef3,
  vnp_TransactionNo: 'TXFAIL' + Date.now(),
  vnp_TransactionStatus: '01',
}
const sig3 = vnpaySign(failParams, process.env.VNPAY_HASH_SECRET)
const failUrl = `${API}/wallet/vnpay-return?${new URLSearchParams({ ...failParams, vnp_SecureHash: sig3 })}`
const redir3 = await fetch(failUrl, { redirect: 'manual' })
assert(redir3.headers.get('location').includes('payment=failed'), 'failed return redirects to payment=failed')
const pay3 = await Payment.findOne({ txnRef: txnRef3 }).lean()
assert(pay3.status === 'FAILED', 'failed Payment status FAILED')
const failTxns = await Transaction.find({ userId: member._id, 'metadata.txnRef': txnRef3 }).lean()
assert(failTxns.length === 0, 'no Transaction recorded for failed payment')
assert(await getBalance(wallet._id) === balAfterCard, `wallet unchanged after failure (${await getBalance(wallet._id)})`)

// bad signature case
const badSigParams = { ...failParams, vnp_ResponseCode: '00', vnp_TransactionStatus: '00', vnp_TxnRef: txnRef3 }
const badUrl = `${API}/wallet/vnpay-return?${new URLSearchParams({ ...badSigParams, vnp_SecureHash: 'deadbeef' })}`
const badRedir = await fetch(badUrl, { redirect: 'manual' })
assert(badRedir.headers.get('location').includes('payment=failed'), 'bad signature -> payment=failed')
assert(await getBalance(wallet._id) === balAfterCard, 'wallet unchanged after bad signature')

// ---------- HISTORY ----------
console.log('\n=== HISTORY: /deposit + /staff/payments ===')
const depPayments = await fetch(`${API}/wallet/deposit-payments`, { headers: { Authorization: `Bearer ${memberToken}` } }).then((r) => r.json())
const depList = depPayments.data || []
const depMethods = depList.map((p) => p.paymentMethod || p.method)
assert(depList.some((p) => p.paymentMethod === 'VNPAY' && p.status === 'PAID'), 'member history contains VNPAY PAID')
assert(depList.some((p) => p.paymentMethod === 'INTERNATIONAL_CARD' && p.status === 'PAID'), 'member history contains INTERNATIONAL_CARD PAID')
assert(depList.some((p) => p.paymentMethod === 'VNPAY' && p.status === 'FAILED'), 'member history contains VNPAY FAILED')
assert(depList.length === 3, `member history has 3 payments (got ${depList.length})`)
console.log('  member /deposit methods:', depMethods.join(', '))

const staffRes = await fetch(`${API}/wallet/staff/payments`, { headers: { Authorization: `Bearer ${staffToken}` } }).then((r) => r.json())
const staffList = staffRes.data?.payments || []
const mine = staffList.filter((p) => String(p.userId?._id || p.userId) === member._id.toString())
assert(mine.some((p) => p.paymentMethod === 'VNPAY' && p.status === 'PAID'), 'staff list contains VNPAY PAID')
assert(mine.some((p) => p.paymentMethod === 'INTERNATIONAL_CARD' && p.status === 'PAID'), 'staff list contains INTERNATIONAL_CARD PAID')
assert(mine.some((p) => p.paymentMethod === 'VNPAY' && p.status === 'FAILED'), 'staff list contains VNPAY FAILED')
console.log('  staff /staff/payments count for member:', mine.length)

// ---------- NOTIFICATION (idempotent) ----------
console.log('\n=== NOTIFICATIONS ===')
const notifs = await Notification.find({ receiverId: member._id, notificationType: 'PAYMENT_SUCCESS' }).lean()
const vnNotifs = notifs.filter((n) => n.content.includes('VNPay'))
const icNotifs = notifs.filter((n) => n.content.includes('Thẻ quốc tế'))
assert(vnNotifs.length === 1, `exactly 1 VNPay success notification (got ${vnNotifs.length})`)
assert(icNotifs.length === 1, `exactly 1 International Card success notification after replay (got ${icNotifs.length})`)
console.log('  success notifications:', notifs.map((n) => n.content).join(' | '))

// ---------- CASE 4: Card confirm endpoint (frontend-driven finalize) ----------
console.log('\n=== CASE 4: POST /wallet/payments/card/confirm ===')
const StripeLib = (await import('stripe')).default
const stripeClient = new StripeLib(process.env.STRIPE_SECRET_KEY)

const piRes = await fetch(`${API}/wallet/create-payment-intent`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` },
  body: JSON.stringify({ amountUsd: 10 }),
})
const piJson = await piRes.json()
assert(piRes.status === 200, `create-payment-intent ${piRes.status}`)
const cardPiId = piJson.paymentIntentId
const cardAmountVnd = piJson.walletAmountVnd
console.log('  paymentIntentId:', cardPiId, 'amountVnd:', cardAmountVnd)

// simulate successful card charge via Stripe test PM
const confirmedPi = await stripeClient.paymentIntents.confirm(cardPiId, { payment_method: 'pm_card_visa', return_url: 'https://example.com/deposit' })
assert(confirmedPi.status === 'succeeded', `stripe PI succeeded (got ${confirmedPi.status})`)

const balBeforeConfirm = await getBalance(wallet._id)
const confRes = await fetch(`${API}/wallet/payments/card/confirm`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` },
  body: JSON.stringify({ paymentIntentId: cardPiId }),
})
const confJson = await confRes.json()
assert(confRes.status === 200, `card confirm ${confRes.status}`)
assert(confJson.data.creditedAmount === cardAmountVnd, `creditedAmount ${cardAmountVnd}`)
assert(confJson.data.paymentId, 'confirm returns paymentId')
assert(confJson.data.transactionId, 'confirm returns transactionId')

const confPay = await Payment.findById(confJson.data.paymentId).lean()
assert(confPay.status === 'PAID', 'confirm Payment PAID')
assert(confPay.paymentMethod === 'INTERNATIONAL_CARD', 'confirm Payment method INTERNATIONAL_CARD')
const confTxn = await Transaction.findById(confJson.data.transactionId).lean()
assert(confTxn.amount === cardAmountVnd, `confirm Transaction amount ${cardAmountVnd}`)
assert(await getBalance(wallet._id) === balBeforeConfirm + cardAmountVnd, 'wallet credited via confirm')

console.log('  --- idempotency (confirm again) ---')
const confRes2 = await fetch(`${API}/wallet/payments/card/confirm`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` },
  body: JSON.stringify({ paymentIntentId: cardPiId }),
})
const confJson2 = await confRes2.json()
assert(confJson2.data.alreadyPaid === true, 'second confirm returns alreadyPaid')
assert(await getBalance(wallet._id) === balBeforeConfirm + cardAmountVnd, 'no double credit on second confirm')

// ---------- CASE 5: Backend error paths (no credit, no records) ----------
console.log('\n=== CASE 5: CONFIRM ERROR PATHS ===')
const balBeforeErr = await getBalance(wallet._id)

// 5a. non-existent PI
const errA = await fetch(`${API}/wallet/payments/card/confirm`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` },
  body: JSON.stringify({ paymentIntentId: 'pi_does_not_exist_123' }),
})
assert([400, 404, 500].includes(errA.status), `non-existent PI -> ${errA.status}`)
assert(await getBalance(wallet._id) === balBeforeErr, 'no credit for non-existent PI')

// 5b. not-succeeded PI (requires_payment_method)
const piPending = await stripeClient.paymentIntents.create({
  amount: 2500,
  currency: 'usd',
  metadata: { userId: member._id.toString(), walletAmountVnd: String(cardAmountVnd), exchangeRate: String(26143.0959) },
})
const errB = await fetch(`${API}/wallet/payments/card/confirm`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` },
  body: JSON.stringify({ paymentIntentId: piPending.id }),
})
assert(errB.status === 400, `not-succeeded PI -> ${errB.status}`)
assert(await getBalance(wallet._id) === balBeforeErr, 'no credit for not-succeeded PI')

// 5c. PI belonging to another user
const otherPi = await stripeClient.paymentIntents.create({
  amount: 2500,
  currency: 'usd',
  metadata: { userId: '000000000000000000000000', walletAmountVnd: String(cardAmountVnd), exchangeRate: String(26143.0959) },
})
await stripeClient.paymentIntents.confirm(otherPi.id, { payment_method: 'pm_card_visa', return_url: 'https://example.com/deposit' })
const errC = await fetch(`${API}/wallet/payments/card/confirm`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${memberToken}` },
  body: JSON.stringify({ paymentIntentId: otherPi.id }),
})
assert(errC.status === 403, `wrong-owner PI -> ${errC.status}`)
assert(await getBalance(wallet._id) === balBeforeErr, 'no credit for wrong-owner PI')

// Các PI của CASE 5 (error paths) tuyệt đối không được tạo Transaction
const case5Refs = ['pi_does_not_exist_123', piPending.id, otherPi.id]
const stray = await Transaction.find({ userId: member._id, referenceId: { $in: case5Refs } }).lean()
assert(stray.length === 0, 'no transactions from error-path PIs')

console.log('\n=== SUMMARY ===')
console.log('wallet final balance:', await getBalance(wallet._id))
console.log('expected:', 100000 + amountVnd + cardAmountVnd)
await mongoose.disconnect()
