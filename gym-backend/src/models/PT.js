import mongoose from 'mongoose'

const ptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    specialties: [{ type: String, trim: true }],

    bio: { type: String, default: '', trim: true },

    experienceYears: {
      type: Number,
      default: 0,
      min: 0,
    },

    certificates: [{ type: String, trim: true }],

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    introVideoUrl: {
      type: String,
      default: '',
    },

    // Thống kê
    totalSessions: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalStudents: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Cấu hình giá đặt lịch (chỉ Admin được sửa) — null = chưa cấu hình
    oneToOnePrice: {
      type: Number,
      default: null,
      min: 0,
    },

    groupPrice: {
      type: Number,
      default: null,
      min: 0,
    },

    priceUpdatedAt: {
      type: Date,
      default: null,
    },

    priceUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
)

export default mongoose.model('PT', ptSchema)