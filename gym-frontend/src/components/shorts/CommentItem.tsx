import { HeartFilled, HeartOutlined } from '@ant-design/icons'
import { Avatar, Skeleton } from 'antd'
import { memo, useEffect, useState } from 'react'
import { getCommentReplies, likeShortComment } from '../../services/shortService'
import type { ShortComment } from '../../types/shorts'

const formatTime = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

interface CommentItemProps {
  comment: ShortComment
  videoId: string
  level?: 0 | 1
  activeReplyId: string | null
  onStartReply: (comment: ShortComment) => void
  onReplyCreated: (parentId: string, reply: ShortComment, commentsCount: number) => void
}

function CommentItem({
  comment,
  videoId,
  level = 0,
  activeReplyId,
  onStartReply,
  onReplyCreated,
}: CommentItemProps) {
  const [item, setItem] = useState(comment)
  const [expanded, setExpanded] = useState(false)
  const [replies, setReplies] = useState<ShortComment[]>([])
  const [repliesLoading, setRepliesLoading] = useState(false)

  useEffect(() => {
    setItem(comment)
  }, [comment])

  useEffect(() => {
    if (!comment.parentCommentId) {
      setItem((current) => ({ ...current, repliesCount: comment.repliesCount }))
    }
  }, [comment.parentCommentId, comment.repliesCount])

  const toggleLike = async () => {
    const previous = item
    setItem((current) => ({
      ...current,
      isLiked: !current.isLiked,
      likesCount: Math.max(0, current.likesCount + (current.isLiked ? -1 : 1)),
    }))

    try {
      const { data } = await likeShortComment(item._id)
      setItem((current) => ({ ...current, isLiked: data.liked, likesCount: data.likesCount }))
    } catch {
      setItem(previous)
    }
  }

  const loadReplies = async () => {
    if (expanded) {
      setExpanded(false)
      return
    }

    setExpanded(true)
    if (replies.length > 0 || item.repliesCount === 0) return

    setRepliesLoading(true)
    try {
      const { data } = await getCommentReplies(item._id, { page: 1, limit: 20 })
      setReplies(data.comments)
    } finally {
      setRepliesLoading(false)
    }
  }

  return (
    <div>
      <div className="shorts-comment-row">
        <Avatar
          size={36}
          src={item.userId.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.userId.name)}`}
        />
        <div className="shorts-comment-main">
          <div className="shorts-comment-name">{item.userId.name}</div>
          {item.content && <div className="shorts-comment-text">{item.content}</div>}
          {item.imageUrl && (
            <img className="shorts-comment-image" src={item.imageUrl} alt="Ảnh bình luận" loading="lazy" />
          )}
          <div className="shorts-comment-meta">
            <span>{formatTime(item.createdAt)}</span>
            {level === 0 && (
              <button className="shorts-comment-text-button" type="button" onClick={() => onStartReply(item)}>
                {activeReplyId === item._id ? 'Đang trả lời' : 'Trả lời'}
              </button>
            )}
            {level === 0 && item.repliesCount > 0 && (
              <button className="shorts-comment-text-button" type="button" onClick={() => void loadReplies()}>
                {expanded ? 'Ẩn replies' : `Xem ${item.repliesCount} replies`}
              </button>
            )}
          </div>

          {expanded && level === 0 && (
            <div className="shorts-replies">
              {repliesLoading ? (
                <Skeleton active avatar paragraph={{ rows: 1 }} />
              ) : replies.map((reply) => (
                <CommentItem
                  key={reply._id}
                  comment={reply}
                  videoId={videoId}
                  level={1}
                  activeReplyId={activeReplyId}
                  onStartReply={onStartReply}
                  onReplyCreated={onReplyCreated}
                />
              ))}
            </div>
          )}
        </div>
        <div className={`shorts-comment-like ${item.isLiked ? 'is-liked' : ''}`}>
          <button type="button" aria-label="Like comment" onClick={() => void toggleLike()}>
            {item.isLiked ? <HeartFilled /> : <HeartOutlined />}
          </button>
          <span>{item.likesCount}</span>
        </div>
      </div>
    </div>
  )
}

export default memo(CommentItem)
