import mongoose from 'mongoose'

const healthMetricSchema = new mongoose.Schema(
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

    weight: {
      type: Number,
      min: 0,
      default: null,
    },

    height: {
      type: Number,
      min: 0,
      default: null,
    },

    bodyFatPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    muscleMass: {
      type: Number,
      min: 0,
      default: null,
    },

    boneMass: {
      type: Number,
      min: 0,
      default: null,
    },

    waterPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    visceralFat: {
      type: Number,
      min: 0,
      max: 60,
      default: null,
    },

    bmi: {
      type: Number,
      min: 0,
      default: null,
    },

    bmr: {
      type: Number,
      min: 0,
      default: null,
    },

    waist: {
      type: Number,
      min: 0,
      default: null,
    },

    hip: {
      type: Number,
      min: 0,
      default: null,
    },

    chest: {
      type: Number,
      min: 0,
      default: null,
    },

    arm: {
      type: Number,
      min: 0,
      default: null,
    },

    thigh: {
      type: Number,
      min: 0,
      default: null,
    },

    source: {
      type: String,
      enum: ['manual', 'inbody_scan', 'ai_estimated'],
      default: 'manual',
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

healthMetricSchema.pre('validate', function () {
  if (this.height > 0 && this.weight > 0) {
    const heightM = this.height / 100
    this.bmi = Math.round((this.weight / (heightM * heightM)) * 10) / 10
  }
})

healthMetricSchema.index({ userId: 1, date: -1 })
healthMetricSchema.index({ userId: 1, source: 1 })

export default mongoose.models.HealthMetric || mongoose.model('HealthMetric', healthMetricSchema)
