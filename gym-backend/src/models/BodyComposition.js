import mongoose from 'mongoose'

const bodyCompositionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    date: {
      type: Date,
      required: true,
      index: true,
    },

    source: {
      type: String,
      enum: ['inbody', 'manual', 'smart_scale'],
      default: 'manual',
    },

    metricId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HealthMetric',
      default: null,
    },

    rawData: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },

    segmentalAnalysis: {
      rightArm: {
        leanMass: { type: Number, default: null },
        fatMass: { type: Number, default: null },
      },
      leftArm: {
        leanMass: { type: Number, default: null },
        fatMass: { type: Number, default: null },
      },
      trunk: {
        leanMass: { type: Number, default: null },
        fatMass: { type: Number, default: null },
      },
      rightLeg: {
        leanMass: { type: Number, default: null },
        fatMass: { type: Number, default: null },
      },
      leftLeg: {
        leanMass: { type: Number, default: null },
        fatMass: { type: Number, default: null },
      },
    },

    scanImageUrl: {
      type: String,
      default: '',
      trim: true,
    },

    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true },
)

bodyCompositionSchema.index({ userId: 1, date: -1 })
bodyCompositionSchema.index({ metricId: 1 })

export default mongoose.models.BodyComposition || mongoose.model('BodyComposition', bodyCompositionSchema)
