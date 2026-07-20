import AppError from '../utils/appError.js'
import { verifyAccessToken } from '../services/tokenService.js'
import { can } from '../config/permissions.js'

// ─── protect ────────────────────────────────────────────────────────────
export const protect = async (req, res, next) => {
  try {
    let token

    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1]
    }

    if (!token) {
      return next(new AppError('Bạn chưa đăng nhập', 401, 'AUTH_NO_TOKEN'))
    }

    const { user } = await verifyAccessToken(token)

    req.user = user
    next()
  } catch (error) {
    return next(error)
  }
}

// ─── authorize (role gate — backward-compatible) ────────────────────────
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'AUTH_NO_TOKEN'))
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          'Bạn không có quyền thực hiện hành động này',
          403,
          'AUTH_INSUFFICIENT_PERMISSIONS',
        ),
      )
    }

    next()
  }
}

// ─── requireRole (explicit alias for authorize) ─────────────────────────
export const requireRole = (...roles) => authorize(...roles)

// ─── requirePermission (RBAC matrix lookup) ─────────────────────────────
export const requirePermission = (resource, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'AUTH_NO_TOKEN'))
    }

    if (!can(req.user.role, resource, action)) {
      return next(
        new AppError(
          'Bạn không có quyền thực hiện hành động này',
          403,
          'AUTH_INSUFFICIENT_PERMISSIONS',
        ),
      )
    }

    next()
  }
}

// ─── requireOwnership (pre-loaded resource ownership check) ─────────────
// Controllers / loaders are responsible for loading the resource onto req
// BEFORE this middleware runs. This middleware only compares owner identity.
export const requireOwnership = ({
  resourceField = 'resource',
  ownerField = 'userId',
} = {}) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'AUTH_NO_TOKEN'))
    }

    const resource = req[resourceField]

    if (!resource) {
      return next(
        new AppError('Resource not loaded for ownership check', 500, 'AUTH_OWNERSHIP_SETUP'),
      )
    }

    const ownerId = resource[ownerField]
    if (!ownerId) {
      return next(new AppError('Resource has no owner field', 500, 'AUTH_OWNERSHIP_SETUP'))
    }

    if (ownerId.toString() !== req.user._id.toString()) {
      return next(
        new AppError(
          'Bạn không có quyền thao tác tài nguyên này',
          403,
          'AUTH_INSUFFICIENT_PERMISSIONS',
        ),
      )
    }

    next()
  }
}

// ─── requireSelfOrRole (self-identity or role gate) ─────────────────────
export const requireSelfOrRole = (paramField, ...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'AUTH_NO_TOKEN'))
    }

    const isSelf = req.params[paramField] === req.user._id.toString()
    const hasRole = roles.includes(req.user.role)

    if (isSelf || hasRole) {
      return next()
    }

    return next(
      new AppError(
        'Bạn không có quyền thực hiện hành động này',
        403,
        'AUTH_INSUFFICIENT_PERMISSIONS',
      ),
    )
  }
}

// ─── Role shortcuts (backward-compatible exports) ───────────────────────
export const adminOnly = authorize('super_admin', 'admin')
export const superAdminOnly = authorize('super_admin')
export const sellerOnly = authorize('seller')
export const sellerOrAdmin = authorize('seller', 'super_admin', 'admin')
export const adminOrStaff = authorize('super_admin', 'admin', 'staff')
export const adminOrPT = authorize('super_admin', 'admin', 'pt')
export const allRoles = authorize(
  'super_admin',
  'admin',
  'pt',
  'staff',
  'member',
  'seller',
)
