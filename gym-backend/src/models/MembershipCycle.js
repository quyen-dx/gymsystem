import mongoose from 'mongoose'

const membershipCycleSchema = new mongoose.Schema({
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  currentMembershipId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Membership',
    default: null,
  },
  currentPlanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    default: null,
  },
  startDate: {
    type: Date,
    default: null,
  },
  endDate: {
    type: Date,
    default: null,
  },
  purchasedAt: {
    type: Date,
    default: null,
  },
  activatedAt: {
    type: Date,
    default: null,
  },
  expiresAt: {
    type: Date,
    default: null,
  },
  refundExpiredAt: {
    type: Date,
    default: null,
  },
  durationDays: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled', 'refunded'],
    default: 'active',
  },
  refundEligible: {
    type: Boolean,
    default: true,
  },
  firstBenefitUsedAt: {
    type: Date,
    default: null,
  },
  firstBenefitType: {
    type: String,
    enum: ['checkin', 'pt_group', 'pt_1on1', 'body_scan', 'other'],
    default: null,
  },
  refundReminderSent: {
    type: [Number],
    default: [],
  },
  transferPending: {
    type: Boolean,
    default: false,
    index: true,
  },
  transferRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MembershipTransferRequest',
    default: null,
  },
  previousCycleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MembershipCycle',
    default: null,
  },
}, { timestamps: true })

membershipCycleSchema.index({ memberId: 1, status: 1 })

export default mongoose.model('MembershipCycle', membershipCycleSchema)
