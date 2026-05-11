import { DeleteOutlined, EditOutlined, EyeOutlined, HeartFilled, LockOutlined, MoreOutlined, UnlockOutlined } from '@ant-design/icons'
import { Dropdown, Empty, Skeleton } from 'antd'
import type { MenuProps } from 'antd'
import type { ShortVideo } from '../../types/shorts'

const formatCount = (value: number) =>
  new Intl.NumberFormat('vi-VN', { notation: value >= 10000 ? 'compact' : 'standard' }).format(value || 0)

export default function ChannelVideoGrid({
  videos,
  loading,
  canManage,
  onOpenVideo,
  onEditVideo,
  onDeleteVideo,
  onToggleVisibility,
}: {
  videos: ShortVideo[]
  loading: boolean
  canManage: boolean
  onOpenVideo: (video: ShortVideo) => void
  onEditVideo: (video: ShortVideo) => void
  onDeleteVideo: (video: ShortVideo) => void
  onToggleVisibility: (video: ShortVideo) => void
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <Skeleton.Node active key={index} className="!h-[260px] !w-full !rounded-2xl" />
        ))}
      </div>
    )
  }

  if (!videos.length) {
    return (
      <div className="rounded-3xl border border-[var(--gs-border)] bg-[var(--gs-bg-elevated)] p-10">
        <Empty description={<span className="text-[var(--gs-text-muted)]">Chưa có video Shorts nào</span>} />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {videos.map((video) => {
        const items: MenuProps['items'] = [
          { key: 'edit', icon: <EditOutlined />, label: 'Sửa video', onClick: () => onEditVideo(video) },
          {
            key: 'visibility',
            icon: video.isActive ? <LockOutlined /> : <UnlockOutlined />,
            label: video.isActive ? 'Chuyển riêng tư' : 'Công khai',
            onClick: () => onToggleVisibility(video),
          },
          { type: 'divider' },
          { key: 'delete', danger: true, icon: <DeleteOutlined />, label: 'Xóa video', onClick: () => onDeleteVideo(video) },
        ]

        return (
          <article
            className="group relative aspect-[9/16] overflow-hidden rounded-2xl border border-[var(--gs-border)] bg-[#2e2e2e] shadow-[var(--gs-shadow)]"
            key={video._id}
          >
            <button className="h-full w-full text-left" type="button" onClick={() => onOpenVideo(video)}>
              {video.thumbnail ? (
                <img className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" src={video.thumbnail} alt={video.caption || 'Short'} loading="lazy" />
              ) : (
                <div className="grid h-full place-items-center bg-zinc-900 text-sm text-white/60">Short</div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-80" />
              <div className="absolute bottom-3 left-3 right-3">
                <p className="line-clamp-2 text-sm font-semibold text-white">{video.caption || 'Không có caption'}</p>
                <div className="mt-2 flex items-center gap-3 text-xs font-bold text-white/90">
                  <span><EyeOutlined /> {formatCount(video.viewsCount)}</span>
                  <span><HeartFilled className="text-[#e53935]" /> {formatCount(video.likesCount)}</span>
                </div>
              </div>
              {!video.isActive && (
                <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2 py-1 text-[11px] font-bold text-white backdrop-blur">
                  Riêng tư
                </span>
              )}
            </button>

            {canManage && (
              <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
                <button
                  className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/80 group-hover:opacity-100 max-[768px]:opacity-100"
                  type="button"
                  onClick={(event) => event.stopPropagation()}
                >
                  <MoreOutlined />
                </button>
              </Dropdown>
            )}
          </article>
        )
      })}
    </div>
  )
}
