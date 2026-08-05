import mongoose from 'mongoose'

const planFeatureSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  isSystem: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true })

planFeatureSchema.index({ isActive: 1 })

const PlanFeature = mongoose.model('PlanFeature', planFeatureSchema)
export default PlanFeature
