import DashboardLayout from '../../../components/layout/header/DashboardLayout'

export default function PTWorkoutsPage() {
  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">PT DASHBOARD</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">Bài tập của tôi</h1>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">Tính năng đang phát triển</p>
      </div>
    </DashboardLayout>
  )
}
