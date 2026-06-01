import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import i18n from '../i18n'
import { systemSettingsService } from '../services/systemSettingsService'
import { resolveEffectiveTheme, useTheme } from './ThemeContext'

export const SYSTEM_SETTINGS_DEFAULTS = {
  general: {
    siteName: 'GymPro',
    slogans: [
      { vi: 'CHINH PHỤC TỪNG NGÀY', en: 'CONQUER EVERY DAY' },
      { vi: 'NƠI BẠN VƯỢT QUA GIỚI HẠN', en: 'WHERE YOU BREAK YOUR LIMITS' },
    ],
    logoUrl: '',
    defaultLanguage: 'vi',
    defaultTheme: 'dark',
    maintenanceMode: false,
    maintenanceMessage: {
      vi: 'Chúng tôi đang nâng cấp hệ thống để mang lại trải nghiệm tốt hơn. Vui lòng quay lại sau.',
      en: 'We are currently improving the platform. Please come back later.',
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

const normalizeSettings = (settings: any): SystemSettings => {
  const rawGeneral = settings?.general || {}
  const hasProvidedSlogans = Array.isArray(rawGeneral.slogans) && rawGeneral.slogans.length > 0
  const legacySlogan = typeof rawGeneral.slogan === 'string'
    ? { vi: rawGeneral.slogan.trim(), en: rawGeneral.slogan.trim() }
    : rawGeneral.slogan
  const merged = mergeSettings(SYSTEM_SETTINGS_DEFAULTS, settings || {})
  const sourceSlogans = hasProvidedSlogans
    ? rawGeneral.slogans
    : legacySlogan
      ? [{ vi: legacySlogan.vi || legacySlogan.en, en: legacySlogan.en || legacySlogan.vi }]
      : SYSTEM_SETTINGS_DEFAULTS.general.slogans
  const slogans = sourceSlogans
    .map((item: any) => ({
      vi: String(item?.vi || '').trim(),
      en: String(item?.en || '').trim(),
    }))
    .filter((item: any) => item.vi && item.en)
  const safeSlogans = slogans.length ? slogans : SYSTEM_SETTINGS_DEFAULTS.general.slogans
  return {
    ...merged,
    general: {
      ...merged.general,
      slogans: safeSlogans.map((item: any) => ({ vi: item.vi, en: item.en })),
    },
  }
}

const getByPath = (value: any, path: string) => path.split('.').reduce((current, key) => current?.[key], value)

export function SystemSettingsProvider({ children }: { children: ReactNode }) {
  const { applyThemeFull, applyThemeMode } = useTheme()
  const { user } = useAuth()
  const [settings, setSettings] = useState<SystemSettings>(SYSTEM_SETTINGS_DEFAULTS)
  const [loading, setLoading] = useState(true)

  const applySettings = (nextSettings: SystemSettings) => {
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
  }

  const refresh = async () => {
    try {
      const response = await systemSettingsService.get()
      applySettings(normalizeSettings(response.data?.settings || {}))
    } catch (error) {
      console.error('[system-settings] failed to load, using defaults:', error)
      applySettings(SYSTEM_SETTINGS_DEFAULTS)
    }
  }

  useEffect(() => {
    const systemTheme = settings.general.defaultTheme === 'light' ? 'light' : 'dark'
    const effectiveTheme = resolveEffectiveTheme(systemTheme, user?.themePreference)
    applyThemeMode(effectiveTheme)
    if (user?.accentColor) {
      applyThemeFull(user.accentColor)
    }
  }, [settings.general.defaultTheme, user?.themePreference, user?.accentColor])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
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
