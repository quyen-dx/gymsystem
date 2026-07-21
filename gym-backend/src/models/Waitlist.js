import mongoose from 'mongoose'

const waitlistSchema = new mongoose.Schema(
  {
    bookingSlotId: {
      type: String,
      required: true,
      index: true,
    },

    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    position: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ['waiting', 'promoted', 'expired', 'cancelled'],
      default: 'waiting',
    },

    notifiedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
)

waitlistSchema.index({ bookingSlotId: 1, memberId: 1 }, { unique: true })

export default mongoose.model('Waitlist', waitlistSchema)