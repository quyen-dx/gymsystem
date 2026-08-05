import DashboardLayout from '../../../../components/layout/header/DashboardLayout'
import ModuleCard from '../../../../components/reports/ModuleCard'
import RangeSelector from '../../../../components/reports/RangeSelector'
import { ReportEmpty, ReportError, ReportSkeleton } from '../../../../components/reports/ReportStates'
import { useReportSummary } from '../../../../hooks/useReportDashboard'

export default function StatisticsHomePage() {
  const { range, setRange, data, loading, error } = useReportSummary()

  return (
    <DashboardLayout>
      {/* Compact header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div>
          <h1 className="m-0 text-2xl font-bold text-[var(--gs-text)]">Trung tâm phân tích dữ liệu</h1>
          <p className="m-0 mt-1 text-sm text-[var(--gs-text-muted)]">
            Tổng quan toàn bộ hoạt động của hệ thống GymPro. Chọn một lĩnh vực để xem dashboard chi tiết.
          </p>
        </div>
        <RangeSelector value={range} onChange={setRange} />
      </div>

      {/* Module cards */}
      {loading && <ReportSkeleton />}
      {!loading && error && <ReportError message={error} />}
      {!loading && !error && data && data.modules.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.modules.map((m) => (
            <ModuleCard key={m.key} module={m} />
          ))}
        </div>
      )}
      {!loading && !error && (!data || data.modules.length === 0) && <ReportEmpty />}
    </DashboardLayout>
  )
}
