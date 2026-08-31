import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import User from '../models/User.js'
import Wallet from '../models/Wallet.js'
import Transaction from '../models/Transaction.js'
import PayoutRequest from '../models/PayoutRequest.js'
import {
  approvePayoutRequest,
  autoConfirmDuePayouts,
  cancelPayoutRequest,
  confirmPayoutReceived,
  createPayoutRequest,
  markPayoutTransferred,
  rejectPayoutRequest,
  sendStalePayoutAdminReminders,
  autoCancelStalePayoutRequests,
} from '../services/payoutRequestService.js'

const uri = process.env.PAYOUT_TEST_MONGO_URI
if (!uri) throw new Error('PAYOUT_TEST_MONGO_URI is required')

const check = (condition, label) => { assert.ok(condition, label); console.log(`  OK: ${label}`) }
const memberId = new mongoose.Types.ObjectId()
const adminId = new mongoose.Types.ObjectId()

await mongoose.connect(uri)
let exitCode = 0
try {
  await mongoose.connection.db.dropDatabase()
  await User.create({ _id: memberId, name: 'Payout Test Member', email: 'payout.test@example.com', provider: 'email', role: 'member' })
  await Wallet.create({ userId: memberId, balance: 1_000_000, withdrawableBalance: 1_000_000, lockedBalance: 0 })

  console.log('CASE 1: reserve + cancel')
  const first = await createPayoutRequest({ memberId, payload: { amount: 600_000, bankCode: 'MB', bankName: 'MB Bank', accountNumber: '123456789', accountHolder: 'NGUYEN VAN A' } })
  let wallet = await Wallet.findOne({ userId: memberId }).lean()
  check(wallet.balance === 400_000 && wallet.lockedBalance === 600_000 && wallet.withdrawableBalance === 400_000, 'reserve moves 600k from available to locked')
  await cancelPayoutRequest({ memberId, payoutRequestId: first._id })
  wallet = await Wallet.findOne({ userId: memberId }).lean()
  check(wallet.balance === 1_000_000 && wallet.lockedBalance === 0 && wallet.withdrawableBalance === 1_000_000, 'cancel returns the entire amount to wallet')

  console.log('CASE 2: reject')
  const rejected = await createPayoutRequest({ memberId, payload: { amount: 300_000, bankCode: 'MB', bankName: 'MB Bank', accountNumber: '123456789', accountHolder: 'NGUYEN VAN A' } })
  await rejectPayoutRequest({ payoutRequestId: rejected._id, adminId, reason: 'Test reject' })
  wallet = await Wallet.findOne({ userId: memberId }).lean()
  check(wallet.balance === 1_000_000 && wallet.lockedBalance === 0, 'reject returns locked funds')

  console.log('CASE 3: transfer + member confirmation')
  const confirmed = await createPayoutRequest({ memberId, payload: { amount: 600_000, bankCode: 'MB', bankName: 'MB Bank', accountNumber: '123456789', accountHolder: 'NGUYEN VAN A' } })
  await approvePayoutRequest({ payoutRequestId: confirmed._id, adminId })
  await markPayoutTransferred({ payoutRequestId: confirmed._id, adminId, transferReference: 'TEST-TRANSFER-1', transferProof: 'https://example.test/proof-1.png' })
  await confirmPayoutReceived({ memberId, payoutRequestId: confirmed._id })
  wallet = await Wallet.findOne({ userId: memberId }).lean()
  const completed = await PayoutRequest.findById(confirmed._id).lean()
  const transactions = await Transaction.find({ referenceId: confirmed._id.toString(), type: 'payout' }).lean()
  check(wallet.balance === 400_000 && wallet.lockedBalance === 0 && wallet.withdrawableBalance === 400_000, 'confirmation releases lock without a second balance debit')
  check(completed.status === 'COMPLETED' && completed.confirmationSource === 'MEMBER', 'member confirmation completes request')
  check(transactions.length === 1 && transactions[0].amount === -600_000, 'exactly one payout transaction exists')
  await assert.rejects(() => confirmPayoutReceived({ memberId, payoutRequestId: confirmed._id }), (error) => error.statusCode === 409)
  check((await Transaction.countDocuments({ referenceId: confirmed._id.toString(), type: 'payout' })) === 1, 'repeated confirmation cannot create a second payout transaction')

  console.log('CASE 4: auto-confirm')
  const auto = await createPayoutRequest({ memberId, payload: { amount: 100_000, bankCode: 'MB', bankName: 'MB Bank', accountNumber: '123456789', accountHolder: 'NGUYEN VAN A' } })
  await approvePayoutRequest({ payoutRequestId: auto._id, adminId })
  await markPayoutTransferred({ payoutRequestId: auto._id, adminId, transferReference: 'TEST-TRANSFER-2', transferProof: 'https://example.test/proof-2.png' })
  await PayoutRequest.updateOne({ _id: auto._id }, { $set: { confirmationDeadline: new Date(Date.now() - 1000) } })
  check(await autoConfirmDuePayouts() === 1, 'cron completes exactly one due transferred request')
  check(await autoConfirmDuePayouts() === 0, 'cron rerun is idempotent')
  const autoCompleted = await PayoutRequest.findById(auto._id).lean()
  check(autoCompleted.status === 'COMPLETED' && autoCompleted.confirmationSource === 'AUTO', 'cron marks request auto-completed')

  console.log('CASE 5: stale pending reminder + auto-cancel')
  const stale = await createPayoutRequest({ memberId, payload: { amount: 100_000, bankCode: 'MB', bankName: 'MB Bank', accountNumber: '123456789', accountHolder: 'NGUYEN VAN A' } })
  // createdAt là immutable trong Mongoose, nên dùng native collection để mô phỏng
  // một yêu cầu được tạo từ lâu mà không làm thay đổi schema/logic production.
  await PayoutRequest.collection.updateOne({ _id: stale._id }, { $set: { createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } })
  check(await sendStalePayoutAdminReminders() === 1, 'cron sends exactly one reminder for a stale pending request')
  check(await sendStalePayoutAdminReminders() === 0, 'reminder cron is idempotent')
  check(await autoCancelStalePayoutRequests() === 1, 'cron auto-cancels exactly one stale pending request')
  check(await autoCancelStalePayoutRequests() === 0, 'auto-cancel cron is idempotent')
  const staleCancelled = await PayoutRequest.findById(stale._id).lean()
  wallet = await Wallet.findOne({ userId: memberId }).lean()
  check(staleCancelled.status === 'CANCELLED' && staleCancelled.cancelReason, 'stale request is cancelled with a reason')
  check(wallet.balance === 300_000 && wallet.lockedBalance === 0 && wallet.withdrawableBalance === 300_000, 'auto-cancel returns locked funds to the wallet')
  console.log('PAYOUT INTEGRATION TEST PASSED')
} catch (error) {
  exitCode = 1
  console.error('PAYOUT INTEGRATION TEST FAILED:', error)
} finally {
  // Payout notifications are intentionally fire-and-forget in production.
  // Let their Mongo writes finish before dropping this isolated test database.
  await new Promise((resolve) => setTimeout(resolve, 500))
  await mongoose.connection.db.dropDatabase()
  await mongoose.disconnect()
}

// Notifications intentionally run fire-and-forget and may keep their buffered
// Mongoose operations alive after the isolated database has been removed.
process.exit(exitCode)
