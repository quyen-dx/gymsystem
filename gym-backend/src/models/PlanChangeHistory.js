import mongoose from 'mongoose'

const planChangeHistorySchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  membershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', required: true },
  fromPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
  toPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
  changeType: { type: String, enum: ['upgrade', 'downgrade', 'renewal'], required: true },
  amount: { type: Number, default: 0 },
  proratedCredit: { type: Number, default: 0 },
  walletCredit: { type: Number, default: 0 },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
}, { timestamps: true })

planChangeHistorySchema.index({ memberId: 1, createdAt: -1 })
planChangeHistorySchema.index({ membershipId: 1 })

export default mongoose.model('PlanChangeHistory', planChangeHistorySchema)
