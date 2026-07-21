import Order from '../models/Order.js'
import MembershipCycle from '../models/MembershipCycle.js'
import CheckIn from '../models/CheckIn.js'
import Booking from '../models/Booking.js'
import PT from '../models/PT.js'
import Product from '../models/Product.js'

const toDateRange = (startDate, endDate) => {
  const now = new Date()
  const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1)
  const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

const toCSV = (columns, rows) => {
  const header = columns.join(',')
  const body = rows.map((row) => columns.map((col) => {
    const val = row[col]
    if (val == null) return ''
    const str = String(val)
    return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
  }).join(','))
  return `${header}\n${body.join('\n')}`
}

export const exportCSV = (columns, rows, filename) => ({ data: toCSV(columns, rows), filename, columns, rows })

export const getRevenueReport = async ({ startDate, endDate } = {}) => {
  const { start, end } = toDateRange(startDate, endDate)

  const [revenueAgg, dailyRevenue, topProducts] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 }, avgOrder: { $avg: '$totalAmount' } } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, paymentStatus: 'paid' } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, paymentStatus: 'paid' } },
      { $unwind: '$items' },
      { $group: { _id: '$items.productName', quantity: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]),
  ])

  return {
    summary: revenueAgg[0] || { total: 0, count: 0, avgOrder: 0 },
    daily: dailyRevenue.map((d) => ({ date: d._id, revenue: d.total, orders: d.count })),
    topProducts: topProducts.map((p) => ({ productName: p._id, quantity: p.quantity, revenue: p.revenue })),
  }
}

export const getMembershipReport = async ({ startDate, endDate } = {}) => {
  const { start, end } = toDateRange(startDate, endDate)

  const [active, newSignups, cancelled, byType, expiring] = await Promise.all([
    MembershipCycle.countDocuments({ status: 'active' }),
    MembershipCycle.countDocuments({ createdAt: { $gte: start, $lte: end }, status: { $ne: 'cancelled' } }),
    MembershipCycle.countDocuments({ createdAt: { $gte: start, $lte: end }, status: 'cancelled' }),
    MembershipCycle.aggregate([
      { $match: { status: { $in: ['active', 'pending_initial_activation'] } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    MembershipCycle.countDocuments({ status: 'active', expiresAt: { $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), $gte: new Date() } }),
  ])

  const byTypeObj = {}
  byType.forEach((t) => { byTypeObj[t._id] = t.count })

  return {
    totalActive: active,
    newSignups,
    cancelled,
    expiringSoon: expiring,
    byStatus: byTypeObj,
    renewalRate: (newSignups + cancelled) > 0 ? Math.round((newSignups / (newSignups + cancelled)) * 100) : 0,
  }
}

export const getCheckinReport = async ({ startDate, endDate } = {}) => {
  const { start, end } = toDateRange(startDate, endDate)

  const [totalCheckIns, uniqueMembers, dailyCheckIns, hourlyCheckIns] = await Promise.all([
    CheckIn.countDocuments({ checkinTime: { $gte: start, $lte: end }, status: 'success' }),
    CheckIn.distinct('memberId', { checkinTime: { $gte: start, $lte: end }, status: 'success' }),
    CheckIn.aggregate([
      { $match: { checkinTime: { $gte: start, $lte: end }, status: 'success' } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$checkinTime' } }, count: { $sum: 1 }, unique: { $addToSet: '$memberId' } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 1, count: 1, uniqueCount: { $size: '$unique' } } },
    ]),
    CheckIn.aggregate([
      { $match: { checkinTime: { $gte: start, $lte: end }, status: 'success' } },
      { $group: { _id: { $hour: { $add: ['$checkinTime', 7 * 60 * 60 * 1000] } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ])

  const totalDays = Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)))

  return {
    totalCheckIns,
    uniqueMembers: uniqueMembers.length,
    avgDaily: Math.round(totalCheckIns / totalDays),
    daily: dailyCheckIns.map((d) => ({ date: d._id, count: d.count, unique: d.uniqueCount })),
    peakHours: hourlyCheckIns.map((h) => ({ hour: h._id, count: h.count })),
  }
}

export const getTrainerReport = async ({ startDate, endDate } = {}) => {
  const { start, end } = toDateRange(startDate, endDate)

  const [trainers, bookingStats, allCheckIns] = await Promise.all([
    PT.find().populate('userId', 'name fullName').lean(),
    Booking.aggregate([
      { $match: { date: { $gte: start, $lte: end }, status: { $in: ['confirmed', 'completed'] } } },
      { $group: { _id: '$ptId', sessions: { $sum: 1 }, members: { $addToSet: '$memberId' } } },
      { $project: { _id: 1, sessions: 1, memberCount: { $size: '$members' } } },
    ]),
    CheckIn.find({ checkinTime: { $gte: start, $lte: end }, status: 'success' }).lean(),
  ])

  const trainerMap = new Map(trainers.map((t) => [String(t.userId?._id || t.userId), t]))

  const trainerStats = bookingStats.map((b) => ({
    trainerId: b._id,
    trainerName: trainerMap.get(String(b._id))?.userId?.fullName || trainerMap.get(String(b._id))?.userId?.name || '',
    sessions: b.sessions,
    members: b.memberCount,
  }))

  const ranked = trainerStats.sort((a, b) => b.sessions - a.sessions)

  return {
    trainers: ranked,
    totalSessions: ranked.reduce((s, t) => s + t.sessions, 0),
    totalCheckIns: allCheckIns.length,
  }
}

export const getProductReport = async ({ startDate, endDate } = {}) => {
  const { start, end } = toDateRange(startDate, endDate)

  const [salesAgg, lowStock] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, paymentStatus: 'paid' } },
      { $unwind: '$items' },
      { $group: {
        _id: '$items.productId',
        productName: { $first: '$items.productName' },
        unitsSold: { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
      } },
      { $sort: { unitsSold: -1 } },
      { $limit: 20 },
    ]),
    Product.find({ isActive: true }).select('name stock').lean(),
  ])

  const lowStockItems = lowStock
    .filter((p) => p.stock < 5)
    .map((p) => ({ productId: p._id, name: p.name, stock: p.stock }))

  return {
    totalUniqueProducts: salesAgg.length,
    topSelling: salesAgg.slice(0, 10).map((s) => ({
      productId: s._id,
      productName: s.productName,
      unitsSold: s.unitsSold,
      revenue: s.revenue,
    })),
    lowStock: lowStockItems,
  }
}
