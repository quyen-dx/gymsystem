export interface ShortUser {
  _id: string
  name: string
  avatar?: string
  email?: string
  role?: string
}

export interface ShortVideo {
  _id: string
  userId: ShortUser
  type: 'upload' | 'youtube'
  caption: string
  videoUrl: string
  youtubeUrl?: string
  thumbnail: string
  likesCount: number
  commentsCount: number
  viewsCount: number
  tags: string[]
  isActive: boolean
  isLiked?: boolean
  createdAt: string
}

export interface ShortComment {
  _id: string
  userId: ShortUser
  videoId: string
  parentCommentId?: string | null
  content: string
  imageUrl?: string
  likesCount: number
  repliesCount: number
  isLiked?: boolean
  createdAt: string
}

export interface ShortsFeedResponse {
  videos: ShortVideo[]
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore: boolean
}

export interface ChannelStats {
  totalVideos: number
  totalLikes: number
  totalViews: number
  totalComments: number
  followersCount: number
}

export interface ChannelProfileResponse {
  profile: ShortUser & {
    bio?: string
    createdAt?: string
  }
  stats: ChannelStats
  canManage: boolean
}

export interface ShortsCommentsResponse {
  comments: ShortComment[]
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore: boolean
}
