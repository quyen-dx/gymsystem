import { Button, Skeleton, Empty } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'

export function ReportSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-4">
            <Skeleton active paragraph={{ rows: 2 }} title={false} />
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-4">
            <Skeleton active paragraph={{ rows: 6 }} title={{ width: '40%' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ReportEmpty({ description = 'Không có dữ liệu trong khoảng thời gian này' }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--gs-border)] bg-[var(--gs-card)] p-8">
      <Empty description={description} />
    </div>
  )
}

export function ReportError({ message = 'Không thể tải dữ liệu', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-2xl border border-red-500/20 bg-[var(--gs-card)] p-8 text-center">
      <div className="text-4xl">⚠️</div>
      <div className="text-sm font-medium text-[var(--gs-text)]">{message}</div>
      {onRetry && (
        <Button icon={<ReloadOutlined />} onClick={onRetry}>
          Thử lại
        </Button>
      )}
    </div>
  )
}
