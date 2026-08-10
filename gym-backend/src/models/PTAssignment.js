import mongoose from 'mongoose'

const ptAssignmentSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ptId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  membershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership' },
  status: {
    type: String,
    // active = đang phụ trách; pending_end_approval = chờ admin duyệt kết thúc;
    // completed = PT đã kết thúc giáo án; ended = PT không còn phụ trách (kết thúc phụ trách);
    // cancelled = bị hủy (cleanup/lỗi gán)
    enum: ['active', 'pending_end_approval', 'cancelled', 'completed', 'ended'],
    default: 'active',
  },
  workoutId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workout', default: null },
  startDate: { type: Date, default: Date.now },
  endDate: Date,
  cancelledAt: Date,
  cancelReason: { type: String, default: '' },
  workoutEndedAt: Date,
  workoutEndedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  workoutNameSnapshot: { type: String, default: '' },
}, { timestamps: true })

ptAssignmentSchema.index({ memberId: 1, status: 1 })
ptAssignmentSchema.index({ ptId: 1, status: 1 })
ptAssignmentSchema.index({ memberId: 1, ptId: 1 })

export default mongoose.models.PTAssignment || mongoose.model('PTAssignment', ptAssignmentSchema)
