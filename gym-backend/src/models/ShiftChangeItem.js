import mongoose from 'mongoose'

export const SHIFT_CHANGE_ITEM_STATUSES = {
  PENDING: 'pending', // chưa có PT thay
  ASSIGNED: 'assigned', // đã gán PT thay, chờ PT thay phản hồi
  ACCEPTED: 'accepted', // PT thay đã chấp nhận
  REJECTED: 'rejected', // PT thay đã từ chối (hoặc tất cả bị từ chối)
  CANCELLED: 'cancelled',
}

const shiftChangeItemSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShiftChangeRequest',
      required: true,
      index: true,
    },
    // Snapshot ca / lớp (không tham chiếu trực tiếp để tránh thay đổi theo thời gian)
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TrainingClass',
      required: true,
    },
    className: { type: String, default: '' },
    classCode: { type: String, default: '' },
    startTime: { type: String, default: '' }, // HH:mm
    endTime: { type: String, default: '' }, // HH:mm
    floorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor', default: null },
    floorName: { type: String, default: '' },
    zoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', default: null },
    zoneName: { type: String, default: '' },
    specialization: { type: String, default: '' },
    status: {
      type: String,
      enum: Object.values(SHIFT_CHANGE_ITEM_STATUSES),
      default: SHIFT_CHANGE_ITEM_STATUSES.PENDING,
    },
    // PT thay thế (PT B) đang được gán / đã chấp nhận cho ca này
    replacementTrainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    replacementStatus: {
      type: String,
      enum: ['pending', 'assigned', 'accepted', 'rejected'],
      default: 'pending',
    },
    // Danh sách PT đã từ chối ca này — admin KHÔNG được chọn lại
    rejectedTrainerIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Lịch sử từ chối theo thứ tự thời gian — mỗi entry: PT + lý do + thời điểm
    rejections: [
      {
        trainerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        reason: { type: String, default: '' },
        at: { type: Date, default: Date.now },
      },
    ],
    // Bản ghi thay ca được tạo khi PT thay chấp nhận
    scheduleReplacementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ScheduleReplacement',
      default: null,
    },
    rejectReason: { type: String, default: '' },
  },
  { timestamps: true },
)

const ShiftChangeItem = mongoose.models.ShiftChangeItem || mongoose.model('ShiftChangeItem', shiftChangeItemSchema)

export default ShiftChangeItem
