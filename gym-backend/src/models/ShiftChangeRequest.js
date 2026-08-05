import mongoose from 'mongoose'

export const SHIFT_CHANGE_REQUEST_STATUSES = {
  PENDING: 'pending',
  WAITING_ASSIGNMENT: 'waiting_assignment',
  ASSIGNED: 'assigned',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
}

const shiftChangeRequestSchema = new mongoose.Schema(
  {
    // PT gửi yêu cầu (PT A)
    requestingPtId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetDate: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(SHIFT_CHANGE_REQUEST_STATUSES),
      default: SHIFT_CHANGE_REQUEST_STATUSES.PENDING,
      index: true,
    },
    // Admin xử lý
    handledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    handledAt: {
      type: Date,
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectReason: {
      type: String,
      default: '',
      trim: true,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
)

// Index truy vấn yêu cầu theo PT + ngày (KHÔNG phải unique — PT được gửi nhiều yêu cầu
// trong cùng ngày nếu khác ca; tính duy nhất là PT + Class + Date).
shiftChangeRequestSchema.index(
  { requestingPtId: 1, targetDate: 1, status: 1 },
  { name: 'requests_by_pt_date' },
)

const ShiftChangeRequest = mongoose.models.ShiftChangeRequest || mongoose.model('ShiftChangeRequest', shiftChangeRequestSchema)

export default ShiftChangeRequest
