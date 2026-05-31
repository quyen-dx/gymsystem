import User from '../models/User.js'
import { getSystemSettingsValue } from '../services/systemSettingsService.js'
import { verifyAccessToken } from '../utils/generateToken.js'

const bypassPaths = [
  '/api/health',
  '/api/system-settings',
  '/api/auth/login',
  '/api/auth/google',
  '/api/auth/google/callback',
  '/api/auth/facebook',
  '/api/auth/facebook/callback',
  '/api/auth/refresh',
  '/api/auth/refresh-token',
  '/api/auth/logout',
]

export const maintenanceModeGuard = async (req, res, next) => {
  try {
    const settings = await getSystemSettingsValue()
    if (!settings.general.maintenanceMode) return next()
    if (bypassPaths.some((path) => req.path === path || req.path.startsWith(`${path}/`))) return next()

    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null
    const decoded = token ? verifyAccessToken(token) : null
    if (decoded?.id) {
      const user = await User.findById(decoded.id).select('role')
      if (user?.role === 'admin') return next()
    }

    return res.status(503).json({
      code: 'MAINTENANCE_MODE',
      message: {
        vi: 'Hệ thống đang bảo trì. Vui lòng quay lại sau.',
        en: 'The system is currently under maintenance. Please come back later.',
      },
      maintenanceMessage: settings.general.maintenanceMessage,
    })
  } catch (error) {
    next(error)
  }
}
