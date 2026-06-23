import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import api from '../../../services/api'

export default function AdminDashboard() {
  const { t } = useTranslation()
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
        // keep default 0 on error
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const statCards = [
    { label: t('admin.dashboard.stats.total_users'), value: stats.totalUsers, tone: 'bg-[var(--gs-accent-soft)] text-[var(--gs-text)]' },
    { label: t('admin.dashboard.stats.members'), value: stats.totalMembers, tone: 'bg-[var(--gs-accent-soft)] text-[var(--gs-text)]' },
    { label: t('admin.dashboard.stats.pt'), value: stats.totalPT, tone: 'bg-[var(--gs-accent-soft)] text-[var(--gs-text)]' },
    { label: t('admin.dashboard.stats.staff'), value: stats.totalStaff, tone: 'bg-[var(--gs-accent-soft)] text-[var(--gs-text)]' },
    { label: t('admin.dashboard.stats.total_plans'), value: stats.totalPlans, tone: 'bg-[var(--gs-accent-soft)] text-[var(--gs-text)]' },
    { label: t('admin.dashboard.stats.active_plans'), value: stats.activePlans, tone: 'bg-[var(--gs-accent-soft)] text-[var(--gs-text)]' },
  ]

  return (
    <DashboardLayout>
      <section className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">{t('admin.dashboard.overline')}</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">{t('admin.dashboard.title')}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--gs-text-muted)]">
          {t('admin.dashboard.description')}
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <article
            key={stat.label}
            className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6"
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
