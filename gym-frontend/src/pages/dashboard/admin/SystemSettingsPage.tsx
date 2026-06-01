import { DeleteOutlined, PlusOutlined, ReloadOutlined, SaveOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Card, Input, InputNumber, Select, Space, Spin, Switch, Typography, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { SYSTEM_SETTINGS_DEFAULTS, useSystemSettings } from '../../../context/SystemSettingsContext'
import { systemSettingsService } from '../../../services/systemSettingsService'

const { Text } = Typography

type SettingType = 'switch' | 'text' | 'select' | 'number' | 'slogans'

type SettingItem = {
  path: string
  type: SettingType
  options?: { labelKey: string; value: string }[]
  min?: number
  max?: number
}

type SettingGroup = {
  key: string
  items: SettingItem[]
}

const langOptions = [
  { labelKey: 'system_settings.options.vi', value: 'vi' },
  { labelKey: 'system_settings.options.en', value: 'en' },
]

const themeOptions = [
  { labelKey: 'system_settings.options.dark', value: 'dark' },
  { labelKey: 'system_settings.options.light', value: 'light' },
]

const SETTING_GROUPS: SettingGroup[] = [
  {
    key: 'general',
    items: [
      { path: 'general.siteName', type: 'text' },
      { path: 'general.slogans', type: 'slogans' },
      { path: 'general.logoUrl', type: 'text' },
      { path: 'general.defaultLanguage', type: 'select', options: langOptions },
      { path: 'general.defaultTheme', type: 'select', options: themeOptions },
      { path: 'general.maintenanceMode', type: 'switch' },
      { path: 'general.maintenanceMessage.vi', type: 'text' },
      { path: 'general.maintenanceMessage.en', type: 'text' },
    ],
  },
  {
    key: 'auth',
    items: [
      { path: 'auth.allowRegistration', type: 'switch' },
      { path: 'auth.allowPhoneLogin', type: 'switch' },
      { path: 'auth.allowEmailUsernameLogin', type: 'switch' },
      { path: 'auth.googleOAuthEnabled', type: 'switch' },
      { path: 'auth.facebookOAuthEnabled', type: 'switch' },
      { path: 'auth.demoOtpEnabled', type: 'switch' },
      { path: 'auth.otpExpiresInSeconds', type: 'number', min: 30, max: 3600 },
      { path: 'auth.forgotPasswordSmsOtpEnabled', type: 'switch' },
      { path: 'auth.forgotPasswordEmailEnabled', type: 'switch' },
    ],
  },
  {
    key: 'members',
    items: [
      { path: 'members.allowProfileUpdate', type: 'switch' },
      { path: 'members.allowAvatarUpload', type: 'switch' },
      { path: 'members.allowAccountLockToggle', type: 'switch' },
      { path: 'members.protectPrimaryAdmin', type: 'switch' },
      { path: 'members.allowBulkActions', type: 'switch' },
    ],
  },
  {
    key: 'billing',
    items: [
      { path: 'billing.allowPlanPurchase', type: 'switch' },
      { path: 'billing.allowAssignPlanToMember', type: 'switch' },
      { path: 'billing.allowPlanRenewal', type: 'switch' },
      { path: 'billing.allowAutoRenewal', type: 'switch' },
      { path: 'billing.discountCodesEnabled', type: 'switch' },
      { path: 'billing.qrPaymentEnabled', type: 'switch' },
      { path: 'billing.planMemberCountEnabled', type: 'switch' },
    ],
  },
  {
    key: 'checkin',
    items: [
      { path: 'checkin.qrCheckinEnabled', type: 'switch' },
      { path: 'checkin.qrTokenTtlSeconds', type: 'number', min: 5, max: 600 },
      { path: 'checkin.preventDuplicateWithinHour', type: 'switch' },
      { path: 'checkin.selfieRequired', type: 'switch' },
      { path: 'checkin.streakEnabled', type: 'switch' },
      { path: 'checkin.successSoundEnabled', type: 'switch' },
    ],
  },
  {
    key: 'pt',
    items: [
      { path: 'pt.moduleEnabled', type: 'switch' },
      { path: 'pt.scheduleEnabled', type: 'switch' },
      { path: 'pt.memberBookingEnabled', type: 'switch' },
      { path: 'pt.weeklyRecurringBookingEnabled', type: 'switch' },
      { path: 'pt.waitlistEnabled', type: 'switch' },
      { path: 'pt.reviewAfterSessionEnabled', type: 'switch' },
    ],
  },
  {
    key: 'workout',
    items: [
      { path: 'workout.workoutPlanEnabled', type: 'switch' },
      { path: 'workout.workoutTimerEnabled', type: 'switch' },
      { path: 'workout.healthLogEnabled', type: 'switch' },
      { path: 'workout.bmiHistoryEnabled', type: 'switch' },
      { path: 'workout.progressPhotoUploadEnabled', type: 'switch' },
      { path: 'workout.healthChartEnabled', type: 'switch' },
    ],
  },
  {
    key: 'reports',
    items: [
      { path: 'reports.revenueChartEnabled', type: 'switch' },
      { path: 'reports.checkinHeatmapEnabled', type: 'switch' },
      { path: 'reports.revenueForecastEnabled', type: 'switch' },
      { path: 'reports.churnRiskEnabled', type: 'switch' },
      { path: 'reports.excelExportEnabled', type: 'switch' },
      { path: 'reports.pdfExportEnabled', type: 'switch' },
      { path: 'reports.auditLogEnabled', type: 'switch' },
    ],
  },
  {
    key: 'notifications',
    items: [
      { path: 'notifications.systemNotificationsEnabled', type: 'switch' },
      { path: 'notifications.roleGroupNotificationsEnabled', type: 'switch' },
      { path: 'notifications.emailNotificationsEnabled', type: 'switch' },
      { path: 'notifications.readUnreadStatusEnabled', type: 'switch' },
    ],
  },
  {
    key: 'shop',
    items: [
      { path: 'shop.productStoreEnabled', type: 'switch' },
      { path: 'shop.cartEnabled', type: 'switch' },
      { path: 'shop.productReviewsEnabled', type: 'switch' },
      { path: 'shop.productDetailPageEnabled', type: 'switch' },
    ],
  },
  {
    key: 'ai',
    items: [
      { path: 'ai.floatingChatbotEnabled', type: 'switch' },
      { path: 'ai.planConsultingAiEnabled', type: 'switch' },
      { path: 'ai.adminAiEnabled', type: 'switch' },
    ],
  },
  {
    key: 'landing',
    items: [
      { path: 'landing.statsSectionEnabled', type: 'switch' },
      { path: 'landing.servicesSectionEnabled', type: 'switch' },
      { path: 'landing.feedbackSectionEnabled', type: 'switch' },
      { path: 'landing.partnersSectionEnabled', type: 'switch' },
      { path: 'landing.startNowButtonEnabled', type: 'switch' },
      { path: 'landing.checkinNowButtonEnabled', type: 'switch' },
    ],
  },
]

const clone = (value: any) => JSON.parse(JSON.stringify(value))

const getByPath = (source: any, path: string) => path.split('.').reduce((value, key) => value?.[key], source)

const setByPath = (source: any, path: string, value: any) => {
  const next = clone(source)
  const keys = path.split('.')
  let cursor = next
  keys.slice(0, -1).forEach((key) => {
    cursor[key] = cursor[key] || {}
    cursor = cursor[key]
  })
  cursor[keys[keys.length - 1]] = value
  return next
}

export default function SystemSettingsPage() {
  const { t } = useTranslation()
  const { settings, loading, refresh } = useSystemSettings()
  const [draft, setDraft] = useState<any>(SYSTEM_SETTINGS_DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState('all')

  useEffect(() => {
    setDraft(clone(settings))
  }, [settings])

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase()
    return SETTING_GROUPS
      .filter((group) => groupFilter === 'all' || group.key === groupFilter)
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (!query) return true
          const label = t(`system_settings.items.${item.path}.label`).toLowerCase()
          const description = t(`system_settings.items.${item.path}.description`).toLowerCase()
          return label.includes(query) || description.includes(query) || item.path.toLowerCase().includes(query)
        }),
      }))
      .filter((group) => group.items.length > 0)
  }, [groupFilter, search, t])

  const save = async () => {
    const slogans = Array.isArray(draft?.general?.slogans) ? draft.general.slogans : []
    if (slogans.length < 1) {
      message.error(t('system_settings.slogans.at_least_one'))
      return
    }
    const invalidIndex = slogans.findIndex((slogan: any) => !String(slogan?.vi || '').trim() || !String(slogan?.en || '').trim())
    if (invalidIndex >= 0) {
      message.error(t('system_settings.slogans.bilingual_required', { index: invalidIndex + 1 }))
      return
    }

    setSaving(true)
    try {
      const response = await systemSettingsService.update(draft)
      setDraft(response.data.settings)
      await refresh()
      message.success(t('system_settings.save_success'))
    } catch (error: any) {
      console.error('[system-settings] save failed response:', error.response?.status, error.response?.data || error.message)
      message.error(error.response?.data?.message || t('system_settings.save_failed'))
    } finally {
      setSaving(false)
    }
  }

  const resetDefault = async () => {
    setResetting(true)
    try {
      const response = await systemSettingsService.resetDefault()
      setDraft(response.data.settings)
      await refresh()
      message.success(t('system_settings.reset_success'))
    } catch (error: any) {
      console.error('[system-settings] reset failed response:', error.response?.status, error.response?.data || error.message)
      message.error(error.response?.data?.message || t('system_settings.reset_failed'))
    } finally {
      setResetting(false)
    }
  }

  const renderControl = (item: SettingItem) => {
    const value = getByPath(draft, item.path)
    if (item.type === 'slogans') {
      const slogans = Array.isArray(value) ? value : []
      const updateSlogans = (nextSlogans: any[]) => {
        setDraft(setByPath(draft, item.path, nextSlogans.map((slogan) => ({
          vi: slogan.vi || '',
          en: slogan.en || '',
        }))))
      }
      return (
        <div className="flex w-full flex-col gap-3">
          {slogans.map((slogan: any, index: number) => (
            <div key={`slogan-${index}`} className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3">
              <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-center">
                <Input
                  value={slogan.vi || ''}
                  placeholder={t('system_settings.slogans.vi_placeholder')}
                  onChange={(event) => {
                    const next = clone(slogans)
                    next[index].vi = event.target.value
                    updateSlogans(next)
                  }}
                />
                <Input
                  value={slogan.en || ''}
                  placeholder={t('system_settings.slogans.en_placeholder')}
                  onChange={(event) => {
                    const next = clone(slogans)
                    next[index].en = event.target.value
                    updateSlogans(next)
                  }}
                />
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => updateSlogans(slogans.filter((_: any, itemIndex: number) => itemIndex !== index))}
                >
                  {t('system_settings.slogans.delete')}
                </Button>
              </div>
            </div>
          ))}
          <Button
            icon={<PlusOutlined />}
            onClick={() => updateSlogans([...slogans, { vi: '', en: '' }])}
          >
            {t('system_settings.slogans.add')}
          </Button>
        </div>
      )
    }
    if (item.type === 'switch') {
      return <Switch checked={Boolean(value)} onChange={(checked) => setDraft(setByPath(draft, item.path, checked))} />
    }
    if (item.type === 'select') {
      return (
        <Select
          value={value}
          style={{ minWidth: 160 }}
          options={(item.options || []).map((option) => ({ value: option.value, label: t(option.labelKey) }))}
          onChange={(nextValue) => setDraft(setByPath(draft, item.path, nextValue))}
        />
      )
    }
    if (item.type === 'number') {
      return (
        <InputNumber
          value={Number(value)}
          min={item.min}
          max={item.max}
          onChange={(nextValue) => setDraft(setByPath(draft, item.path, Number(nextValue) || item.min || 0))}
        />
      )
    }
    return <Input value={value || ''} onChange={(event) => setDraft(setByPath(draft, item.path, event.target.value))} />
  }

  return (
    <DashboardLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 sm:p-6">
        <div className="sticky top-0 z-20 -mx-4 border-b border-[var(--theme-border)] bg-[var(--theme-bg)]/95 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="m-0 text-2xl font-bold text-[var(--theme-text)]">{t('system_settings.title')}</h1>
              <p className="m-0 mt-1 text-sm text-[var(--theme-muted)]">{t('system_settings.subtitle')}</p>
            </div>
            <Space wrap>
              <Button icon={<ReloadOutlined />} loading={resetting} onClick={resetDefault}>
                {t('system_settings.reset_default')}
              </Button>
              <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>
                {t('system_settings.save_changes')}
              </Button>
            </Space>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_260px]">
            <Input
              prefix={<SearchOutlined />}
              value={search}
              placeholder={t('system_settings.search_placeholder')}
              onChange={(event) => setSearch(event.target.value)}
              allowClear
            />
            <Select
              value={groupFilter}
              onChange={setGroupFilter}
              options={[
                { value: 'all', label: t('system_settings.all_groups') },
                ...SETTING_GROUPS.map((group) => ({ value: group.key, label: t(`system_settings.groups.${group.key}`) })),
              ]}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center"><Spin /></div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {groups.map((group) => (
              <Card
                key={group.key}
                title={<span className="text-[var(--theme-text)]">{t(`system_settings.groups.${group.key}`)}</span>}
                className="border border-[var(--theme-border)] bg-[var(--theme-card)]"
              >
                <div className="flex flex-col divide-y divide-[var(--theme-border)]">
                  {group.items.map((item) => (
                    <div key={item.path} className={`grid gap-3 py-4 ${item.type === 'slogans' ? '' : 'sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center'}`}>
                      <div className="min-w-0">
                        <div className="font-medium text-[var(--theme-text)]">{t(`system_settings.items.${item.path}.label`)}</div>
                        <Text className="text-sm text-[var(--theme-muted)]">{t(`system_settings.items.${item.path}.description`)}</Text>
                      </div>
                      <div className={item.type === 'slogans' ? 'min-w-0' : 'sm:justify-self-end'}>{renderControl(item)}</div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
