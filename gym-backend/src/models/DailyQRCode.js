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
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
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
