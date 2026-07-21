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
    txnRef: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1000,
    },
    type: {
      type: String,
      trim: true,
      default: 'payment',
      index: true,
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
    method: {
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

const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000

paymentSchema.statics.createWithIdempotency = async function (docs, options) {
  const doc = Array.isArray(docs) ? docs[0] : docs
  const idempotencyKey = doc?.idempotencyKey

  if (idempotencyKey) {
    const cutoff = new Date(Date.now() - IDEMPOTENCY_WINDOW_MS)
    const findOptions = options?.session ? { session: options.session } : {}
    const existing = await this.findOne(
      { idempotencyKey, createdAt: { $gte: cutoff } },
      null,
      findOptions,
    )
    if (existing) return existing
  }

  try {
    return await this.create(docs, options)
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.idempotencyKey) {
      const findOptions = options?.session ? { session: options.session } : {}
      return await this.findOne(
        { idempotencyKey: doc.idempotencyKey },
        null,
        findOptions,
      )
    }
    throw err
  }
}

export default mongoose.model('Payment', paymentSchema)
