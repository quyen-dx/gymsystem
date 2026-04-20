import DashboardLayout from '../../components/layout/DashboardLayout'

export default function StaffDashboard() {
  return (
    <DashboardLayout>
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[28px] border border-[var(--gs-border)] bg-[rgba(24,24,24,0.94)] p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Front desk</p>
          <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)]">Check-in board</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--gs-text-muted)]">
            Mau sac duoc tiet che de uu tien doc nhanh member den phong tap trong gio cao diem.
          </p>
        </div>

        <div className="rounded-[28px] border border-[rgba(116,140,84,0.28)] bg-[rgba(116,140,84,0.12)] p-8">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--gs-text-soft)]">Current status</p>
          <p className="mt-4 text-4xl font-semibold text-[var(--gs-text)]">86</p>
          <p className="mt-2 text-sm text-[var(--gs-text-muted)]">members da check-in hom nay</p>
        </div>
      </section>
    </DashboardLayout>
  )
}
