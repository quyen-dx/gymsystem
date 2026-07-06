import mongoose from "mongoose";

const waitlistSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const groupClassSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["yoga", "zumba", "boxing"],
      required: true,
    },

    ptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    schedule: {
      type: Date,
      required: true,
    },

    maxSlot: {
      type: Number,
      default: 15,
    },

    enrolledMembers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    enrolledCount: {
      type: Number,
      default: 0,
    },

    checkedInCount: {
      type: Number,
      default: 0,
    },

    waitlist: [waitlistSchema],

    status: {
      type: String,
      enum: ["OPEN", "FULL", "FINISHED"],
      default: "OPEN",
    },
  },
  {
    timestamps: true,
  }
);

groupClassSchema.pre("save", function (next) {
  this.enrolledCount = this.enrolledMembers.length;

  if (this.enrolledCount >= this.maxSlot) {
    this.status = "FULL";
  } else {
    this.status = "OPEN";
  }

  next();
});

export default mongoose.model("GroupClass", groupClassSchema);