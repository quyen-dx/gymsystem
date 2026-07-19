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
    membershipCycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipCycle',
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
    totalDays: {
      type: Number,
      required: true,
      min: 1,
    },
    usedPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    policyCode: {
      type: String,
      enum: ['REFUND_100', 'REFUND_50', 'NO_REFUND'],
      required: true,
    },
    policyLabel: {
      type: String,
      trim: true,
      required: true,
    },
    refundRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    registeredAt: {
      type: Date,
      required: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    policyAccepted: {
      type: Boolean,
      default: false,
    },
    policyAcceptedAt: {
      type: Date,
      default: null,
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
      enum: ['WALLET', 'NONE'],
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
