import { UploadOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { Empty, Form, Input, message, Modal, Progress, Skeleton, Tabs, Upload } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Swiper as SwiperType } from 'swiper'
import { Mousewheel } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/react'
import ShortsComments from '../../../components/shorts/ShortsComments'
import ShortsVideoCard from '../../../components/shorts/ShortsVideoCard'
import { readStoredShortsVolume } from '../../../components/shorts/VolumeControl'
import { useTheme } from '../../../context/ThemeProvider'
import {
  getShortFeed,
  likeShort,
  uploadShort,
  uploadShortByUrl,
  viewShort,
} from '../../../services/shortService'
import type { ShortVideo } from '../../../types/shorts'

const PAGE_SIZE = 10
const MAX_FILE_SIZE = 300 * 1024 * 1024
const MAX_DURATION_SECONDS = 300
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

const isValidHttpUrl = (value: string) => {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}

const extractYoutubeId = (value: string) => {
  try {
    const url = new URL(value)
    const host = url.hostname.replace(/^www\./, '').toLowerCase()
    if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || ''
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

const getYoutubeEmbedUrl = (value: string, autoplay: boolean, volume: number) => {
  const youtubeId = extractYoutubeId(value)
  if (!youtubeId) return ''
  const params = new URLSearchParams({
    autoplay: autoplay ? '1' : '0',
    mute: volume > 0 ? '0' : '1',
    playsinline: '1',
    loop: '1',
    playlist: youtubeId,
    controls: '0',
    rel: '0',
    modestbranding: '1',
  })
  return `https://www.youtube.com/embed/${youtubeId}?${params.toString()}`
}

const isDirectPreviewableVideo = (value: string) =>
  isValidHttpUrl(value) && /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(value)

const validateVideoFile = (file: File) =>
  new Promise<void>((resolve, reject) => {
    if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
      reject(new Error('Chỉ chấp nhận mp4, webm hoặc mov'))
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      reject(new Error('Video tối đa 300MB'))
      return
    }

    const video = document.createElement('video')
    const objectUrl = URL.createObjectURL(file)
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl)
      if (video.duration > MAX_DURATION_SECONDS) {
        reject(new Error('Video local tối đa 5 phút'))
      } else {
        resolve()
      }
    }
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Không đọc được metadata video'))
    }
    video.src = objectUrl
  })

const shortsFrameClass = 'relative h-[calc(100dvh-112px)] min-h-[calc(100dvh-112px)] overflow-hidden rounded-[18px] bg-[#2e2e2e] text-white max-[640px]:h-[calc(100dvh-86px)] max-[640px]:min-h-[calc(100dvh-86px)] max-[640px]:rounded-none'
const loadingStateClass = 'relative grid h-[calc(100dvh-112px)] min-h-[calc(100dvh-112px)] place-items-center bg-[radial-gradient(circle_at_top,rgba(255,45,85,0.2),transparent_34%),#2e2e2e] p-6 text-white max-[640px]:h-[calc(100dvh-86px)] max-[640px]:min-h-[calc(100dvh-86px)]'
const panelClass = 'w-[min(420px,92vw)] rounded-3xl border border-white/10 bg-[rgba(20,20,20,0.82)] p-7 text-center backdrop-blur-xl'
const uploadPreviewClass = 'mt-3.5 aspect-[9/16] max-h-[420px] overflow-hidden rounded-[18px] border border-white/10 bg-[#2e2e2e]'
const uploadPreviewMediaClass = 'block h-full w-full border-0 object-cover'

