import mongoose from 'mongoose'

const videoLikeSchema = new mongoose.Schema(
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
  },
  { timestamps: true },
)

videoLikeSchema.index({ userId: 1, videoId: 1 }, { unique: true })

const VideoLike = mongoose.model('VideoLike', videoLikeSchema)

export default VideoLike
