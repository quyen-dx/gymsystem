import AuditLog from '../models/AuditLog.js'

const getUserDisplayName = (user, fallback = '') =>
  String(user?.fullName || user?.displayName || user?.name || fallback || '').trim()

export const recordAuditLog = async ({ req, module, action, entity, entityName, details = '', oldValue = null, newValue = null }) => {
  if (!req.user || !entity?._id) return

  await AuditLog.create({
    module,
    action,
    entityId: entity._id,
    entityName: entityName || entity.name || entity.email || entity.phone || entity._id.toString(),
    admin: {
      id: req.user._id,
      name: getUserDisplayName(req.user),
      email: req.user.email || '',
    },
    details,
    oldValue,
    newValue,
    ip: req.ip || req.connection?.remoteAddress || '',
    userAgent: (req.headers && req.headers['user-agent']) || req.get?.('user-agent') || '',
  })
}
