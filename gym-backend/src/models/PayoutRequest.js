import mongoose from 'mongoose'

export const PAYOUT_STATUSES = ['PENDING_REVIEW', 'APPROVED', 'TRANSFERRED', 'DISPUTED', 'COMPLETED', 'REJECTED', 'CANCELLED']

const transferSchema = new mongoose.Schema({
  transferReference: { type: String, trim: true, required: true },
  transferProof: { type: String, trim: true, required: true },
  transferredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  transferredAt: { type: Date, required: true },
}, { _id: false })

const payoutRequestSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true },
  amount: { type: Number, required: true, min: 1 },
  status: { type: String, enum: PAYOUT_STATUSES, default: 'PENDING_REVIEW', index: true },
  bankSnapshot: {
    bankCode: { type: String, required: true, trim: true },
    bankName: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    accountHolder: { type: String, required: true, trim: true },
  },
  memberNote: { type: String, trim: true, default: '' },
  adminReminderSentAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  cancelReason: { type: String, trim: true, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  rejectReason: { type: String, trim: true, default: '' },
  transferredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  transferredAt: { type: Date, default: null },
  transferReference: { type: String, trim: true, default: '' },
  transferProof: { type: String, trim: true, default: '' },
  transferHistory: { type: [transferSchema], default: [] },
  confirmationDeadline: { type: Date, default: null, index: true },
  confirmedAt: { type: Date, default: null },
  confirmationSource: { type: String, enum: ['MEMBER', 'AUTO', 'ADMIN'], default: null },
  disputedAt: { type: Date, default: null },
  disputeReason: { type: String, trim: true, default: '' },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedAt: { type: Date, default: null },
  resolutionNote: { type: String, trim: true, default: '' },
  payoutTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
}, { timestamps: true })

payoutRequestSchema.index({ memberId: 1, status: 1, createdAt: -1 })
payoutRequestSchema.index({ status: 1, createdAt: -1 })
payoutRequestSchema.index({ status: 1, confirmationDeadline: 1 })
payoutRequestSchema.index({ status: 1, adminReminderSentAt: 1, createdAt: 1 })

export default mongoose.model('PayoutRequest', payoutRequestSchema)
