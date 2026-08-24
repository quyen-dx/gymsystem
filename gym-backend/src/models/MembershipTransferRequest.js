import mongoose from 'mongoose'

export const MEMBERSHIP_TRANSFER_STATUSES = [
  'PENDING_RECIPIENT', 'PENDING_REVIEW', 'COMPLETED', 'REJECTED', 'CANCELLED', 'EXPIRED',
]

const membershipTransferRequestSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sourceMembershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', required: true, index: true },
  sourceCycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipCycle', required: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
  sourceEndDate: { type: Date, required: true },
  status: { type: String, enum: MEMBERSHIP_TRANSFER_STATUSES, default: 'PENDING_RECIPIENT', index: true },
  note: { type: String, trim: true, default: '' },
  recipientRespondedAt: { type: Date, default: null },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  rejectionReason: { type: String, trim: true, default: '' },
  completedAt: { type: Date, default: null },
  targetMembershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },
  targetCycleId: { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipCycle', default: null },
}, { timestamps: true })

membershipTransferRequestSchema.index({ senderId: 1, status: 1, createdAt: -1 })
membershipTransferRequestSchema.index({ recipientId: 1, status: 1, createdAt: -1 })
membershipTransferRequestSchema.index({ status: 1, createdAt: -1 })

export default mongoose.model('MembershipTransferRequest', membershipTransferRequestSchema)
