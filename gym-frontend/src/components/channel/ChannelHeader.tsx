import { ShareAltOutlined } from '@ant-design/icons'
import { Avatar, Button, Statistic } from 'antd'
import type { ChannelProfileResponse } from '../../types/shorts'

const formatCount = (value: number) =>
  new Intl.NumberFormat('vi-VN', { notation: value >= 10000 ? 'compact' : 'standard' }).format(value || 0)

export default function ChannelHeader({
  channel,
  onShare,
}: {
  channel: ChannelProfileResponse
  onShare: () => void
}) {
  const { profile, stats } = channel

  return (
    <section className="overflow-hidden rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(229,57,53,0.16),rgba(255,255,255,0.03))] shadow-[var(--gs-shadow)]">
      <div className="h-32 bg-[radial-gradient(circle_at_20%_20%,rgba(229,57,53,0.42),transparent_32%),linear-gradient(135deg,#111827,#2b1414_55%,#050505)] max-[640px]:h-24" />
      <div className="-mt-12 px-7 pb-7 max-[640px]:px-4 max-[640px]:pb-5">
        <div className="flex items-end gap-5 max-[640px]:items-center">
          <Avatar
            size={112}
            src={profile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || 'GS')}`}
            className="!border-4 !border-[var(--gs-bg-elevated)] shadow-2xl max-[640px]:!h-20 max-[640px]:!w-20"
          />
          <div className="min-w-0 flex-1 pb-2">
            <h1 className="m-0 truncate text-3xl font-black text-[var(--gs-text)] max-[640px]:text-xl">
              {profile.name || 'GymSystem Channel'}
            </h1>
            <p className="m-0 mt-1 truncate text-sm text-[var(--gs-text-muted)]">
              @{profile.email?.split('@')[0] || profile._id.slice(-8)}
            </p>
          </div>
        </div>

        <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--gs-text-muted)]">
          {profile.bio || 'Kênh Shorts cá nhân trên GymSystem.'}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Statistic title="Video" value={stats.totalVideos} valueStyle={{ color: 'var(--gs-text)', fontWeight: 800 }} />
          <Statistic title="Followers" value={formatCount(stats.followersCount)} valueStyle={{ color: 'var(--gs-text)', fontWeight: 800 }} />
          <Statistic title="Likes" value={formatCount(stats.totalLikes)} valueStyle={{ color: 'var(--gs-text)', fontWeight: 800 }} />
          <Statistic title="Views" value={formatCount(stats.totalViews)} valueStyle={{ color: 'var(--gs-text)', fontWeight: 800 }} />
          <Statistic title="Comments" value={formatCount(stats.totalComments)} valueStyle={{ color: 'var(--gs-text)', fontWeight: 800 }} />
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button icon={<ShareAltOutlined />} onClick={onShare}>
            Share profile
          </Button>
        </div>
      </div>
    </section>
  )
}
