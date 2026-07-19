import mongoose from 'mongoose';

const membershipSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled'],
      default: 'active',
    },
    source: {
      type: String,
      enum: ['manual', 'stripe', 'staff', 'wallet'],
      default: 'manual',
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    remindersSent: {
      type: [Number],
      default: [],
    },
  },
  { timestamps: true }
);

// Index để tìm kiếm nhanh
membershipSchema.index({ memberId: 1, status: 1 });
membershipSchema.index({ planId: 1, status: 1 });
const Membership = mongoose.model('Membership', membershipSchema);
export default Membership;
