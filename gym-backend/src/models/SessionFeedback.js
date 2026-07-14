import mongoose from "mongoose";

const sessionFeedbackSchema = new mongoose.Schema(
  {
    workoutId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workout",
      required: true,
      index: true,
    },
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    ptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
    },
    note: {
      type: String,
      default: "",
      trim: true,
    },
    performance: {
      type: String,
      enum: ["excellent", "good", "average", "below_average", "poor"],
      default: "good",
    },
    recommendation: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

sessionFeedbackSchema.index({ workoutId: 1, date: -1 });
sessionFeedbackSchema.index({ memberId: 1, date: -1 });

export default mongoose.models.SessionFeedback || mongoose.model("SessionFeedback", sessionFeedbackSchema);
