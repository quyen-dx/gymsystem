import DashboardLayout from '../../components/layout/DashboardLayout'

export default function AdminMembersPage() {
  return (
    <DashboardLayout>
      <div className="mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))] p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Module 2</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)]">Quản lý Members</h1>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">
          Chức năng đang phát triển — Phụ trách: Thành viên 2
        </p>
      </div>
    </DashboardLayout>
  )
}