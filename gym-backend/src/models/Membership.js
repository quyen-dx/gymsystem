import mongoose from 'mongoose';

const membershipSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
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
  },
  { timestamps: true }
);

// Index để tìm kiếm nhanh
membershipSchema.index({ memberId: 1, status: 1 });
membershipSchema.index({ planId: 1, status: 1 });
membershipSchema.index({ endDate: 1 }); // Dùng cho cảnh báo hết hạn (Module 2)

const Membership = mongoose.model('Membership', membershipSchema);
export default Membership;