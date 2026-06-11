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
    experienceYears: { type: Number, default: 0, min: 0 },
    certificates: [{ type: String, trim: true }],
    rating: { type: Number, default: 0, min: 0, max: 5 },
    introVideoUrl: { type: String, default: '' },
    totalSessions: { type: Number, default: 0, min: 0 },
    totalStudents: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
)

export default mongoose.model('PT', ptSchema)
