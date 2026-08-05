import mongoose from 'mongoose'
import Payment from '../models/Payment.js'
import Transaction from '../models/Transaction.js'
import Order from '../models/Order.js'
import Booking from '../models/Booking.js'
import User from '../models/User.js'
import PT from '../models/PT.js'
import PTAssignment from '../models/PTAssignment.js'
import SessionFeedback from '../models/SessionFeedback.js'
import CheckIn from '../models/CheckIn.js'
import ClassEnrollment from '../models/ClassEnrollment.js'
import TrainingClass from '../models/TrainingClass.js'
import ShiftChangeRequest from '../models/ShiftChangeRequest.js'
import RefundRequest from '../models/RefundRequest.js'
import MembershipPeriod from '../models/MembershipPeriod.js'
import MembershipCycle from '../models/MembershipCycle.js'
import MembershipCancellationRequest from '../models/MembershipCancellationRequest.js'
import PlanChangeHistory from '../models/PlanChangeHistory.js'
import Plan from '../models/Plan.js'
import Shop from '../models/Shop.js'
import Product from '../models/Product.js'
import Wallet from '../models/Wallet.js'
import UserActivity from '../models/UserActivity.js'
import { getDisplayName } from '../utils/displayName.js'

const DAY_MS = 86400000
const TZ = '+07:00'

const PAID_PAYMENT_STATUSES = { $in: ['PAID', 'paid'] }
const COMPLETED_TXN = { $in: ['completed', 'COMPLETED'] }

const startOfDay = (ts) => {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d
}

export const resolveRange = ({ range = '30d', from, to } = {}) => {
  const now = Date.now()
  let start
  let end = now
  switch (range) {
    case 'today':
      start = startOfDay(now).getTime()
      break
    case '7d':
      start = now - 7 * DAY_MS
      break
    case '30d':
      start = now - 30 * DAY_MS
      break
    case 'quarter': {
      const d = new Date()
      const qm = Math.floor(d.getMonth() / 3) * 3
      start = new Date(d.getFullYear(), qm, 1).getTime()
      break
    }
    case 'year':
      start = new Date(new Date().getFullYear(), 0, 1).getTime()
      break
    default:
      if (from && to) {
        start = new Date(from).getTime()
        end = new Date(to).getTime()
      } else {
        start = now - 30 * DAY_MS
      }
  }
  if (end - start <= 0) start = end - DAY_MS
  const prevEnd = start
  const prevStart = start - (end - start)
  return {
    from: new Date(start),
    to: new Date(end),
    prevFrom: new Date(prevStart),
    prevTo: new Date(prevEnd),
    label: RANGE_LABELS[range] || 'Tùy chọn',
  }
}

// Áp dụng bộ lọc ngày/giờ từ click trên biểu đồ.
// Hỗ trợ: "YYYY-MM-DD" (ngày), "YYYY-MM" (tháng), timestamp (ms), hoặc chuỗi ngày ISO.
const applyDateFilter = (date, timestamp, r) => {
  const raw = date ?? timestamp
  if (raw === undefined || raw === null || raw === '') return r
  const str = String(raw)
  let from
  let to
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    from = startOfDay(new Date(`${str}T00:00:00`))
    to = new Date(from.getTime() + DAY_MS)
  } else if (/^\d{4}-\d{2}$/.test(str)) {
    const [y, m] = str.split('-').map(Number)
    from = new Date(y, m - 1, 1)
    to = new Date(y, m, 1)
  } else if (/^\d+$/.test(str)) {
    from = startOfDay(Number(str))
    to = new Date(from.getTime() + DAY_MS)
  } else {
    const d = new Date(str)
    if (Number.isNaN(d.getTime())) return r
    from = startOfDay(d)
    to = new Date(from.getTime() + DAY_MS)
  }
  return { ...r, from, to }
}

const RANGE_LABELS = {
  today: 'Hôm nay',
  '7d': '7 ngày',
  '30d': '30 ngày',
  quarter: 'Quý này',
  year: 'Năm nay',
}

const fmtMoney = (n) => Number(n || 0).toLocaleString('vi-VN')

const sum = (arr) => arr.reduce((s, v) => s + (Number(v) || 0), 0)

const pct = (cur, prev) => {
  if (!prev) return cur > 0 ? 100 : 0
  return Math.round(((cur - prev) / prev) * 1000) / 10
}

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

const monthLabels = (from, to) => {
  const out = []
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1)
  const endM = new Date(to.getFullYear(), to.getMonth(), 1)
  while (cursor <= endM) {
    out.push(monthKey(cursor))
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return out
}

const dayLabels = (from, to) => {
  const out = []
  let cursor = startOfDay(from)
  const end = startOfDay(to)
  while (cursor <= end) {
    out.push(new Date(cursor))
    cursor = new Date(cursor.getTime() + DAY_MS)
  }
  return out
}

const fmtDay = (d) => d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })

const fmtMonthShort = (key) => {
  const [y, m] = key.split('-').map(Number)
  return `${m}/${String(y).slice(2)}`
}

const fmtMonthLong = (key) => {
  const [y, m] = key.split('-').map(Number)
  const names = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12']
  return `${names[m - 1]} ${y}`
}

const fillDaily = (rows, from, to, { valueKey = 'total', keyName = '_id' } = {}) => {
  const map = new Map(rows.map((r) => [r[keyName], r[valueKey] || 0]))
  const labels = []
  const data = []
  const keys = []
  for (const d of dayLabels(from, to)) {
    const k = d.toISOString().slice(0, 10)
    labels.push(fmtDay(d))
    data.push(map.get(k) || 0)
    keys.push(k)
  }
  return { labels, data, keys }
}

const fillMonthly = (rows, from, to) => {
  const map = new Map(rows.map((r) => [r._id, r.total || 0]))
  const labels = []
  const data = []
  const keys = []
  for (const k of monthLabels(from, to)) {
    labels.push(fmtMonthShort(k))
    data.push(map.get(k) || 0)
    keys.push(k)
  }
  return { labels, data, keys }
}

const dateStrKey = {
  $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ },
}

// ---------------------------------------------------------------------------
// Series / KPI helpers
// ---------------------------------------------------------------------------

const dailySeries = async (Model, match, sumField, { from, to }) => {
  const rows = await Model.aggregate([
    { $match: { ...match, createdAt: { $gte: from, $lt: to } } },
    { $group: { _id: dateStrKey, total: { $sum: `$${sumField}` } } },
    { $sort: { _id: 1 } },
  ])
  return fillDaily(rows, from, to)
}

