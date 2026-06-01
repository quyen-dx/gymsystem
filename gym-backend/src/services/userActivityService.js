import UserActivity from '../models/UserActivity.js'

export const recordUserActivity = async ({ userId, type, title, description = '', metadata = {} }) => {
  if (!userId || !type || !title) return
  await UserActivity.create({ user: userId, type, title, description, metadata })
}
