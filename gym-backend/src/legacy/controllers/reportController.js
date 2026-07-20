import Order from '../models/Order.js'

export const getOverviewStats = async (req, res) => {}
export const getChartsData = async (req, res) => {}
export const getHeatmap = async (req, res) => {}
export const getForecast = async (req, res) => {}
export const getChurnRisk = async (req, res) => {}
export const exportMonthlyReport = async (req, res) => {}

export const getRevenueReport = async (req, res) => {
  try {
    const { period } = req.query
    const now = new Date()
    let startDate

    if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    } else if (period === 'quarter') {
      const currentQuarterMonth = Math.floor(now.getMonth() / 3) * 3
      startDate = new Date(now.getFullYear(), currentQuarterMonth, 1)
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1)
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    const revenueStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: 'PAID'
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          newOrdersCount: { $sum: 1 }
        }
      }
    ])

    const totalRevenue = revenueStats[0]?.totalRevenue || 0
    const newOrdersCount = revenueStats[0]?.newOrdersCount || 0

    const topPlansRaw = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: 'PAID'
        }
      },
      {
        $group: {
          _id: '$planName',
          quantity: { $sum: 1 },
          revenue: { $sum: '$amount' }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 }
    ])

    const topPlans = topPlansRaw.map(item => ({
      name: item._id || 'Gói không tên',
      quantity: item.quantity,
      revenue: item.revenue,
      percentage: totalRevenue > 0 ? Math.round((item.revenue / totalRevenue) * 100) : 0
    }))

    const recentTransactions = await Order.find({
      createdAt: { $gte: startDate },
      status: 'PAID'
    })
      .sort({ createdAt: -1 })
      .limit(10)

    return res.status(200).json({
      totalRevenue,
      newOrdersCount,
      growthRate: 0,
      targetPercentage: 0,
      topPlans,
      recentTransactions
    })

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy dữ liệu báo cáo doanh thu',
      error: error.message
    })
  }
}