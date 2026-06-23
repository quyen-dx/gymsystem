import mongoose from 'mongoose'

const feedbackSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['suggestion', 'bug', 'complaint', 'other'],
      default: 'suggestion',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['pending', 'reviewing', 'resolved', 'rejected'],
      default: 'pending',
      index: true,
    },
    adminReply: { type: String, default: '', trim: true },
    attachments: [{
      url: { type: String, required: true },
      publicId: { type: String, default: '' },
      type: { type: String, enum: ['image'], default: 'image' },
    }],
  },
  { timestamps: true },
)

export default mongoose.model('Feedback', feedbackSchema)
