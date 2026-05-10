import mongoose from 'mongoose'

const videoCommentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShortVideo',
      required: true,
      index: true,
    },
    parentCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VideoComment',
      default: null,
      index: true,
    },
    content: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },
    imageUrl: {
      type: String,
      default: '',
      trim: true,
    },
    likesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
)

videoCommentSchema.index({ videoId: 1, parentCommentId: 1, createdAt: -1 })

const VideoComment = mongoose.model('VideoComment', videoCommentSchema)

export default VideoComment
