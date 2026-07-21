import {
  getRevenueReport,
  getMembershipReport,
  getCheckinReport,
  getTrainerReport,
  getProductReport,
  exportCSV,
} from '../services/reportService.js'

const getDateParams = (req) => ({
  startDate: req.query.startDate || undefined,
  endDate: req.query.endDate || undefined,
})

const sendCSV = (res, { data, filename }) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(data)
}

export const getRevenue = async (req, res, next) => {
  try {
    const data = await getRevenueReport(getDateParams(req))
    if (req.query.format === 'csv') {
      const csv = exportCSV(
        ['date', 'revenue', 'orders'],
        data.daily,
        'revenue-report.csv',
      )
      return sendCSV(res, csv)
    }
    return res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
}

export const getMemberships = async (req, res, next) => {
  try {
    const data = await getMembershipReport(getDateParams(req))
    return res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
}

export const getCheckins = async (req, res, next) => {
  try {
    const data = await getCheckinReport(getDateParams(req))
    if (req.query.format === 'csv') {
      const csv = exportCSV(
        ['date', 'count', 'unique'],
        data.daily,
        'checkin-report.csv',
      )
      return sendCSV(res, csv)
    }
    return res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
}

export const getTrainers = async (req, res, next) => {
  try {
    const data = await getTrainerReport(getDateParams(req))
    if (req.query.format === 'csv') {
      const csv = exportCSV(
        ['trainerName', 'sessions', 'members'],
        data.trainers,
        'trainer-report.csv',
      )
      return sendCSV(res, csv)
    }
    return res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
}

export const getProducts = async (req, res, next) => {
  try {
    const data = await getProductReport(getDateParams(req))
    if (req.query.format === 'csv') {
      const csv = exportCSV(
        ['productName', 'unitsSold', 'revenue'],
        data.topSelling,
        'product-report.csv',
      )
      return sendCSV(res, csv)
    }
    return res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
}
