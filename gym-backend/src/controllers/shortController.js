import mongoose from 'mongoose'
import cloudinary from '../config/cloudinary.js'
import CommentLike from '../models/CommentLike.js'
import ShortVideo from '../models/ShortVideo.js'
import VideoComment from '../models/VideoComment.js'
import VideoLike from '../models/VideoLike.js'
import AppError from '../utils/appError.js'

const MAX_FEED_LIMIT = 20
const VIEW_COOLDOWN_MS = 30 * 60 * 1000
const viewCache = new Map()

const userSelect = 'name avatar role'

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id)

const normalizePagination = (query) => {
  const page = Math.max(Number(query.page) || 1, 1)
  const rawLimit = Math.max(Number(query.limit) || 8, 1)
  const limit = Math.min(rawLimit, MAX_FEED_LIMIT)
  return { page, limit, skip: (page - 1) * limit }
}

const normalizeTags = (tags) => {
  const values = Array.isArray(tags)
    ? tags
    : String(tags || '')
      .split(',')

  return [...new Set(values
    .map((tag) => String(tag).trim().replace(/^#/, '').toLowerCase())
    .filter(Boolean))]
    .slice(0, 12)
}

const isValidHttpUrl = (value) => {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}

const isCloudinaryUrl = (value) => {
  try {
    const url = new URL(value)
    return url.hostname.toLowerCase().includes('cloudinary.com')
  } catch {
    return false
  }
}

const isDirectVideoUrl = (value) => {
  try {
    const url = new URL(value)
    return /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(url.pathname + url.search)
  } catch {
    return false
  }
}

const extractYoutubeId = (value) => {
  try {
    const url = new URL(value)
    const host = url.hostname.replace(/^www\./, '').toLowerCase()

    if (host === 'youtu.be') {
      return url.pathname.split('/').filter(Boolean)[0] || ''
    }

    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      if (url.pathname === '/watch') return url.searchParams.get('v') || ''
      if (url.pathname.startsWith('/shorts/')) return url.pathname.split('/')[2] || ''
      if (url.pathname.startsWith('/embed/')) return url.pathname.split('/')[2] || ''
    }

    return ''
  } catch {
    return ''
  }
}

const getYoutubeThumbnail = (youtubeId) =>
  `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`

const uploadVideoBuffer = (file) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'video',
        folder: 'gym-shorts',
        allowed_formats: ['mp4', 'mov', 'webm', 'm4v'],
      },
      (error, result) => {
        if (error) reject(error)
        else resolve(result)
      },
    )

    stream.end(file.buffer)
  })

const uploadCommentImageBuffer = (file) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: 'gym-shorts/comments',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
        transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }],
      },
      (error, result) => {
        if (error) reject(error)
        else resolve(result)
      },
    )

    stream.end(file.buffer)
  })

const getThumbnailUrl = (publicId) =>
  cloudinary.url(publicId, {
    resource_type: 'video',
    secure: true,
    format: 'jpg',
    transformation: [
      { width: 720, height: 1280, crop: 'fill', gravity: 'auto', start_offset: 'auto' },
      { quality: 'auto' },
    ],
  })

const withViewerState = async (videos, userId) => {
  const plainVideos = videos.map((video) => video.toObject())
  if (!userId || plainVideos.length === 0) {
    return plainVideos.map((video) => ({ ...video, isLiked: false }))
  }

  const likedIds = await VideoLike.find({
    userId,
    videoId: { $in: plainVideos.map((video) => video._id) },
  }).distinct('videoId')

  const likedSet = new Set(likedIds.map((id) => id.toString()))
  return plainVideos.map((video) => ({
    ...video,
    isLiked: likedSet.has(video._id.toString()),
  }))
}

const withCommentViewerState = async (comments, userId) => {
  const plainComments = comments.map((comment) => comment.toObject())
  if (plainComments.length === 0) return []

  const [likedIds, replyGroups] = await Promise.all([
    userId
      ? CommentLike.find({
        userId,
        commentId: { $in: plainComments.map((comment) => comment._id) },
      }).distinct('commentId')
      : [],
    VideoComment.aggregate([
      { $match: { parentCommentId: { $in: plainComments.map((comment) => comment._id) } } },
      { $group: { _id: '$parentCommentId', count: { $sum: 1 } } },
    ]),
  ])

  const likedSet = new Set(likedIds.map((id) => id.toString()))
  const replyCountMap = new Map(replyGroups.map((item) => [item._id.toString(), item.count]))

  return plainComments.map((comment) => ({
    ...comment,
    isLiked: likedSet.has(comment._id.toString()),
    repliesCount: replyCountMap.get(comment._id.toString()) || 0,
  }))
}

const assertVideoAccess = (video, user) => {
  const isOwner = video.userId?.toString() === user._id.toString()
  if (!isOwner && user.role !== 'admin') {
    throw new AppError('Bạn không có quyền xóa video này', 403)
  }
}

