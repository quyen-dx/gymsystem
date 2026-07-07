import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Tiêu đề thông báo là bắt buộc'],
      trim: true,
    },
    content: {
      type: String,
      required: [true, 'Nội dung thông báo là bắt buộc'],
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
)

const Notification = mongoose.model('Notification', notificationSchema)

export default Notification