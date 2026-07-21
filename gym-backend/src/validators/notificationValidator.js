import { z } from 'zod'

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID không hợp lệ')

export const sendNotificationSchema = z.object({
  title: z.string().min(1, 'Tiêu đề là bắt buộc').max(200),
  content: z.string().min(1, 'Nội dung là bắt buộc'),
  receiverId: objectId.optional(),
  receiverRole: z.enum(['member', 'pt', 'admin', 'staff', 'super_admin']).optional(),
  notificationType: z.string().optional(),
  sendEmail: z.boolean().optional(),
  sendSms: z.boolean().optional(),
  sendPush: z.boolean().optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
}).strict()

export const updatePreferenceSchema = z.object({
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  disabledTypes: z.array(z.string()).optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
}).strict()

export const createTemplateSchema = z.object({
  name: z.string().min(1, 'Tên mẫu là bắt buộc').max(100),
  description: z.string().optional(),
  notificationType: z.string().min(1, 'Loại thông báo là bắt buộc'),
  channels: z.array(z.enum(['in_app', 'email', 'sms', 'push'])).optional(),
  title: z.string().min(1, 'Tiêu đề mẫu là bắt buộc').max(200),
  titleEn: z.string().optional(),
  body: z.string().min(1, 'Nội dung mẫu là bắt buộc'),
  bodyEn: z.string().optional(),
  emailSubject: z.string().optional(),
  emailHtml: z.string().optional(),
  smsText: z.string().optional(),
  pushTitle: z.string().optional(),
  pushBody: z.string().optional(),
  placeholders: z.array(z.object({
    key: z.string(),
    description: z.string().optional(),
    required: z.boolean().optional(),
  })).optional(),
  isActive: z.boolean().optional(),
}).strict()

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  notificationType: z.string().optional(),
  channels: z.array(z.enum(['in_app', 'email', 'sms', 'push'])).optional(),
  title: z.string().min(1).max(200).optional(),
  titleEn: z.string().optional(),
  body: z.string().min(1).optional(),
  bodyEn: z.string().optional(),
  emailSubject: z.string().optional(),
  emailHtml: z.string().optional(),
  smsText: z.string().optional(),
  pushTitle: z.string().optional(),
  pushBody: z.string().optional(),
  placeholders: z.array(z.object({
    key: z.string(),
    description: z.string().optional(),
    required: z.boolean().optional(),
  })).optional(),
  isActive: z.boolean().optional(),
}).strict()

export const registerPushTokenSchema = z.object({
  token: z.string().min(1, 'Push token là bắt buộc'),
  platform: z.enum(['web', 'ios', 'android']),
  deviceId: z.string().optional(),
}).strict()
