import UserActivity from '../models/UserActivity.js'
import { invalidatePersonalContextCache } from './conversationContextCache.js'

export const recordUserActivity = async ({ userId, type, title, description = '', metadata = {} }) => {
  if (!userId || !type || !title) return
  const activity = await UserActivity.create({ user: userId, type, title, description, metadata })
  const text = `${type} ${title} ${description}`.toLowerCase()
  if (text.includes('checkin') || text.includes('check-in') || text.includes('điểm danh') || text.includes('diem danh')) {
    invalidatePersonalContextCache(userId)
  }
  return activity
}
