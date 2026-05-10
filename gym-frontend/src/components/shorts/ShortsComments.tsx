import { CloseOutlined } from '@ant-design/icons'
import { Button, Empty, Skeleton } from 'antd'
import type { InputRef } from 'antd/es/input'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addShortComment, getShortComments } from '../../services/shortService'
import type { ShortComment, ShortVideo } from '../../types/shorts'
import CommentInput from './CommentInput'
import CommentItem from './CommentItem'
import './ShortsComments.css'

const COMMENT_LIMIT = 30

interface ShortsCommentsProps {
  open: boolean
  video: ShortVideo | null
  dark: boolean
  onClose: () => void
  onCommentsCountChange: (videoId: string, commentsCount: number) => void
}

export default function ShortsComments({
  open,
  video,
  dark,
  onClose,
  onCommentsCountChange,
}: ShortsCommentsProps) {
  const [comments, setComments] = useState<ShortComment[]>([])
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [replyingTo, setReplyingTo] = useState<ShortComment | null>(null)
  const inputRef = useRef<InputRef>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const visibleComments = useMemo(() => comments.slice(0, 120), [comments])

  useEffect(() => {
    if (!open || !video) return

    setLoading(true)
    setReplyingTo(null)
    setText('')
    setImageFile(null)
    setImagePreview('')
    getShortComments(video._id, { page: 1, limit: COMMENT_LIMIT })
      .then(({ data }) => setComments(data.comments))
      .finally(() => setLoading(false))

    window.setTimeout(() => inputRef.current?.focus(), 180)
  }, [open, video])

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  const submitComment = useCallback(async () => {
    if (!video || (!text.trim() && !imageFile)) return

    setSubmitting(true)
    try {
      const { data } = await addShortComment(video._id, text.trim(), replyingTo?._id || null, imageFile)
      setComments((current) => {
        if (!replyingTo) return [data.comment, ...current]
        return current.map((comment) =>
          comment._id === replyingTo._id
            ? { ...comment, repliesCount: comment.repliesCount + 1 }
            : comment,
        )
      })
      setText('')
      setImageFile(null)
      if (imagePreview) URL.revokeObjectURL(imagePreview)
      setImagePreview('')
      setReplyingTo(null)
      onCommentsCountChange(video._id, data.commentsCount)
    } finally {
      setSubmitting(false)
    }
  }, [imageFile, imagePreview, onCommentsCountChange, replyingTo, text, video])

  const handleReplyCreated = useCallback((_parentId: string, _reply: ShortComment, commentsCount: number) => {
    if (!video) return
    onCommentsCountChange(video._id, commentsCount)
  }, [onCommentsCountChange, video])

  const startReply = useCallback((comment: ShortComment) => {
    setReplyingTo(comment)
    window.setTimeout(() => inputRef.current?.focus(), 30)
  }, [])

  const chooseImage = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) return

    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setImagePreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (!open || !video) return null

  return (
    <div className="shorts-comments-backdrop" onClick={onClose}>
      <section
        className={`shorts-comments-panel ${dark ? 'is-dark' : 'is-light'}`}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
      >
        <header className="shorts-comments-header">
          <div className="shorts-comments-title">
            Bình luận ({video.commentsCount.toLocaleString('vi-VN')})
          </div>
          <Button shape="circle" type="text" icon={<CloseOutlined />} onClick={onClose} />
        </header>

        <div className="shorts-comments-list">
          {loading ? (
            <>
              <Skeleton active avatar paragraph={{ rows: 2 }} />
              <Skeleton active avatar paragraph={{ rows: 2 }} />
              <Skeleton active avatar paragraph={{ rows: 2 }} />
            </>
          ) : visibleComments.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<span style={{ color: 'rgba(255,255,255,0.72)' }}>Chưa có bình luận</span>}
            />
          ) : visibleComments.map((comment) => (
            <CommentItem
              key={comment._id}
              comment={comment}
              videoId={video._id}
              activeReplyId={replyingTo?._id || null}
              onStartReply={startReply}
              onReplyCreated={handleReplyCreated}
            />
          ))}
        </div>

        <footer className="shorts-comments-input">
          {replyingTo && (
            <div className="shorts-reply-target">
              <span>Đang trả lời {replyingTo.userId.name}</span>
              <button type="button" onClick={() => setReplyingTo(null)}>Hủy</button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => chooseImage(event.target.files?.[0])}
          />
          <CommentInput
            dark={dark}
            text={text}
            inputRef={inputRef}
            imagePreview={imagePreview}
            submitting={submitting}
            placeholder={replyingTo ? `Trả lời ${replyingTo.userId.name}...` : 'Thêm bình luận...'}
            onTextChange={setText}
            onSubmit={() => void submitComment()}
            onChooseImage={() => fileInputRef.current?.click()}
            onClearImage={clearImage}
          />
        </footer>
      </section>
    </div>
  )
}
