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

    trainingType: {
      type: String,
      enum: ['one_to_one', 'group'],
      default: 'one_to_one',
    },

    priceAtBooking: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'refunded'],
      default: 'unpaid',
      index: true,
    },

    paymentMethod: {
      type: String,
      enum: ['wallet'],
      default: 'wallet',
    },

    walletTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },

    status: {
      type: String,
      enum: ['pending', 'awaiting_payment', 'confirmed', 'cancelled', 'completed'],
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
// Unique partial index to prevent double-booking of the same PT slot.
// Only active-status bookings are constrained; cancelled/completed are ignored.
bookingSchema.index(
  { ptId: 1, date: 1, slot: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['pending', 'awaiting_payment', 'confirmed'] },
    },
  },
)

export default mongoose.model('Booking', bookingSchema)
