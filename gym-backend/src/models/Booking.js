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
      // not_required: đặt lịch PT không thu phí riêng; vẫn là booking hợp lệ
      // để check-in và nghiệp vụ no-show có thể xử lý.
      enum: ['unpaid', 'pending', 'paid', 'not_required', 'failed', 'expired', 'refunded'],
      default: 'unpaid',
      index: true,
    },

    paymentMethod: {
      type: String,
      enum: ['wallet', 'vnpay'],
      default: 'wallet',
    },

    walletTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    paymentDeadline: { type: Date, default: null, index: true },
    paymentFailedAt: { type: Date, default: null },
    paymentExpiredAt: { type: Date, default: null },

    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TrainingRequest',
      default: null,
      index: true,
    },

    status: {
      type: String,
      enum: ['pending', 'awaiting_payment', 'confirmed', 'cancelled', 'completed', 'member_no_show', 'pt_no_show', 'needs_review'],
      default: 'pending',
      index: true,
    },

    // P1: vết đánh dấu no-show (PT mark / staff mark / tự động từ sweeper)
    noShowMarkedAt: {
      type: Date,
      default: null,
    },
    noShowMarkedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    autoNoShow: {
      type: Boolean,
      default: false,
    },
    noShowReason: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    // P1: thiếu dữ liệu (không check-in, không ghi nhận điểm danh PT) → cần lễ tân xử lý
    needsReview: {
      type: Boolean,
      default: false,
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

    rescheduledFrom: {
      date: {
        type: Date,
        default: null,
      },
      slot: {
        type: String,
        default: '',
      },
    },

    rescheduledAt: {
      type: Date,
      default: null,
    },

    rescheduleReason: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },

    // P10: yêu cầu đổi lịch của member — PT phải xác nhận (approved/rejected) trước khi áp dụng
    rescheduleRequest: {
      status: {
        type: String,
        enum: [null, 'pending', 'approved', 'rejected', 'cancelled'],
        default: null,
      },
      requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      requestedAt: {
        type: Date,
        default: null,
      },
      oldDate: {
        type: Date,
        default: null,
      },
      oldSlot: {
        type: String,
        default: '',
      },
      newDate: {
        type: Date,
        default: null,
      },
      newSlot: {
        type: String,
        default: '',
      },
      reason: {
        type: String,
        default: '',
        trim: true,
        maxlength: 500,
      },
      decidedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      decidedAt: {
        type: Date,
        default: null,
      },
      decisionNote: {
        type: String,
        default: '',
        trim: true,
        maxlength: 500,
      },
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
