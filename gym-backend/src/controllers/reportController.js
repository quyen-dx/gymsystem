import { getSummary, getFinance, getMembers, getPt, getBooking, getCheckin, getSystem, getTransactions, getMemberActivity, getBookings, getCheckins, getOrders, getSystemUsers } from '../services/reportService.js'
import { buildXlsx, buildPdf } from '../services/reportExportService.js'

const MODULES = ['finance', 'members', 'pt', 'booking', 'checkin', 'system']
const EXPORT_MODULES = MODULES.filter((module) => module !== 'checkin')

const parseRange = (req) => ({
  range: req.query.range || '30d',
  from: req.query.from || undefined,
  to: req.query.to || undefined,
})

export const getOverviewStats = async (req, res) => {
  try {
    const data = await getSummary(parseRange(req))
    res.status(200).json(data)
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi khi lấy dữ liệu tổng quan', error: error.message })
  }
}

export const getChartsData = async (req, res) => {
  try {
    const { module = 'finance' } = req.query
    if (!MODULES.includes(module)) {
      return res.status(400).json({ success: false, message: 'Module không hợp lệ' })
    }
    const loaders = { finance: getFinance, members: getMembers, pt: getPt, booking: getBooking, checkin: getCheckin, system: getSystem }
    const data = await loaders[module](parseRange(req))
    res.status(200).json(data)
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi khi lấy dữ liệu dashboard', error: error.message })
  }
}

export const getHeatmap = async (req, res) => {
  res.status(200).json({ success: true, message: 'Chưa khả dụng' })
}

export const getForecast = async (req, res) => {
  res.status(200).json({ success: true, message: 'Chưa khả dụng' })
}

export const getChurnRisk = async (req, res) => {
  res.status(200).json({ success: true, message: 'Chưa khả dụng' })
}

export const getTransactionsHandler = async (req, res) => {
  try {
    const data = await getTransactions({
      ...parseRange(req),
      date: req.query.date || undefined,
      timestamp: req.query.timestamp || undefined,
      type: req.query.type || undefined,
      status: req.query.status || undefined,
      search: req.query.search || undefined,
      memberId: req.query.memberId || undefined,
      ptId: req.query.ptId || undefined,
      shopId: req.query.shopId || undefined,
      planId: req.query.planId || undefined,
      page: Number(req.query.page) || 1,
      pageSize: Math.min(Number(req.query.pageSize) || 20, 200),
    })
    res.status(200).json(data)
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi khi lấy giao dịch', error: error.message })
  }
}

export const getMemberActivityHandler = async (req, res) => {
  try {
    const data = await getMemberActivity({
      ...parseRange(req),
      date: req.query.date || undefined,
      timestamp: req.query.timestamp || undefined,
      type: req.query.type || undefined,
      memberId: req.query.memberId || undefined,
      search: req.query.search || undefined,
      page: Number(req.query.page) || 1,
      pageSize: Math.min(Number(req.query.pageSize) || 20, 200),
    })
    res.status(200).json(data)
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi khi lấy hoạt động hội viên', error: error.message })
  }
}

export const getBookingsHandler = async (req, res) => {
  try {
    const data = await getBookings({
      ...parseRange(req),
      date: req.query.date || undefined,
      ptId: req.query.ptId || undefined,
      status: req.query.status || undefined,
      search: req.query.search || undefined,
      page: Number(req.query.page) || 1,
      pageSize: Math.min(Number(req.query.pageSize) || 20, 200),
    })
    res.status(200).json(data)
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách booking', error: error.message })
  }
}

export const getSystemUsersHandler = async (req, res) => {
  try {
    const data = await getSystemUsers({
      ...parseRange(req),
      date: req.query.date || undefined,
      timestamp: req.query.timestamp || undefined,
      role: req.query.role || undefined,
      search: req.query.search || undefined,
      page: Number(req.query.page) || 1,
      pageSize: Math.min(Number(req.query.pageSize) || 20, 200),
    })
    res.status(200).json(data)
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách user', error: error.message })
  }
}

export const exportReport = async (req, res) => {
  try {
    const module = req.query.module || 'finance'
    const format = req.query.format === 'pdf' ? 'pdf' : 'xlsx'
    const range = req.query.range || '30d'
    const { from, to } = req.query
    if (!EXPORT_MODULES.includes(module)) {
      return res.status(400).json({ success: false, message: 'Module không hợp lệ' })
    }
    const actorName = req.user?.name || 'Admin'

    const now = new Date()
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`

    if (format === 'pdf') {
      const buffer = await buildPdf({ module, range, from, to, actorName })
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="GymPro-${module}-${stamp}.pdf"`)
      return res.send(buffer)
    }

    const buffer = await buildXlsx({ module, range, from, to })
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="GymPro-${module}-${stamp}.xlsx"`)
    res.send(buffer)
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi khi xuất báo cáo', error: error.message })
  }
}

export const getRevenueReport = async (req, res) => {
  try {
    const period = ['month', 'quarter', 'year'].includes(req.query.period) ? req.query.period : 'month'
    const data = await getFinance({ ...parseRange(req), range: period })
    res.status(200).json(data)
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi khi lấy báo cáo doanh thu', error: error.message })
  }
}

export const getCheckinsHandler = async (req, res) => {
  try {
    const data = await getCheckins({
      ...parseRange(req),
      date: req.query.date || undefined,
      status: req.query.status || undefined,
      method: req.query.method || undefined,
      sessionType: req.query.sessionType || undefined,
      memberId: req.query.memberId || undefined,
      planId: req.query.planId || undefined,
      search: req.query.search || undefined,
      page: Number(req.query.page) || 1,
      pageSize: Math.min(Number(req.query.pageSize) || 20, 200),
    })
    res.status(200).json(data)
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi khi lấy lịch sử check-in', error: error.message })
  }
}
