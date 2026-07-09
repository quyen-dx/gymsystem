import mongoose from 'mongoose'

const EXERCISE_REGEX = /^(?:Khong|Không)\s+(?:index|indexing)/i

const vectorDocumentSchema = new mongoose.Schema({
  source: {
    type: String,
    required: true,
    enum: ['faq', 'policy', 'readme', 'exercise', 'nutrition', 'knowledge', 'module_readme'],
    index: true,
  },
  sourceId: { type: String, default: '' },
  title: { type: String, default: '' },
  content: { type: String, required: true },
  language: { type: String, default: 'vi' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  chunkIndex: { type: Number, default: 0 },
  embedding: { type: [Number], default: [] },
  contentHash: { type: String, default: '' },
}, {
  timestamps: true,
})

vectorDocumentSchema.index({ source: 1, sourceId: 1 })
vectorDocumentSchema.index({ contentHash: 1 })

export default mongoose.model('VectorDocument', vectorDocumentSchema)
