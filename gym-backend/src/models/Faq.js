import mongoose from 'mongoose'

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
    category: { type: String, default: 'Chung', trim: true, index: true },
    isPublished: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
)

faqSchema.index({ question: 'text', answer: 'text', category: 'text' })

export default mongoose.model('Faq', faqSchema)
