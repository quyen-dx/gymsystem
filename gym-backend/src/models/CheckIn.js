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
      default: null,
    },
    checkinTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'expired', 'blocked'],
      default: 'success',
    },
    errorNote: {
      type: String,
      trim: true,
      default: '',
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
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      default: null,
    },
    planName: {
      type: String,
      trim: true,
      default: '',
    },
    planPrice: {
      type: Number,
      default: 0,
    },
    // New fields for the daily QR check-in flow
    dailyQRCodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DailyQRCode',
    },
    scheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkoutSchedule',
    },
    sessionDate: {
      type: Date,
    },
    sessionTitle: {
      type: String,
    },
    sessionTime: {
      type: String,
    },
    sessionIndex: {
      type: Number,
    },
    classCode: {
      type: String,
    },
    checkinSource: {
      type: String,
      enum: ['daily_qr', 'staff_qr'],
      default: 'daily_qr',
    },
    sessionType: {
      type: String,
      enum: ['scheduled', 'free_workout'],
      default: 'scheduled',
    },
    checkInMethod: {
      type: String,
      enum: ['QR_SELF', 'QR_PROJECTOR', 'STAFF', 'RECEPTION', 'AUTO'],
      default: 'QR_SELF',
    },
    manualReason: {
      type: String,
      trim: true,
      default: '',
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    performedByName: {
      type: String,
      default: '',
    },
  },
  { timestamps: true },
)

checkInSchema.index({ memberId: 1, checkinTime: -1 })
checkInSchema.index({ staffId: 1, checkinTime: -1 })
checkInSchema.index({ checkinTime: -1 })
checkInSchema.index({ qrToken: 1 })
checkInSchema.index({ dailyQRCodeId: 1 })
checkInSchema.index({ memberId: 1, scheduleId: 1, sessionDate: 1 })
checkInSchema.index({ planId: 1, checkinTime: -1 })

const CheckIn = mongoose.model('CheckIn', checkInSchema)
export default CheckIn
