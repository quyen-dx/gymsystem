import mongoose from 'mongoose';

const cancellationRequestSchema = new mongoose.Schema(
  {
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
      index: true,
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
    usedDays: {
      type: Number,
      required: true,
      min: 0,
    },
    remainingDays: {
      type: Number,
      required: true,
      min: 0,
    },
    usedPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    refundEligible: {
      type: Boolean,
      default: false,
    },
    estimatedRefundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    finalRefundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    rejectReason: {
      type: String,
      trim: true,
      default: '',
    },
    refundMethod: {
      type: String,
      enum: ['WALLET', 'BANK_TRANSFER', 'CASH_COUNTER', 'NONE'],
      default: 'NONE',
    },
    refundStatus: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'NOT_APPLICABLE'],
      default: 'NOT_APPLICABLE',
    },
    refundCompletedAt: {
      type: Date,
      default: null,
    },
    bankName: {
      type: String,
      trim: true,
      default: '',
    },
    bankAccountNumber: {
      type: String,
      trim: true,
      default: '',
    },
    bankAccountName: {
      type: String,
      trim: true,
      default: '',
    },
    bankNote: {
      type: String,
      trim: true,
      default: '',
    },
    staffNote: {
      type: String,
      trim: true,
      default: '',
    },
    handledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    handledAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

cancellationRequestSchema.index({ memberId: 1, status: 1 });
cancellationRequestSchema.index({ createdAt: -1 });

export default mongoose.model('MembershipCancellationRequest', cancellationRequestSchema);
