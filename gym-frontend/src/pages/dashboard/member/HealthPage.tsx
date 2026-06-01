
import { useTranslation } from 'react-i18next'
import MemberLayout from '../../../components/layout/header/MemberLayout'

export default function HealthPage() {
    const { t } = useTranslation()
    return (
        <MemberLayout>
            <div className="member-page mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))] p-8 max-[640px]:p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">{t('health.module')}</p>
                <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)]">{t('health.title')}</h1>
                <p className="mt-2 text-sm text-[var(--gs-text-muted)]">
                    {t('health.under_development')}
                </p>
            </div>
        </MemberLayout>
    )
}
