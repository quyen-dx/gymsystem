import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import NotificationCenter from '../../../components/notifications/NotificationCenter'

export default function PTNotificationsPage() {
  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">THÔNG BÁO</p>
          <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">Thông báo</h1>
        </div>
        <NotificationCenter role="pt" />
      </div>
    </DashboardLayout>
  )
}
