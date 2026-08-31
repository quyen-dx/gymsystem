import mongoose from 'mongoose'

const scheduleExerciseSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  note: { type: String, default: '', trim: true },
  completed: { type: Boolean, default: false },
  // Kết quả thực hiện do PT ghi nhận khi hoàn thành buổi tập
  setsDone: { type: Number, default: 0 },
  repsDone: { type: Number, default: 0 },
  weightUsed: { type: Number, default: 0 },
  durationMin: { type: Number, default: 0 },
}, { _id: false })

const sessionChangeSchema = new mongoose.Schema({
  action: { type: String, enum: ['created', 'rescheduled', 'cancelled', 'status_changed', 'result_updated', 'plan_updated'], default: 'status_changed' },
  from: { type: mongoose.Schema.Types.Mixed, default: null },
  to: { type: mongoose.Schema.Types.Mixed, default: null },
  reason: { type: String, default: '' },
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  byRole: { type: String, default: '' },
  at: { type: Date, default: Date.now },
}, { _id: false })

const scheduleSessionSchema = new mongoose.Schema({
  dayOrder: { type: Number, required: true },
  // Vị trí buổi trong giáo án mẫu (template.days) mà slot này tương ứng (1-based).
  // Slot thứ j được gán buổi thứ j của giáo án; buổi nào chưa có slot → đang chờ (WAITING).
  // Khi member có thêm buổi PT, PT thêm slot mới → slot đó nhận buổi kế tiếp chưa hoàn thành.
  templateSessionIndex: { type: Number, default: null },
  date: { type: Date, required: true },
  time: { type: String, default: '' },
  endTime: { type: String, default: '' },
  className: { type: String, default: '' },
  classCode: { type: String, default: '' },
  location: { type: String, default: '' },
  status: {
    type: String,
    // pending = chưa diễn ra; completed = PT hoàn thành; skipped = PT bỏ qua;
    // cancelled = member/admin hủy; no_show = member không có mặt
    enum: ['pending', 'completed', 'skipped', 'cancelled', 'no_show'],
    default: 'pending',
  },
  title: { type: String, default: '' },
  muscleGroup: { type: String, default: '' },
  exercises: { type: [scheduleExerciseSchema], default: [] },
  feedback: { type: String, default: '' },
  // Đánh giá của PT khi hoàn thành buổi
  performance: { type: String, enum: ['', 'excellent', 'good', 'average', 'below_average', 'poor'], default: '' },
  completedAt: { type: Date, default: null },
  // Lịch sử thay đổi của buổi (đổi lịch, hủy, cập nhật kết quả...) — không ghi đè mất gốc
  changeHistory: { type: [sessionChangeSchema], default: [] },
}, { _id: false })

const workoutScheduleSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workout', required: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Liên kết với đúng phân công PT 1-1 để thao tác kết thúc không quét lịch khác.
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'PTAssignment', default: null, index: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingClass', default: null, index: true },
  trainerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  startDate: { type: Date, required: true },
  weekIndex: { type: Number, default: 1 },
  totalWeeks: { type: Number, default: 1 },
  status: { type: String, enum: ['active', 'completed', 'archived', 'cancelled'], default: 'active' },
  sessions: { type: [scheduleSessionSchema], default: [] },
  // Soft-delete: lịch không bị xóa vĩnh viễn, giữ nguyên lịch sử nghiệp vụ
  deletedAt: { type: Date, default: null },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  deleteReason: { type: String, default: '' },
}, { timestamps: true })

workoutScheduleSchema.index({ memberId: 1, status: 1 })
workoutScheduleSchema.index({ memberId: 1, date: 1 })

export default mongoose.models.WorkoutSchedule || mongoose.model('WorkoutSchedule', workoutScheduleSchema)
