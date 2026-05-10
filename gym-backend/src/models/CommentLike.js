import mongoose from 'mongoose'

const commentLikeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    commentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VideoComment',
      required: true,
      index: true,
    },
  },
  { timestamps: true },
)

commentLikeSchema.index({ userId: 1, commentId: 1 }, { unique: true })

const CommentLike = mongoose.model('CommentLike', commentLikeSchema)

export default CommentLike
