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
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: {
    type: String,
    enum: ['workout', 'measurement', 'nutrition', 'note'],
    required: true,
    index: true,
  },
  date: { type: Date, required: true, index: true },
  exercises: [exerciseLogSchema],
  totalDuration: { type: Number, min: 0, default: 0 },
  intensity: { type: String, enum: ['low', 'medium', 'high', ''], default: '' },
  workoutType: {
    type: String,
    enum: ['strength', 'cardio', 'flexibility', 'hiit', 'crossfit', 'yoga', 'swimming', 'sports', 'other', ''],
    default: '',
  },
  caloriesBurned: { type: Number, min: 0, default: 0 },
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
  notes: { type: String, default: '', trim: true },
  tags: [{ type: String, trim: true }],
  isTemplate: { type: Boolean, default: false },
  templateName: { type: String, default: '', trim: true },
  source: { type: String, enum: ['manual', 'ai', 'pt', 'import'], default: 'manual' },
}, { timestamps: true })

healthLogSchema.index({ user: 1, date: -1 })
healthLogSchema.index({ user: 1, type: 1, date: -1 })

export default mongoose.model('HealthLog', healthLogSchema)
