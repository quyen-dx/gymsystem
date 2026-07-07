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

    // Member
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // PT
    ptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Các tuần
    weeks: {
      type: [weekSchema],
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
  },
  {
    timestamps: true,
  }
);

// Index
workoutSchema.index({ memberId: 1 });
workoutSchema.index({ ptId: 1 });
workoutSchema.index({ memberId: 1, createdAt: -1 });

export default mongoose.models.Workout || mongoose.model("Workout", workoutSchema);
