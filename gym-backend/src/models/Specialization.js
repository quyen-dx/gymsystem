import mongoose from 'mongoose'

const specializationSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  icon: { type: String, default: '', trim: true },
  color: { type: String, default: '#6B7280', trim: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true })

specializationSchema.index({ isActive: 1 })

const Specialization = mongoose.model('Specialization', specializationSchema)
export default Specialization
