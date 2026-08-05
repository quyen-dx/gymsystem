import mongoose from 'mongoose'
await mongoose.connect(process.env.MONGO_URI)
const Transaction = (await import('../models/Transaction.js')).default

const groups = await Transaction.aggregate([
  { $match: { idempotencyKey: { $type: 'string' } } },
  { $group: { _id: '$idempotencyKey', docs: { $push: '$_id' }, count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } },
])

let deleted = 0
for (const g of groups) {
  const txns = await Transaction.find({ _id: { $in: g.docs } }).sort({ createdAt: 1 }).lean()
  const preferred = txns.find((t) => t.paymentId) || txns[0]
  const toDelete = txns.filter((t) => t._id.toString() !== preferred._id.toString())
  for (const t of toDelete) {
    await Transaction.deleteOne({ _id: t._id })
    deleted += 1
    console.log('deleted dup idempotencyKey', g._id, t._id.toString())
  }
}
console.log('total duplicate groups:', groups.length, '| deleted:', deleted)

// cleanup test member for clean re-run
const User = (await import('../models/User.js')).default
const member = await User.findOne({ email: 'deposit.test@example.com' })
if (member) {
  const Wallet = (await import('../models/Wallet.js')).default
  const Payment = (await import('../models/Payment.js')).default
  const PolicyConsent = (await import('../models/PolicyConsent.js')).default
  const Notification = (await import('../models/Notification.js')).default
  await Payment.deleteMany({ userId: member._id })
  await Transaction.deleteMany({ userId: member._id })
  await Wallet.deleteMany({ userId: member._id })
  await PolicyConsent.deleteMany({ userId: member._id })
  await Notification.deleteMany({ receiverId: member._id })
  await User.deleteOne({ _id: member._id })
  console.log('test member cleaned:', member.email)
}
process.exit(0)
