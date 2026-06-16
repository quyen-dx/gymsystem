import mongoose from 'mongoose'

const checkInSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    checkinTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['success', 'expired', 'blocked'],
      default: 'success',
    },
    qrToken: {
      type: String,
    },
    qrExpiredAt: {
      type: Date,
    },
    selfieUrl: {
      type: String,
    },
    streakDay: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true },
)

checkInSchema.index({ memberId: 1, checkinTime: -1 })
checkInSchema.index({ staffId: 1, checkinTime: -1 })
checkInSchema.index({ checkinTime: -1 })
checkInSchema.index({ qrToken: 1 })

const CheckIn = mongoose.model('CheckIn', checkInSchema)
export default CheckIn
