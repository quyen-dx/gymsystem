import type { ReactNode } from 'react'

interface ChartCardProps {
  title: string
  children: ReactNode
  action?: ReactNode
  className?: string
}

export default function ChartCard({ title, children, action, className = '' }: ChartCardProps) {
  return (
    <div className={`rounded-2xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="m-0 text-sm font-semibold text-[var(--gs-text)]">{title}</h4>
        {action}
      </div>
      {children}
    </div>
  )
}
