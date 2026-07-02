import UserActivity from '../models/UserActivity.js'
import { invalidatePersonalContextCache } from './conversationContextCache.js'

export const recordUserActivity = async ({ userId, type, title, description = '', metadata = {}, session = null }) => {
  if (!userId || !type || !title) return
  const docs = [{ user: userId, type, title, description, metadata }]
  const activity = session
    ? (await UserActivity.create(docs, { session }))[0]
    : await UserActivity.create(docs[0])
  const text = `${type} ${title} ${description}`.toLowerCase()
  if (text.includes('checkin') || text.includes('check-in') || text.includes('điểm danh') || text.includes('diem danh')) {
    invalidatePersonalContextCache(userId)
  }
  return activity
}
