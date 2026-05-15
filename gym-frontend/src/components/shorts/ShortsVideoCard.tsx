import {
  CommentOutlined,
  HeartFilled,
  HeartOutlined,
  ShareAltOutlined,
} from '@ant-design/icons'
import { Avatar, Button } from 'antd'
import { memo, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useDoubleTap from '../../hooks/useDoubleTap'
import { getChannelProfile } from '../../services/shortService'
import type { ShortVideo } from '../../types/shorts'
import HeartAnimationLayer, { type FloatingHeart } from './HeartAnimationLayer'
import VolumeControl from './VolumeControl'

const mediaClass = 'shorts-video-player absolute inset-0 z-[1] h-full w-full border-0 bg-[#101010] object-contain object-center'
const actionClass = 'grid justify-items-center gap-1.5 text-xs font-bold text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.55)]'
const iconButtonClass = '!h-12 !w-12 !border-white/20 !bg-[rgba(15,15,15,0.42)] !text-white !backdrop-blur-xl !transition hover:!-translate-y-0.5 hover:!scale-105 hover:!border-white/35 hover:!bg-[rgba(28,28,28,0.62)] max-[640px]:!h-11 max-[640px]:!w-11'

const formatCount = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(value)
}

interface ShortsVideoCardProps {
  video: ShortVideo
  isActive: boolean
  shouldRenderVideo: boolean
  volume: number
  youtubeEmbedUrl: string
  setVideoRef: (videoId: string, element: HTMLVideoElement | null) => void
  applyVolumeToVideo: (video: HTMLVideoElement | null, volume: number) => void
  onVolumeChange: (volume: number) => void
  onToggleLike: (video: ShortVideo) => void
  onLikeOnly: (video: ShortVideo) => void
  onOpenComments: (video: ShortVideo) => void
  onShare: (video: ShortVideo) => void
}

