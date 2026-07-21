import mongoose from 'mongoose'

const zoneSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  floorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor', required: true, index: true },
  maxCapacity: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['active', 'maintenance'], default: 'active' },
}, { timestamps: true })

export default mongoose.models.Zone || mongoose.model('Zone', zoneSchema)
