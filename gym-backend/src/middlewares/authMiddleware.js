import { verifyAccessToken } from '../services/tokenService.js'

export const protect = async (req, res, next) => {
  try {
    let token

    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1]
    }

    if (!token) {
      return res.status(401).json({ message: 'Bạn chưa đăng nhập' })
    }

    const { user } = await verifyAccessToken(token)

    req.user = user
    next()
  } catch (error) {
    return next(error)
  }
}

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Bạn không có quyền thực hiện hành động này. Yêu cầu role: ${roles.join(', ')}`,
      })
    }
    next()
  }
}

export const adminOnly = authorize('super_admin', 'admin')
export const superAdminOnly = authorize('super_admin')
export const sellerOnly = authorize('seller')
export const sellerOrAdmin = authorize('seller', 'super_admin', 'admin')
export const adminOrStaff = authorize('super_admin', 'admin', 'staff')
export const adminOrPT = authorize('super_admin', 'admin', 'pt')
export const allRoles = authorize('super_admin', 'admin', 'pt', 'staff', 'member', 'seller')