export default function ShortsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { dark } = useTheme()
  const [videos, setVideos] = useState<ShortVideo[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [feedReady, setFeedReady] = useState(false)
  const [feedRenderKey, setFeedRenderKey] = useState('initial')
  const [loadingMore, setLoadingMore] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file')
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [filePreviewUrl, setFilePreviewUrl] = useState('')
  const [urlPreview, setUrlPreview] = useState('')
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [commentVideo, setCommentVideo] = useState<ShortVideo | null>(null)
  const [api, contextHolder] = message.useMessage()
  const [form] = Form.useForm()
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({})
  const volumeRef = useRef(readStoredShortsVolume())
  const viewedVideos = useRef(new Set<string>())
  const displayedVideoIdsRef = useRef(new Set<string>())
  const likeOnlyInFlightRef = useRef(new Set<string>())
  const feedRequestSeq = useRef(0)

  const applyVolumeToVideo = useCallback((video: HTMLVideoElement | null, volume: number) => {
    if (!video) return
    video.volume = volume / 100
    video.muted = volume === 0
  }, [])

  const applyVolumeToAllVideos = useCallback((volume: number) => {
    volumeRef.current = volume
    Object.values(videoRefs.current).forEach((video) => applyVolumeToVideo(video, volume))
  }, [applyVolumeToVideo])

  const setVideoRef = useCallback((videoId: string, element: HTMLVideoElement | null) => {
    videoRefs.current[videoId] = element
  }, [])

  const loadFeed = useCallback(async (targetPage: number, append = false) => {
    const requestId = ++feedRequestSeq.current
    if (append) {
      setLoadingMore(true)
    } else {
      console.debug('[Shorts feed] render gate: clear stale feed before random fetch')
      setFeedReady(false)
      setLoading(true)
      setActiveIndex(0)
      setVideos([])
      videoRefs.current = {}
      displayedVideoIdsRef.current = new Set()
    }

    try {
      const initialVideo = targetPage === 1 && !append ? searchParams.get('video') || undefined : undefined
      const excludedIds = append ? Array.from(displayedVideoIdsRef.current).join(',') : undefined
      const { data } = await getShortFeed({ page: targetPage, limit: PAGE_SIZE, video: initialVideo, excludedIds })
      if (requestId !== feedRequestSeq.current) {
        console.debug('[Shorts feed] ignored stale random response', { requestId })
        return
      }
      console.debug('[Shorts feed] loaded videos', data.videos.map((video) => ({
        id: video._id,
        thumbnail: video.thumbnail,
        videoUrl: video.videoUrl,
      })))
      const uniqueVideos = data.videos.filter((video) => {
        if (!append) return true
        return !displayedVideoIdsRef.current.has(video._id)
      })

      uniqueVideos.forEach((video) => displayedVideoIdsRef.current.add(video._id))

      setVideos((current) => append ? [...current, ...uniqueVideos] : uniqueVideos)
      if (!append) {
        setFeedRenderKey(uniqueVideos.map((video) => video._id).join(':') || `empty-${Date.now()}`)
        setFeedReady(true)
      }
      if (initialVideo && !append) {
        const nextIndex = uniqueVideos.findIndex((video) => video._id === initialVideo)
        if (nextIndex >= 0) setActiveIndex(nextIndex)
      }
      setPage(data.page)
      setHasMore(data.hasMore)
    } catch {
      if (requestId !== feedRequestSeq.current) return
      api.error('Không thể tải Shorts')
      if (!append) setFeedReady(true)
    } finally {
      if (requestId === feedRequestSeq.current) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [api, searchParams])

  useEffect(() => {
    void loadFeed(1)
  }, [loadFeed])

  useEffect(() => {
    if (searchParams.get('upload') === '1') {
      setUploadOpen(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    videos.forEach((video, index) => {
      const element = videoRefs.current[video._id]
      if (!element) return

      if (index === activeIndex) {
        applyVolumeToVideo(element, volumeRef.current)
        element.play().catch(() => {
          element.muted = true
          element.play().catch(() => undefined)
        })
      } else {
        element.pause()
        element.currentTime = 0
        applyVolumeToVideo(element, volumeRef.current)
      }
    })

    const activeVideo = videos[activeIndex]
    if (activeVideo) {
      console.debug('[Shorts feed] active video', {
        index: activeIndex,
        id: activeVideo._id,
        thumbnail: activeVideo.thumbnail,
        videoUrl: activeVideo.videoUrl,
      })
    }
    if (activeVideo && !viewedVideos.current.has(activeVideo._id)) {
      viewedVideos.current.add(activeVideo._id)
      viewShort(activeVideo._id)
        .then(({ data }) => {
          setVideos((current) => current.map((item) =>
            item._id === activeVideo._id ? { ...item, viewsCount: data.viewsCount } : item,
          ))
        })
        .catch(() => undefined)
    }

    const nextVideo = videos[activeIndex + 1]
    if (nextVideo?.videoUrl) {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'video'
      link.href = nextVideo.videoUrl
      document.head.appendChild(link)
      return () => link.remove()
    }

    return undefined
  }, [activeIndex, applyVolumeToVideo, videos])

  useEffect(() => {
    return () => {
      Object.values(videoRefs.current).forEach((video) => {
        if (!video) return
        video.pause()
        video.removeAttribute('src')
        video.load()
      })
      videoRefs.current = {}
    }
  }, [])

  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl)
    }
  }, [filePreviewUrl])

  const handleSlideChange = (swiper: SwiperType) => {
    const nextIndex = swiper.activeIndex
    setActiveIndex(nextIndex)
    if (hasMore && !loadingMore && nextIndex >= videos.length - 3) {
      void loadFeed(page + 1, true)
    }
  }

  const toggleLike = async (video: ShortVideo) => {
    const previous = video
    setVideos((current) => current.map((item) =>
      item._id === video._id
        ? {
          ...item,
          isLiked: !item.isLiked,
          likesCount: Math.max(0, item.likesCount + (item.isLiked ? -1 : 1)),
        }
        : item,
    ))

    try {
      const { data } = await likeShort(video._id)
      setVideos((current) => current.map((item) =>
        item._id === video._id
          ? { ...item, isLiked: data.liked, likesCount: data.likesCount }
          : item,
      ))
    } catch {
      setVideos((current) => current.map((item) => item._id === previous._id ? previous : item))
      api.error('Không thể cập nhật lượt thích')
    }
  }

  const likeVideoOnly = async (video: ShortVideo) => {
    if (video.isLiked) return
    if (likeOnlyInFlightRef.current.has(video._id)) return
    likeOnlyInFlightRef.current.add(video._id)

    const previous = video
    setVideos((current) => current.map((item) =>
      item._id === video._id
        ? { ...item, isLiked: true, likesCount: item.likesCount + 1 }
        : item,
    ))

    try {
      const { data } = await likeShort(video._id)
      setVideos((current) => current.map((item) =>
        item._id === video._id
          ? { ...item, isLiked: data.liked, likesCount: data.likesCount }
          : item,
      ))
    } catch {
      setVideos((current) => current.map((item) => item._id === previous._id ? previous : item))
      api.error('Không thể cập nhật lượt thích')
    } finally {
      likeOnlyInFlightRef.current.delete(video._id)
    }
  }

  const openComments = async (video: ShortVideo) => {
    setCommentVideo(video)
    setCommentsOpen(true)
  }

  const updateVideoCommentsCount = useCallback((videoId: string, commentsCount: number) => {
    setVideos((current) => current.map((item) =>
      item._id === videoId ? { ...item, commentsCount } : item,
    ))
    setCommentVideo((current) => current?._id === videoId ? { ...current, commentsCount } : current)
  }, [])

  const closeComments = () => {
    setCommentsOpen(false)
  }

  const handleShare = async (video: ShortVideo) => {
    const shareUrl = `${window.location.origin}/shorts?video=${video._id}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'GymSystem Shorts', text: video.caption, url: shareUrl })
      } else {
        await navigator.clipboard.writeText(shareUrl)
        api.success('Đã copy liên kết')
      }
    } catch {
      api.info('Đã hủy chia sẻ')
    }
  }

  const handleFileListChange = async (nextFileList: UploadFile[]) => {
    const nextFile = nextFileList.at(-1)
    if (!nextFile?.originFileObj) {
      setFileList([])
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl)
      setFilePreviewUrl('')
      return
    }

    try {
      await validateVideoFile(nextFile.originFileObj)
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl)
      setFileList([nextFile])
      setFilePreviewUrl(URL.createObjectURL(nextFile.originFileObj))
    } catch (error) {
      api.warning(error instanceof Error ? error.message : 'Video không hợp lệ')
      setFileList([])
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl)
      setFilePreviewUrl('')
    }
  }

  const validateUrlPreview = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setUrlPreview('')
      return
    }

    if (!isValidHttpUrl(trimmed)) {
      setUrlPreview('')
      api.warning('URL không hợp lệ')
      return
    }

    const youtubeId = extractYoutubeId(trimmed)
    const cloudinary = new URL(trimmed).hostname.toLowerCase().includes('cloudinary.com')
    if (!youtubeId && !cloudinary && !isDirectPreviewableVideo(trimmed)) {
      setUrlPreview('')
      api.warning('Chỉ hỗ trợ Cloudinary URL, Youtube URL hoặc mp4/webm/mov trực tiếp')
      return
    }

    setUrlPreview(trimmed)
  }

  const handleUpload = async () => {
    const values = await form.validateFields()
    const caption = values.caption || ''
    const tags = values.tags || ''

    setUploading(true)
    setUploadProgress(0)
    try {
      if (uploadMode === 'url') {
        const videoUrl = String(values.videoUrl || '').trim()
        if (!isValidHttpUrl(videoUrl)) {
          api.warning('URL video không hợp lệ')
          return
        }
        await uploadShortByUrl({ videoUrl, caption, tags })
      } else {
        const file = fileList[0]?.originFileObj
        if (!file) {
          api.warning('Vui lòng chọn video')
          return
        }

        await validateVideoFile(file)
        const payload = new FormData()
        payload.append('video', file)
        payload.append('caption', caption)
        payload.append('tags', tags)
        await uploadShort(payload, (event) => {
          if (!event.total) return
          setUploadProgress(Math.round((event.loaded * 100) / event.total))
        })
      }

      api.success('Đã upload Shorts')
      setUploadOpen(false)
      setFileList([])
      setUrlPreview('')
      setUploadProgress(0)
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl)
      setFilePreviewUrl('')
      form.resetFields()
      viewedVideos.current.clear()
      await loadFeed(1)
      setActiveIndex(0)
    } catch {
      api.error('Upload video thất bại')
    } finally {
      setUploading(false)
    }
  }

  if (loading || !feedReady) {
    console.debug('[Shorts feed] render loading gate', { loading, feedReady, videosCount: videos.length })
    return (
      <div className={loadingStateClass}>
        {contextHolder}
        <div className={panelClass}>
          <Skeleton active avatar paragraph={{ rows: 4 }} />
        </div>
      </div>
    )
  }

  if (!videos.length) {
    console.debug('[Shorts feed] render empty state after random fetch')
    return (
      <div className={loadingStateClass}>
        {contextHolder}
        <div className={panelClass}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<span style={{ color: '#edebe6' }}>Chưa có video Shorts nào</span>}
          />
        </div>
        <UploadModal
          form={form}
          open={uploadOpen}
          uploading={uploading}
          uploadProgress={uploadProgress}
          uploadMode={uploadMode}
          filePreviewUrl={filePreviewUrl}
          urlPreview={urlPreview}
          fileList={fileList}
          onModeChange={setUploadMode}
          onUrlPreviewChange={validateUrlPreview}
          onFileListChange={(files) => void handleFileListChange(files)}
          onCancel={() => setUploadOpen(false)}
          onUpload={handleUpload}
        />
      </div>
    )
  }

  return (
    <div className={shortsFrameClass}>
      {contextHolder}
      <div className="h-full w-full">
        <Swiper
          key={feedRenderKey}
          className="h-full w-full"
          direction="vertical"
          slidesPerView={1}
          mousewheel
          modules={[Mousewheel]}
          onSlideChange={handleSlideChange}
        >
          {videos.map((video, index) => {
            const shouldRenderVideo = Math.abs(index - activeIndex) <= 1
            return (
              <SwiperSlide className="grid place-items-center" style={{ backgroundColor: '#2e2e2e' }} key={video._id}>
                <ShortsVideoCard
                  video={video}
                  isActive={index === activeIndex}
                  shouldRenderVideo={shouldRenderVideo}
                  volume={volumeRef.current}
                  youtubeEmbedUrl={getYoutubeEmbedUrl(video.youtubeUrl || '', index === activeIndex, volumeRef.current)}
                  setVideoRef={setVideoRef}
                  applyVolumeToVideo={applyVolumeToVideo}
                  onVolumeChange={applyVolumeToAllVideos}
                  onToggleLike={(selectedVideo) => void toggleLike(selectedVideo)}
                  onLikeOnly={(selectedVideo) => void likeVideoOnly(selectedVideo)}
                  onOpenComments={(selectedVideo) => void openComments(selectedVideo)}
                  onShare={(selectedVideo) => void handleShare(selectedVideo)}
                />
              </SwiperSlide>
            )
          })}
          {loadingMore && (
            <SwiperSlide className="grid place-items-center" style={{ backgroundColor: '#2e2e2e' }}>
              <div className={panelClass}>
                <Skeleton active avatar paragraph={{ rows: 3 }} />
              </div>
            </SwiperSlide>
          )}
        </Swiper>
      </div>

      <ShortsComments
        open={commentsOpen}
        video={commentVideo}
        dark={dark}
        onClose={closeComments}
        onCommentsCountChange={updateVideoCommentsCount}
      />

      <UploadModal
        form={form}
        open={uploadOpen}
        uploading={uploading}
        uploadProgress={uploadProgress}
        uploadMode={uploadMode}
        filePreviewUrl={filePreviewUrl}
        urlPreview={urlPreview}
        fileList={fileList}
        onModeChange={setUploadMode}
        onUrlPreviewChange={validateUrlPreview}
        onFileListChange={(files) => void handleFileListChange(files)}
        onCancel={() => setUploadOpen(false)}
        onUpload={handleUpload}
      />
    </div>
  )
}

interface UploadModalProps {
  form: ReturnType<typeof Form.useForm>[0]
  open: boolean
  uploading: boolean
  uploadProgress: number
  uploadMode: 'file' | 'url'
  filePreviewUrl: string
  urlPreview: string
  fileList: UploadFile[]
  onModeChange: (mode: 'file' | 'url') => void
  onUrlPreviewChange: (value: string) => void
  onFileListChange: (files: UploadFile[]) => void
  onCancel: () => void
  onUpload: () => void
}

function UploadModal({
  form,
  open,
  uploading,
  uploadProgress,
  uploadMode,
  filePreviewUrl,
  urlPreview,
  fileList,
  onModeChange,
  onUrlPreviewChange,
  onFileListChange,
  onCancel,
  onUpload,
}: UploadModalProps) {
  const youtubePreviewUrl = getYoutubeEmbedUrl(urlPreview, false, 0)
  const directPreview = isDirectPreviewableVideo(urlPreview) || urlPreview.includes('cloudinary.com')

  return (
    <Modal
      title="Đăng Gym Short"
      open={open}
      onCancel={onCancel}
      onOk={onUpload}
      okText="Upload"
      cancelText="Hủy"
      confirmLoading={uploading}
      width={620}
    >
      <Form form={form} layout="vertical">
        <Tabs
          activeKey={uploadMode}
          onChange={(key) => onModeChange(key as 'file' | 'url')}
          items={[
            {
              key: 'file',
              label: 'Upload từ máy tính',
              children: (
                <div>
                  <Upload.Dragger
                    accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime"
                    maxCount={1}
                    fileList={fileList}
                    beforeUpload={() => false}
                    onChange={({ fileList: nextFileList }) => onFileListChange(nextFileList)}
                  >
                    <p className="ant-upload-drag-icon"><UploadOutlined /></p>
                    <p className="ant-upload-text">Kéo thả video hoặc bấm để chọn file</p>
                    <p className="ant-upload-hint">Mp4/WebM/MOV, tối đa 300MB và 5 phút. Khuyến nghị 720p để upload nhanh và hiển thị đẹp.</p>
                  </Upload.Dragger>
                  {filePreviewUrl && (
                    <div className={uploadPreviewClass}>
                      <video className={uploadPreviewMediaClass} src={filePreviewUrl} controls playsInline />
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'url',
              label: 'Dán video URL',
              children: (
                <div>
                  <Form.Item
                    name="videoUrl"
                    label="Video URL"
                    rules={[
                      {
                        validator: (_, value: string) => {
                          if (uploadMode !== 'url') return Promise.resolve()
                          if (!value?.trim()) return Promise.reject(new Error('Vui lòng nhập URL video'))
                          if (!isValidHttpUrl(value.trim())) return Promise.reject(new Error('URL không hợp lệ'))
                          return Promise.resolve()
                        },
                      },
                    ]}
                  >
                    <Input
                      placeholder="Cloudinary, Youtube hoặc https://.../video.mp4"
                      onBlur={(event) => onUrlPreviewChange(event.target.value)}
                      onPressEnter={(event) => onUrlPreviewChange(event.currentTarget.value)}
                    />
                  </Form.Item>
                  {urlPreview && (
                    <div className={uploadPreviewClass}>
                      {youtubePreviewUrl ? (
                        <iframe
                          className={uploadPreviewMediaClass}
                          src={youtubePreviewUrl}
                          title="Youtube preview"
                          allow="encrypted-media; picture-in-picture"
                          allowFullScreen
                        />
                      ) : directPreview ? (
                        <video className={uploadPreviewMediaClass} src={urlPreview} controls playsInline />
                      ) : (
                        <Skeleton active paragraph={{ rows: 2 }} />
                      )}
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />
        <Form.Item name="caption" label="Caption">
          <Input.TextArea rows={4} maxLength={2200} showCount placeholder="Chia sẻ buổi tập, PR, kỹ thuật..." />
        </Form.Item>
        <Form.Item name="tags" label="Tags">
          <Input placeholder="gym, cardio, pt, healthy" />
        </Form.Item>
        {uploading && uploadMode === 'file' && (
          <Progress percent={uploadProgress} status={uploadProgress >= 100 ? 'success' : 'active'} />
        )}
      </Form>
    </Modal>
  )
}
