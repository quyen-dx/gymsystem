import mongoose from "mongoose";

// Bài tập
const exerciseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    sets: {
      type: Number,
      required: true,
      min: 1,
    },

    reps: {
      type: Number,
      required: true,
      min: 1,
    },

    restTime: {
      type: Number,
      default: 60,
      min: 0,
    },

    techniqueNote: {
      type: String,
      default: "",
      trim: true,
    },

    completed: {
      type: Boolean,
      default: false,
    },

    completedAt: {
      type: Date,
    },

    actualCompletionTime: {
      type: Number,
      min: 0,
    },
  },
  { _id: false }
);

// Buổi tập
const sessionSchema = new mongoose.Schema(
  {
    sessionName: {
      type: String,
      required: true,
      trim: true,
    },

    feedback: {
      type: String,
      default: "",
      trim: true,
    },

    startedAt: {
      type: Date,
    },

    endedAt: {
      type: Date,
    },

    exercises: {
      type: [exerciseSchema],
      default: [],
    },
  },
  { _id: false }
);

// Tuần tập
const weekSchema = new mongoose.Schema(
  {
    weekNumber: {
      type: Number,
      required: true,
      min: 1,
    },

    sessions: {
      type: [sessionSchema],
      default: [],
    },
  },
  { _id: false }
);

// Ngày tập (cho template)
const templateDayExerciseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    note: { type: String, default: '', trim: true },
  },
  { _id: false }
)

const templateDaySchema = new mongoose.Schema(
  {
    dayOfWeek: { type: Number, default: 0, min: 0, max: 8 },
    muscleGroup: { type: String, default: '', trim: true },
    description: { type: String, default: '', trim: true },
    exercises: { type: [templateDayExerciseSchema], default: [] },
  },
  { _id: false }
)

// Workout
const workoutSchema = new mongoose.Schema(
  {
    // Tên lộ trình
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Mục tiêu
    goal: {
      type: String,
      required: true,
      trim: true,
    },

    // Thời gian (số tuần)
    duration: {
      type: Number,
      required: true,
      min: 1,
    },

    // Ngày bắt đầu
    startDate: {
      type: Date,
    },

    // Ngày kết thúc
    endDate: {
      type: Date,
    },

    // Mô tả
    description: {
      type: String,
      default: "",
      trim: true,
    },

    // Member (không bắt buộc với template)
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    // PT
    ptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // Các tuần (cho giáo án đã gán)
    weeks: {
      type: [weekSchema],
      default: [],
    },

    // Các ngày tập (cho template)
    days: {
      type: [templateDaySchema],
      default: [],
    },

    // % hoàn thành
    completionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // Calories dự kiến
    estimatedCalories: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Là giáo án mẫu?
    isTemplate: {
      type: Boolean,
      default: false,
    },

    // Trạng thái (với giáo án đã gán cho member)
    status: {
      type: String,
      enum: ['active', 'completed', 'archived'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

// Index
workoutSchema.index({ memberId: 1 });
workoutSchema.index({ ptId: 1 });
workoutSchema.index({ memberId: 1, createdAt: -1 });

workoutSchema.index({ isTemplate: 1, createdAt: -1 });

export default mongoose.models.Workout || mongoose.model("Workout", workoutSchema);