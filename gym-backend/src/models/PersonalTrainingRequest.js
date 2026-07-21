import mongoose from 'mongoose'

const personalTrainingRequestSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    specialization: {
      type: String,
      required: [true, 'Chuyên môn là bắt buộc'],
      trim: true,
    },
    goals: [
      {
        type: String,
        trim: true,
      },
    ],
    phone: {
      type: String,
      required: [true, 'Số điện thoại là bắt buộc'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email là bắt buộc'],
      trim: true,
    },
    hasPTPreference: {
      type: Boolean,
      default: false,
    },
    preferredPTId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'assigned', 'cancelled'],
      default: 'pending',
      index: true,
    },
    assignedTrainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedAt: Date,
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    cancelledAt: Date,
    cancelReason: {
      type: String,
      default: '',
    },
  },
  { timestamps: true },
)

personalTrainingRequestSchema.index({ memberId: 1, status: 1 })
personalTrainingRequestSchema.index({ status: 1, createdAt: -1 })

const PersonalTrainingRequest = mongoose.model(
  'PersonalTrainingRequest',
  personalTrainingRequestSchema,
)
export default PersonalTrainingRequest
