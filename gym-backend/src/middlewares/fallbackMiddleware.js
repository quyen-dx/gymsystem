import { isFallbackActive } from '../config/db.js'

export const blockWritesInFallback = (req, res, next) => {
  if (isFallbackActive() && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return res.status(503).json({
      message: 'Hệ thống đang ở chế độ ngoại tuyến. Chỉ có thể xem dữ liệu.',
      code: 'FALLBACK_READ_ONLY',
    })
  }
  next()
}
