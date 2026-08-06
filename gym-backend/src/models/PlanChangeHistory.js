import mongoose from 'mongoose'

const planChangeHistorySchema = new mongoose.Schema({
  // New fields (Membership Cycle)
  cycleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MembershipCycle',
    default: null,
    index: true,
  },
  // Legacy fields (kept for backwards compatibility)
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  membershipId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Membership',
    default: null,
  },
  fromPlanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    default: null,
  },
  toPlanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    default: null
  },
  changedAt: {
    type: Date,
    default: Date.now,
  },
  // Unified type field
  changeType: {
    type: String,
    enum: ['purchase', 'upgrade', 'downgrade', 'renew', 'renewal','change_plan', 'cancel'],
    default: 'purchase',
  },
  type: {
    type: String,
     enum: ['purchase', 'upgrade', 'downgrade', 'renew', 'change_plan', 'cancel'],
    default: 'purchase',
  },
  // Financial fields (new naming)
  priceDifference: {
    type: Number,
    default: 0,
  },
  proratedValue: {
    type: Number,
    default: 0,
  },
  // Financial fields (legacy naming)
  amount: {
    type: Number,
    default: 0,
  },
  proratedCredit: {
    type: Number,
    default: 0,
  },
  walletCredit: {
    type: Number,
    default: 0,
  },
  oldPlanRemainingDays: {
    type: Number,
    default: 0,
  },
  oldPlanRemainingValue: {
    type: Number,
    default: 0,
  },
  newStartDate: {
    type: Date,
    default: null,
  },
  newEndDate: {
    type: Date,
    default: null,
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    default: null,
  },
  // Feature codes snapshot (old vs new plan) để audit quyền lợi bị thu hồi/cấp
  featureSnapshot: {
    from: { type: [String], default: [] },
    to: { type: [String], default: [] },
    _id: false,
  },
  note: {
    type: String,
    default: '',
  },
}, { timestamps: true })

planChangeHistorySchema.index({ memberId: 1, createdAt: -1 })
planChangeHistorySchema.index({ membershipId: 1 })
planChangeHistorySchema.index({ cycleId: 1, changedAt: -1 })

export default mongoose.model('PlanChangeHistory', planChangeHistorySchema)
