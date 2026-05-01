import AuditLog from '../models/AuditLog.js'

export const getAuditLogs = async (req, res, next) => {
  try {
    const { module, action, page = 1, limit = 20 } = req.query
    const filter = {}

    if (module) filter.module = module
    if (action) filter.action = action

    const total = await AuditLog.countDocuments(filter)
    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))

    res.json({
      logs,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (err) {
    next(err)
  }
}
