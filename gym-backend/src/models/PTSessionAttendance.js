import mongoose from 'mongoose'

/**
 * P1: Điểm danh sự có mặt của PT cho từng buổi tập (nguồn dữ liệu độc lập với check-in
 * của member để quyết định completed / member_no_show / pt_no_show / needs_review).
 * Lễ tân/staff ghi nhận tại quầy, PT ghi nhận cho buổi của mình, admin sửa khi cần.
 */
const ptSessionAttendanceSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      unique: true,
      index: true,
    },
    ptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['present', 'absent'],
      required: true,
    },
    // Lý do khi PT vắng mặt (để minh bạch khi hoàn tiền/đền bù)
    note: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    markedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
)

const PTSessionAttendance =
  mongoose.models.PTSessionAttendance || mongoose.model('PTSessionAttendance', ptSessionAttendanceSchema)

export default PTSessionAttendance
