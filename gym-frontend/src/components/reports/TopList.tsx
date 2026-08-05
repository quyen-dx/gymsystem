import { TrophyOutlined } from '@ant-design/icons'
import type { TopItem, TopListData } from '../../types/report'

interface TopListProps {
  data: TopListData
  onItemClick?: (item: TopItem) => void
  accent?: string
}

export default function TopList({ data, onItemClick, accent = '#3b82f6' }: TopListProps) {
  if (!data?.items?.length) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-[var(--gs-text-muted)]">
        Không có dữ liệu
      </div>
    )
  }
  const max = Math.max(...data.items.map((i) => Number(i.value) || 0), 1)
  const rankColor = (i: number) => (i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : 'var(--gs-text-soft)')

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <TrophyOutlined style={{ color: accent }} />
        <h4 className="m-0 text-sm font-semibold text-[var(--gs-text)]">{data.title}</h4>
      </div>
      <div className="space-y-2">
        {data.items.map((item, i) => (
          <div
            key={`${item.id || item.label}-${i}`}
            onClick={onItemClick ? () => onItemClick(item) : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-colors ${onItemClick ? 'cursor-pointer hover:bg-[var(--gs-elevated)]' : ''}`}
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--gs-elevated)] text-xs font-bold" style={{ color: rankColor(i) }}>
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-[var(--gs-text)]">{item.label}</div>
              {item.sub && <div className="truncate text-xs text-[var(--gs-text-soft)]">{item.sub}</div>}
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-bold" style={{ color: item.color || accent }}>
                {Number(item.value) >= 1000 && item.value === Math.round(item.value)
                  ? `${Number(item.value).toLocaleString('vi-VN')}`
                  : Number(item.value) >= 1000
                    ? `${Number(item.value).toLocaleString('vi-VN')}`
                    : Number(item.value) % 1 !== 0
                      ? Number(item.value).toFixed(1)
                      : Number(item.value).toLocaleString('vi-VN')}
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--gs-border)]">
                <div className="h-full rounded-full" style={{ width: `${(Number(item.value) / max) * 100}%`, background: item.color || accent }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
