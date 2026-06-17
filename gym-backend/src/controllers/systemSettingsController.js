import { recordAuditLog } from '../services/auditLogService.js'
import {
  getSystemSettingsDocument,
  resetSystemSettingsValue,
  updateSystemSettingsValue,
} from '../services/systemSettingsService.js'
import { invalidateContextCache } from '../services/conversationContextCache.js'

const sendSystemSettingsError = (res, error, fallbackMessage = 'Không thể xử lý cài đặt hệ thống') => {
  console.error('[system-settings] error:', error)

  if (error?.name === 'ValidationError') {
    return res.status(400).json({
      code: 'VALIDATION_FAILED',
      message: `Validation failed: ${error.message}`,
      details: error.errors,
    })
  }

  if (error?.name === 'MongoServerError' || error?.name === 'MongooseError') {
    return res.status(500).json({
      code: 'DATABASE_ERROR',
      message: `Database error: ${error.message}`,
    })
  }

  return res.status(error.statusCode || error.status || 500).json({
    code: error.code || 'SYSTEM_SETTINGS_ERROR',
    message: error.message || fallbackMessage,
  })
}

export const getSystemSettings = async (_req, res, next) => {
  try {
    const doc = await getSystemSettingsDocument()
    res.json({ settings: doc.settings })
  } catch (error) {
    sendSystemSettingsError(res, error, 'Không thể tải system settings')
  }
}

export const updateSystemSettings = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ code: 'MISSING_FIELD', message: 'Missing field: settings payload is required' })
    }

    const payload = req.body.settings ?? req.body
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return res.status(400).json({ code: 'VALIDATION_FAILED', message: 'Validation failed: settings must be an object' })
    }

    console.log('[system-settings] PUT payload:', JSON.stringify(payload))

    const doc = await updateSystemSettingsValue(payload)
    invalidateContextCache('systemSettings')
    try {
      await recordAuditLog({
        req,
        module: 'system_settings',
        action: 'update',
        entity: doc,
        entityName: 'System settings',
        details: 'Cập nhật cài đặt hệ thống toàn website',
      })
    } catch (auditError) {
      console.error('[system-settings] audit log failed:', auditError)
      return res.json({
        message: 'Cập nhật cài đặt hệ thống thành công, nhưng ghi audit log thất bại',
        warning: `Audit log error: ${auditError.message}`,
        settings: doc.settings,
      })
    }

    return res.json({ message: 'Cập nhật cài đặt hệ thống thành công', settings: doc.settings })
  } catch (error) {
    return sendSystemSettingsError(res, error, 'Không thể cập nhật system settings')
  }
}

export const resetSystemSettings = async (req, res, next) => {
  try {
    const doc = await resetSystemSettingsValue()
    invalidateContextCache('systemSettings')
    try {
      await recordAuditLog({
        req,
        module: 'system_settings',
        action: 'update',
        entity: doc,
        entityName: 'System settings',
        details: 'Reset cài đặt hệ thống về mặc định',
      })
    } catch (auditError) {
      console.error('[system-settings] audit log failed:', auditError)
      return res.json({
        message: 'Đã reset cài đặt hệ thống về mặc định, nhưng ghi audit log thất bại',
        warning: `Audit log error: ${auditError.message}`,
        settings: doc.settings,
      })
    }
    return res.json({ message: 'Đã reset cài đặt hệ thống về mặc định', settings: doc.settings })
  } catch (error) {
    return sendSystemSettingsError(res, error, 'Không thể reset system settings')
  }
}
