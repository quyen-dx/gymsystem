import mongoose from 'mongoose'

const waitlistSchema = new mongoose.Schema(
  {
    bookingSlotId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    notifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

waitlistSchema.index({ bookingSlotId: 1, notifiedAt: 1, createdAt: 1 })

export default mongoose.model('Waitlist', waitlistSchema)
