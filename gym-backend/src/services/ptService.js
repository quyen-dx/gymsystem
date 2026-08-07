import mongoose from 'mongoose'
import User from '../models/User.js'
import PT from '../models/PT.js'
import TrainerSchedule from '../models/TrainerSchedule.js'

const DAY_LABELS = { vi: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] }
const SHIFT_LABELS = { vi: { morning: 'Sáng', afternoon: 'Chiều', evening: 'Tối' }, en: { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' } }

const buildScheduleLabel = (schedules, lang = 'vi') => {
  if (!schedules || schedules.length === 0) return ''
  const days = DAY_LABELS[lang]
  const shifts = SHIFT_LABELS[lang]
  const grouped = {}
  for (const s of schedules) {
    const dayLabel = days[s.dayOfWeek] || `Day${s.dayOfWeek}`
    const shiftLabel = shifts[s.shift] || s.shift
    if (!grouped[dayLabel]) grouped[dayLabel] = []
    if (!grouped[dayLabel].includes(shiftLabel)) grouped[dayLabel].push(shiftLabel)
  }
  return Object.entries(grouped)
    .map(([day, shiftList]) => `${day}: ${shiftList.join(', ')}`)
    .join(' | ')
}

export const getAvailablePTs = async ({ specialization = '' } = {}) => {
  const keyword = String(specialization || '').trim()
  let pts = []
  if (keyword) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const baseFilter = { role: 'pt', isActive: true }
    pts = await User.find({ ...baseFilter, fullName: new RegExp('^' + escaped + '$', 'i') })
      .select('fullName name avatar phone email contactEmail specialties rating experienceYears bio')
      .sort({ rating: -1, experienceYears: -1 })
      .lean()
    if (pts.length === 0) {
      pts = await User.find({ ...baseFilter, fullName: new RegExp(escaped, 'i') })
        .select('fullName name avatar phone email contactEmail specialties rating experienceYears bio')
        .sort({ rating: -1, experienceYears: -1 })
        .lean()
    }
    if (pts.length === 0) {
      const broadRegex = new RegExp(keyword.split(/[\s,;|]+/).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i')
      pts = await User.find({ ...baseFilter, $or: [{ fullName: broadRegex }, { name: broadRegex }, { bio: broadRegex }, { specialties: broadRegex }] })
        .select('fullName name avatar phone email contactEmail specialties rating experienceYears bio')
        .sort({ rating: -1, experienceYears: -1 })
        .lean()
    }
  } else {
    pts = await User.find({ role: 'pt', isActive: true })
      .select('fullName name avatar phone email contactEmail specialties rating experienceYears bio')
      .sort({ rating: -1, experienceYears: -1 })
      .lean()
  }

  const ptModels = await PT.find({ userId: { $in: pts.map((p) => p._id) } }).select('_id userId totalSessions totalStudents certificates').lean()
  const ptModelMap = {}
  for (const pm of ptModels) {
    ptModelMap[String(pm.userId)] = pm
  }
  const userIds = pts.map((p) => p._id)
  const scheduleDocs = userIds.length > 0
    ? await TrainerSchedule.find({ trainerId: { $in: userIds }, status: 'active' }).sort({ dayOfWeek: 1 }).lean()
    : []

  return {
    count: pts.length,
    pts: pts.map((pt) => {
      const pm = ptModelMap[String(pt._id)]
      const schedules = scheduleDocs.filter((s) => String(s.trainerId) === String(pt._id))
      return {
        id: pt._id,
        name: pt.fullName || pt.name,
        fullName: pt.fullName || pt.name,
        avatar: pt.avatar || '',
        phone: pt.phone || '',
        email: pt.email || pt.contactEmail || '',
        specialties: pt.specialties || [],
        rating: pt.rating || 0,
        experienceYears: pt.experienceYears || 0,
        bio: pt.bio || '',
        totalSessions: pm?.totalSessions || 0,
        totalStudents: pm?.totalStudents || 0,
        schedule: buildScheduleLabel(schedules),
        scheduleRaw: schedules.map((s) => ({ dayOfWeek: s.dayOfWeek, shift: s.shift })),
      }
    }),
  }
}
