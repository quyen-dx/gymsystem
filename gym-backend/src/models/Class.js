import mongoose from 'mongoose'

const classSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    ptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PT',
      required: true,
      index: true,
    },
    schedule: [
      {
        dayOfWeek: { type: Number, min: 0, max: 6 },
        startTime: String,
        endTime: String,
      },
    ],
    maxSlots: { type: Number, required: true, min: 1 },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true },
)

export default mongoose.model('Class', classSchema)
