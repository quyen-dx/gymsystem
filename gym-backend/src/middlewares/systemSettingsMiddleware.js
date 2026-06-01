import { disabledFeatureMessage, isFeatureEnabled } from '../services/systemSettingsService.js'

export const requireFeature = (path) => async (_req, res, next) => {
  try {
    if (!(await isFeatureEnabled(path))) {
      return res.status(403).json({ code: 'FEATURE_DISABLED', message: disabledFeatureMessage })
    }
    next()
  } catch (error) {
    next(error)
  }
}