export const uploadShortVideo = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('Vui lòng chọn video để upload', 400))
    }

    if (!req.file.mimetype?.startsWith('video/')) {
      return next(new AppError('File upload phải là video', 400))
    }

    const result = await uploadVideoBuffer(req.file)
    const video = await ShortVideo.create({
      userId: req.user._id,
      type: 'upload',
      caption: req.body.caption || '',
      videoUrl: result.secure_url,
      thumbnail: getThumbnailUrl(result.public_id),
      tags: normalizeTags(req.body.tags),
    })

    const populatedVideo = await ShortVideo.findById(video._id).populate('userId', userSelect)

    res.status(201).json({
      message: 'Upload video thành công',
      video: { ...populatedVideo.toObject(), isLiked: false },
    })
  } catch (err) {
    next(err)
  }
}

export const uploadShortVideoByUrl = async (req, res, next) => {
  try {
    const videoUrl = String(req.body.videoUrl || '').trim()
    if (!isValidHttpUrl(videoUrl)) {
      return next(new AppError('URL video không hợp lệ', 400))
    }

    const youtubeId = extractYoutubeId(videoUrl)
    const basePayload = {
      userId: req.user._id,
      caption: req.body.caption || '',
      tags: normalizeTags(req.body.tags),
    }

    const video = youtubeId
      ? await ShortVideo.create({
        ...basePayload,
        type: 'youtube',
        youtubeUrl: videoUrl,
        thumbnail: getYoutubeThumbnail(youtubeId),
      })
      : await ShortVideo.create({
        ...basePayload,
        type: 'upload',
        videoUrl,
        thumbnail: req.body.thumbnail || '',
      })

    if (!youtubeId && !isCloudinaryUrl(videoUrl) && !isDirectVideoUrl(videoUrl)) {
      await video.deleteOne()
      return next(new AppError('Chỉ hỗ trợ Cloudinary URL, Youtube URL hoặc URL video mp4/webm/mov trực tiếp', 400))
    }

    const populatedVideo = await ShortVideo.findById(video._id).populate('userId', userSelect)
    res.status(201).json({
      message: 'Đăng video bằng URL thành công',
      video: { ...populatedVideo.toObject(), isLiked: false },
    })
  } catch (err) {
    next(err)
  }
}

export const getShortFeed = async (req, res, next) => {
  try {
    const { page, limit, skip } = normalizePagination(req.query)
    const filter = { isActive: true }
    const total = await ShortVideo.countDocuments(filter)
    const videos = await ShortVideo.find(filter)
      .populate('userId', userSelect)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    res.json({
      videos: await withViewerState(videos, req.user?._id),
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

export const getAdminShorts = async (req, res, next) => {
  try {
    const { page, limit, skip } = normalizePagination(req.query)
    const search = String(req.query.search || '').trim()
    const filter = {}

    if (search) {
      filter.$or = [
        { caption: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ]
    }

    const total = await ShortVideo.countDocuments(filter)
    const videos = await ShortVideo.find(filter)
      .populate('userId', 'name avatar email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    res.json({
      videos,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    next(err)
  }
}

export const toggleShortLike = async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) return next(new AppError('Video không hợp lệ', 400))

    const video = await ShortVideo.findOne({ _id: id, isActive: true })
    if (!video) return next(new AppError('Không tìm thấy video', 404))

    const existingLike = await VideoLike.findOne({ userId: req.user._id, videoId: id })
    const liked = !existingLike

    if (existingLike) {
      await existingLike.deleteOne()
    } else {
      await VideoLike.create({ userId: req.user._id, videoId: id })
    }

    const likesCount = await VideoLike.countDocuments({ videoId: id })
    video.likesCount = likesCount
    await video.save()

    res.json({ liked, likesCount })
  } catch (err) {
    if (err.code === 11000) {
      const likesCount = await VideoLike.countDocuments({ videoId: req.params.id })
      return res.json({ liked: true, likesCount })
    }
    next(err)
  }
}

export const addShortView = async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) return next(new AppError('Video không hợp lệ', 400))

    const viewerKey = req.user?._id?.toString() || req.ip
    const cacheKey = `${viewerKey}:${id}`
    const now = Date.now()
    const lastViewedAt = viewCache.get(cacheKey)

    if (lastViewedAt && now - lastViewedAt < VIEW_COOLDOWN_MS) {
      const video = await ShortVideo.findById(id).select('viewsCount')
      return res.json({ counted: false, viewsCount: video?.viewsCount || 0 })
    }

    const video = await ShortVideo.findOneAndUpdate(
      { _id: id, isActive: true },
      { $inc: { viewsCount: 1 } },
      { new: true, select: 'viewsCount' },
    )
    if (!video) return next(new AppError('Không tìm thấy video', 404))

    viewCache.set(cacheKey, now)
    if (viewCache.size > 20000) {
      for (const [key, value] of viewCache) {
        if (now - value > VIEW_COOLDOWN_MS) viewCache.delete(key)
      }
    }

    res.json({ counted: true, viewsCount: video.viewsCount })
  } catch (err) {
    next(err)
  }
}

