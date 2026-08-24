import { normalizeSystemSettings, SYSTEM_SETTINGS_DEFAULTS, validateSystemSettingsForSave } from '../config/systemSettingsDefaults.js'
import SystemSettings from '../models/SystemSettings.js'
import AppError from '../utils/appError.js'

export const disabledFeatureMessage = 'Chức năng này hiện đang bị quản trị viên tạm thời vô hiệu hóa.'

export const getSystemSettingsDocument = async () => {
  let doc = await SystemSettings.findOne({ singletonKey: 'global' })
  if (!doc) {
    doc = await SystemSettings.create({
      singletonKey: 'global',
      settings: SYSTEM_SETTINGS_DEFAULTS,
    })
  }

  const normalized = normalizeSystemSettings(doc.settings)
  // Migrate the initial payout timeout defaults to the shorter policy currently in use.
  if (
    normalized?.billing?.payoutAdminReminderHours === 48
    && normalized?.billing?.payoutAutoCancelHours === 168
  ) {
    normalized.billing.payoutAdminReminderHours = 24
    normalized.billing.payoutAutoCancelHours = 48
  }
  if (JSON.stringify(doc.settings) !== JSON.stringify(normalized)) {
    doc.settings = normalized
    await doc.save()
  }

  return doc
}

export const getSystemSettingsValue = async () => {
  const doc = await getSystemSettingsDocument()
  return normalizeSystemSettings(doc.settings)
}

export const updateSystemSettingsValue = async (settings) => {
  const doc = await getSystemSettingsDocument()
  validateSystemSettingsForSave(settings)
  doc.settings = normalizeSystemSettings(settings)
  await doc.save()
  return doc
}

export const resetSystemSettingsValue = async () => {
  const doc = await getSystemSettingsDocument()
  doc.settings = SYSTEM_SETTINGS_DEFAULTS
  await doc.save()
  return doc
}

export const getSettingByPath = (settings, path) => (
  String(path || '')
    .split('.')
    .filter(Boolean)
    .reduce((value, key) => value?.[key], settings)
)

export const isFeatureEnabled = async (path) => {
  const settings = await getSystemSettingsValue()
  return getSettingByPath(settings, path) !== false
}

export const assertFeatureEnabled = async (path) => {
  if (!(await isFeatureEnabled(path))) {
    throw new AppError(disabledFeatureMessage, 403, 'FEATURE_DISABLED')
  }
}
