import mongoose from 'mongoose'

const ptScheduleSchema = new mongoose.Schema(
  {
    ptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PT',
      required: true,
    },
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0,
      max: 6,
    },
    shift: {
      type: String,
      enum: ['morning', 'afternoon', 'evening'],
      required: true,
    },
  },
  { timestamps: true },
)

ptScheduleSchema.index({ ptId: 1, dayOfWeek: 1 })

export default mongoose.model('PTSchedule', ptScheduleSchema)
