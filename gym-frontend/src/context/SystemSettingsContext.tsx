import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import i18n from '../i18n'
import { systemSettingsService } from '../services/systemSettingsService'
import { useTheme } from './ThemeContext'

export const SYSTEM_SETTINGS_DEFAULTS = {
  general: {
    siteName: 'GymPro',
    logoUrl: '',
    defaultLanguage: 'vi',
    defaultTheme: 'dark',
    maintenanceMode: false,
    maintenanceMessage: {
      vi: 'Hệ thống đang bảo trì. Vui lòng quay lại sau.',
      en: 'The system is currently under maintenance. Please come back later.',
    },
  },
  auth: { allowRegistration: true, allowPhoneLogin: true, allowEmailUsernameLogin: true, googleOAuthEnabled: true, facebookOAuthEnabled: true, demoOtpEnabled: true, otpExpiresInSeconds: 300, forgotPasswordSmsOtpEnabled: true, forgotPasswordEmailEnabled: true },
  members: { allowProfileUpdate: true, allowAvatarUpload: true, allowAccountLockToggle: true, protectPrimaryAdmin: true, allowBulkActions: true },
  billing: { allowPlanPurchase: true, allowAssignPlanToMember: true, allowPlanRenewal: true, allowAutoRenewal: true, discountCodesEnabled: true, qrPaymentEnabled: true, planMemberCountEnabled: true },
  checkin: { qrCheckinEnabled: true, qrTokenTtlSeconds: 30, preventDuplicateWithinHour: true, selfieRequired: false, streakEnabled: true, successSoundEnabled: true },
  pt: { moduleEnabled: true, scheduleEnabled: true, memberBookingEnabled: true, weeklyRecurringBookingEnabled: true, waitlistEnabled: true, reviewAfterSessionEnabled: true },
  workout: { workoutPlanEnabled: true, workoutTimerEnabled: true, healthLogEnabled: true, bmiHistoryEnabled: true, progressPhotoUploadEnabled: true, healthChartEnabled: true },
  reports: { revenueChartEnabled: true, checkinHeatmapEnabled: true, revenueForecastEnabled: true, churnRiskEnabled: true, excelExportEnabled: true, pdfExportEnabled: true, auditLogEnabled: true },
  notifications: { systemNotificationsEnabled: true, roleGroupNotificationsEnabled: true, emailNotificationsEnabled: true, readUnreadStatusEnabled: true },
  shop: { productStoreEnabled: true, cartEnabled: true, productReviewsEnabled: true, productDetailPageEnabled: true },
  ai: { floatingChatbotEnabled: true, planConsultingAiEnabled: true, adminAiEnabled: true },
  landing: { statsSectionEnabled: true, servicesSectionEnabled: true, feedbackSectionEnabled: true, partnersSectionEnabled: true, startNowButtonEnabled: true, checkinNowButtonEnabled: true },
}

type SystemSettings = typeof SYSTEM_SETTINGS_DEFAULTS

type ContextValue = {
  settings: SystemSettings
  loading: boolean
  refresh: () => Promise<void>
  isEnabled: (path: string) => boolean
}

const SystemSettingsContext = createContext<ContextValue | null>(null)

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const mergeSettings = (base: any, overrides: any): any => {
  const output = { ...base }
  Object.entries(overrides || {}).forEach(([key, value]) => {
    output[key] = isObject(value) && isObject(base[key]) ? mergeSettings(base[key], value) : value
  })
  return output
}

const getByPath = (value: any, path: string) => path.split('.').reduce((current, key) => current?.[key], value)

export function SystemSettingsProvider({ children }: { children: ReactNode }) {
  const { applyThemeMode } = useTheme()
  const [settings, setSettings] = useState<SystemSettings>(SYSTEM_SETTINGS_DEFAULTS)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    const response = await systemSettingsService.get()
    const nextSettings = mergeSettings(SYSTEM_SETTINGS_DEFAULTS, response.data?.settings || {})
    setSettings(nextSettings)
    document.title = nextSettings.general.siteName || 'GymPro'
    if (nextSettings.general.logoUrl) {
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null
      if (link) link.href = nextSettings.general.logoUrl
    }
    const preferredLanguage = nextSettings.general.defaultLanguage
    if (!localStorage.getItem('i18nextLng') && ['vi', 'en'].includes(preferredLanguage)) {
      i18n.changeLanguage(preferredLanguage)
    }
    applyThemeMode(nextSettings.general.defaultTheme === 'light' ? 'light' : 'dark')
  }

  useEffect(() => {
    refresh().catch(() => { }).finally(() => setLoading(false))
  }, [])

  const value = useMemo<ContextValue>(() => ({
    settings,
    loading,
    refresh,
    isEnabled: (path: string) => getByPath(settings, path) !== false,
  }), [settings, loading])

  return <SystemSettingsContext.Provider value={value}>{children}</SystemSettingsContext.Provider>
}

export const useSystemSettings = () => {
  const context = useContext(SystemSettingsContext)
  if (!context) throw new Error('useSystemSettings must be used inside SystemSettingsProvider')
  return context
}
