import CheckIn from '../models/CheckIn.js'
import MembershipCycle from '../models/MembershipCycle.js'
import Booking from '../models/Booking.js'
import Order from '../models/Order.js'
import PT from '../models/PT.js'
import User from '../models/User.js'
import Shop from '../models/Shop.js'
import Product from '../models/Product.js'
import { calculateStreak } from './streakService.js'

const todayStart = (now) => new Date(now.getFullYear(), now.getMonth(), now.getDate())
const monthStart = (now) => new Date(now.getFullYear(), now.getMonth(), 1)
const tomorrowStart = (now) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

export const getAdminDashboard = async () => {
  const now = new Date()
  const today = todayStart(now)
  const month = monthStart(now)
  const tomorrow = tomorrowStart(now)
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const [
    activeMembers,
    totalActive,
    todayCheckIns,
    todayUniqueMembers,
    monthCheckIns,
    expiringMemberships,
    totalPTs,
    todayBookings,
    recentCheckIns,
    todayRevenue,
    monthRevenue,
    totalOrders,
  ] = await Promise.all([
    MembershipCycle.countDocuments({ status: 'active' }),
    MembershipCycle.countDocuments({ status: { $in: ['active', 'pending_initial_activation'] } }),
    CheckIn.countDocuments({ checkinTime: { $gte: today }, status: 'success' }),
    CheckIn.distinct('memberId', { checkinTime: { $gte: today }, status: 'success' }),
    CheckIn.countDocuments({ checkinTime: { $gte: month }, status: 'success' }),
    MembershipCycle.countDocuments({ status: 'active', expiresAt: { $lte: sevenDays, $gte: now } }),
    PT.countDocuments(),
    Booking.countDocuments({ date: { $gte: today, $lt: tomorrow }, status: 'confirmed' }),
    CheckIn.find({ status: 'success' }).sort({ checkinTime: -1 }).limit(10).populate('memberId', 'name fullName memberCode').lean(),
    Order.aggregate([{ $match: { createdAt: { $gte: today }, paymentStatus: 'paid' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    Order.aggregate([{ $match: { createdAt: { $gte: month }, paymentStatus: 'paid' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    Order.countDocuments(),
  ])

  return {
    memberships: { totalActive, activeMembers, expiringMemberships },
    checkIns: { today: todayCheckIns, todayUnique: todayUniqueMembers.length, thisMonth: monthCheckIns },
    revenue: { today: todayRevenue[0]?.total || 0, thisMonth: monthRevenue[0]?.total || 0 },
    trainers: { total: totalPTs },
    bookings: { todayConfirmed: todayBookings },
    orders: { total: totalOrders },
    recentCheckIns: recentCheckIns.map((c) => ({
      _id: c._id,
      checkinTime: c.checkinTime,
      memberName: c.memberId?.fullName || c.memberId?.name || '',
      memberCode: c.memberId?.memberCode || '',
      streakDay: c.streakDay,
    })),
  }
}

export const getStaffDashboard = async () => {
  const now = new Date()
  const today = todayStart(now)

  const [todayCheckIns, activeMembers, recentCheckIns] = await Promise.all([
    CheckIn.countDocuments({ checkinTime: { $gte: today }, status: 'success' }),
    MembershipCycle.countDocuments({ status: 'active' }),
    CheckIn.find({ status: 'success' }).sort({ checkinTime: -1 }).limit(10).populate('memberId', 'name fullName memberCode').lean(),
  ])

  return {
    todayCheckIns,
    activeMembers,
    recentCheckIns: recentCheckIns.map((c) => ({
      _id: c._id,
      checkinTime: c.checkinTime,
      memberName: c.memberId?.fullName || c.memberId?.name || '',
      memberCode: c.memberId?.memberCode || '',
      streakDay: c.streakDay,
    })),
  }
}

export const getPTDashboard = async (userId) => {
  const now = new Date()
  const today = todayStart(now)
  const tomorrow = tomorrowStart(now)

  const [assignedMembersArr, todayBookings, upcomingBookings] = await Promise.all([
    Booking.distinct('memberId', { ptId: userId, status: 'confirmed' }),
    Booking.countDocuments({ ptId: userId, date: { $gte: today, $lt: tomorrow }, status: { $ne: 'cancelled' } }),
    Booking.find({ ptId: userId, date: { $gte: today }, status: { $ne: 'cancelled' } })
      .sort({ date: 1 })
      .limit(5)
      .populate('memberId', 'name fullName memberCode')
      .lean(),
  ])

  return {
    assignedMembers: assignedMembersArr.length,
    todayBookings,
    upcomingBookings: upcomingBookings.map((b) => ({
      _id: b._id,
      date: b.date,
      slot: b.slot,
      status: b.status,
      memberName: b.memberId?.fullName || b.memberId?.name || '',
      memberCode: b.memberId?.memberCode || '',
    })),
  }
}

export const getMemberDashboard = async (userId) => {
  const now = new Date()
  const month = monthStart(now)

  const [totalCheckIns, monthCheckIns, streak, membership, recentCheckIns, recentOrders] = await Promise.all([
    CheckIn.countDocuments({ memberId: userId, status: 'success' }),
    CheckIn.countDocuments({ memberId: userId, checkinTime: { $gte: month }, status: 'success' }),
    calculateStreak(userId),
    MembershipCycle.findOne({
      memberId: userId,
      status: { $in: ['active', 'pending_initial_activation', 'pending_renewal_activation'] },
    }).populate('currentPlanId', 'nameVi nameEn durationDays price').sort({ createdAt: -1 }).lean(),
    CheckIn.find({ memberId: userId, status: 'success' }).sort({ checkinTime: -1 }).limit(5).lean(),
    Order.find({ userId, hiddenForUser: { $ne: true } }).sort({ createdAt: -1 }).limit(5).select('orderNumber totalAmount status createdAt').lean(),
  ])

  return {
    checkIns: { total: totalCheckIns, thisMonth: monthCheckIns, streak },
    membership: membership ? {
      planName: membership.currentPlanId?.nameVi || membership.currentPlanId?.nameEn || '',
      status: membership.status,
      expiresAt: membership.expiresAt,
      durationDays: membership.durationDays,
    } : null,
    recentCheckIns: recentCheckIns.map((c) => ({
      checkinTime: c.checkinTime,
      streakDay: c.streakDay,
    })),
    recentOrders: recentOrders,
  }
}

export const getSellerDashboard = async (userId) => {
  const shop = await User.findById(userId).select('shopId').lean()
  if (!shop?.shopId) {
    return { shopFound: false }
  }

  const shopId = shop.shopId

  const [shopDoc, productCount, orderCount, revenueAgg, pendingOrders, activeOrders, payoutTotal] = await Promise.all([
    Shop.findById(shopId).select('name rating reviewCount').lean(),
    Product.countDocuments({ shop_id: shopId, isActive: true }),
    Order.countDocuments({ shopId }),
    Order.aggregate([
      { $match: { shopId, paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, escrow: { $sum: { $cond: ['$escrowReleased', 0, '$sellerEscrowAmount'] } } } },
    ]),
    Order.countDocuments({ shopId, status: 'CHỜ XÁC NHẬN' }),
    Order.countDocuments({ shopId, status: 'ĐANG GIAO HÀNG' }),
    Order.aggregate([
      { $match: { shopId, escrowReleased: true } },
      { $group: { _id: null, total: { $sum: '$sellerEscrowAmount' } } },
    ]),
  ])

  return {
    shopFound: true,
    shop: shopDoc,
    productCount,
    orderCount,
    pendingOrders,
    activeOrders,
    totalRevenue: revenueAgg[0]?.total || 0,
    pendingEscrow: revenueAgg[0]?.escrow || 0,
    releasedPayouts: payoutTotal[0]?.total || 0,
  }
}
