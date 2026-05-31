import { recordAuditLog } from '../services/auditLogService.js'
import {
  getSystemSettingsDocument,
  resetSystemSettingsValue,
  updateSystemSettingsValue,
} from '../services/systemSettingsService.js'

export const getSystemSettings = async (_req, res, next) => {
  try {
    const doc = await getSystemSettingsDocument()
    res.json({ settings: doc.settings })
  } catch (error) {
    next(error)
  }
}

export const updateSystemSettings = async (req, res, next) => {
  try {
    const doc = await updateSystemSettingsValue(req.body?.settings || req.body || {})
    await recordAuditLog({
      req,
      module: 'system_settings',
      action: 'update',
      entity: doc,
      entityName: 'System settings',
      details: 'Cập nhật cài đặt hệ thống toàn website',
    })
    res.json({ message: 'Cập nhật cài đặt hệ thống thành công', settings: doc.settings })
  } catch (error) {
    next(error)
  }
}

export const resetSystemSettings = async (req, res, next) => {
  try {
    const doc = await resetSystemSettingsValue()
    await recordAuditLog({
      req,
      module: 'system_settings',
      action: 'update',
      entity: doc,
      entityName: 'System settings',
      details: 'Reset cài đặt hệ thống về mặc định',
    })
    res.json({ message: 'Đã reset cài đặt hệ thống về mặc định', settings: doc.settings })
  } catch (error) {
    next(error)
  }
}

