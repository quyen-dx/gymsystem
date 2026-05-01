import AuditLog from '../models/AuditLog.js'

export const recordAuditLog = async ({ req, module, action, entity, entityName, details = '' }) => {
  if (!req.user || !entity?._id) return

  await AuditLog.create({
    module,
    action,
    entityId: entity._id,
    entityName: entityName || entity.name || entity.email || entity.phone || entity._id.toString(),
    admin: {
      id: req.user._id,
      name: req.user.name || '',
      email: req.user.email || '',
    },
    details,
  })
}
