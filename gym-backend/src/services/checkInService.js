import mongoose from 'mongoose'
import CheckIn from '../models/CheckIn.js'

const toObjectId = (value, fieldName) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    const error = new Error(`${fieldName} không hợp lệ`)
    error.statusCode = 400
    throw error
  }
  return new mongoose.Types.ObjectId(value)
}

const computeStreak = (checkins) => {
  if (checkins.length === 0) return 0
  let streak = 1
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const lastDate = new Date(checkins[0].checkinTime)
  lastDate.setHours(0, 0, 0, 0)
  if (Math.floor((today - lastDate) / (24 * 60 * 60 * 1000)) > 1) return 0
  for (let i = 1; i < checkins.length; i++) {
    const curr = new Date(checkins[i].checkinTime)
    curr.setHours(0, 0, 0, 0)
    const prev = new Date(checkins[i - 1].checkinTime)
    prev.setHours(0, 0, 0, 0)
    if (Math.floor((prev - curr) / (24 * 60 * 60 * 1000)) === 1) streak++
    else break
  }
  return streak
}

export const getCheckinStats = async ({ userId }) => {
  const memberId = toObjectId(userId, 'userId')
  const allCheckins = await CheckIn.find({ memberId, status: 'success' })
    .sort({ checkinTime: -1 })
    .lean()
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  let thisMonth = 0, thisWeek = 0, last30Days = 0
  let lastCheckin = null, todayCheckinTime = null
  for (const c of allCheckins) {
    const ct = new Date(c.checkinTime)
    if (ct >= startOfMonth) thisMonth++
    if (ct >= startOfWeek) thisWeek++
    if (ct >= thirtyDaysAgo) last30Days++
    if (!lastCheckin) lastCheckin = ct
    if (ct >= todayStart && !todayCheckinTime) todayCheckinTime = ct
  }

  return {
    stats: {
      total: allCheckins.length,
      thisMonth,
      thisWeek,
      last30Days,
      lastCheckin,
      todayCheckinTime,
      streak: computeStreak(allCheckins),
    },
  }
}
