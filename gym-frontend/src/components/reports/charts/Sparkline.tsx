import { Area, AreaChart, ResponsiveContainer } from 'recharts'

interface SparklineProps {
  data: number[]
  color?: string
  height?: number
}

export default function Sparkline({ data, color = 'var(--theme-accent)', height = 40 }: SparklineProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[40px] items-end gap-[2px]" aria-hidden>
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="w-[3px] rounded-t bg-[var(--gs-border)]" style={{ height: `${4 + ((i * 7) % 9) * 3}px` }} />
        ))}
      </div>
    )
  }
  const chartData = data.map((v, i) => ({ i, v }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.8} fill="url(#spark)" isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
