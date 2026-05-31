export const SYSTEM_SETTINGS_DEFAULTS = {
  general: {
    siteName: 'GymPro',
    slogans: [
      {
        vi: 'CHINH PHỤC TỪNG NGÀY',
        en: 'CONQUER EVERY DAY',
      },
      {
        vi: 'NƠI BẠN VƯỢT QUA GIỚI HẠN',
        en: 'WHERE YOU BREAK YOUR LIMITS',
      },
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
  const rawGeneral = settings?.general || {}
  const hasProvidedSlogans = Array.isArray(rawGeneral.slogans) && rawGeneral.slogans.length > 0
  const legacySlogan = typeof rawGeneral.slogan === 'string'
    ? { vi: rawGeneral.slogan.trim(), en: rawGeneral.slogan.trim() }
    : rawGeneral.slogan
  const merged = mergeSystemSettings(SYSTEM_SETTINGS_DEFAULTS, settings)
  const legacyMaintenanceMessages = {
    vi: 'Hệ thống đang bảo trì. Vui lòng quay lại sau.',
    en: 'The system is currently under maintenance. Please come back later.',
  }
  merged.general.defaultLanguage = ['vi', 'en'].includes(merged.general.defaultLanguage) ? merged.general.defaultLanguage : 'vi'
  merged.general.defaultTheme = ['dark', 'light'].includes(merged.general.defaultTheme) ? merged.general.defaultTheme : 'dark'
  merged.general.siteName = String(merged.general.siteName || SYSTEM_SETTINGS_DEFAULTS.general.siteName).trim()
  const sourceSlogans = hasProvidedSlogans
    ? rawGeneral.slogans
    : legacySlogan
      ? [{ vi: legacySlogan.vi || legacySlogan.en, en: legacySlogan.en || legacySlogan.vi }]
      : SYSTEM_SETTINGS_DEFAULTS.general.slogans
  merged.general.slogans = sourceSlogans
    .map((item) => ({
      vi: String(item?.vi || '').trim(),
      en: String(item?.en || '').trim(),
    }))
    .filter((item) => item.vi && item.en)
  if (!merged.general.slogans.length) {
    merged.general.slogans = SYSTEM_SETTINGS_DEFAULTS.general.slogans.map(({ vi, en }) => ({ vi, en }))
  }
  delete merged.general.slogan
  merged.general.logoUrl = String(merged.general.logoUrl || '').trim()
  merged.general.maintenanceMessage = {
    vi: String(merged.general.maintenanceMessage?.vi || SYSTEM_SETTINGS_DEFAULTS.general.maintenanceMessage.vi).trim(),
    en: String(merged.general.maintenanceMessage?.en || SYSTEM_SETTINGS_DEFAULTS.general.maintenanceMessage.en).trim(),
  }
  if (merged.general.maintenanceMessage.vi === legacyMaintenanceMessages.vi) {
    merged.general.maintenanceMessage.vi = SYSTEM_SETTINGS_DEFAULTS.general.maintenanceMessage.vi
  }
  if (merged.general.maintenanceMessage.en === legacyMaintenanceMessages.en) {
    merged.general.maintenanceMessage.en = SYSTEM_SETTINGS_DEFAULTS.general.maintenanceMessage.en
  }
  merged.auth.otpExpiresInSeconds = Math.max(30, Number(merged.auth.otpExpiresInSeconds) || 300)
  merged.checkin.qrTokenTtlSeconds = Math.max(5, Number(merged.checkin.qrTokenTtlSeconds) || 30)
  return merged
}

export const validateSystemSettingsForSave = (settings = {}) => {
  const slogans = settings?.general?.slogans
  if (!Array.isArray(slogans) || slogans.length < 1) {
    const error = new Error('Phải có ít nhất 1 slogan')
    error.statusCode = 400
    error.code = 'VALIDATION_FAILED'
    throw error
  }

  slogans.forEach((item, index) => {
    const vi = String(item?.vi || '').trim()
    const en = String(item?.en || '').trim()
    if (!vi || !en) {
      const error = new Error(`Slogan dòng ${index + 1} phải có cả tiếng Việt và tiếng Anh`)
      error.statusCode = 400
      error.code = 'VALIDATION_FAILED'
      throw error
    }
  })
}