function ShortsVideoCard({
  video,
  isActive,
  shouldRenderVideo,
  volume,
  youtubeEmbedUrl,
  setVideoRef,
  applyVolumeToVideo,
  onVolumeChange,
  onToggleLike,
  onLikeOnly,
  onOpenComments,
  onShare,
}: ShortsVideoCardProps) {
  const navigate = useNavigate()
  const [hearts, setHearts] = useState<FloatingHeart[]>([])

  const addHeart = useCallback((point: { x: number; y: number }) => {
    const driftX = Math.round((Math.random() - 0.5) * 70)
    const driftY = Math.round((Math.random() - 0.5) * 42)
    setHearts((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        x: point.x + Math.round((Math.random() - 0.5) * 34),
        y: point.y + driftY,
        rotate: Math.round((Math.random() - 0.5) * 34),
        driftX,
        scale: 0.92 + Math.random() * 0.28,
      },
    ])
  }, [])

  const removeHeart = useCallback((id: string) => {
    setHearts((current) => current.filter((heart) => heart.id !== id))
  }, [])

  const handleDoubleTap = useCallback((point: { x: number; y: number }) => {
    addHeart(point)
    onLikeOnly(video)
  }, [addHeart, onLikeOnly, video])

  const doubleTapHandlers = useDoubleTap({ onDoubleTap: handleDoubleTap })
  const channelUserId = video.userId?._id

  const openChannel = useCallback(() => {
    if (!channelUserId) return
    navigate(`/channel/${channelUserId}`)
  }, [channelUserId, navigate])

  const prefetchChannel = useCallback(() => {
    if (!channelUserId || window.matchMedia('(hover: none)').matches) return
    getChannelProfile(channelUserId).catch(() => undefined)
  }, [channelUserId])

  return (
    <div
      className="relative h-full w-[min(100%,520px)] touch-pan-y overflow-hidden bg-[#101010] max-[640px]:w-full"
      {...doubleTapHandlers}
    >
      {video.type === 'youtube' && shouldRenderVideo ? (
        <iframe
          className={mediaClass}
          src={youtubeEmbedUrl}
          title={video.caption || 'Youtube Short'}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : video.type === 'upload' && shouldRenderVideo ? (
        <video
          ref={(element) => {
            setVideoRef(video._id, element)
            applyVolumeToVideo(element, volume)
          }}
          className={mediaClass}
          src={video.videoUrl}
          poster={video.thumbnail}
          autoPlay
          playsInline
          muted={volume === 0}
          controls={false}
          loop
          preload="metadata"
        />
      ) : video.thumbnail ? (
        <img className={`${mediaClass} brightness-[0.78]`} src={video.thumbnail} alt={video.caption || 'Short video'} />
      ) : (
        <div className={`${mediaClass} brightness-[0.78]`} />
      )}

      <div className="shorts-video-overlay pointer-events-none absolute inset-0 z-[2] bg-[linear-gradient(180deg,rgba(0,0,0,0.26),transparent_22%,transparent_50%,rgba(0,0,0,0.88)),linear-gradient(90deg,transparent_54%,rgba(0,0,0,0.32))]" />
      <HeartAnimationLayer hearts={hearts} onHeartDone={removeHeart} />
      {isActive && <VolumeControl onVolumeChange={onVolumeChange} />}

      <div className="absolute bottom-28 right-3.5 z-[3] grid gap-4 max-[640px]:bottom-[98px] max-[640px]:right-2.5 max-[640px]:gap-3.5" onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()}>
        <div className={actionClass}>
          <Button
            shape="circle"
            className={iconButtonClass}
            icon={video.isLiked
              ? <HeartFilled className="!text-[#ff2d55]" style={{ color: '#ff2d55' }} />
              : <HeartOutlined />}
            onClick={() => onToggleLike(video)}
          />
          <span>{formatCount(video.likesCount)}</span>
        </div>
        <div className={actionClass}>
          <Button
            shape="circle"
            className={iconButtonClass}
            icon={<CommentOutlined />}
            onClick={() => onOpenComments(video)}
          />
          <span>{formatCount(video.commentsCount)}</span>
        </div>
        <div className={actionClass}>
          <Button
            shape="circle"
            className={iconButtonClass}
            icon={<ShareAltOutlined />}
            onClick={() => onShare(video)}
          />
          <span>{formatCount(video.viewsCount)}</span>
        </div>
      </div>

      <div className="absolute bottom-7 left-[18px] right-[86px] z-[3] grid gap-2.5 max-[640px]:bottom-[22px] max-[640px]:left-3.5 max-[640px]:right-[72px]">
        <div
          className="flex min-w-0 items-center gap-2.5"
          onMouseEnter={prefetchChannel}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            openChannel()
          }}
        >
          <button
            className="group/avatar grid rounded-full outline-none transition-transform duration-200 hover:scale-105 focus-visible:ring-2 focus-visible:ring-white/80"
            type="button"
            aria-label={`Mở kênh ${video.userId?.name || 'GymPro'}`}
          >
            <Avatar
              size={42}
              src={video.userId?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(video.userId?.name || 'GP')}`}
              className="cursor-pointer ring-2 ring-white/20 transition group-hover/avatar:ring-white/60"
            />
          </button>
          <button
            className="min-w-0 cursor-pointer truncate border-0 bg-transparent p-0 text-left font-extrabold text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.6)] transition hover:underline hover:decoration-white/70 hover:underline-offset-4"
            type="button"
          >
            @{video.userId?.name || 'GymPro'}
          </button>
        </div>
        {video.caption && <div className="whitespace-pre-wrap break-words text-[15px] leading-[1.4] text-white/95 [text-shadow:0_2px_12px_rgba(0,0,0,0.65)] max-[640px]:text-sm">{video.caption}</div>}
        {video.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {video.tags.map((tag) => <span className="text-[13px] font-bold text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.6)]" key={tag}>#{tag}</span>)}
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(ShortsVideoCard)
