import User from '../models/User.js'
import Membership from '../models/Membership.js'

export const getOverviewStats = async (req, res) => {
  try {
    const totalMembers = await User.countDocuments({ role: 'member' })
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const newMembers = await User.countDocuments({ role: 'member', createdAt: { $gte: startOfMonth } })

    const sevenDaysLater = new Date()
    sevenDaysLater.setDate(now.getDate() + 7)
    const expiringMembers = await Membership.countDocuments({
      endDate: { $gte: now, $lte: sevenDaysLater },
      status: 'active',
    })

    res.status(200).json({
      success: true,
      data: {
        totalMembers,
        newMembersThisMonth: newMembers,
        expiringIn7Days: expiringMembers,
        revenueThisMonth: 150000000,
        revenueLastMonth: 135000000,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const getChartsData = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        revenue6Months: [
          { month: 'Tháng 2', revenue: 110000000 },
          { month: 'Tháng 3', revenue: 125000000 },
          { month: 'Tháng 4', revenue: 140000000 },
          { month: 'Tháng 5', revenue: 130000000 },
          { month: 'Tháng 6', revenue: 135000000 },
          { month: 'Tháng 7', revenue: 150000000 },
        ],
        hourlyCheckIn: Array.from({ length: 24 }, (_, i) => ({ hour: `${i}h`, count: Math.floor(Math.random() * 50) })),
        renewalRate: 78,
        top5PT: [
          { name: 'Nguyễn Văn A', classes: 45 },
          { name: 'Trần Thị B', classes: 40 },
          { name: 'Lê Văn C', classes: 38 },
          { name: 'Phạm Minh D', classes: 35 },
          { name: 'Hoàng Văn E', classes: 30 },
        ],
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const getHeatmap = async (req, res) => {
  try {
    const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật']
    const data = []
    days.forEach((day) => {
      for (let hour = 0; hour < 24; hour++) {
        data.push({ day, hour, value: Math.floor(Math.random() * 30) })
      }
    })
    res.status(200).json({ success: true, data })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const getForecast = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        nextMonthForecast: 165000000,
        historicalAccuracy: 94,
        trend: 'up',
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const getChurnRisk = async (req, res) => {
  try {
    const lowActivityMembers = await User.find({ role: 'member' }).limit(5).select('name email phone')
    const data = lowActivityMembers.map((member) => ({
      userId: member._id,
      name: member.name,
      email: member.email,
      phone: member.phone,
      lastCheckIn: '15 ngày trước',
      daysToExpiry: Math.floor(Math.random() * 6) + 1,
    }))
    res.status(200).json({ success: true, data })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const exportExcelReport = async (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename=report.xlsx')
    res.status(200).send(Buffer.from([]))
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}