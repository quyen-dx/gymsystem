import mongoose from 'mongoose'

const membershipRenewalSchema = new mongoose.Schema({
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
  days: {
    type: Number,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  oldEndDate: {
    type: Date,
    required: true,
  },
  newEndDate: {
    type: Date,
    required: true,
  },
  renewedAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'CANCELLED'],
    default: 'ACTIVE',
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    default: null,
  },
  durationMultiplier: {
    type: Number,
    default: 1,
  },
}, { timestamps: true })

membershipRenewalSchema.index({ membershipId: 1, status: 1 })
membershipRenewalSchema.index({ memberId: 1 })

const MembershipRenewal = mongoose.model('MembershipRenewal', membershipRenewalSchema)
export default MembershipRenewal
