import mongoose from 'mongoose'

const notificationPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId là bắt buộc'],
      unique: true,
    },
    emailEnabled: {
      type: Boolean,
      default: true,
    },
    smsEnabled: {
      type: Boolean,
      default: true,
    },
    pushEnabled: {
      type: Boolean,
      default: true,
    },
    inAppEnabled: {
      type: Boolean,
      default: true,
    },
    disabledTypes: [{
      type: String,
    }],
    quietHoursEnabled: {
      type: Boolean,
      default: false,
    },
    quietHoursStart: {
      type: String,
      default: '22:00',
    },
    quietHoursEnd: {
      type: String,
      default: '07:00',
    },
    timezone: {
      type: String,
      default: 'Asia/Ho_Chi_Minh',
    },
  },
  {
    timestamps: true,
  },
)

notificationPreferenceSchema.index({ userId: 1 }, { unique: true })

notificationPreferenceSchema.methods.isChannelEnabled = function (channel) {
  switch (channel) {
    case 'email': return this.emailEnabled
    case 'sms': return this.smsEnabled
    case 'push': return this.pushEnabled
    case 'in_app': return this.inAppEnabled
    default: return true
  }
}

notificationPreferenceSchema.methods.isTypeDisabled = function (notificationType) {
  return this.disabledTypes.includes(notificationType)
}

const NotificationPreference = mongoose.models.NotificationPreference || mongoose.model('NotificationPreference', notificationPreferenceSchema)

export default NotificationPreference
