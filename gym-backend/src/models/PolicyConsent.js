import mongoose from 'mongoose'

const policyConsentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    policyType: {
      type: String,
      enum: ['payment', 'refund', 'membership', 'wallet', 'terms'],
      required: true,
    },
    policyVersion: { type: String, required: true, trim: true },
    acceptedAt: { type: Date, default: Date.now },
    policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Policy', default: null },
    context: { type: String, default: '', trim: true },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true },
)

policyConsentSchema.index({ userId: 1, policyType: 1, policyVersion: 1, context: 1 }, { unique: true })
policyConsentSchema.index({ userId: 1, policyType: 1 })

const PolicyConsent = mongoose.model('PolicyConsent', policyConsentSchema)

// migrate old unique index (userId,policyType,policyVersion) → (userId,policyType,policyVersion,context)
PolicyConsent.syncIndexes().catch((err) => {
  console.error('Failed to sync PolicyConsent indexes:', err.message)
})

export default PolicyConsent
