import { Card, Empty } from 'antd'

export default function FeatureDisabled() {
  return (
    <div className="flex min-h-[420px] items-center justify-center p-6">
      <Card className="w-full max-w-xl border border-[var(--theme-border)] bg-[var(--theme-card)] text-center">
        <Empty description={<span className="text-[var(--theme-text)]">Tính năng này hiện đang tạm khóa</span>} />
      </Card>
    </div>
  )
}
