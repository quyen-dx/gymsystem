import mongoose from 'mongoose'

const membershipFreezeSchema = new mongoose.Schema(
  {
    cycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MembershipCycle',
      required: true,
      index: true,
    },
    userId: {
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
    durationDays: {
      type: Number,
      required: true,
      min: 1,
      max: 30,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'active', 'completed'],
      default: 'pending',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    previousFreezeEndDate: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
)

membershipFreezeSchema.index({ cycleId: 1, status: 1 })
membershipFreezeSchema.index({ userId: 1, startDate: -1 })
membershipFreezeSchema.index({ status: 1, startDate: 1 })

const MembershipFreeze = mongoose.model('MembershipFreeze', membershipFreezeSchema)

export default MembershipFreeze
