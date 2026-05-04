import DashboardLayout from '../../../components/layout/DashboardLayout'

export default function StaffMemberPage() {
  return (
    <DashboardLayout>
      <div className="mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))] p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Module 3</p>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">
          Chức năng đang phát triển — Phụ trách: Thành viên 3
        </p>
      </div>
    </DashboardLayout>
  )
}
