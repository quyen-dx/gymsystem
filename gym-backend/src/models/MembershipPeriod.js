import mongoose from 'mongoose'

const membershipPeriodSchema = new mongoose.Schema({
  membershipId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Membership',
    required: true,
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: true,
  },
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  totalDays: {
    type: Number,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    default: null,
  },
  activatedAt: {
    type: Date,
    default: null,
  },
  completedAt: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'CANCEL_REQUESTED', 'REJECTED'],
    default: 'PENDING',
  },
}, { timestamps: true })

membershipPeriodSchema.index({ membershipId: 1, status: 1 })
membershipPeriodSchema.index({ membershipId: 1, endDate: -1 })
membershipPeriodSchema.index({ memberId: 1 })

const MembershipPeriod = mongoose.model('MembershipPeriod', membershipPeriodSchema)
export default MembershipPeriod
