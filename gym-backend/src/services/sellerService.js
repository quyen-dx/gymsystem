import Order from '../models/Order.js'
import Product from '../models/Product.js'
import SellerPayout from '../models/SellerPayout.js'
import Shop from '../models/Shop.js'
import User from '../models/User.js'
import AppError from '../utils/appError.js'

const getSellerShopId = async (userId) => {
  const user = await User.findById(userId).select('shopId').lean()
  if (!user?.shopId) {
    throw new AppError('Bạn chưa có shop', 400)
  }
  return user.shopId
}

export const getSellerRevenue = async (userId) => {
  const shopId = await getSellerShopId(userId)
  const orders = await Order.find({ shopId }).select('sellerEscrowAmount escrowReleased status createdAt').lean()

  const totalRevenue = orders.reduce((sum, o) => sum + (o.sellerEscrowAmount || 0), 0)
  const pendingEscrow = orders
    .filter((o) => !o.escrowReleased)
    .reduce((sum, o) => sum + (o.sellerEscrowAmount || 0), 0)
  const releasedEscrow = orders
    .filter((o) => o.escrowReleased)
    .reduce((sum, o) => sum + (o.sellerEscrowAmount || 0), 0)

  const periodStats = {}
  for (const o of orders) {
    const month = new Date(o.createdAt).toISOString().slice(0, 7)
    if (!periodStats[month]) {
      periodStats[month] = { revenue: 0, orders: 0 }
    }
    periodStats[month].revenue += o.sellerEscrowAmount || 0
    periodStats[month].orders += 1
  }

  return { totalRevenue, pendingEscrow, releasedEscrow, periodStats }
}

export const getSellerStats = async (userId) => {
  const shopId = await getSellerShopId(userId)

  const productCount = await Product.countDocuments({ shop_id: shopId, isActive: true })
  const orderCount = await Order.countDocuments({ shopId })
  const pendingOrders = await Order.countDocuments({ shopId, status: 'CHỜ XÁC NHẬN' })
  const shippingOrders = await Order.countDocuments({ shopId, status: 'ĐANG GIAO HÀNG' })
  const deliveredOrders = await Order.countDocuments({ shopId, status: 'GIAO THÀNH CÔNG' })
  const cancelledOrders = await Order.countDocuments({ shopId, status: 'ĐÃ HỦY' })

  const revenue = await Order.aggregate([
    { $match: { shopId } },
    { $group: { _id: null, total: { $sum: '$sellerEscrowAmount' }, released: { $sum: { $cond: ['$escrowReleased', '$sellerEscrowAmount', 0] } } } },
  ]).then((r) => r[0] || { total: 0, released: 0 })

  const shop = await Shop.findById(shopId).select('rating reviewCount name').lean()

  return {
    productCount,
    orderCount,
    pendingOrders,
    shippingOrders,
    deliveredOrders,
    cancelledOrders,
    totalRevenue: revenue.total || 0,
    releasedRevenue: revenue.released || 0,
    shopRating: shop?.rating || 0,
    shopReviewCount: shop?.reviewCount || 0,
    shopName: shop?.name || '',
  }
}

export const getSellerPayouts = async (userId, { page = 1, limit = 20 } = {}) => {
  const payouts = await SellerPayout.find({ sellerId: userId })
    .populate('orderId', 'orderNumber totalAmount status')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean()

  const total = await SellerPayout.countDocuments({ sellerId: userId })

  return {
    payouts,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  }
}
