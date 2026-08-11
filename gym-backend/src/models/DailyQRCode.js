import mongoose from 'mongoose'

const dailyQRCodeSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
  },
  date: {
    type: Date,
    required: true,
  },
  createdBy: {
    // null = hệ thống tự tạo (job 00:00), không phải do admin/staff bấm tạo
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
}, { timestamps: true })

dailyQRCodeSchema.index({ date: -1, isActive: 1 })

export default mongoose.model('DailyQRCode', dailyQRCodeSchema)
