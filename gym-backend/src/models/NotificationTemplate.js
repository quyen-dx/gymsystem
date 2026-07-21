import mongoose from 'mongoose'

const notificationTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên mẫu là bắt buộc'],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      default: '',
    },
    notificationType: {
      type: String,
      required: [true, 'Loại thông báo là bắt buộc'],
      trim: true,
    },
    channels: [{
      type: String,
      enum: ['in_app', 'email', 'sms', 'push'],
    }],
    title: {
      type: String,
      required: [true, 'Tiêu đề mẫu là bắt buộc'],
      trim: true,
    },
    titleEn: {
      type: String,
      default: '',
    },
    body: {
      type: String,
      required: [true, 'Nội dung mẫu là bắt buộc'],
      trim: true,
    },
    bodyEn: {
      type: String,
      default: '',
    },
    emailSubject: {
      type: String,
      default: '',
    },
    emailHtml: {
      type: String,
      default: '',
    },
    smsText: {
      type: String,
      default: '',
    },
    pushTitle: {
      type: String,
      default: '',
    },
    pushBody: {
      type: String,
      default: '',
    },
    placeholders: [{
      key: { type: String, required: true },
      description: { type: String, default: '' },
      required: { type: Boolean, default: false },
    }],
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

notificationTemplateSchema.index({ notificationType: 1, isActive: 1 })
notificationTemplateSchema.index({ name: 1 }, { unique: true })

const NotificationTemplate = mongoose.models.NotificationTemplate || mongoose.model('NotificationTemplate', notificationTemplateSchema)

export default NotificationTemplate
