import { useNavigate } from 'react-router-dom'
import { ArrowRightOutlined } from '@ant-design/icons'
import type { SummaryModule } from '../../types/report'
import { MODULE_ICONS } from './moduleIcons'

export default function ModuleCard({ module }: { module: SummaryModule }) {
  const navigate = useNavigate()
  const Icon = MODULE_ICONS[module.icon] || MODULE_ICONS.finance

  return (
    <div
      onClick={() => navigate(module.route)}
      className="group flex cursor-pointer flex-col rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--gs-border-strong)] hover:shadow-md"
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `${module.color}14`, color: module.color }}>
          <Icon style={{ fontSize: 18 }} />
        </span>
        <span className="text-lg font-semibold leading-tight text-[var(--gs-text)]">{module.label}</span>
      </div>

      <div className="mt-5 text-[34px] font-bold leading-none tracking-tight" style={{ color: module.color }}>
        {module.displayValue}
      </div>
      <div className="mt-2 text-sm text-[var(--gs-text-muted)]">{module.hint}</div>

      <div className="mt-auto flex items-center gap-1.5 pt-5 text-sm font-medium text-[var(--gs-text-soft)] transition-colors group-hover:text-[var(--theme-accent)]">
        Xem dashboard
        <ArrowRightOutlined className="text-xs transition-transform duration-200 group-hover:translate-x-0.5" />
      </div>
    </div>
  )
}
