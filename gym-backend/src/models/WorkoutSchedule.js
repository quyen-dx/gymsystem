import mongoose from 'mongoose'

const scheduleExerciseSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  note: { type: String, default: '', trim: true },
  completed: { type: Boolean, default: false },
}, { _id: false })

const scheduleSessionSchema = new mongoose.Schema({
  dayOrder: { type: Number, required: true },
  date: { type: Date, required: true },
  time: { type: String, default: '' },
  endTime: { type: String, default: '' },
  className: { type: String, default: '' },
  classCode: { type: String, default: '' },
  location: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'completed', 'skipped'], default: 'pending' },
  title: { type: String, default: '' },
  muscleGroup: { type: String, default: '' },
  exercises: { type: [scheduleExerciseSchema], default: [] },
  feedback: { type: String, default: '' },
}, { _id: false })

const workoutScheduleSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workout', required: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingClass', default: null, index: true },
  trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  startDate: { type: Date, required: true },
  status: { type: String, enum: ['active', 'completed', 'archived', 'cancelled'], default: 'active' },
  sessions: { type: [scheduleSessionSchema], default: [] },
}, { timestamps: true })

workoutScheduleSchema.index({ memberId: 1, status: 1 })
workoutScheduleSchema.index({ memberId: 1, date: 1 })

export default mongoose.models.WorkoutSchedule || mongoose.model('WorkoutSchedule', workoutScheduleSchema)
