import mongoose from 'mongoose'

const auditLogSchema = new mongoose.Schema(
  {
    module: {
      type: String,
      enum: ['users', 'plans', 'products', 'shops', 'ai', 'system_settings', 'planFeatures', 'specializations', 'memberships', 'bookings', 'payments', 'wallets', 'checkins', 'notifications', 'trainers', 'refunds', 'freezes', 'orders', 'returns'],
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ['create', 'update', 'delete'],
      required: true,
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    entityName: {
      type: String,
      default: '',
      trim: true,
    },
    admin: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      name: { type: String, default: '' },
      email: { type: String, default: '' },
    },
    details: {
      type: String,
      default: '',
      trim: true,
    },
    oldValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    ip: {
      type: String,
      trim: true,
      default: '',
    },
    userAgent: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true },
)

auditLogSchema.index({ module: 1, createdAt: -1 })

export default mongoose.model('AuditLog', auditLogSchema)
