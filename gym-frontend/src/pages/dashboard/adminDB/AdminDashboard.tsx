import { useEffect, useState } from 'react'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import api from '../../../services/api'

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalMembers: 0,
    totalPT: 0,
    totalStaff: 0,
    totalPlans: 0,
    activePlans: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [usersRes, plansRes] = await Promise.all([
          api.get('/auth/users'),
          api.get('/plans'),
        ])

        const users = usersRes.data.users
        setStats({
          totalUsers: users.length,
          totalMembers: users.filter((u: any) => u.role === 'member').length,
          totalPT: users.filter((u: any) => u.role === 'pt').length,
          totalStaff: users.filter((u: any) => u.role === 'staff').length,
          totalPlans: plansRes.data.pagination.total,
          activePlans: plansRes.data.plans.filter((p: any) => p.isActive).length,
        })
      } catch {
        // giữ nguyên 0 nếu lỗi
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const statCards = [
    { label: 'Tổng người dùng', value: stats.totalUsers, tone: 'bg-[var(--gs-accent-soft)] text-[var(--gs-text)]' },
    { label: 'Members', value: stats.totalMembers, tone: 'bg-[rgba(116,140,84,0.16)] text-[var(--gs-text)]' },
    { label: 'PT', value: stats.totalPT, tone: 'bg-white/[0.04] text-[var(--gs-text)]' },
    { label: 'Staff', value: stats.totalStaff, tone: 'bg-white/[0.04] text-[var(--gs-text)]' },
    { label: 'Tổng gói tập', value: stats.totalPlans, tone: 'bg-white/[0.04] text-[var(--gs-text)]' },
    { label: 'Gói đang hoạt động', value: stats.activePlans, tone: 'bg-[rgba(116,140,84,0.16)] text-[var(--gs-text)]' },
  ]

  return (
    <DashboardLayout>
      <section className="mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))] p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Admin overview</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)]">Daily operations</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--gs-text-muted)]">
          Tổng quan người dùng và gói tập trong hệ thống.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {statCards.map((stat) => (
          <article
            key={stat.label}
            className="rounded-[24px] border border-[var(--gs-border)] bg-[rgba(23,23,23,0.92)] p-6"
          >
            <div className={`inline-flex rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em] ${stat.tone}`}>
              {stat.label}
            </div>
            <p className="mt-5 text-4xl font-semibold text-[var(--gs-text)]">
              {loading ? '—' : stat.value.toLocaleString()}
            </p>
          </article>
        ))}
      </div>
    </DashboardLayout>
  )
}