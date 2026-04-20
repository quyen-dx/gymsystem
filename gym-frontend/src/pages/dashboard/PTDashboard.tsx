import DashboardLayout from '../../components/layout/DashboardLayout'

const sessions = [
  { name: '6:00 AM', detail: 'Lower body - Mai Anh' },
  { name: '8:30 AM', detail: 'Mobility - Quoc Dat' },
  { name: '5:15 PM', detail: 'Strength base - Thanh Lam' },
]

export default function PTDashboard() {
  return (
    <DashboardLayout>
      <section className="mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[rgba(24,24,24,0.94)] p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Coach space</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)]">Training schedule</h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--gs-text-muted)]">
          Giao dien giu nen toi va accent am de buoi hoc noi bat ma khong bi san mau qua tay.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {sessions.map((session) => (
          <article
            key={session.name}
            className="rounded-[24px] border border-[var(--gs-border)] bg-[rgba(255,255,255,0.03)] p-6"
          >
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--gs-text-soft)]">{session.name}</p>
            <p className="mt-4 text-xl font-semibold text-[var(--gs-text)]">{session.detail}</p>
          </article>
        ))}
      </div>
    </DashboardLayout>
  )
}
