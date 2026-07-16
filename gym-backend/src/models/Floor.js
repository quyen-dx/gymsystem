import mongoose from 'mongoose'

const floorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  order: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'maintenance'], default: 'active' },
}, { timestamps: true })

floorSchema.index({ order: 1 })

export default mongoose.models.Floor || mongoose.model('Floor', floorSchema)
