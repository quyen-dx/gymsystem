import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons'
import type { ReportKpi } from '../../types/report'
import KpiIcon from './KpiIcon'
import Sparkline from './charts/Sparkline'

interface KpiCardProps {
  kpi: ReportKpi
  onClick?: () => void
}

function formatKpiValue(kpi: ReportKpi) {
  const v = Number(kpi.value || 0)
  if (kpi.format === 'money') return `${v.toLocaleString('vi-VN')}đ`
  if (kpi.format === 'percent') return `${v}%`
  if (kpi.format === 'rating') return `${v}/5`
  return v.toLocaleString('vi-VN')
}

const KPI_COLORS: Record<string, string> = {
  totalRevenue: '#16a34a',
  transactions: '#3b82f6',
  refunds: '#ef4444',
  avgPerDay: '#f59e0b',
}

export default function KpiCard({ kpi, onClick }: KpiCardProps) {
  const showDelta = kpi.delta !== null && kpi.delta !== undefined
  const positive = (kpi.delta ?? 0) >= 0
  const color = KPI_COLORS[kpi.key] || 'var(--theme-accent)'

  return (
    <div
      onClick={onClick}
      className={`flex flex-col gap-3 rounded-2xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-4 transition-all duration-200 ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[var(--gs-text-soft)]">
          <span className="text-lg" style={{ color }}><KpiIcon name={kpi.icon} /></span>
          <span className="text-xs font-medium uppercase tracking-wide">{kpi.label}</span>
        </div>
        {showDelta && (
          <div className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${positive ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-500'}`}>
            {positive ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            {positive ? '+' : ''}
            {kpi.delta}%
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-[var(--gs-text)]">{formatKpiValue(kpi)}</div>
      <div className="h-10">
        <Sparkline data={kpi.sparkline} color={color} />
      </div>
    </div>
  )
}
