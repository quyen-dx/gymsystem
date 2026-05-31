import { Card, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import { useSystemSettings } from '../../context/SystemSettingsContext'

const { Text, Title } = Typography

const pickMaintenanceMessage = (message: any, language: string, fallback: string) => {
  const lang = language?.startsWith('vi') ? 'vi' : 'en'
  return String(message?.[lang] || message?.vi || message?.en || fallback)
}

export default function MaintenancePage() {
  const { t, i18n } = useTranslation()
  const { settings } = useSystemSettings()
  const message = pickMaintenanceMessage(
    settings.general.maintenanceMessage,
    i18n.language,
    t('system_settings.maintenance.default_message'),
  )

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--theme-bg)] p-6 text-[var(--theme-text)]">
      <Card className="w-full max-w-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-[var(--theme-accent-muted)] text-2xl text-[var(--theme-accent)]">
          !
        </div>
        <Title level={2} className="!mb-3 !text-[var(--theme-text)]">
          {t('system_settings.maintenance.title')}
        </Title>
        <Text className="text-base text-[var(--theme-muted)]">{message}</Text>
      </Card>
    </main>
  )
}
