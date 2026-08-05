import mongoose from 'mongoose'

const trainingClassSchema = new mongoose.Schema({
  code: { type: String, unique: true, sparse: true, trim: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  specialization: { type: String, default: '', trim: true },
  ptId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  pendingTrainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  floorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor', default: null },
  zoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', default: null },
  daysOfWeek: { type: [{ type: Number, min: 0, max: 6 }], default: [] },
  startTime: { type: String, default: null }, // HH:mm
  endTime: { type: String, default: null },   // HH:mm
  status: {
    type: String,
    enum: ['waiting_pt', 'waiting_accept', 'active', 'inactive', 'closed'],
    default: 'waiting_pt',
  },
}, { timestamps: true })

trainingClassSchema.index({ createdAt: -1 })
trainingClassSchema.index({ floorId: 1, zoneId: 1 })
trainingClassSchema.index({ ptId: 1 })
trainingClassSchema.index({ status: 1 })

trainingClassSchema.pre('save', async function () {
  if (!this.code) {
    const count = await mongoose.model('TrainingClass').countDocuments()
    this.code = `C${String(count + 1).padStart(3, '0')}`
  }
})

export default mongoose.models.TrainingClass || mongoose.model('TrainingClass', trainingClassSchema)
