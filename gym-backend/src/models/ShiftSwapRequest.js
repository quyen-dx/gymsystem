import mongoose from 'mongoose'

const shiftSwapRequestSchema = new mongoose.Schema({
  requestingPtId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  targetDate: { type: Date, required: true },
  reason: { type: String, default: '' },
  status: {
    type: String,
    enum: ['cho_duyet', 'da_duyet', 'tu_choi', 'da_huy'],
    default: 'cho_duyet',
    index: true,
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  rejectReason: { type: String, default: '' },
}, { timestamps: true })

shiftSwapRequestSchema.index({ requestingPtId: 1, status: 1 })
shiftSwapRequestSchema.index({ requestingPtId: 1, targetDate: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['cho_duyet', 'da_duyet'] } } })

export default mongoose.models.ShiftSwapRequest || mongoose.model('ShiftSwapRequest', shiftSwapRequestSchema)
