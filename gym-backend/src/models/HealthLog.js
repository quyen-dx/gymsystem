import mongoose from 'mongoose'

const exerciseLogSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  sets: { type: Number, min: 0, default: 0 },
  reps: { type: Number, min: 0, default: 0 },
  weight: { type: Number, min: 0, default: 0 },
  duration: { type: Number, min: 0, default: 0 },
  distance: { type: Number, min: 0, default: 0 },
  notes: { type: String, default: '', trim: true },
}, { _id: false })

const healthLogSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  type: {
    type: String,
    enum: ['workout', 'measurement', 'nutrition', 'note'],
    default: 'measurement',
    index: true,
  },
  date: { type: Date, required: true, index: true },
  height: { type: Number, min: 0 },
  weight: { type: Number, min: 0 },
  bodyFat: { type: Number, min: 0, max: 100 },
  muscle: { type: Number, min: 0 },
  bmi: { type: Number, min: 0 },
  visceralFat: { type: Number, min: 0, max: 60 },
  chest: { type: Number, min: 0 },
  waist: { type: Number, min: 0 },
  hips: { type: Number, min: 0 },
  arm: { type: Number, min: 0 },
  thigh: { type: Number, min: 0 },
  photoUrl: { type: String, default: '', trim: true },
  mood: {
    type: String,
    enum: ['great', 'good', 'normal', 'tired', 'stressed', 'sick', ''],
    default: '',
  },
  exercises: { type: [exerciseLogSchema], default: [] },
  totalDuration: { type: Number, min: 0, default: 0 },
  intensity: { type: String, enum: ['low', 'medium', 'high', ''], default: '' },
  workoutType: {
    type: String,
    enum: ['strength', 'cardio', 'flexibility', 'hiit', 'crossfit', 'yoga', 'swimming', 'sports', 'other', ''],
    default: '',
  },
  caloriesBurned: { type: Number, min: 0, default: 0 },
  notes: { type: String, default: '', trim: true },
  tags: [{ type: String, trim: true }],
  isTemplate: { type: Boolean, default: false },
  templateName: { type: String, default: '', trim: true },
  source: { type: String, enum: ['manual', 'ai', 'pt', 'import'], default: 'manual' },
}, { timestamps: true })

healthLogSchema.pre('validate', function () {
  if (!this.memberId && this.user) this.memberId = this.user
  if (!this.user && this.memberId) this.user = this.memberId

  if (!this.memberId && !this.user) {
    this.invalidate('memberId', 'memberId la bat buoc')
  }

  const heightCm = Number(this.height || 0)
  const weightKg = Number(this.weight || 0)
  if (heightCm > 0 && weightKg > 0) {
    const heightM = heightCm / 100
    this.bmi = Math.round((weightKg / (heightM * heightM)) * 10) / 10
  }
})

healthLogSchema.index({ memberId: 1, date: -1 })
healthLogSchema.index({ memberId: 1, type: 1, date: -1 })
healthLogSchema.index({ user: 1, date: -1 })
healthLogSchema.index({ user: 1, type: 1, date: -1 })

export default mongoose.models.HealthLog || mongoose.model('HealthLog', healthLogSchema)
