import mongoose from 'mongoose'

const groupClassSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên lớp học là bắt buộc'],
      trim: true,
    },
    type: {
      type: String,
      enum: {
        values: ['yoga', 'zumba', 'boxing'],
        message: 'Loại lớp học không hợp lệ',
      },
      required: [true, 'Loại lớp học là bắt buộc'],
    },
    ptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Huấn luyện viên là bắt buộc'],
    },
    schedule: {
      type: Date,
      required: [true, 'Lịch học là bắt buộc'],
    },
    maxSlot: {
      type: Number,
      required: [true, 'Số lượng chỗ tối đa là bắt buộc'],
      default: 15,
      min: [1, 'Số lượng chỗ tối đa phải lớn hơn 0'],
    },
    enrolledMembers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    waitlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    checkedInCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
)

groupClassSchema.virtual('enrolledCount').get(function () {
  return this.enrolledMembers.length
})

groupClassSchema.set('toJSON', { virtuals: true })
groupClassSchema.set('toObject', { virtuals: true })

const GroupClass = mongoose.model('GroupClass', groupClassSchema)

export default GroupClass