const countSeries = async (Model, match, { from, to }) => {
  const rows = await Model.aggregate([
    { $match: { ...match, createdAt: { $gte: from, $lt: to } } },
    { $group: { _id: dateStrKey, total: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ])
  return fillDaily(rows, from, to)
}

const countInRange = async (Model, match, { from, to }) => {
  const where = { ...match }
  if (from) where.createdAt = { $gte: from, $lt: to }
  return Model.countDocuments(where)
}

const sumInRange = async (Model, match, field, { from, to }) => {
  const where = { ...match }
  if (from) where.createdAt = { $gte: from, $lt: to }
  const res = await Model.aggregate([
    { $match: where },
    { $group: { _id: null, total: { $sum: `$${field}` } } },
  ])
  return res[0]?.total || 0
}

// ---------------------------------------------------------------------------
// Revenue streams (membership payments, shop orders, wallet deposits, refunds)
// ---------------------------------------------------------------------------

const collectRevenueStreams = async ({ from, to }) => {
  const [membership, shop, deposit, refund] = await Promise.all([
    Payment.aggregate([
      { $match: { status: PAID_PAYMENT_STATUSES, createdAt: { $gte: from, $lt: to } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: from, $lt: to } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]),
    Transaction.aggregate([
      { $match: { status: COMPLETED_TXN, type: 'deposit', createdAt: { $gte: from, $lt: to } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Transaction.aggregate([
      { $match: { status: COMPLETED_TXN, type: { $in: ['refund', 'REFUND_TO_WALLET'] }, createdAt: { $gte: from, $lt: to } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ])
  return {
    membership: membership[0]?.total || 0,
    shop: shop[0]?.total || 0,
    deposit: deposit[0]?.total || 0,
    refund: refund[0]?.total || 0,
    membershipCount: membership[0]?.count || 0,
    shopCount: shop[0]?.count || 0,
    depositCount: deposit[0]?.count || 0,
  }
}

// ---------------------------------------------------------------------------
// Summary (module cards for Statistics Home)
// ---------------------------------------------------------------------------

export const getSummary = async ({ range = '30d', from, to } = {}) => {
  const r = resolveRange({ range, from, to })
  const [revenue, prevRevenue, membersTotal, newMembers, newMembersPrev, ptsTotal, bookingsTotal, shopsTotal, shopRevenue, usersTotal] = await Promise.all([
    collectRevenueStreams({ from: r.from, to: r.to }),
    collectRevenueStreams({ from: r.prevFrom, to: r.prevTo }),
    User.countDocuments({ role: 'member' }),
    countInRange(User, { role: 'member' }, { from: r.from, to: r.to }),
    countInRange(User, { role: 'member' }, { from: r.prevFrom, to: r.prevTo }),
    PT.countDocuments(),
    countInRange(Booking, {}, { from: r.from, to: r.to }),
    Shop.countDocuments(),
    sumInRange(Order, { paymentStatus: 'paid' }, 'totalAmount', { from: r.from, to: r.to }),
    User.countDocuments(),
  ])

  const curRevenue = revenue.membership + revenue.shop + revenue.deposit
  const prevTotal = prevRevenue.membership + prevRevenue.shop + prevRevenue.deposit

  const modules = [
    {
      key: 'finance',
      label: 'Tài chính',
      description: 'Doanh thu, giao dịch, hoàn tiền & lợi nhuận',
      icon: 'finance',
      color: '#16a34a',
      value: curRevenue,
      displayValue: `${fmtMoney(curRevenue)}đ`,
      delta: pct(curRevenue, prevTotal),
      hint: `${fmtMoney(revenue.refund)}đ hoàn tiền trong kỳ`,
      route: '/admin/reports/finance',
    },
    {
      key: 'members',
      label: 'Hội viên',
      description: 'Đăng ký, gia hạn, check-in & hoạt động',
      icon: 'members',
      color: '#3b82f6',
      value: membersTotal,
      displayValue: membersTotal.toLocaleString('vi-VN'),
      delta: pct(newMembers, newMembersPrev),
      hint: `+${newMembers} hội viên mới trong kỳ`,
      route: '/admin/reports/members',
    },
    {
      key: 'pt',
      label: 'Huấn luyện viên',
      description: 'Booking, lớp học, đánh giá & doanh thu PT',
      icon: 'pt',
      color: '#8b5cf6',
      value: ptsTotal,
      displayValue: ptsTotal.toLocaleString('vi-VN'),
      delta: null,
      hint: `${bookingsTotal} booking trong kỳ`,
      route: '/admin/reports/pt',
    },
    {
      key: 'booking',
      label: 'Booking & Lớp học',
      description: 'Đặt lịch, lớp mở, tỷ lệ hủy',
      icon: 'booking',
      color: '#f59e0b',
      value: bookingsTotal,
      displayValue: bookingsTotal.toLocaleString('vi-VN'),
      delta: null,
      hint: 'Đặt lịch & lớp học trong kỳ',
      route: '/admin/reports/booking',
    },
    {
      key: 'shop',
      label: 'Shop',
      description: 'Doanh thu, đơn hàng & sản phẩm',
      icon: 'shop',
      color: '#ec4899',
      value: shopRevenue,
      displayValue: `${fmtMoney(shopRevenue)}đ`,
      delta: null,
      hint: `${shopsTotal} shop đang hoạt động`,
      route: '/admin/reports/shop',
    },
    {
      key: 'system',
      label: 'Hệ thống',
      description: 'Người dùng, vai trò & hoạt động hệ thống',
      icon: 'system',
      color: '#64748b',
      value: usersTotal,
      displayValue: usersTotal.toLocaleString('vi-VN'),
      delta: null,
      hint: 'Tổng người dùng hệ thống',
      route: '/admin/reports/system',
    },
  ]

  return { range: r, modules }
}

// ---------------------------------------------------------------------------
// Finance
// ---------------------------------------------------------------------------

export const getFinance = async ({ range = '30d', from, to } = {}) => {
  const r = resolveRange({ range, from, to })
  const [cur, prev, refundRows] = await Promise.all([
    collectRevenueStreams({ from: r.from, to: r.to }),
    collectRevenueStreams({ from: r.prevFrom, to: r.prevTo }),
    Transaction.aggregate([
      { $match: { status: COMPLETED_TXN, type: { $in: ['refund', 'REFUND_TO_WALLET'] }, createdAt: { $gte: r.from, $lt: r.to } } },
      { $group: { _id: dateStrKey, total: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]),
  ])

  const revenue = cur.membership + cur.shop + cur.deposit
  const prevRevenue = prev.membership + prev.shop + prev.deposit
  const txCount = cur.membershipCount + cur.shopCount + cur.depositCount
  const days = Math.max(1, Math.ceil((r.to - r.from) / DAY_MS))

  // Daily revenue series (all streams combined)
  const [membershipDaily, shopDaily, depositDaily] = await Promise.all([
    dailySeries(Payment, { status: PAID_PAYMENT_STATUSES }, 'amount', { from: r.from, to: r.to }),
    dailySeries(Order, { paymentStatus: 'paid' }, 'totalAmount', { from: r.from, to: r.to }),
    dailySeries(Transaction, { status: COMPLETED_TXN, type: 'deposit' }, 'amount', { from: r.from, to: r.to }),
  ])
  const revenueLabels = membershipDaily.labels
  const revenueByDay = revenueLabels.map((_, i) => membershipDaily.data[i] + shopDaily.data[i] + depositDaily.data[i])

  // Monthly revenue (12 months)
  const monthFrom = new Date(r.to.getTime() - 11 * 30 * DAY_MS)
  const [mPay, mShop, mDep] = await Promise.all([
    Payment.aggregate([
      { $match: { status: PAID_PAYMENT_STATUSES, createdAt: { $gte: monthFrom, $lt: r.to } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: TZ } }, total: { $sum: '$amount' } } },
    ]),
    Order.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: monthFrom, $lt: r.to } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: TZ } }, total: { $sum: '$totalAmount' } } },
    ]),
    Transaction.aggregate([
      { $match: { status: COMPLETED_TXN, type: 'deposit', createdAt: { $gte: monthFrom, $lt: r.to } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: TZ } }, total: { $sum: '$amount' } } },
    ]),
  ])
  const monthMap = new Map()
  for (const x of [...mPay, ...mShop, ...mDep]) {
    monthMap.set(x._id, (monthMap.get(x._id) || 0) + x.total)
  }
  const monthLabelsArr = monthLabels(monthFrom, r.to)
  const monthlyData = monthLabelsArr.map((k) => monthMap.get(k) || 0)

  // Revenue by plan (membership)
  const planRevenue = await Payment.aggregate([
    { $match: { status: PAID_PAYMENT_STATUSES, createdAt: { $gte: r.from, $lt: r.to }, planId: { $ne: null } } },
    { $lookup: { from: 'plans', localField: 'planId', foreignField: '_id', as: 'plan' } },
    { $match: { 'plan.0': { $exists: true } } },
    { $unwind: '$plan' },
    { $group: { _id: '$plan._id', name: { $first: '$plan.nameVi' }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
    { $limit: 8 },
  ])

  // Revenue by shop
  const shopRevenueAgg = await Order.aggregate([
    { $match: { paymentStatus: 'paid', createdAt: { $gte: r.from, $lt: r.to } } },
    { $lookup: { from: 'shops', localField: 'shopId', foreignField: '_id', as: 'shop' } },
    { $unwind: { path: '$shop', preserveNullAndEmptyArrays: true } },
    { $group: { _id: '$shopId', name: { $first: { $ifNull: ['$shop.name', 'Shop không tên'] } }, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
    { $limit: 6 },
  ])

  // Top members by spend (payments + orders)
  const [topMembersPayment, topMembersOrder] = await Promise.all([
    Payment.aggregate([
      { $match: { status: PAID_PAYMENT_STATUSES, createdAt: { $gte: r.from, $lt: r.to } } },
      { $group: { _id: '$userId', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: r.from, $lt: r.to } } },
      { $group: { _id: '$userId', total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]),
  ])
  const spendMap = new Map()
  for (const grp of [topMembersPayment, topMembersOrder]) {
    for (const row of grp) {
      const prev = spendMap.get(String(row._id)) || { total: 0, count: 0 }
      spendMap.set(String(row._id), { total: prev.total + row.total, count: prev.count + row.count })
    }
  }
  const topMembers = []
  for (const [id, val] of spendMap.entries()) {
    topMembers.push({ _id: id, ...val })
  }
  topMembers.sort((a, b) => b.total - a.total)
  const topMemberIds = topMembers.slice(0, 10).map((m) => m._id)
  const memberUsers = topMemberIds.length
    ? await User.find({ _id: { $in: topMemberIds } }).select('fullName name username email phone').lean()
    : []
  const userMap = new Map(memberUsers.map((u) => [String(u._id), u]))
  const topMemberRows = topMembers.slice(0, 10).map((m) => ({
    id: m._id,
    label: getDisplayName(userMap.get(m._id), 'Hội viên'),
    value: m.total,
    sub: `${m.count} giao dịch`,
  }))

  const kpis = [
    { key: 'totalRevenue', label: 'Tổng doanh thu', value: revenue, delta: pct(revenue, prevRevenue), format: 'money', icon: 'revenue', sparkline: revenueByDay },
    { key: 'transactions', label: 'Tổng giao dịch', value: txCount, delta: pct(txCount, prev.membershipCount + prev.shopCount + prev.depositCount), format: 'number', icon: 'orders', sparkline: [] },
    { key: 'refunds', label: 'Tổng hoàn tiền', value: cur.refund, delta: null, format: 'money', icon: 'refund', sparkline: refundRows.map((x) => x.total) },
    { key: 'avgPerDay', label: 'Doanh thu TB/ngày', value: Math.round(revenue / days), delta: pct(revenue / days, prevRevenue / days), format: 'money', icon: 'avg', sparkline: [] },
  ]

  return {
    range: r,
    kpis,
    charts: {
      revenueByDay: {
        type: 'area',
        title: 'Doanh thu theo ngày',
        labels: revenueLabels,
        pointKeys: membershipDaily.keys,
        series: [{ name: 'Doanh thu', data: revenueByDay }],
      },
      revenueByMonth: {
        type: 'bar',
        title: 'Doanh thu theo tháng (12 tháng)',
        labels: monthLabelsArr.map(fmtMonthShort),
        pointKeys: monthLabelsArr,
        series: [{ name: 'Doanh thu', data: monthlyData }],
      },
      revenueSource: {
        type: 'pie',
        title: 'Cơ cấu nguồn thu',
        labels: ['Gói tập', 'Shop', 'Nạp ví'],
        series: [{ name: 'Nguồn thu', data: [cur.membership, cur.shop, cur.deposit] }],
      },
      revenueByPlan: {
        type: 'bar',
        title: 'Doanh thu theo gói tập',
        labels: planRevenue.map((p) => p.name),
        pointKeys: planRevenue.map((p) => String(p._id)),
        series: [{ name: 'Doanh thu', data: planRevenue.map((p) => p.total) }],
      },
      revenueByShop: {
        type: 'bar',
        title: 'Doanh thu theo shop',
        labels: shopRevenueAgg.map((s) => s.name),
        pointKeys: shopRevenueAgg.map((s) => String(s._id)),
        series: [{ name: 'Doanh thu', data: shopRevenueAgg.map((s) => s.total) }],
      },
    },
    tops: {
      topPlans: {
        title: 'Top gói bán chạy',
        items: planRevenue.map((p) => ({ id: p._id, label: p.name, value: p.total, sub: `${p.count} lượt mua`, color: '#3b82f6' })),
      },
      topShops: {
        title: 'Top shop doanh thu',
        items: shopRevenueAgg.map((s) => ({ id: s._id, label: s.name, value: s.total, sub: `${s.count} đơn`, color: '#ec4899' })),
      },
      topMembers: {
        title: 'Top hội viên chi nhiều',
        items: topMemberRows.map((m, i) => ({ ...m, color: i === 0 ? '#16a34a' : undefined })),
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export const getMembers = async ({ range = '30d', from, to } = {}) => {
  const r = resolveRange({ range, from, to })
  const [total, newNow, newPrev, renewNow, renewPrev, changesNow, cancelNow, checkInNow, checkInPrev, ptBookNow, ptBookPrev, enrollNow, enrollPrev, activeMembers] = await Promise.all([
    User.countDocuments({ role: 'member' }),
    countInRange(User, { role: 'member' }, { from: r.from, to: r.to }),
    countInRange(User, { role: 'member' }, { from: r.prevFrom, to: r.prevTo }),
    countInRange(MembershipPeriod, { status: 'ACTIVE' }, { from: r.from, to: r.to }),
    countInRange(MembershipPeriod, { status: 'ACTIVE' }, { from: r.prevFrom, to: r.prevTo }),
    countInRange(PlanChangeHistory, { changeType: { $in: ['change_plan', 'upgrade', 'downgrade'] } }, { from: r.from, to: r.to }),
    countInRange(MembershipCancellationRequest, { status: { $in: ['pending', 'approved'] } }, { from: r.from, to: r.to }),
    countInRange(CheckIn, { status: 'success' }, { from: r.from, to: r.to }),
    countInRange(CheckIn, { status: 'success' }, { from: r.prevFrom, to: r.prevTo }),
    countInRange(Booking, { status: { $in: ['confirmed', 'completed'] } }, { from: r.from, to: r.to }),
    countInRange(Booking, { status: { $in: ['confirmed', 'completed'] } }, { from: r.prevFrom, to: r.prevTo }),
    countInRange(ClassEnrollment, {}, { from: r.from, to: r.to }),
    countInRange(ClassEnrollment, {}, { from: r.prevFrom, to: r.prevTo }),
    User.countDocuments({ role: 'member', isActive: true, status: 'active' }),
  ])

  const [signupDaily, checkInDaily, cancelDaily, renewDaily] = await Promise.all([
    countSeries(User, { role: 'member' }, { from: r.from, to: r.to }),
    countSeries(CheckIn, { status: 'success' }, { from: r.from, to: r.to }),
    countSeries(MembershipCancellationRequest, { status: { $in: ['pending', 'approved'] } }, { from: r.from, to: r.to }),
    countSeries(MembershipPeriod, { status: 'ACTIVE' }, { from: r.from, to: r.to }),
  ])

  // Top most-active members (check-ins)
  const topCheckIn = await CheckIn.aggregate([
    { $match: { status: 'success', createdAt: { $gte: r.from, $lt: r.to } } },
    { $group: { _id: '$memberId', total: { $sum: 1 } } },
    { $sort: { total: -1 } },
    { $limit: 8 },
  ])
  // Top workout members (session feedback count)
  const topWorkout = await SessionFeedback.aggregate([
    { $match: { createdAt: { $gte: r.from, $lt: r.to } } },
    { $group: { _id: '$memberId', total: { $sum: 1 } } },
    { $sort: { total: -1 } },
    { $limit: 8 },
  ])
  // Top spending members
  const memberIdPool = [...new Set([...topCheckIn, ...topWorkout].map((x) => x._id))]
  const memberUsers = memberIdPool.length
    ? await User.find({ _id: { $in: memberIdPool } }).select('fullName name username email phone memberCode').lean()
    : []
  const userMap = new Map(memberUsers.map((u) => [String(u._id), u]))

  const enrichTop = (rows) => rows.map((row) => ({
    id: row._id,
    label: getDisplayName(userMap.get(String(row._id)), 'Hội viên'),
    sub: userMap.get(String(row._id))?.memberCode || userMap.get(String(row._id))?.phone || '',
    value: row.total,
    color: '#3b82f6',
  }))

  const kpis = [
    { key: 'total', label: 'Tổng hội viên', value: total, delta: null, format: 'number', icon: 'members', sparkline: [] },
    { key: 'new', label: 'Hội viên mới', value: newNow, delta: pct(newNow, newPrev), format: 'number', icon: 'new', sparkline: signupDaily.data },
    { key: 'active', label: 'Đang hoạt động', value: activeMembers, delta: null, format: 'number', icon: 'active', sparkline: [] },
    { key: 'renew', label: 'Gia hạn', value: renewNow, delta: pct(renewNow, renewPrev), format: 'number', icon: 'renew', sparkline: renewDaily.data },
    { key: 'changes', label: 'Đổi gói', value: changesNow, delta: null, format: 'number', icon: 'change', sparkline: [] },
    { key: 'cancels', label: 'Yêu cầu hủy', value: cancelNow, delta: null, format: 'number', icon: 'cancel', sparkline: cancelDaily.data },
    { key: 'checkins', label: 'Check-in', value: checkInNow, delta: pct(checkInNow, checkInPrev), format: 'number', icon: 'checkin', sparkline: checkInDaily.data },
    { key: 'ptBookings', label: 'Đặt lịch PT', value: ptBookNow, delta: pct(ptBookNow, ptBookPrev), format: 'number', icon: 'pt', sparkline: [] },
  ]

  return {
    range: r,
    kpis,
    charts: {
      growth: {
        type: 'line',
        title: 'Tăng trưởng hội viên mới',
        labels: signupDaily.labels,
        pointKeys: signupDaily.keys,
        series: [{ name: 'Hội viên mới', data: signupDaily.data }],
      },
      renewRate: {
        type: 'area',
        title: 'Gia hạn theo ngày',
        labels: renewDaily.labels,
        pointKeys: renewDaily.keys,
        series: [{ name: 'Gia hạn', data: renewDaily.data }],
      },
      cancelRate: {
        type: 'bar',
        title: 'Hủy membership theo ngày',
        labels: cancelDaily.labels,
        pointKeys: cancelDaily.keys,
        series: [{ name: 'Yêu cầu hủy', data: cancelDaily.data }],
      },
    },
    tops: {
      topWorkout: { title: 'Hội viên tập nhiều nhất', items: enrichTop(topWorkout), color: '#f59e0b' },
      topCheckIn: { title: 'Hội viên check-in nhiều nhất', items: enrichTop(topCheckIn), color: '#3b82f6' },
    },
  }
}

// ---------------------------------------------------------------------------
// PT
// ---------------------------------------------------------------------------

export const getPt = async ({ range = '30d', from, to } = {}) => {
  const r = resolveRange({ range, from, to })
  const [totalPt, activePt, bookingsNow, bookingsPrev, sessions, avgRatingAgg, assignments] = await Promise.all([
    User.countDocuments({ role: 'pt' }),
    User.countDocuments({ role: 'pt', isActive: true, status: 'active', availabilityStatus: 'ACTIVE' }),
    countInRange(Booking, {}, { from: r.from, to: r.to }),
    countInRange(Booking, {}, { from: r.prevFrom, to: r.prevTo }),
    countInRange(SessionFeedback, {}, { from: r.from, to: r.to }),
    Booking.aggregate([
      { $match: { rating: { $exists: true, $ne: null }, createdAt: { $gte: r.from, $lt: r.to } } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]),
    PTAssignment.countDocuments({ status: 'active' }),
  ])

  const [bookingByPt, cancelledByPt, shiftByPt, ratingByPt, sessionByPt, studentsByPt] = await Promise.all([
    Booking.aggregate([
      { $match: { createdAt: { $gte: r.from, $lt: r.to }, status: { $in: ['confirmed', 'completed', 'pending'] } } },
      { $group: { _id: '$ptId', total: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 8 },
    ]),
    Booking.aggregate([
      { $match: { createdAt: { $gte: r.from, $lt: r.to }, status: 'cancelled' } },
      { $group: { _id: '$ptId', total: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 8 },
    ]),
    ShiftChangeRequest.aggregate([
      { $match: { createdAt: { $gte: r.from, $lt: r.to } } },
      { $group: { _id: '$requestingPtId', total: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 8 },
    ]),
    Booking.aggregate([
      { $match: { createdAt: { $gte: r.from, $lt: r.to }, rating: { $exists: true, $ne: null } } },
      { $group: { _id: '$ptId', total: { $avg: '$rating' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 8 },
    ]),
    SessionFeedback.aggregate([
      { $match: { createdAt: { $gte: r.from, $lt: r.to } } },
      { $group: { _id: '$ptId', total: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 8 },
    ]),
    PTAssignment.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$ptId', total: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 8 },
    ]),
  ])

  const ptIdPool = [...new Set([...bookingByPt, ...cancelledByPt, ...shiftByPt, ...ratingByPt, ...sessionByPt, ...studentsByPt].map((x) => x._id))]
  const ptUsers = ptIdPool.length
    ? await User.find({ _id: { $in: ptIdPool } }).select('fullName name username email').lean()
    : []
  const ptNameMap = new Map(ptUsers.map((u) => [String(u._id), getDisplayName(u, 'PT')]))

  const enrich = (rows, color) => rows.map((row) => ({
    id: row._id,
    label: ptNameMap.get(String(row._id)) || 'PT',
    value: row.total,
    sub: `${row.total} lượt`,
    color,
  }))

  const kpis = [
    { key: 'total', label: 'Số PT', value: totalPt, delta: null, format: 'number', icon: 'pt', sparkline: [] },
    { key: 'active', label: 'PT đang hoạt động', value: activePt, delta: null, format: 'number', icon: 'active', sparkline: [] },
    { key: 'bookings', label: 'Tổng booking', value: bookingsNow, delta: pct(bookingsNow, bookingsPrev), format: 'number', icon: 'booking', sparkline: [] },
    { key: 'sessions', label: 'Số buổi dạy', value: sessions, delta: null, format: 'number', icon: 'session', sparkline: [] },
    { key: 'students', label: 'Học viên đang kèm', value: assignments, delta: null, format: 'number', icon: 'members', sparkline: [] },
    { key: 'rating', label: 'Đánh giá TB', value: Math.round((avgRatingAgg[0]?.avg || 0) * 10) / 10, delta: null, format: 'rating', icon: 'rating', sparkline: [] },
  ]

  return {
    range: r,
    kpis,
    charts: {
      bookingByPt: {
        type: 'bar',
        title: 'Booking theo PT',
        labels: bookingByPt.map((x) => ptNameMap.get(String(x._id)) || 'PT'),
        pointKeys: bookingByPt.map((x) => String(x._id)),
        series: [{ name: 'Booking', data: bookingByPt.map((x) => x.total) }],
      },
      ratingByPt: {
        type: 'line',
        title: 'Đánh giá theo PT',
        labels: ratingByPt.map((x) => ptNameMap.get(String(x._id)) || 'PT'),
        pointKeys: ratingByPt.map((x) => String(x._id)),
        series: [{ name: 'Điểm TB', data: ratingByPt.map((x) => Math.round(x.total * 10) / 10) }],
      },
    },
    tops: {
      topBooking: { title: 'PT nhiều booking nhất', items: enrich(bookingByPt, '#f59e0b') },
      topStudents: { title: 'PT nhiều học viên nhất', items: enrich(studentsByPt, '#3b82f6') },
      topRating: { title: 'PT đánh giá cao nhất', items: ratingByPt.map((row) => ({ id: row._id, label: ptNameMap.get(String(row._id)) || 'PT', value: Math.round(row.total * 10) / 10, sub: `${row.count} đánh giá`, color: '#8b5cf6' })) },
      topSessions: { title: 'PT nhiều giờ dạy nhất', items: enrich(sessionByPt, '#06b6d4') },
      topCancelled: { title: 'PT bị hủy nhiều nhất', items: enrich(cancelledByPt, '#ef4444') },
      topShiftChanges: { title: 'PT thay ca nhiều nhất', items: enrich(shiftByPt, '#64748b') },
    },
  }
}

// ---------------------------------------------------------------------------
// Booking & Classes
// ---------------------------------------------------------------------------

export const getBooking = async ({ range = '30d', from, to } = {}) => {
  const r = resolveRange({ range, from, to })
  const [totalNow, totalPrev, confirmedNow, cancelledNow, classesActive, classesWaiting, enrollments, waitlist] = await Promise.all([
    countInRange(Booking, {}, { from: r.from, to: r.to }),
    countInRange(Booking, {}, { from: r.prevFrom, to: r.prevTo }),
    countInRange(Booking, { status: { $in: ['confirmed', 'completed'] } }, { from: r.from, to: r.to }),
    countInRange(Booking, { status: 'cancelled' }, { from: r.from, to: r.to }),
    TrainingClass.countDocuments({ status: 'active' }),
    TrainingClass.countDocuments({ status: { $in: ['waiting_pt', 'waiting_accept'] } }),
    countInRange(ClassEnrollment, { status: 'active' }, { from: r.from, to: r.to }),
    countInRange(Booking, { status: 'pending' }, { from: r.from, to: r.to }),
  ])

  const [byDay, byPt, byHour, ratingByPt, enrollDaily] = await Promise.all([
    countSeries(Booking, {}, { from: r.from, to: r.to }),
    Booking.aggregate([
      { $match: { createdAt: { $gte: r.from, $lt: r.to } } },
      { $group: { _id: '$ptId', total: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 8 },
    ]),
    Booking.aggregate([
      { $match: { createdAt: { $gte: r.from, $lt: r.to } } },
      {
        $group: {
          _id: {
            $cond: [
              { $regexMatch: { input: { $toString: '$slot' }, regex: /^(\d{1,2})/ } },
              { $substrCP: ['$slot', 0, 2] },
              'Khác',
            ],
          },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Booking.aggregate([
      { $match: { rating: { $exists: true, $ne: null }, createdAt: { $gte: r.from, $lt: r.to } } },
      { $group: { _id: '$ptId', avg: { $avg: '$rating' } } },
      { $sort: { avg: -1 } },
      { $limit: 8 },
    ]),
    countSeries(ClassEnrollment, { status: 'active' }, { from: r.from, to: r.to }),
  ])

  const ptIdPool = [...new Set([...byPt, ...ratingByPt].map((x) => x._id))]
  const ptUsers = ptIdPool.length ? await User.find({ _id: { $in: ptIdPool } }).select('fullName name username email').lean() : []
  const ptNameMap = new Map(ptUsers.map((u) => [String(u._id), getDisplayName(u, 'PT')]))

  const hourRows = byHour.map((h) => ({ label: `${h._id}h`, value: h.total })).sort((a, b) => a.label.localeCompare(b.label))

  const kpis = [
    { key: 'total', label: 'Tổng booking', value: totalNow, delta: pct(totalNow, totalPrev), format: 'number', icon: 'booking', sparkline: byDay.data },
    { key: 'success', label: 'Booking thành công', value: confirmedNow, delta: null, format: 'number', icon: 'success', sparkline: [] },
    { key: 'cancelled', label: 'Booking hủy', value: cancelledNow, delta: null, format: 'number', icon: 'cancel', sparkline: [] },
    { key: 'classes', label: 'Lớp đang mở', value: classesActive, delta: null, format: 'number', icon: 'class', sparkline: [] },
    { key: 'waiting', label: 'Lớp chờ PT', value: classesWaiting, delta: null, format: 'number', icon: 'waiting', sparkline: [] },
    { key: 'enrollments', label: 'Học viên trong lớp', value: enrollments, delta: null, format: 'number', icon: 'members', sparkline: enrollDaily.data },
    { key: 'pending', label: 'Chờ thanh toán', value: waitlist, delta: null, format: 'number', icon: 'pending', sparkline: [] },
  ]

  const cancelRate = totalNow > 0 ? Math.round((cancelledNow / totalNow) * 1000) / 10 : 0

  return {
    range: r,
    kpis,
    charts: {
      bookingByDay: {
        type: 'line',
        title: 'Booking theo ngày',
        labels: byDay.labels,
        pointKeys: byDay.keys,
        series: [{ name: 'Booking', data: byDay.data }],
      },
      bookingByPt: {
        type: 'bar',
        title: 'Booking theo PT',
        labels: byPt.map((x) => ptNameMap.get(String(x._id)) || 'PT'),
        pointKeys: byPt.map((x) => String(x._id)),
        series: [{ name: 'Booking', data: byPt.map((x) => x.total) }],
      },
      bookingByHour: {
        type: 'bar',
        title: 'Booking theo giờ',
        labels: hourRows.map((h) => h.label),
        series: [{ name: 'Lượt đặt', data: hourRows.map((h) => h.value) }],
      },
      cancelRate: {
        type: 'pie',
        title: 'Tỷ lệ hủy booking',
        labels: [`Thành công (${confirmedNow})`, `Đã hủy (${cancelledNow})`],
        series: [{ name: 'Booking', data: [confirmedNow, cancelledNow] }],
      },
    },
    tops: {
      topBookedPt: {
        title: 'PT được đặt nhiều nhất',
        items: byPt.map((row) => ({ id: row._id, label: ptNameMap.get(String(row._id)) || 'PT', value: row.total, sub: `${row.total} booking`, color: '#f59e0b' })),
      },
      topRatedPt: {
        title: 'PT được đánh giá tốt nhất',
        items: ratingByPt.map((row) => ({ id: row._id, label: ptNameMap.get(String(row._id)) || 'PT', value: Math.round(row.avg * 10) / 10, sub: 'điểm TB', color: '#8b5cf6' })),
      },
      cancelRateTop: {
        title: 'Tỷ lệ hủy chung',
        items: [{ id: 'rate', label: 'Tỷ lệ hủy', value: cancelRate, sub: 'trên tổng booking', color: '#ef4444' }],
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Shop
// ---------------------------------------------------------------------------

export const getShop = async ({ range = '30d', from, to } = {}) => {
  const r = resolveRange({ range, from, to })
  const [revenueNow, revenuePrev, ordersNow, ordersPrev, totalShops, activeShops, lockedShops, newShops, newShopsPrev, totalProducts, totalSellers, totalOrders, failedOrders, deliveredCount] = await Promise.all([
    sumInRange(Order, { paymentStatus: 'paid' }, 'totalAmount', { from: r.from, to: r.to }),
    sumInRange(Order, { paymentStatus: 'paid' }, 'totalAmount', { from: r.prevFrom, to: r.prevTo }),
    countInRange(Order, { paymentStatus: 'paid' }, { from: r.from, to: r.to }),
    countInRange(Order, { paymentStatus: 'paid' }, { from: r.prevFrom, to: r.prevTo }),
    Shop.countDocuments(),
    Shop.countDocuments({ isActive: true }),
    Shop.countDocuments({ isActive: false }),
    countInRange(Shop, {}, { from: r.from, to: r.to }),
    countInRange(Shop, {}, { from: r.prevFrom, to: r.prevTo }),
    Product.countDocuments(),
    User.countDocuments({ role: 'seller' }),
    countInRange(Order, {}, { from: r.from, to: r.to }),
    countInRange(Order, { paymentStatus: 'failed' }, { from: r.from, to: r.to }),
    countInRange(Order, { paymentStatus: 'paid', status: 'GIAO THÀNH CÔNG' }, { from: r.from, to: r.to }),
  ])

  const [revDaily, byShop, byShopOrders, bySeller, prodRevenue, prodQty, mostReturned] = await Promise.all([
    dailySeries(Order, { paymentStatus: 'paid' }, 'totalAmount', { from: r.from, to: r.to }),
    Order.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: r.from, $lt: r.to } } },
      { $lookup: { from: 'shops', localField: 'shopId', foreignField: '_id', as: 'shop' } },
      { $unwind: { path: '$shop', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$shopId', name: { $first: { $ifNull: ['$shop.name', 'Shop'] } }, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 6 },
    ]),
    Order.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: r.from, $lt: r.to } } },
      { $lookup: { from: 'shops', localField: 'shopId', foreignField: '_id', as: 'shop' } },
      { $unwind: { path: '$shop', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$shopId', name: { $first: { $ifNull: ['$shop.name', 'Shop'] } }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]),
    Order.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: r.from, $lt: r.to } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.sellerId', total: { $sum: '$items.total' }, count: { $sum: '$items.quantity' } } },
      { $sort: { total: -1 } },
      { $limit: 6 },
    ]),
    Order.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: r.from, $lt: r.to } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.productName', total: { $sum: '$items.total' } } },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]),
    Order.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: r.from, $lt: r.to } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.productName', total: { $sum: '$items.quantity' } } },
      { $sort: { total: -1 } },
      { $limit: 6 },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: r.from, $lt: r.to }, paymentStatus: 'failed' } },
      { $unwind: '$items' },
      { $group: { _id: '$items.productName', total: { $sum: '$items.quantity' } } },
      { $sort: { total: -1 } },
      { $limit: 6 },
    ]),
  ])

  // Doanh thu theo tháng (12 tháng gần nhất)
  const monthFrom = new Date(r.to.getTime() - 11 * 30 * DAY_MS)
  const monthRows = await Order.aggregate([
    { $match: { paymentStatus: 'paid', createdAt: { $gte: monthFrom, $lt: r.to } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: TZ } }, total: { $sum: '$totalAmount' } } },
  ])
  const monthMap = new Map(monthRows.map((x) => [x._id, x.total]))
  const monthLabelsArr = monthLabels(monthFrom, r.to)
  const monthlyData = monthLabelsArr.map((k) => monthMap.get(k) || 0)

  // Categories from products
  const catAgg = await Product.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$category', total: { $sum: '$stock' } } },
    { $sort: { total: -1 } },
    { $limit: 8 },
  ])
  const catLabels = catAgg.map((c) => c._id || 'Khác')
  const catData = catAgg.map((c) => c.total)

  const sellerIdPool = bySeller.map((s) => s._id)
  const sellerUsers = sellerIdPool.length ? await User.find({ _id: { $in: sellerIdPool } }).select('fullName name username email').lean() : []
  const sellerNameMap = new Map(sellerUsers.map((u) => [String(u._id), getDisplayName(u, 'Seller')]))

  const avgOrderValue = ordersNow > 0 ? Math.round(revenueNow / ordersNow) : 0
  const returnRate = ordersNow > 0 ? Math.round(((ordersNow - deliveredCount) / ordersNow) * 1000) / 10 : 0
  const cancelRate = totalOrders > 0 ? Math.round((failedOrders / totalOrders) * 1000) / 10 : 0

  const kpis = [
    { key: 'revenue', label: 'Doanh thu Shop', value: revenueNow, delta: pct(revenueNow, revenuePrev), format: 'money', icon: 'revenue', sparkline: revDaily.data },
    { key: 'orders', label: 'Tổng đơn hàng', value: ordersNow, delta: pct(ordersNow, ordersPrev), format: 'number', icon: 'orders', sparkline: [] },
    { key: 'products', label: 'Tổng sản phẩm', value: totalProducts, delta: null, format: 'number', icon: 'product', sparkline: [] },
    { key: 'activeShops', label: 'Shop đang hoạt động', value: activeShops, delta: null, format: 'number', icon: 'shop', sparkline: [] },
    { key: 'lockedShops', label: 'Shop bị khóa', value: lockedShops, delta: null, format: 'number', icon: 'cancel', sparkline: [] },
    { key: 'newShops', label: 'Shop mới tham gia', value: newShops, delta: pct(newShops, newShopsPrev), format: 'number', icon: 'new', sparkline: [] },
    { key: 'avgOrderValue', label: 'Giá trị đơn TB', value: avgOrderValue, delta: null, format: 'money', icon: 'avg', sparkline: [] },
    { key: 'returnRate', label: 'Tỷ lệ hoàn đơn', value: returnRate, delta: null, format: 'percent', icon: 'return', sparkline: [] },
    { key: 'cancelRate', label: 'Tỷ lệ hủy đơn', value: cancelRate, delta: null, format: 'percent', icon: 'cancel', sparkline: [] },
  ]

  return {
    range: r,
    kpis,
    charts: {
      revenueByDay: {
        type: 'area',
        title: 'Doanh thu shop theo ngày',
        labels: revDaily.labels,
        pointKeys: revDaily.keys,
        series: [{ name: 'Doanh thu', data: revDaily.data }],
      },
      revenueByMonth: {
        type: 'bar',
        title: 'Doanh thu theo tháng (12 tháng)',
        labels: monthLabelsArr.map(fmtMonthShort),
        pointKeys: monthLabelsArr,
        series: [{ name: 'Doanh thu', data: monthlyData }],
      },
      revenueByShop: {
        type: 'bar',
        title: 'Doanh thu theo shop',
        labels: byShop.map((s) => s.name),
        pointKeys: byShop.map((s) => String(s._id)),
        series: [{ name: 'Doanh thu', data: byShop.map((s) => s.total) }],
      },
      revenueBySeller: {
        type: 'bar',
        title: 'Doanh thu theo seller',
        labels: bySeller.map((s) => sellerNameMap.get(String(s._id)) || 'Seller'),
        pointKeys: bySeller.map((s) => String(s._id)),
        series: [{ name: 'Doanh thu', data: bySeller.map((s) => s.total) }],
      },
      categoryShare: {
        type: 'pie',
        title: 'Doanh thu theo danh mục',
        labels: catLabels,
        pointKeys: catAgg.map((c) => String(c._id)),
        series: [{ name: 'Sản phẩm', data: catData }],
      },
      returnRate: {
        type: 'pie',
        title: 'Trạng thái đơn hàng',
        labels: [`Giao thành công (${deliveredCount})`, `Khác (${ordersNow - deliveredCount})`],
        series: [{ name: 'Đơn', data: [deliveredCount, ordersNow - deliveredCount] }],
      },
    },
    tops: {
      topSellingShops: { title: 'Shop bán nhiều nhất', items: byShopOrders.map((s) => ({ id: s._id, label: s.name, value: s.count, sub: `${s.count} đơn`, color: '#06b6d4' })) },
      topShops: { title: 'Shop doanh thu cao nhất', items: byShop.map((s) => ({ id: s._id, label: s.name, value: s.total, sub: `${s.count} đơn`, color: '#ec4899' })) },
      topSellers: { title: 'Seller doanh thu cao nhất', items: bySeller.map((s) => ({ id: s._id, label: sellerNameMap.get(String(s._id)) || 'Seller', value: s.total, sub: `${s.count} sản phẩm`, color: '#8b5cf6' })) },
      topSellingProducts: { title: 'Sản phẩm bán chạy', items: prodQty.map((p) => ({ id: p._id, label: p._id, value: p.total, sub: 'lượt bán', color: '#3b82f6' })) },
      topProducts: { title: 'Sản phẩm doanh thu cao', items: prodRevenue.map((p) => ({ id: p._id, label: p._id, value: p.total, sub: 'doanh thu', color: '#f59e0b' })) },
      topReturned: { title: 'Sản phẩm bị hoàn nhiều', items: mostReturned.map((p) => ({ id: p._id, label: p._id, value: p.total, sub: 'lượt thất bại', color: '#ef4444' })) },
    },
  }
}

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------

export const getSystem = async ({ range = '30d', from, to } = {}) => {
  const r = resolveRange({ range, from, to })
  const roleCounts = await User.aggregate([{ $group: { _id: '$role', total: { $sum: 1 } } }])
  const roleMap = new Map(roleCounts.map((x) => [x._id, x.total]))
  const roleLabelMap = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    staff: 'Staff',
    pt: 'PT',
    member: 'Hội viên',
    seller: 'Seller',
  }
  const total = sum(roleCounts.map((r) => r.total))

  const [signupDaily, activitiesNow, activitiesPrev, activityTypes, lockedUsers, wallets, activeToday] = await Promise.all([
    countSeries(User, {}, { from: r.from, to: r.to }),
    countInRange(UserActivity, {}, { from: r.from, to: r.to }),
    countInRange(UserActivity, {}, { from: r.prevFrom, to: r.prevTo }),
    UserActivity.aggregate([
      { $match: { createdAt: { $gte: r.from, $lt: r.to } } },
      { $group: { _id: '$type', total: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 8 },
    ]),
    User.countDocuments({ status: 'locked' }),
    Wallet.countDocuments(),
    User.countDocuments({ updatedAt: { $gte: r.from, $lt: r.to } }),
  ])

  const kpis = [
    { key: 'total', label: 'Tổng user', value: total, delta: null, format: 'number', icon: 'users', sparkline: [] },
    { key: 'admin', label: 'Admin', value: roleMap.get('admin') || 0, delta: null, format: 'number', icon: 'admin', sparkline: [] },
    { key: 'staff', label: 'Staff', value: roleMap.get('staff') || 0, delta: null, format: 'number', icon: 'staff', sparkline: [] },
    { key: 'pt', label: 'PT', value: roleMap.get('pt') || 0, delta: null, format: 'number', icon: 'pt', sparkline: [] },
    { key: 'member', label: 'Hội viên', value: roleMap.get('member') || 0, delta: null, format: 'number', icon: 'members', sparkline: [] },
    { key: 'seller', label: 'Seller', value: roleMap.get('seller') || 0, delta: null, format: 'number', icon: 'seller', sparkline: [] },
  ]

  return {
    range: r,
    kpis,
    charts: {
      userByRole: {
        type: 'pie',
        title: 'User theo vai trò',
        labels: roleCounts.map((x) => roleLabelMap[x._id] || x._id),
        series: [{ name: 'User', data: roleCounts.map((x) => x.total) }],
      },
      signupByDay: {
        type: 'line',
        title: 'Đăng ký theo ngày',
        labels: signupDaily.labels,
        pointKeys: signupDaily.keys,
        series: [{ name: 'Đăng ký', data: signupDaily.data }],
      },
      activityByDay: {
        type: 'area',
        title: 'Hoạt động hệ thống theo ngày',
        labels: activitiesNow ? activityDailyFromTotal() : [],
        series: [],
      },
      activityByType: {
        type: 'bar',
        title: 'Loại hoạt động',
        labels: activityTypes.map((a) => a._id),
        pointKeys: activityTypes.map((a) => String(a._id)),
        series: [{ name: 'Lượt', data: activityTypes.map((a) => a.total) }],
      },
    },
    tops: {
      roles: {
        title: 'Phân bố vai trò',
        items: roleCounts.map((x) => ({ id: x._id, label: roleLabelMap[x._id] || x._id, value: x.total, sub: `${Math.round((x.total / (total || 1)) * 100)}%`, color: '#64748b' })),
      },
    },
  }
}

const activityDailyFromTotal = () => []

// ---------------------------------------------------------------------------
// Transactions (drill-down ledger)
// ---------------------------------------------------------------------------

const txTypeMeta = {
  membership: { label: 'Đăng ký gói', color: 'green' },
  deposit: { label: 'Nạp ví', color: 'blue' },
  shop: { label: 'Mua hàng', color: 'magenta' },
  refund: { label: 'Hoàn tiền', color: 'red' },
}

export const getTransactions = async ({ range = '30d', from, to, date, timestamp, type, status, search, memberId, ptId, shopId, planId, page = 1, pageSize = 20 } = {}) => {
  const r = applyDateFilter(date, timestamp, resolveRange({ range, from, to }))
  const skip = (Number(page) - 1) * Number(pageSize)
  const limit = Number(pageSize)
  const searchRegex = search ? new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null

  const userFilter = memberId ? { $in: [mongoose.Types.ObjectId.isValid(memberId) ? new mongoose.Types.ObjectId(memberId) : memberId] } : undefined

  // Membership payments
  const payMatch = { status: PAID_PAYMENT_STATUSES, createdAt: { $gte: r.from, $lt: r.to } }
  if (planId) payMatch.planId = planId
  const payments = await Payment.aggregate([
    { $match: payMatch },
    { $sort: { createdAt: -1 } },
    { $limit: 500 },
  ])
  const planIds = [...new Set(payments.map((p) => p.planId).filter(Boolean))]
  const plans = planIds.length ? await Plan.find({ _id: { $in: planIds } }).select('nameVi').lean() : []
  const planMap = new Map(plans.map((p) => [String(p._id), p.nameVi]))

  const txns = payments.map((p) => ({
    id: p._id,
    code: p.txnRef || String(p._id),
    memberId: p.userId,
    plan: planMap.get(String(p.planId)) || '',
    type: 'membership',
    paymentMethod: p.paymentMethod || p.method || '',
    amount: p.amount,
    discount: 0,
    refund: 0,
    status: 'completed',
    time: p.paidAt || p.completedAt || p.createdAt,
    note: p.metadata?.note || '',
    staff: p.metadata?.staffName || '',
    pt: p.metadata?.ptName || '',
  }))

  // Deposits & refunds
  const walletTxns = await Transaction.aggregate([
    { $match: { status: COMPLETED_TXN, type: { $in: ['deposit', 'refund', 'REFUND_TO_WALLET'] }, createdAt: { $gte: r.from, $lt: r.to } } },
    { $sort: { createdAt: -1 } },
    { $limit: 500 },
  ])
  walletTxns.forEach((t) => {
    const isRefund = ['refund', 'REFUND_TO_WALLET'].includes(t.type)
    txns.push({
      id: t._id,
      code: t.referenceId || String(t._id),
      memberId: t.userId,
      plan: '',
      type: isRefund ? 'refund' : 'deposit',
      paymentMethod: t.paymentMethod || t.provider || '',
      amount: t.amount,
      discount: 0,
      refund: isRefund ? t.amount : 0,
      status: t.status,
      time: t.completedAt || t.createdAt,
      note: t.description || '',
      staff: t.metadata?.staffName || '',
      pt: t.metadata?.ptName || '',
    })
  })

  // Shop orders
  const orderMatch = { createdAt: { $gte: r.from, $lt: r.to } }
  if (shopId) orderMatch.shopId = shopId
  const orders = await Order.find(orderMatch).sort({ createdAt: -1 }).limit(500).lean()
  const shopIds = [...new Set(orders.map((o) => o.shopId).filter(Boolean))]
  const shops = shopIds.length ? await Shop.find({ _id: { $in: shopIds } }).select('name').lean() : []
  const shopMap = new Map(shops.map((s) => [String(s._id), s.name]))
  const sellerIds = [...new Set(orders.flatMap((o) => (o.items || []).map((i) => i.sellerId)).filter(Boolean))]
  const sellers = sellerIds.length ? await User.find({ _id: { $in: sellerIds } }).select('fullName name username email').lean() : []
  const sellerMap = new Map(sellers.map((s) => [String(s._id), getDisplayName(s, '')]))
  orders.forEach((o) => {
    txns.push({
      id: o._id,
      code: o.paymentReference || String(o._id),
      memberId: o.userId,
      plan: shopMap.get(String(o.shopId)) || '',
      type: 'shop',
      paymentMethod: o.paymentStatus,
      amount: o.paymentStatus === 'paid' ? o.totalAmount || 0 : 0,
      discount: o.discountAmount || 0,
      refund: 0,
      status: o.status,
      time: o.createdAt,
      note: o.address?.recipientName || '',
      staff: o.items?.[0]?.sellerId ? (sellerMap.get(String(o.items[0].sellerId)) || '') : '',
      pt: '',
    })
  })

  // Member info
  const memberIds = [...new Set(txns.map((t) => t.memberId).filter(Boolean))]
  const memberUsers = memberIds.length
    ? await User.find({ _id: { $in: memberIds } }).select('fullName name username email phone memberCode').lean()
    : []
  const userMap = new Map(memberUsers.map((u) => [String(u._id), u]))
  const ptMap = new Map(memberUsers.map((u) => [String(u._id), u]))

  let rows = txns.map((t) => {
    const member = userMap.get(String(t.memberId))
    const ptName = t.pt ? getDisplayName(userMap.get(String(t.pt)), '') : ''
    return {
      ...t,
      memberName: getDisplayName(member, 'Khách vãng lai'),
      memberEmail: member?.email || '',
      memberPhone: member?.phone || '',
      memberCode: member?.memberCode || '',
      ptName,
      typeLabel: txTypeMeta[t.type]?.label || t.type,
      typeColor: txTypeMeta[t.type]?.color || 'default',
    }
  })

  if (type) rows = rows.filter((t) => t.type === type)
  if (searchRegex) {
    rows = rows.filter((t) =>
      [t.code, t.memberName, t.memberEmail, t.memberPhone, t.plan, t.note].some((v) => searchRegex.test(String(v || ''))),
    )
  }

  const total = rows.length
  const paged = rows.slice(skip, skip + limit)

  return {
    range: r,
    rows: paged,
    total,
    page: Number(page),
    pageSize: limit,
    types: Object.entries(txTypeMeta).map(([key, v]) => ({ key, label: v.label, color: v.color })),
  }
}

// ---------------------------------------------------------------------------
// Member Activity (Dashboard Hội viên) — renew/change/cancel/checkin/register
// ---------------------------------------------------------------------------

export const getMemberActivity = async ({ range = '30d', from, to, date, timestamp, type, memberId, search, page = 1, pageSize = 20 } = {}) => {
  const r = applyDateFilter(date, timestamp, resolveRange({ range, from, to }))
  const skip = (Number(page) - 1) * Number(pageSize)
  const limit = Number(pageSize)
  const searchRegex = search ? new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null
  const rows = []

  if (!type || type === 'register') {
    const users = await User.find({ role: 'member', createdAt: { $gte: r.from, $lt: r.to } })
      .select('fullName name username email memberCode createdAt')
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean()
    users.forEach((u) => {
      rows.push({
        id: `reg-${u._id}`,
        memberId: u._id,
        memberName: getDisplayName(u, ''),
        memberCode: u.memberCode || '',
        plan: '',
        activityType: 'register',
        activityLabel: 'Đăng ký mới',
        detail: 'Đăng ký tài khoản hội viên',
        time: u.createdAt,
      })
    })
  }

  if (!type || type === 'renew') {
    const periods = await MembershipPeriod.find({ status: 'ACTIVE', createdAt: { $gte: r.from, $lt: r.to } })
      .populate('memberId', 'fullName name username email memberCode')
      .populate('planId', 'nameVi')
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean()
    periods.forEach((p) => {
      rows.push({
        id: `renew-${p._id}`,
        memberId: p.memberId?._id,
        memberName: getDisplayName(p.memberId, ''),
        memberCode: p.memberId?.memberCode || '',
        plan: p.planId?.nameVi || '',
        activityType: 'renew',
        activityLabel: 'Gia hạn',
        detail: `Gia hạn đến ${p.endDate ? new Date(p.endDate).toLocaleDateString('vi-VN') : '-'}`,
        time: p.createdAt,
      })
    })
  }

  if (!type || type === 'change') {
    const changes = await PlanChangeHistory.find({ createdAt: { $gte: r.from, $lt: r.to } })
      .populate('memberId', 'fullName name username email memberCode')
      .populate('fromPlanId', 'nameVi')
      .populate('toPlanId', 'nameVi')
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean()
    changes.forEach((c) => {
      rows.push({
        id: `chg-${c._id}`,
        memberId: c.memberId?._id,
        memberName: getDisplayName(c.memberId, ''),
        memberCode: c.memberId?.memberCode || '',
        plan: c.toPlanId?.nameVi || '',
        activityType: 'change',
        activityLabel: 'Đổi gói',
        detail: `${c.fromPlanId?.nameVi || '—'} → ${c.toPlanId?.nameVi || '—'}`,
        time: c.createdAt,
      })
    })
  }

  if (!type || type === 'cancel') {
    const cancels = await MembershipCancellationRequest.find({ createdAt: { $gte: r.from, $lt: r.to } })
      .populate('memberId', 'fullName name username email memberCode')
      .populate('planId', 'nameVi')
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean()
    cancels.forEach((c) => {
      const statusMap = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' }
      rows.push({
        id: `can-${c._id}`,
        memberId: c.memberId?._id,
        memberName: getDisplayName(c.memberId, ''),
        memberCode: c.memberId?.memberCode || '',
        plan: c.planId?.nameVi || '',
        activityType: 'cancel',
        activityLabel: 'Hủy membership',
        detail: `Trạng thái: ${statusMap[c.status] || c.status}${c.reason ? ` — ${c.reason}` : ''}`,
        time: c.createdAt,
      })
    })
  }

  if (!type || type === 'checkin') {
    const checks = await CheckIn.find({ status: 'success', checkinTime: { $gte: r.from, $lt: r.to } })
      .populate('memberId', 'fullName name username email memberCode')
      .sort({ checkinTime: -1 })
      .limit(1000)
      .lean()
    checks.forEach((c) => {
      rows.push({
        id: `ci-${c._id}`,
        memberId: c.memberId?._id,
        memberName: getDisplayName(c.memberId, ''),
        memberCode: c.memberId?.memberCode || '',
        plan: '',
        activityType: 'checkin',
        activityLabel: 'Check-in',
        detail: `${c.checkinTime ? new Date(c.checkinTime).toLocaleString('vi-VN') : '-'} (${c.checkInMethod || ''})`,
        time: c.checkinTime,
      })
    })
  }

  let filtered = rows
  if (memberId) filtered = filtered.filter((x) => String(x.memberId) === String(memberId))
  if (searchRegex) {
    filtered = filtered.filter((x) =>
      [x.memberName, x.memberCode, x.plan, x.detail].some((v) => searchRegex.test(String(v || ''))),
    )
  }
  filtered.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  return {
    range: r,
    rows: filtered.slice(skip, skip + limit),
    total: filtered.length,
    page: Number(page),
    pageSize: limit,
    types: [
      { key: 'register', label: 'Đăng ký mới' },
      { key: 'renew', label: 'Gia hạn' },
      { key: 'change', label: 'Đổi gói' },
      { key: 'cancel', label: 'Hủy membership' },
      { key: 'checkin', label: 'Check-in' },
    ],
  }
}

// ---------------------------------------------------------------------------
// Booking detail (Dashboard Booking & PT)
// ---------------------------------------------------------------------------

export const getBookings = async ({ range = '30d', from, to, date, ptId, status, search, page = 1, pageSize = 20 } = {}) => {
  const r = applyDateFilter(date, null, resolveRange({ range, from, to }))
  const skip = (Number(page) - 1) * Number(pageSize)
  const limit = Number(pageSize)
  const match = { createdAt: { $gte: r.from, $lt: r.to } }
  if (ptId) match.ptId = ptId
  if (status) match.status = status
  if (search) match.$or = [
    { 'slot': { $regex: search, $options: 'i' } },
    { 'note': { $regex: search, $options: 'i' } },
  ]

  const [total, bookings] = await Promise.all([
    Booking.countDocuments(match),
    Booking.find(match).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ])

  const userIds = [...new Set(bookings.flatMap((b) => [b.memberId, b.ptId]).filter(Boolean))]
  const users = userIds.length ? await User.find({ _id: { $in: userIds } }).select('fullName name username email memberCode').lean() : []
  const userMap = new Map(users.map((u) => [String(u._id), u]))

  const statusMap = { pending: 'Chờ xử lý', awaiting_payment: 'Chờ thanh toán', confirmed: 'Đã xác nhận', cancelled: 'Đã hủy', completed: 'Hoàn tất' }

  return {
    range: r,
    rows: bookings.map((b) => ({
      id: b._id,
      code: String(b._id),
      memberId: b.memberId,
      memberName: getDisplayName(userMap.get(String(b.memberId)), ''),
      memberCode: userMap.get(String(b.memberId))?.memberCode || '',
      ptId: b.ptId,
      ptName: getDisplayName(userMap.get(String(b.ptId)), ''),
      date: b.date,
      slot: b.slot || '',
      trainingType: b.trainingType,
      status: b.status,
      statusLabel: statusMap[b.status] || b.status,
      paymentStatus: b.paymentStatus,
    })),
    total,
    page: Number(page),
    pageSize: limit,
    types: Object.entries(statusMap).map(([key, label]) => ({ key, label })),
  }
}

// ---------------------------------------------------------------------------
// Order detail (Dashboard Shop)
// ---------------------------------------------------------------------------

export const getOrders = async ({ range = '30d', from, to, date, shopId, status, search, page = 1, pageSize = 20 } = {}) => {
  const r = applyDateFilter(date, null, resolveRange({ range, from, to }))
  const skip = (Number(page) - 1) * Number(pageSize)
  const limit = Number(pageSize)
  const match = { createdAt: { $gte: r.from, $lt: r.to } }
  if (shopId) match.shopId = shopId
  if (status) match.paymentStatus = status

  const [total, orders] = await Promise.all([
    Order.countDocuments(match),
    Order.find(match).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ])

  const memberIds = [...new Set(orders.map((o) => o.userId).filter(Boolean))]
  const shopIds = [...new Set(orders.map((o) => o.shopId).filter(Boolean))]
  const sellerIds = [...new Set(orders.flatMap((o) => (o.items || []).map((i) => i.sellerId)).filter(Boolean))]
  const [members, shops, sellers] = await Promise.all([
    memberIds.length ? User.find({ _id: { $in: memberIds } }).select('fullName name username email memberCode').lean() : [],
    shopIds.length ? Shop.find({ _id: { $in: shopIds } }).select('name').lean() : [],
    sellerIds.length ? User.find({ _id: { $in: sellerIds } }).select('fullName name username email').lean() : [],
  ])
  const memberMap = new Map(members.map((u) => [String(u._id), u]))
  const shopMap = new Map(shops.map((s) => [String(s._id), s.name]))
  const sellerMap = new Map(sellers.map((u) => [String(u._id), getDisplayName(u, '')]))

  const statusMap = { 'CHỜ XÁC NHẬN': 'Chờ xác nhận', 'ĐANG GIAO HÀNG': 'Đang giao hàng', 'GIAO THÀNH CÔNG': 'Giao thành công' }

  return {
    range: r,
    rows: orders.map((o) => ({
      id: o._id,
      code: o.paymentReference || String(o._id),
      memberId: o.userId,
      memberName: getDisplayName(memberMap.get(String(o.userId)), ''),
      memberCode: memberMap.get(String(o.userId))?.memberCode || '',
      shopId: o.shopId,
      shopName: shopMap.get(String(o.shopId)) || '—',
      sellerName: o.items?.[0] ? sellerMap.get(String(o.items[0].sellerId)) || '' : '',
      itemCount: (o.items || []).reduce((s, i) => s + (i.quantity || 0), 0),
      itemsSummary: (o.items || []).slice(0, 2).map((i) => i.productName || i.name).join(', '),
      total: o.totalAmount || 0,
      discount: o.discountAmount || 0,
      status: o.status,
      statusLabel: statusMap[o.status] || o.status,
      paymentStatus: o.paymentStatus,
      time: o.createdAt,
    })),
    total,
    page: Number(page),
    pageSize: limit,
    types: Object.entries(statusMap).map(([key, label]) => ({ key, label })),
  }
}

// ---------------------------------------------------------------------------
// System users (Dashboard Hệ thống)
// ---------------------------------------------------------------------------

export const getSystemUsers = async ({ range = '30d', from, to, date, timestamp, role, search, page = 1, pageSize = 20 } = {}) => {
  const r = applyDateFilter(date, timestamp, resolveRange({ range, from, to }))
  const skip = (Number(page) - 1) * Number(pageSize)
  const limit = Number(pageSize)
  const match = { createdAt: { $gte: r.from, $lt: r.to } }
  if (role) match.role = role
  if (search) {
    const re = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    match.$or = [{ name: re }, { fullName: re }, { email: re }, { phone: re }, { memberCode: re }]
  }

  const [total, users] = await Promise.all([
    User.countDocuments(match),
    User.find(match).select('fullName name username email phone memberCode role status isActive createdAt updatedAt').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ])

  const roleLabels = { super_admin: 'Super Admin', admin: 'Admin', staff: 'Staff', pt: 'PT', member: 'Hội viên', seller: 'Seller' }

  return {
    range: r,
    rows: users.map((u) => ({
      id: u._id,
      name: getDisplayName(u, ''),
      email: u.email || '',
      phone: u.phone || '',
      memberCode: u.memberCode || '',
      role: u.role,
      roleLabel: roleLabels[u.role] || u.role,
      status: u.isActive && u.status === 'active' ? 'active' : 'locked',
      registeredAt: u.createdAt,
      lastActiveAt: u.updatedAt,
    })),
    total,
    page: Number(page),
    pageSize: limit,
    roles: Object.entries(roleLabels).map(([key, label]) => ({ key, label })),
  }
}
