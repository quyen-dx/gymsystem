import { getSellerRevenue, getSellerStats, getSellerPayouts } from '../services/sellerService.js'

export const getRevenue = async (req, res, next) => {
  try {
    const data = await getSellerRevenue(req.user._id)
    return res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
}

export const getStats = async (req, res, next) => {
  try {
    const data = await getSellerStats(req.user._id)
    return res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
}

export const getPayouts = async (req, res, next) => {
  try {
    const { page, limit } = req.query
    const data = await getSellerPayouts(req.user._id, { page: Number(page) || 1, limit: Number(limit) || 20 })
    return res.json({ success: true, ...data })
  } catch (error) {
    next(error)
  }
}
