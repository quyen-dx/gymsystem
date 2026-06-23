import mongoose from 'mongoose'

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    membershipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Membership',
      default: null,
      index: true,
    },
    registrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipRegistration',
      default: null,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      default: null,
      index: true,
    },
    stripeSessionId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      trim: true,
      default: 'vnd',
    },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'pending', 'paid', 'failed', 'refunded'],
      default: 'PENDING',
      index: true,
    },
    paymentMethod: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'MANUAL',
    },
    source: {
      type: String,
      enum: ['ONLINE', 'OFFLINE'],
      default: 'ONLINE',
    },
    paidAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
)

paymentSchema.index({ createdAt: -1 })

export default mongoose.model('Payment', paymentSchema)
