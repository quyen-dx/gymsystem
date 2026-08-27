import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import ChartFactory from './charts/ChartFactory'
import KpiCard from './KpiCard'
import TopList from './TopList'
import ChartCard from './ChartCard'
import RangeSelector from './RangeSelector'
import ReportExportButton from './ReportExportButton'
import FinancialDetailDrawer from './drawers/FinancialDetailDrawer'
import MemberActivityDrawer from './drawers/MemberActivityDrawer'
import BookingDetailDrawer from './drawers/BookingDetailDrawer'
import PTDetailDrawer from './drawers/PTDetailDrawer'
import SystemUserDrawer from './drawers/SystemUserDrawer'
import CheckinDetailDrawer from './drawers/CheckinDetailDrawer'
import { ReportEmpty, ReportError, ReportSkeleton } from './ReportStates'
import { useReportDashboard } from '../../hooks/useReportDashboard'
import type { DrawerType, DrillFilter, ReportModule } from '../../types/report'

interface DashboardScaffoldProps {
  module: ReportModule
  title: string
  subtitle: string
  drawerType: DrawerType
  chartOrder?: string[]
  topOrder?: string[]
  /** Map KPI key → drill filter when clicking the KPI */
  kpiToFilter?: Record<string, DrillFilter>
  /** When a top item is clicked, map it to a drill filter */
  topToFilter?: (topKey: string, itemId?: string) => DrillFilter | null
  chartPointToFilter?: (chartKey: string, pointKey?: string | number) => DrillFilter | null
  exportEnabled?: boolean
}

export default function DashboardScaffold({
  module,
  title,
  subtitle,
  drawerType,
  chartOrder,
  topOrder,
  kpiToFilter,
  topToFilter,
  chartPointToFilter,
  exportEnabled = true,
}: DashboardScaffoldProps) {
  const navigate = useNavigate()
  const { range, setRange, data, loading, error, refresh } = useReportDashboard(module)
  const [drawer, setDrawer] = useState<{ open: boolean; title: string; filters?: DrillFilter } | null>(null)

  const chartKeys = useMemo(() => {
    if (!data) return []
    return chartOrder || Object.keys(data.charts)
  }, [data, chartOrder])

  const topKeys = useMemo(() => {
    if (!data) return []
    return topOrder || Object.keys(data.tops)
  }, [data, topOrder])

  const openDrawer = (dTitle: string, filters?: DrillFilter) => {
    setDrawer({ open: true, title: dTitle, filters })
  }

  const renderDrawer = () => {
    const common = {
      open: !!drawer?.open,
      title: drawer?.title || '',
      range,
      filters: drawer?.filters,
      onClose: () => setDrawer(null),
    }
    switch (drawerType) {
      case 'member':
        return <MemberActivityDrawer {...common} />
      case 'booking':
        return <BookingDetailDrawer {...common} />
      case 'pt':
        return <PTDetailDrawer {...common} />
      case 'system':
        return <SystemUserDrawer {...common} />
      case 'checkin':
        return <CheckinDetailDrawer {...common} />
      case 'financial':
      default:
        return <FinancialDetailDrawer {...common} />
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/admin/reports')}
            className="mb-1 -ml-2 !text-[var(--gs-text-soft)]"
          >
            Quay lại Thống kê
          </Button>
          <h1 className="m-0 text-2xl font-bold text-[var(--gs-text)]">{title}</h1>
          <p className="m-0 mt-0.5 text-sm text-[var(--gs-text-muted)]">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangeSelector value={range} onChange={setRange} />
          {exportEnabled && <ReportExportButton module={module} range={range} />}
        </div>
      </div>

      {loading && <ReportSkeleton />}
      {!loading && error && <ReportError message={error} onRetry={refresh} />}
      {!loading && !error && (!data || (data.kpis.length === 0 && chartKeys.length === 0)) && <ReportEmpty />}

      {!loading && !error && data && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {data.kpis.map((kpi) => (
              <KpiCard
                key={kpi.key}
                kpi={kpi}
                onClick={
                  kpiToFilter?.[kpi.key]
                    ? () => openDrawer(`${kpi.label} — ${data.range.label}`, kpiToFilter[kpi.key])
                    : undefined
                }
              />
            ))}
          </div>

          {/* Charts */}
          {chartKeys.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {chartKeys.map((key) => {
                const chart = data.charts[key]
                if (!chart) return null
                const canDrillDown = !!chartPointToFilter?.(key, chart.pointKeys?.[0])
                return (
                  <ChartCard key={key} title={chart.title}>
                    <ChartFactory
                      type={chart.type}
                      labels={chart.labels}
                      series={chart.series}
                      pointKeys={chart.pointKeys}
                      onPointClick={
                        canDrillDown && chartPointToFilter
                          ? (point) => {
                              const filter = chartPointToFilter(key, point.key)
                              if (filter) openDrawer(`${chart.title} — ${point.label}`, filter)
                            }
                          : undefined
                      }
                    />
                  </ChartCard>
                )
              })}
            </div>
          )}

          {/* Top lists */}
          {topKeys.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {topKeys.map((key) => {
                const top = data.tops[key]
                if (!top) return null
                const canDrillDown = !!topToFilter?.(key, top.items[0]?.id)
                return (
                  <ChartCard key={key} title={top.title}>
                    <TopList
                      data={top}
                      onItemClick={
                        canDrillDown && topToFilter
                          ? (item) => {
                              const filter = topToFilter(key, item.id)
                              if (filter) openDrawer(`${top.title} — ${item.label}`, filter)
                            }
                          : undefined
                      }
                    />
                  </ChartCard>
                )
              })}
            </div>
          )}
        </>
      )}

      {renderDrawer()}
    </div>
  )
}
