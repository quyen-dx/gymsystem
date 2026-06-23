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
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
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
    autoRenew: {
      type: Boolean,
      default: false,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelReason: {
      type: String,
      trim: true,
      default: '',
    },
    cancelHandledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    cancelHandledAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Index để tìm kiếm nhanh
membershipSchema.index({ memberId: 1, status: 1 });
membershipSchema.index({ planId: 1, status: 1 });
membershipSchema.index({ endDate: 1 }); // Dùng cho cảnh báo hết hạn (Module 2)

const Membership = mongoose.model('Membership', membershipSchema);
export default Membership;
