import mongoose from 'mongoose'

const shortVideoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['upload', 'youtube'],
      default: 'upload',
      index: true,
    },
    caption: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2200,
    },
    videoUrl: {
      type: String,
      default: '',
      trim: true,
    },
    youtubeUrl: {
      type: String,
      default: '',
      trim: true,
    },
    thumbnail: {
      type: String,
      default: '',
      trim: true,
    },
    likesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    commentsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    viewsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tags: [{
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 40,
    }],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true },
)

shortVideoSchema.index({ isActive: 1, createdAt: -1 })
shortVideoSchema.index({ userId: 1, createdAt: -1 })

const ShortVideo = mongoose.model('ShortVideo', shortVideoSchema)

export default ShortVideo
