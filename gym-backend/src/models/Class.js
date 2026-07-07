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

const classSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["yoga", "zumba", "boxing"],
      default: "yoga",
    },

    ptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    schedule: [
      {
        dayOfWeek: {
          type: Number,
          min: 0,
          max: 6,
        },

        startTime: String,

        endTime: String,
      },
    ],

    maxSlots: {
      type: Number,
      required: true,
      min: 1,
    },

    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    waitlist: [waitlistSchema],

    checkedInCount: {
      type: Number,
      default: 0,
    },

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

classSchema.virtual("slotLeft").get(function () {
  return this.maxSlots - this.members.length;
});

classSchema.pre("save", function (next) {
  if (this.members.length >= this.maxSlots) {
    this.status = "FULL";
  } else {
    this.status = "OPEN";
  }

  next();
});

export default mongoose.model("Class", classSchema);