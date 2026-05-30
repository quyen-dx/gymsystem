import mongoose from 'mongoose'

const policySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    category: { type: String, default: 'Chung', trim: true },
    content: { type: String, required: true, trim: true },
    isPublished: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
)

export default mongoose.model('Policy', policySchema)
