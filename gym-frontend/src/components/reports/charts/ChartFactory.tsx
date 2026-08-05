import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ChartType, ReportChart } from '../../../types/report'

const PALETTE = ['#3b82f6', '#16a34a', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#64748b', '#f97316', '#14b8a6']

const tooltipStyle = {
  background: 'var(--gs-elevated)',
  border: '1px solid var(--gs-border)',
  borderRadius: 12,
  color: 'var(--gs-text)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
  fontSize: 12,
}

const axisProps = {
  tick: { fill: 'var(--gs-text-soft)', fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: 'var(--gs-border)' },
}

interface ChartPoint {
  index: number
  label: string | number
  value: number
  key?: string | number
}

interface ChartFactoryProps {
  type: ChartType
  labels: string[]
  series: ReportChart['series']
  pointKeys?: (string | number)[]
  height?: number
  onPointClick?: (point: ChartPoint) => void
}

function formatValue(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}tr`
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`
  return String(Math.round(v))
}

export default function ChartFactory({ type, labels, series, pointKeys, height = 260, onPointClick }: ChartFactoryProps) {
  if (!series.length || series.every((s) => s.data.length === 0)) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-[var(--gs-text-muted)]">
        Không có dữ liệu
      </div>
    )
  }

  const data = labels.map((label, i) => {
    const row: Record<string, string | number> = { name: label }
    series.forEach((s) => {
      row[s.name] = s.data[i] || 0
    })
    return row
  })

  const formatPointLabel = (label: string, pk?: string | number) => {
    if (typeof pk === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(pk)) {
      return new Date(`${pk}T00:00:00`).toLocaleDateString('vi-VN')
    }
    if (typeof pk === 'string' && /^\d{4}-\d{2}$/.test(pk)) {
      const [y, m] = pk.split('-').map(Number)
      return `Tháng ${m}/${y}`
    }
    return String(label)
  }

  // Dùng chính nhãn của điểm được click (không dùng first/last/series[0]) để tìm
  // đúng vị trí trong labels & pointKeys → luôn lấy đúng ngày/timestamp của điểm đó.
  const firePoint = (row: any) => {
    if (!onPointClick || !row) return
    const label = row?.name ?? row?.activeLabel
    if (label === undefined || label === null) return
    const idx = labels.indexOf(String(label))
    if (idx < 0) return
    const pk = pointKeys?.[idx]
    onPointClick({
      index: idx,
      label: formatPointLabel(label, pk),
      value: Number(row?.value ?? 0),
      key: pk,
    })
  }

  const handleChartClick = (payload: any) => {
    if (!onPointClick || !payload) return
    const row = payload?.activePayload?.[0]?.payload
    firePoint(row ?? payload)
  }

  const handlePieClick = (data: any) => {
    firePoint(data)
  }

  const commonAxes = (
    <>
      <CartesianGrid stroke="var(--gs-border)" strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="name" {...axisProps} />
      <YAxis {...axisProps} tickFormatter={(v: number) => formatValue(v)} width={48} />
      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--gs-text)' }} formatter={(value: any) => [formatValue(Number(value)), 'Giá trị']} />
      <Legend wrapperStyle={{ fontSize: 12, color: 'var(--gs-text-soft)' }} />
    </>
  )

  switch (type) {
    case 'line':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} onClick={handleChartClick} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            {commonAxes}
            {series.map((s, i) => (
              <Line key={s.name} type="monotone" dataKey={s.name} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5, cursor: 'pointer' }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )
    case 'area':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} onClick={handleChartClick} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            {commonAxes}
            {series.map((s, i) => (
              <Area key={s.name} type="monotone" dataKey={s.name} stroke={PALETTE[i % PALETTE.length]} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.18} strokeWidth={2.5} activeDot={{ r: 5, cursor: 'pointer' }} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )
    case 'bar':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} onClick={handleChartClick} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            {commonAxes}
            {series.map((s, i) => (
              <Bar key={s.name} dataKey={s.name} fill={PALETTE[i % PALETTE.length]} radius={[4, 4, 0, 0]} cursor="pointer" barSize={28} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )
    case 'pie':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart onClick={handleChartClick}>
            <Tooltip contentStyle={tooltipStyle} formatter={(value: any) => [formatValue(Number(value)), 'Giá trị']} />
            <Legend wrapperStyle={{ fontSize: 12, color: 'var(--gs-text-soft)' }} />
            <Pie data={data} dataKey={series[0]?.name || 'value'} nameKey="name" cx="50%" cy="50%" outerRadius={92} innerRadius={54} paddingAngle={2} cursor="pointer" onClick={handlePieClick}>
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      )
    default:
      return null
  }
}
