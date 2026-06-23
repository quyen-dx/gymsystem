import { Card, Empty } from 'antd'
import { useTranslation } from 'react-i18next'

export default function FeatureDisabled() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-[420px] items-center justify-center p-6">
      <Card className="w-full max-w-xl border border-[var(--theme-border)] bg-[var(--theme-card)] text-center">
        <Empty description={<span className="text-[var(--theme-text)]">{t('system_settings.disabled_message')}</span>} />
      </Card>
    </div>
  )
}
