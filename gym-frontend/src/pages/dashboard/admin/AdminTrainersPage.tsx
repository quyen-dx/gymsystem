import { useTranslation } from 'react-i18next'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'

export default function AdminTrainersPage() {
  const { t } = useTranslation()
  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">{t('admin.trainers.module')}</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">{t('admin.trainers.title')}</h1>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">
          {t('admin.trainers.under_development')}
        </p>
      </div>
    </DashboardLayout>
  )
}
