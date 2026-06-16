import mongoose from 'mongoose'

const bookingSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    ptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    slot: {
      type: String,
      required: true,
      trim: true,
    },
    note: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
      index: true,
    },
    cancelReason: {
      type: String,
      default: '',
    },

    rejectReason: {
      type: String,
      default: '',
    },

    isViolation: {
      type: Boolean,
      default: false,
    },

    rating: {
      type: Number,
      min: 1,
      max: 5,
    },

    reviewComment: {
      type: String,
      default: '',
    },
    completedAt: Date,
  },
  { timestamps: true },
)

bookingSchema.index({ ptId: 1, date: 1, slot: 1, status: 1 })
bookingSchema.index({ memberId: 1, date: 1, status: 1 })

export default mongoose.model('Booking', bookingSchema)
