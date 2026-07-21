import CheckIn from '../models/CheckIn.js'

export const calculateStreak = async (memberId) => {
  const checkins = await CheckIn.find({ memberId, status: 'success' })
    .sort({ checkinTime: -1 })
    .lean()

  if (checkins.length === 0) return 0

  let streak = 1
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const lastCheckin = new Date(checkins[0].checkinTime)
  lastCheckin.setHours(0, 0, 0, 0)

  const diffFromToday = Math.floor((today - lastCheckin) / (24 * 60 * 60 * 1000))
  if (diffFromToday > 1) return 0

  for (let i = 1; i < checkins.length; i++) {
    const curr = new Date(checkins[i].checkinTime)
    curr.setHours(0, 0, 0, 0)
    const prev = new Date(checkins[i - 1].checkinTime)
    prev.setHours(0, 0, 0, 0)
    const diff = Math.floor((prev - curr) / (24 * 60 * 60 * 1000))
    if (diff === 1) {
      streak++
    } else {
      break
    }
  }

  return streak
}
