import mongoose from 'mongoose'

export const SCHEDULE_REPLACEMENT_STATUSES = {
  APPROVED: 'approved', // PT thay đã chấp nhận — đang hiệu lực
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed', // đã qua date+endTime
  EXPIRED: 'expired',
}

/**
 * Bản ghi thay ca tạm thời — KHÔNG ghi đè assignedTrainer của lớp.
 * Chỉ override khi render lịch: ưu tiên replacement còn hiệu lực
 * (date+endTime >= now, status=approved), nếu không dùng assignedTrainer gốc.
 */
const scheduleReplacementSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShiftChangeRequest',
      required: true,
      index: true,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShiftChangeItem',
      required: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TrainingClass',
      required: true,
    },
    originalTrainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    replacementTrainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    startTime: { type: String, default: '' },
    endTime: { type: String, default: '' },
    status: {
      type: String,
      enum: Object.values(SCHEDULE_REPLACEMENT_STATUSES),
      default: SCHEDULE_REPLACEMENT_STATUSES.APPROVED,
    },
  },
  { timestamps: true },
)

scheduleReplacementSchema.index({ originalTrainerId: 1, date: 1 })
scheduleReplacementSchema.index({ replacementTrainerId: 1, date: 1 })
scheduleReplacementSchema.index({ classId: 1, date: 1 })

const ScheduleReplacement = mongoose.models.ScheduleReplacement || mongoose.model('ScheduleReplacement', scheduleReplacementSchema)

export default ScheduleReplacement
