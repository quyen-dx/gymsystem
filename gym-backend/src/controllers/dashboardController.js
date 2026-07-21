import { getAdminDashboard, getStaffDashboard, getPTDashboard, getMemberDashboard, getSellerDashboard } from '../services/dashboardService.js'

export const getDashboard = async (req, res, next) => {
  try {
    const { role, _id } = req.user

    let data
    switch (role) {
      case 'super_admin':
      case 'admin':
        data = await getAdminDashboard()
        break
      case 'staff':
        data = await getStaffDashboard()
        break
      case 'pt':
        data = await getPTDashboard(_id)
        break
      case 'member':
        data = await getMemberDashboard(_id)
        break
      case 'seller':
        data = await getSellerDashboard(_id)
        break
      default:
        data = { message: 'Dashboard not available for your role' }
    }

    return res.json({ success: true, role, data })
  } catch (error) {
    next(error)
  }
}
