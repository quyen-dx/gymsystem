import UserActivity from '../models/UserActivity.js'

export const recordUserActivity = async ({ userId, type, title, description = '', metadata = {}, session = null }) => {
  if (!userId || !type || !title) return
  const docs = [{ user: userId, type, title, description, metadata }]
  const activity = session
    ? (await UserActivity.create(docs, { session }))[0]
    : await UserActivity.create(docs[0])
  return activity
}
