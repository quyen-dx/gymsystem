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
  auth: {
    allowRegistration: true,
    allowPhoneLogin: true,
    allowEmailUsernameLogin: true,
    googleOAuthEnabled: true,
    facebookOAuthEnabled: true,
    demoOtpEnabled: true,
    otpExpiresInSeconds: 300,
    forgotPasswordSmsOtpEnabled: true,
    forgotPasswordEmailEnabled: true,
  },
  members: {
    allowProfileUpdate: true,
    allowAvatarUpload: true,
    allowAccountLockToggle: true,
    protectPrimaryAdmin: true,
    allowBulkActions: true,
  },
  billing: {
    allowPlanPurchase: true,
    allowAssignPlanToMember: true,
    allowPlanRenewal: true,
    allowAutoRenewal: true,
    discountCodesEnabled: true,
    qrPaymentEnabled: true,
    planMemberCountEnabled: true,
  },
  checkin: {
    qrCheckinEnabled: true,
    qrTokenTtlSeconds: 30,
    preventDuplicateWithinHour: true,
    selfieRequired: false,
    streakEnabled: true,
    successSoundEnabled: true,
  },
  pt: {
    moduleEnabled: true,
    scheduleEnabled: true,
    memberBookingEnabled: true,
    weeklyRecurringBookingEnabled: true,
    waitlistEnabled: true,
    reviewAfterSessionEnabled: true,
  },
  workout: {
    workoutPlanEnabled: true,
    workoutTimerEnabled: true,
    healthLogEnabled: true,
    bmiHistoryEnabled: true,
    progressPhotoUploadEnabled: true,
    healthChartEnabled: true,
  },
  reports: {
    revenueChartEnabled: true,
    checkinHeatmapEnabled: true,
    revenueForecastEnabled: true,
    churnRiskEnabled: true,
    excelExportEnabled: true,
    pdfExportEnabled: true,
    auditLogEnabled: true,
  },
  notifications: {
    systemNotificationsEnabled: true,
    roleGroupNotificationsEnabled: true,
    emailNotificationsEnabled: true,
    readUnreadStatusEnabled: true,
  },
  shop: {
    productStoreEnabled: true,
    cartEnabled: true,
    productReviewsEnabled: true,
    productDetailPageEnabled: true,
  },
  ai: {
    floatingChatbotEnabled: true,
    planConsultingAiEnabled: true,
    adminAiEnabled: true,
  },
  landing: {
    statsSectionEnabled: true,
    servicesSectionEnabled: true,
    feedbackSectionEnabled: true,
    partnersSectionEnabled: true,
    startNowButtonEnabled: true,
    checkinNowButtonEnabled: true,
  },
}

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value)

export const mergeSystemSettings = (base, overrides = {}) => {
  const output = { ...base }
  Object.entries(overrides || {}).forEach(([key, value]) => {
    if (isPlainObject(value) && isPlainObject(base[key])) {
      output[key] = mergeSystemSettings(base[key], value)
    } else if (value !== undefined) {
      output[key] = value
    }
  })
  return output
}

export const normalizeSystemSettings = (settings = {}) => {
  const merged = mergeSystemSettings(SYSTEM_SETTINGS_DEFAULTS, settings)
  merged.general.defaultLanguage = ['vi', 'en'].includes(merged.general.defaultLanguage) ? merged.general.defaultLanguage : 'vi'
  merged.general.defaultTheme = ['dark', 'light'].includes(merged.general.defaultTheme) ? merged.general.defaultTheme : 'dark'
  merged.general.maintenanceMessage = {
    vi: String(merged.general.maintenanceMessage?.vi || SYSTEM_SETTINGS_DEFAULTS.general.maintenanceMessage.vi).trim(),
    en: String(merged.general.maintenanceMessage?.en || SYSTEM_SETTINGS_DEFAULTS.general.maintenanceMessage.en).trim(),
  }
  merged.auth.otpExpiresInSeconds = Math.max(30, Number(merged.auth.otpExpiresInSeconds) || 300)
  merged.checkin.qrTokenTtlSeconds = Math.max(5, Number(merged.checkin.qrTokenTtlSeconds) || 30)
  return merged
}
