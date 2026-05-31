import { ClockCircleOutlined, CustomerServiceOutlined, ToolOutlined } from '@ant-design/icons'
import { Button, Card, Typography } from 'antd'
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
  const siteName = settings.general.siteName || 'GymPro'
  const message = pickMaintenanceMessage(
    settings.general.maintenanceMessage,
    i18n.language,
    t('system_settings.maintenance.default_message'),
  )

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--theme-bg)] p-4 text-[var(--theme-text)] sm:p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,var(--theme-accent-muted),transparent_42%)]" />
      <Card className="relative z-10 w-full max-w-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] text-center shadow-2xl">
        <div className="mb-7 flex items-center justify-center gap-3">
          {settings.general.logoUrl ? (
            <img src={settings.general.logoUrl} alt={siteName} className="h-11 w-11 rounded-xl object-cover" />
          ) : (
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--theme-button-bg)] font-black text-[var(--theme-button-text)]">
              GP
            </div>
          )}
          <span className="text-lg font-black tracking-wide text-[var(--theme-text)]">{siteName}</span>
        </div>

        <div className="mx-auto mb-6 grid h-24 w-24 place-items-center rounded-full border border-[var(--theme-accent-border)] bg-[var(--theme-accent-muted)] text-5xl text-[var(--theme-accent)] sm:h-28 sm:w-28">
          <ToolOutlined />
        </div>

        <Title level={1} className="!mb-4 !text-3xl !font-black !text-[var(--theme-text)] sm:!text-4xl">
          {t('system_settings.maintenance.title')}
        </Title>

        <Text className="mx-auto block max-w-xl text-base leading-7 text-[var(--theme-muted)] sm:text-lg">
          {message}
        </Text>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-elevated)] p-4 text-left">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--theme-text)]">
              <ClockCircleOutlined className="text-[var(--theme-accent)]" />
              {t('system_settings.maintenance.estimate_label')}
            </div>
            <Text className="text-sm text-[var(--theme-muted)]">{t('system_settings.maintenance.estimate_value')}</Text>
          </div>
          <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-elevated)] p-4 text-left">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--theme-text)]">
              <ToolOutlined className="text-[var(--theme-accent)]" />
              {t('system_settings.maintenance.reason_label')}
            </div>
            <Text className="text-sm text-[var(--theme-muted)]">{t('system_settings.maintenance.reason_value')}</Text>
          </div>
        </div>

        <Button
          type="primary"
          size="large"
          icon={<CustomerServiceOutlined />}
          className="mt-8 !h-12 !rounded-full !px-7 !font-bold"
          href="mailto:support@gympro.vn"
        >
          {t('system_settings.maintenance.contact_support')}
        </Button>
      </Card>
    </main>
  )
}