export const addShortComment = async (req, res, next) => {
  try {
    const { id } = req.params
    const content = String(req.body.content || '').trim()
    const parentCommentId = req.body.parentCommentId || null
    const imageUrl = req.file ? (await uploadCommentImageBuffer(req.file)).secure_url : ''

    if (!isValidObjectId(id)) return next(new AppError('Video không hợp lệ', 400))
    if (!content && !imageUrl) return next(new AppError('Vui lòng nhập nội dung hoặc chọn ảnh', 400))
    if (parentCommentId && !isValidObjectId(parentCommentId)) {
      return next(new AppError('Bình luận cha không hợp lệ', 400))
    }

    const video = await ShortVideo.findOne({ _id: id, isActive: true })
    if (!video) return next(new AppError('Không tìm thấy video', 404))

    if (parentCommentId) {
      const parentComment = await VideoComment.findOne({ _id: parentCommentId, videoId: id })
      if (!parentComment) return next(new AppError('Không tìm thấy bình luận cha', 404))
      if (parentComment.parentCommentId) {
        return next(new AppError('Chỉ hỗ trợ reply tối đa 1 cấp', 400))
      }
    }

    const comment = await VideoComment.create({
      userId: req.user._id,
      videoId: id,
      parentCommentId,
      content,
      imageUrl,
    })

    const commentsCount = await VideoComment.countDocuments({ videoId: id })
    video.commentsCount = commentsCount
    await video.save()

    const populatedComment = await VideoComment.findById(comment._id).populate('userId', userSelect)
    res.status(201).json({
      comment: {
        ...populatedComment.toObject(),
        isLiked: false,
        repliesCount: 0,
      },
      commentsCount,
    })
  } catch (err) {
    next(err)
  }
}

export const getShortComments = async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) return next(new AppError('Video không hợp lệ', 400))

    const { page, limit, skip } = normalizePagination(req.query)
    const filter = { videoId: id, parentCommentId: null }
    const total = await VideoComment.countDocuments(filter)
    const comments = await VideoComment.find(filter)
      .populate('userId', userSelect)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    res.json({
      comments: await withCommentViewerState(comments, req.user?._id),
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

export const getCommentReplies = async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) return next(new AppError('Bình luận không hợp lệ', 400))

    const parentComment = await VideoComment.findById(id)
    if (!parentComment) return next(new AppError('Không tìm thấy bình luận', 404))

    const { page, limit, skip } = normalizePagination(req.query)
    const filter = { parentCommentId: id }
    const total = await VideoComment.countDocuments(filter)
    const replies = await VideoComment.find(filter)
      .populate('userId', userSelect)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)

    res.json({
      comments: await withCommentViewerState(replies, req.user?._id),
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

export const toggleCommentLike = async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) return next(new AppError('Bình luận không hợp lệ', 400))

    const comment = await VideoComment.findById(id)
    if (!comment) return next(new AppError('Không tìm thấy bình luận', 404))

    const existingLike = await CommentLike.findOne({ userId: req.user._id, commentId: id })
    const liked = !existingLike

    if (existingLike) {
      await existingLike.deleteOne()
    } else {
      await CommentLike.create({ userId: req.user._id, commentId: id })
    }

    const likesCount = await CommentLike.countDocuments({ commentId: id })
    comment.likesCount = likesCount
    await comment.save()

    res.json({ liked, likesCount })
  } catch (err) {
    if (err.code === 11000) {
      const likesCount = await CommentLike.countDocuments({ commentId: req.params.id })
      return res.json({ liked: true, likesCount })
    }
    next(err)
  }
}

export const updateShortStatus = async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) return next(new AppError('Video không hợp lệ', 400))

    const video = await ShortVideo.findByIdAndUpdate(
      id,
      { isActive: Boolean(req.body.isActive) },
      { new: true },
    ).populate('userId', 'name avatar email role')

    if (!video) return next(new AppError('Không tìm thấy video', 404))
    res.json({ message: video.isActive ? 'Đã mở video' : 'Đã khóa video', video })
  } catch (err) {
    next(err)
  }
}

export const deleteShortVideo = async (req, res, next) => {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) return next(new AppError('Video không hợp lệ', 400))

    const video = await ShortVideo.findById(id)
    if (!video) return next(new AppError('Không tìm thấy video', 404))

    assertVideoAccess(video, req.user)

    await Promise.all([
      VideoLike.deleteMany({ videoId: id }),
      CommentLike.deleteMany({
        commentId: { $in: await VideoComment.find({ videoId: id }).distinct('_id') },
      }),
      VideoComment.deleteMany({ videoId: id }),
      video.deleteOne(),
    ])

    res.json({ message: 'Đã xóa video' })
  } catch (err) {
    next(err)
  }
}
