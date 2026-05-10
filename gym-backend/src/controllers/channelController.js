import mongoose from 'mongoose'
import ShortVideo from '../models/ShortVideo.js'
import User from '../models/User.js'
import AppError from '../utils/appError.js'

const MAX_CHANNEL_LIMIT = 24
const userSelect = 'name avatar email role bio createdAt'

const normalizePagination = (query) => {
  const page = Math.max(Number(query.page) || 1, 1)
  const rawLimit = Math.max(Number(query.limit) || 12, 1)
  const limit = Math.min(rawLimit, MAX_CHANNEL_LIMIT)
  return { page, limit, skip: (page - 1) * limit }
}

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id)

const canManageChannel = (req, userId) =>
  req.user?._id?.toString() === userId || req.user?.role === 'admin'

export const getChannelProfile = async (req, res, next) => {
  try {
    const { userId } = req.params
    if (!isValidObjectId(userId)) return next(new AppError('Kênh không hợp lệ', 400))

    const user = await User.findById(userId).select(userSelect)
    if (!user) return next(new AppError('Không tìm thấy kênh', 404))

    const includePrivate = canManageChannel(req, userId)
    const match = {
      userId: new mongoose.Types.ObjectId(userId),
      ...(includePrivate ? {} : { isActive: true }),
    }

    const [stats] = await ShortVideo.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$userId',
          totalVideos: { $sum: 1 },
          totalLikes: { $sum: '$likesCount' },
          totalViews: { $sum: '$viewsCount' },
          totalComments: { $sum: '$commentsCount' },
        },
      },
    ])

    const safeStats = {
      totalVideos: stats?.totalVideos || 0,
      totalLikes: stats?.totalLikes || 0,
      totalViews: stats?.totalViews || 0,
      totalComments: stats?.totalComments || 0,
    }

    res.json({
      profile: user,
      stats: {
        ...safeStats,
        followersCount: Math.max(12, Math.floor((safeStats.totalLikes + safeStats.totalViews) / 18)),
      },
      canManage: includePrivate,
    })
  } catch (err) {
    next(err)
  }
}

export const getChannelVideos = async (req, res, next) => {
  try {
    const { userId } = req.params
    if (!isValidObjectId(userId)) return next(new AppError('Kênh không hợp lệ', 400))

    const { page, limit, skip } = normalizePagination(req.query)
    const includePrivate = canManageChannel(req, userId)
    const filter = {
      userId,
      ...(includePrivate ? {} : { isActive: true }),
    }

    const total = await ShortVideo.countDocuments(filter)
    const videos = await ShortVideo.find(filter)
      .populate('userId', 'name avatar role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    res.json({
      videos,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    })
  } catch (err) {
    next(err)
  }
}
