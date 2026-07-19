import mongoose from 'mongoose'

const refundRequestSchema = new mongoose.Schema({
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  membershipId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Membership',
    required: true,
  },
  membershipPeriodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MembershipPeriod',
    default: null,
  },
  cancellationRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MembershipCancellationRequest',
    default: null,
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: true,
  },
  reason: {
    type: String,
    trim: true,
    default: '',
  },
  refundAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'REFUNDED'],
    default: 'PENDING',
    index: true,
  },
  requestedAt: {
    type: Date,
    default: Date.now,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  reviewedAt: {
    type: Date,
    default: null,
  },
  staffNote: {
    type: String,
    trim: true,
    default: '',
  },

  // === Snapshot tại thời điểm gửi yêu cầu ===
  daysUsedAtRequest: {
    type: Number,
    default: 0,
  },
  eligibleWithin7Days: {
    type: Boolean,
    default: false,
  },
  usedCheckIn: {
    type: Boolean,
    default: false,
  },
  usedGym: {
    type: Boolean,
    default: false,
  },
  usedPT: {
    type: Boolean,
    default: false,
  },
  usedBenefits: {
    type: Boolean,
    default: false,
  },
  checkInCountAtRequest: {
    type: Number,
    default: 0,
  },
  gymUsageCountAtRequest: {
    type: Number,
    default: 0,
  },
  ptBookingCountAtRequest: {
    type: Number,
    default: 0,
  },
  refundPolicyResult: {
    type: String,
    default: '',
  },
  policyVersion: {
    type: String,
    default: '1.0',
  },

  // === Thông tin các MembershipPeriod PENDING khi hủy toàn bộ gói ===
  pendingPeriodsTotal: {
    type: Number,
    default: 0,
    min: 0,
  },
  pendingPeriodsCount: {
    type: Number,
    default: 0,
    min: 0,
  },
}, { timestamps: true })

refundRequestSchema.index({ memberId: 1, status: 1 })
refundRequestSchema.index({ status: 1, createdAt: -1 })

export default mongoose.model('RefundRequest', refundRequestSchema)
