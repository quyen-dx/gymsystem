import User from '../models/User.js'
import PT from '../models/PT.js'
import TrainerSchedule from '../models/TrainerSchedule.js'
import Booking from '../models/Booking.js'
import TrainingClass from '../models/TrainingClass.js'
import TrainingAssignment from '../models/TrainingAssignment.js'
import ClassEnrollment from '../models/ClassEnrollment.js'
import WorkoutSchedule from '../models/WorkoutSchedule.js'
import CheckIn from '../models/CheckIn.js'
import { recordAuditLog } from '../services/auditLogService.js'
import AppError from '../utils/appError.js'
import { isValidEmail, normalizePhone } from '../utils/identifier.js'
import sendError from '../utils/sendError.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'
import { getActiveReplacementsForPT } from '../services/shiftChangeService.js'
import { getAvailabilitySlots } from '../services/ptScheduleValidationService.js'

const ALLOWED_PT_SPECIALTIES = new Set([
  'GYM',
  'CARDIO',
  'STRENGTH TRAINING',
  'YOGA',
  'BOXING',
  'CROSSFIT',
  'PILATES',
  'ZUMBA',
])

function parseSpecialties(value) {
  const list = typeof value === 'string' ? JSON.parse(value) : (value || [])
  if (!Array.isArray(list)) return []

  return [...new Set(
    list
      .map((item) => String(item || '').trim().toUpperCase())
      .filter((item) => ALLOWED_PT_SPECIALTIES.has(item)),
  )]
}

// Lịch bận do PT phụ trách lớp nhóm (TrainingClass active) — expand theo từng ngày trong khoảng thời gian
const buildClassBusyEntries = async ({ trainerIds, from, to }) => {
  const classes = await TrainingClass.find({
    ptId: { $in: trainerIds },
    status: { $nin: ['closed', 'inactive'] },
    daysOfWeek: { $ne: [] },
  })
    .select('ptId name daysOfWeek startTime endTime')
    .lean()

  const entries = []
  for (const c of classes) {
    if (!c.startTime || !c.endTime) continue
    const slot = `${String(c.startTime).slice(0, 5)}-${String(c.endTime).slice(0, 5)}`
    for (let t = from.getTime(); t < to.getTime(); t += 24 * 60 * 60 * 1000) {
      const d = new Date(t)
      if ((c.daysOfWeek || []).includes(d.getDay())) {
        entries.push({ ptId: c.ptId, date: d, slot })
      }
    }
  }
  return entries
}

export const getPTs = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', specialty, minRating, status, isActive, sortBy = 'createdAt', sortOrder = 'desc' } = req.query

    const userFilter = { role: 'pt' }
    const isMemberViewer = req.user?.role === 'member'
    // Hội viên chỉ được chọn PT đang hoạt động; không được nhìn thấy tài khoản đã khóa.
    if (isMemberViewer) {
      userFilter.isActive = true
      userFilter.status = { $ne: 'locked' }
    }

    if (search) {
      const keyword = String(search).trim()
      const compactKeyword = keyword.replace(/\s+/g, '')
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const escapedCompact = compactKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      userFilter.$or = [
        { fullName: { $regex: escapedKeyword, $options: 'i' } },
        { name: { $regex: escapedKeyword, $options: 'i' } },
        { email: { $regex: escapedCompact, $options: 'i' } },
        { phone: { $regex: escapedCompact, $options: 'i' } },
      ]
    }

    if (!isMemberViewer) {
      if (status === 'active' || isActive === 'true' || isActive === true) userFilter.isActive = true
      else if (status === 'locked' || isActive === 'false' || isActive === false) userFilter.isActive = false
    }

    const allUsers = await User.find(userFilter)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .lean()

    const userIds = allUsers.map((u) => u._id)
    const ptRecords = await PT.find({ userId: { $in: userIds } }).lean()
    const ptMap = {}
    ptRecords.forEach((pt) => { ptMap[pt.userId.toString()] = pt })

    // Lịch làm việc lấy từ TrainerSchedule (lịch cố định theo tuần do Admin thiết lập)
    const scheduleMap = {}
    if (userIds.length > 0) {
      const schedules = await TrainerSchedule.find({ trainerId: { $in: userIds }, status: 'active' })
        .sort({ dayOfWeek: 1 })
        .lean()
      schedules.forEach((s) => {
        const key = s.trainerId.toString()
        if (!scheduleMap[key]) scheduleMap[key] = []
        scheduleMap[key].push(s)
      })
    }

    // Booking.ptId tham chiếu User (không phải PT profile)
    const stats = await Booking.aggregate([
      { $match: { ptId: { $in: userIds }, status: { $ne: 'cancelled' } } },
      { $group: { _id: '$ptId', count: { $sum: 1 } } },
    ])
    const bookingCountMap = {}
    stats.forEach((s) => { bookingCountMap[s._id.toString()] = s.count })

    // Lịch bận của từng PT (booking đang hoạt động trong 12 tuần tới) — để member
    // thấy ngay khung nào bị khóa khi chọn ngày/giờ trong form đặt lịch
    const busyMap = {}
    if (userIds.length > 0) {
      const busyStart = new Date()
      busyStart.setHours(0, 0, 0, 0)
      const busyEnd = new Date(busyStart.getTime() + 12 * 7 * 24 * 60 * 60 * 1000)
      const busyBookings = await Booking.find({
        ptId: { $in: userIds },
        date: { $gte: busyStart, $lt: busyEnd },
        status: { $in: ['pending', 'awaiting_payment', 'confirmed'] },
      })
        .select('ptId date slot')
        .lean()
      busyBookings.forEach((b) => {
        const key = b.ptId.toString()
        if (!busyMap[key]) busyMap[key] = []
        busyMap[key].push({ date: b.date, slot: b.slot })
      })

      // Lịch bận do phụ trách lớp nhóm (hiển thị khóa giờ trong form đặt lịch)
      const classBusy = await buildClassBusyEntries({ trainerIds: userIds, from: busyStart, to: busyEnd })
      classBusy.forEach((e) => {
        const key = e.ptId.toString()
        if (!busyMap[key]) busyMap[key] = []
        busyMap[key].push({ date: e.date, slot: e.slot })
      })
    }

    let specialtyFilter = null
    if (specialty) {
      const escapedSpecialty = String(specialty).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      specialtyFilter = new RegExp(`^${escapedSpecialty}$`, 'i')
    }

    const filteredUsers = allUsers
      .filter((u) => {
        if (!specialtyFilter) return true
        const pt = ptMap[u._id.toString()]
        return pt?.specialties?.some((s) => specialtyFilter.test(s))
      })

    const pageNumber = Number(page)
    const limitNumber = Number(limit)
    const pagedUsers = filteredUsers.slice((pageNumber - 1) * limitNumber, pageNumber * limitNumber)

    const result = pagedUsers
      .map((u) => {
        const pt = ptMap[u._id.toString()]
        const ptId = pt?._id?.toString()
        const base = {
          _id: u._id,
          name: u.fullName || u.name,
          fullName: u.fullName,
          avatar: u.avatar,
          specialties: pt?.specialties || [],
          bio: pt?.bio || '',
          experienceYears: pt?.experienceYears || 0,
          rating: pt?.rating || 0,
          schedules: scheduleMap[u._id.toString()] || [],
          busyBookings: busyMap[u._id.toString()] || [],
        }
        if (isMemberViewer) return base
        return {
          ...base,
          email: u.email,
          phone: u.phone,
          dateOfBirth: u.dateOfBirth,
          gender: u.gender,
          isActive: u.isActive,
          status: u.status,
          createdAt: u.createdAt,
          certificates: pt?.certificates || [],
          introVideoUrl: pt?.introVideoUrl || '',
          totalSessions: pt?.totalSessions || 0,
          totalStudents: pt?.totalStudents || 0,
          ptId,
          bookingCount: bookingCountMap[u._id.toString()] || 0,
        }
      })

    res.json({
      pts: result,
      pagination: {
        total: filteredUsers.length,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(filteredUsers.length / limitNumber),
      },
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const getPTById = async (req, res) => {
  try {
    const isMemberViewer = req.user?.role === 'member'
    const userFilter = { _id: req.params.id, role: 'pt' }
    if (isMemberViewer) {
      userFilter.isActive = true
      userFilter.status = { $ne: 'locked' }
    }
    const user = await User.findOne(userFilter).lean()
    if (!user) throw new AppError('Không tìm thấy PT', 404)

    const pt = await PT.findOne({ userId: user._id }).lean()
    const schedules = await TrainerSchedule.find({ trainerId: user._id, status: 'active' }).sort({ dayOfWeek: 1 }).lean()

    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    // Lịch bận 12 tuần tới — để member thấy khung giờ bị khóa ngay trong form đặt lịch
    const busyStart = new Date()
    busyStart.setHours(0, 0, 0, 0)
    const busyEnd = new Date(busyStart.getTime() + 12 * 7 * 24 * 60 * 60 * 1000)
    const busyBookings = await Booking.find({
      ptId: user._id,
      date: { $gte: busyStart, $lt: busyEnd },
      status: { $in: ['pending', 'awaiting_payment', 'confirmed'] },
    })
      .select('date slot')
      .lean()

    // Lịch bận do phụ trách lớp nhóm (hiển thị khóa giờ trong form đặt lịch)
    const classBusy = await buildClassBusyEntries({ trainerIds: [user._id], from: busyStart, to: busyEnd })
    busyBookings.push(...classBusy.map((e) => ({ date: e.date, slot: e.slot })))

    // Chi tiết booking có PII của hội viên chỉ dành cho quản trị. Hội viên chỉ
    // nhận busyBookings để chọn giờ, không nhận danh tính khách khác.
    const bookings = isMemberViewer ? [] : await Booking.find({
      ptId: user._id,
      date: { $gte: weekStart, $lt: weekEnd },
      status: { $ne: 'cancelled' },
    })
      .populate('memberId', 'name avatar phone')
      .sort({ date: 1, slot: 1 })
      .lean()

    res.json({
      pt: {
        _id: user._id,
        name: user.fullName || user.name,
        fullName: user.fullName,
        avatar: user.avatar,
        specialties: pt?.specialties || [],
        bio: pt?.bio || '',
        experienceYears: pt?.experienceYears || 0,
        rating: pt?.rating || 0,
        schedules,
        busyBookings,
        ...(!isMemberViewer ? {
          email: user.email,
          phone: user.phone,
          dateOfBirth: user.dateOfBirth,
          gender: user.gender,
          isActive: user.isActive,
          status: user.status,
          createdAt: user.createdAt,
          certificates: pt?.certificates || [],
          introVideoUrl: pt?.introVideoUrl || '',
          totalSessions: pt?.totalSessions || 0,
          totalStudents: pt?.totalStudents || 0,
        } : {}),
      },
      ...(!isMemberViewer ? { bookings } : {}),
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const getPTSchedule = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: 'pt' }).lean()
    if (!user) throw new AppError('Không tìm thấy PT', 404)

    const pt = await PT.findOne({ userId: user._id }).lean()
    if (!pt) throw new AppError('PT chưa có hồ sơ', 404)

    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    // Booking.ptId tham chiếu User
    const bookings = await Booking.find({
      ptId: user._id,
      date: { $gte: weekStart, $lt: weekEnd },
      status: { $ne: 'cancelled' },
    })
      .populate('memberId', 'name avatar phone')
      .sort({ date: 1, slot: 1 })
      .lean()

    const days = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      const dayBookings = bookings.filter(
        (b) => new Date(b.date).toISOString().split('T')[0] === dateStr,
      )
      days.push({
        date: dateStr,
        dayOfWeek: d.getDay(),
        bookings: dayBookings,
      })
    }

    // Lịch làm việc cố định theo tuần (TrainerSchedule)
    const scheduleSlots = await TrainerSchedule.find({ trainerId: user._id, status: 'active' }).sort({ dayOfWeek: 1 }).lean()

    res.json({ schedule: days, availableSlots: scheduleSlots })
  } catch (error) {
    return sendError(res, error)
  }
}

/**
 * Lấy lịch PT 1-1 (Booking) của chính PT trong tuần được chọn.
 * Query params: weekStart=YYYY-MM-DD (Monday). Mặc định: tuần hiện tại.
 */
export const getPTMySchedule = async (req, res) => {
  try {
    const { weekStart } = req.query
    let start
    if (weekStart && /^\d{4}-\d{2}-\d{2}$/.test(String(weekStart))) {
      start = new Date(`${String(weekStart)}T00:00:00.000Z`)
    } else {
      start = new Date()
      start.setHours(0, 0, 0, 0)
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
    }
    const end = new Date(start)
    end.setDate(end.getDate() + 7)

    const bookings = await Booking.find({
      ptId: req.user._id,
      date: { $gte: start, $lt: end },
      status: 'confirmed',
    })
      .populate('memberId', 'name avatar phone')
      .sort({ date: 1, slot: 1 })
      .lean()

    res.json({ bookings })
  } catch (error) {
    return sendError(res, error)
  }
}

export const getPTMyClasses = async (req, res) => {
  try {
    const assignments = await TrainingAssignment.find({ trainerId: req.user._id, status: 'active' })
      .populate({
        path: 'classId',
        populate: [
          { path: 'floorId', select: 'name' },
          { path: 'zoneId', select: 'name' },
        ],
      })
      .sort({ createdAt: -1 })
      .lean()

    const classes = assignments.map(a => a.classId).filter(Boolean)

    res.json({ classes })
  } catch (error) {
    return sendError(res, error)
  }
}

const DAY_LABELS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']

/**
 * Lấy số lượng hội viên có buổi tập thực tế cho từng lớp theo từng ngày trong tuần.
 * Query params: weekStart=YYYY-MM-DD (Monday of the week)
 * Tự động tạo notification nếu có lớp sắp tới (24-48h) mà không có hội viên.
 */
export const getPTMyWeekAttendees = async (req, res) => {
  try {
    const { weekStart } = req.query
    if (!weekStart) {
      return res.status(400).json({ message: 'Thiếu weekStart (YYYY-MM-DD)' })
    }

    const startDate = new Date(weekStart)
    if (isNaN(startDate.getTime())) {
      return res.status(400).json({ message: 'weekStart không hợp lệ' })
    }

    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 7)

    const assignments = await TrainingAssignment.find({ trainerId: req.user._id, status: 'active' })
      .populate('classId', '_id code name daysOfWeek startTime endTime')
      .lean()

    const classes = assignments.map(a => a.classId).filter(Boolean)

    // Replacements (thay ca) còn hiệu lực trong tuần — chỉ để override khi render lịch,
    // KHÔNG đổi assignedTrainer / TrainingClass.
    const replacements = await getActiveReplacementsForPT({ ptId: req.user._id, weekStart }).catch(() => [])

    // Lấy lớp gốc của các ca thay để tính số hội viên khi render card "Ca thay"
    const replacementClasses = []
    const seenClassIds = new Set(classes.map(c => String(c._id)))
    for (const r of replacements) {
      const cid = typeof r.classId === 'object' ? r.classId?._id : r.classId
      if (!cid || seenClassIds.has(String(cid))) continue
      seenClassIds.add(String(cid))
      const cls = await TrainingClass.findById(cid).select('_id code name daysOfWeek startTime endTime').lean()
      if (cls) replacementClasses.push(cls)
    }

    const allClasses = [...classes, ...replacementClasses]

    if (allClasses.length === 0) {
      return res.json({ attendees: [], replacements })
    }

    const classCodes = allClasses.map(c => c.code).filter(Boolean)
    const classIds = allClasses.map(c => c._id).filter(Boolean)

    // Lấy enrolled members từ ClassEnrollment (bao gồm cả chưa có workout)
    const enrollments = await ClassEnrollment.find({
      classId: { $in: classIds },
      status: 'active',
    })
      .populate('memberId', 'name fullName memberCode')
      .lean()

    // Thêm enrolled members vào attendeeMap trước
    // Dùng weekday của class, không giới hạn ngày
    const attendeeMap = new Map()
    for (const enrollment of enrollments) {
      const member = typeof enrollment.memberId === 'object' ? enrollment.memberId : null
      if (!member?._id) continue
      const cls = allClasses.find(c => String(c._id) === String(enrollment.classId))
      if (!cls) continue
      for (const dayOfWeek of cls.daysOfWeek || []) {
        const key = `${dayOfWeek}_${cls.code}`
        if (!attendeeMap.has(key)) {
          attendeeMap.set(key, new Map())
        }
        const members = attendeeMap.get(key)
        if (!members.has(String(member._id))) {
          members.set(String(member._id), {
            _id: member._id,
            name: member.fullName || member.name || '',
            memberCode: member.memberCode || '',
          })
        }
      }
    }

    const schedules = await WorkoutSchedule.find({
      status: 'active',
      'sessions.date': { $gte: startDate, $lt: endDate },
      'sessions.classCode': { $in: classCodes },
      'sessions.status': { $ne: 'cancelled' },
    })
      .populate('memberId', 'name fullName memberCode')
      .lean()

    for (const schedule of schedules) {
      const member = typeof schedule.memberId === 'object' ? schedule.memberId : null
      if (!member?._id) continue

      for (const session of schedule.sessions || []) {
        if (!session.classCode || !classCodes.includes(session.classCode)) continue
        if (session.status === 'cancelled' || session.status === 'skipped') continue

        const sessionDate = new Date(session.date)
        if (sessionDate < startDate || sessionDate >= endDate) continue

        const dayOfWeek = sessionDate.getDay()
        const key = `${dayOfWeek}_${session.classCode}`

        if (!attendeeMap.has(key)) {
          attendeeMap.set(key, new Map())
        }
        const members = attendeeMap.get(key)
        if (!members.has(String(member._id))) {
          members.set(String(member._id), {
            _id: member._id,
            name: member.fullName || member.name || '',
            memberCode: member.memberCode || '',
          })
        }
      }
    }

    // Build attendee list with check-in status for today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayEnd = new Date(today)
    todayEnd.setHours(23, 59, 59, 999)
    const todayDayOfWeek = today.getDay()

    // Collect all member IDs from today's sessions
    const todayMemberIds = new Set()
    const todaySessionKeys = new Set()
    for (const [key, members] of attendeeMap) {
      const [dayOfWeek] = key.split('_')
      if (parseInt(dayOfWeek) === todayDayOfWeek) {
        todaySessionKeys.add(key)
        for (const memberId of members.keys()) {
          todayMemberIds.add(memberId)
        }
      }
    }

    // Batch-query today's check-ins for all relevant members
    const todayCheckins = todayMemberIds.size > 0
      ? await CheckIn.find({
          memberId: { $in: Array.from(todayMemberIds) },
          sessionDate: { $gte: today, $lte: todayEnd },
          status: 'success',
        }).select('memberId checkinTime sessionType scheduleId sessionIndex').lean()
      : []

    const checkinMap = new Map()
    for (const c of todayCheckins) {
      const mid = String(c.memberId)
      if (!checkinMap.has(mid)) checkinMap.set(mid, [])
      checkinMap.get(mid).push(c)
    }

    const attendees = []
    for (const [key, members] of attendeeMap) {
      const [dayOfWeek, code] = key.split('_')
      const cls = allClasses.find(c => c.code === code)
      const isToday = parseInt(dayOfWeek) === todayDayOfWeek

      const memberList = Array.from(members.values()).map(m => {
        const mDoc = { _id: m._id, name: m.name, memberCode: m.memberCode }
        if (isToday) {
          const memberCheckins = checkinMap.get(String(m._id)) || []
          const hasCheckin = memberCheckins.length > 0
          mDoc.checkedIn = hasCheckin
          mDoc.checkedInAt = hasCheckin ? memberCheckins[0].checkinTime : null
        }
        return mDoc
      })

      attendees.push({
        dayOfWeek: parseInt(dayOfWeek),
        classId: cls?._id || null,
        code,
        count: members.size,
        members: memberList,
      })
    }

    // Auto-notify for upcoming empty classes (within 24-48h)
    const now = new Date()
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)

    for (const entry of attendees) {
      if (entry.count > 0) continue

      const classDate = new Date(startDate)
      classDate.setDate(classDate.getDate() + ((entry.dayOfWeek - startDate.getDay() + 7) % 7))

      if (classDate >= now && classDate <= in48h) {
        const cls = classes.find(c => c._id === entry.classId)
        if (cls) {
          const dayLabel = DAY_LABELS[entry.dayOfWeek] || ''
          const dateStr = `${classDate.getDate()}/${classDate.getMonth() + 1}`
          createNotification({
            receiverId: req.user._id,
            receiverRole: 'pt',
            notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
            title: 'Lớp sắp tới chưa có hội viên',
            content: `Lớp [${cls.code}] ${cls.name} ngày ${dateStr} (${dayLabel}) hiện chưa có hội viên nào đăng ký buổi tập.`,
            relatedId: cls._id,
            relatedType: 'TrainingClass',
            redirectUrl: '/pt/schedule',
            createdBy: 'System',
          }).catch(err => console.error('Notify empty class failed:', err.message))
        }
      }
    }

    res.json({ attendees, replacements })
  } catch (error) {
    return sendError(res, error)
  }
}

export const createPT = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      dateOfBirth,
      gender,
      specialties,
      bio,
      experienceYears,
      certificates,
      introVideoUrl,
    } = req.body
    if (!name?.trim()) throw new AppError('Họ tên là bắt buộc', 400)
    if (!email && !phone) throw new AppError('PT cần có email hoặc số điện thoại', 400)
    if (!password || String(password).length < 8) {
      throw new AppError('Mật khẩu khởi tạo cho PT phải có ít nhất 8 ký tự', 400)
    }
    const normalizedEmail = email ? String(email).toLowerCase().trim() : ''
    const normalizedPhone = phone ? normalizePhone(phone) : ''
    if (normalizedEmail && !isValidEmail(normalizedEmail)) throw new AppError('Email không hợp lệ', 400)
    if (phone && !normalizedPhone) throw new AppError('Số điện thoại không hợp lệ', 400)
    const duplicate = await User.findOne({
      $or: [
        ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
        ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
      ],
    }).lean()
    if (duplicate) throw new AppError('Email hoặc số điện thoại đã được sử dụng', 409)

    const userData = {
      name: name.trim(),
      role: 'pt',
      provider: email ? 'email' : 'phone',
      isVerified: true,
      password: String(password),
      specialties: parseSpecialties(specialties),
    }
    if (normalizedEmail) userData.email = normalizedEmail
    if (normalizedPhone) userData.phone = normalizedPhone
    if (dateOfBirth) userData.dateOfBirth = new Date(dateOfBirth)
    if (gender) userData.gender = gender

    if (req.files?.avatar?.[0]) {
      userData.avatar = req.files.avatar[0].path
    }

    const user = await User.create(userData)

    const ptData = {
      userId: user._id,
      specialties: userData.specialties,
      bio: bio?.trim() || '',
      experienceYears: Number(experienceYears) || 0,
      certificates: typeof certificates === 'string' ? JSON.parse(certificates) : (certificates || []),
      introVideoUrl: introVideoUrl?.trim() || '',
    }
    const pt = await PT.create(ptData)

    await recordAuditLog({
      req,
      module: 'users',
      action: 'create',
      entity: user,
      details: 'Thêm PT mới',
    })
    res.status(201).json({ message: 'Thêm PT thành công', pt: { ...pt.toObject(), user: { _id: user._id, name: user.name, email: user.email, phone: user.phone, avatar: user.avatar } } })
  } catch (error) {
    return sendError(res, error)
  }
}

export const updatePT = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      dateOfBirth,
      gender,
      specialties,
      bio,
      experienceYears,
      certificates,
      introVideoUrl,
    } = req.body
    const user = await User.findById(req.params.id)
    if (!user || user.role !== 'pt') throw new AppError('Không tìm thấy PT', 404)

    const hasField = (field) => Object.prototype.hasOwnProperty.call(req.body, field)
    if (hasField('name') && !String(name || '').trim()) throw new AppError('Họ tên là bắt buộc', 400)
    if (hasField('name')) user.name = String(name).trim()
    if (hasField('email')) {
      const normalizedEmail = String(email || '').toLowerCase().trim()
      if (normalizedEmail && !isValidEmail(normalizedEmail)) throw new AppError('Email không hợp lệ', 400)
      const duplicate = normalizedEmail
        ? await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } }).lean()
        : null
      if (duplicate) throw new AppError('Email đã được sử dụng', 409)
      user.email = normalizedEmail || undefined
    }
    if (hasField('phone')) {
      const np = phone ? normalizePhone(phone) : ''
      if (!np) throw new AppError('Số điện thoại không hợp lệ', 400)
      const duplicate = await User.findOne({ phone: np, _id: { $ne: user._id } }).lean()
      if (duplicate) throw new AppError('Số điện thoại đã được sử dụng', 409)
      user.phone = np
    }
    if (dateOfBirth) user.dateOfBirth = new Date(dateOfBirth)
    if (gender) user.gender = gender

    if (req.files?.avatar?.[0]) {
      user.avatar = req.files.avatar[0].path
    }

    await user.save()

    let pt = await PT.findOne({ userId: user._id })
    if (!pt) {
      pt = await PT.create({ userId: user._id })
    }

    if (specialties !== undefined) {
      pt.specialties = parseSpecialties(specialties)
      user.specialties = pt.specialties
    }
    if (bio !== undefined) pt.bio = bio.trim()
    if (experienceYears !== undefined) pt.experienceYears = Number(experienceYears)
    if (certificates !== undefined) pt.certificates = typeof certificates === 'string' ? JSON.parse(certificates) : certificates
    if (introVideoUrl !== undefined) pt.introVideoUrl = introVideoUrl.trim()

    await pt.save()

    await recordAuditLog({
      req,
      module: 'users',
      action: 'update',
      entity: user,
      details: 'Cập nhật thông tin PT',
    })
    res.json({ message: 'Cập nhật thành công' })
  } catch (error) {
    return sendError(res, error)
  }
}

export const deletePT = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user || user.role !== 'pt') throw new AppError('Không tìm thấy PT', 404)

    user.isActive = false
    user.isLocked = true
    user.status = 'locked'
    await user.save()

    await recordAuditLog({
      req,
      module: 'users',
      action: 'delete',
      entity: user,
      details: 'Xóa PT (vô hiệu hóa)',
    })
    res.json({ message: 'Đã xóa PT' })
  } catch (error) {
    return sendError(res, error)
  }
}

export const updatePTSchedule = async (req, res) => {
  try {
    const { schedules } = req.body
    const user = await User.findById(req.params.id)
    if (!user || user.role !== 'pt') throw new AppError('Không tìm thấy PT', 404)

    const { setSchedule } = await import('../services/trainerScheduleService.js')
    await setSchedule({ trainerId: user._id, schedules: Array.isArray(schedules) ? schedules : [] })

    createNotification({
      receiverId: req.params.id,
      receiverRole: 'pt',
      notificationType: NOTIFICATION_TYPES.PT_SCHEDULE_CHANGED,
      title: 'Lịch làm việc đã được cập nhật',
      content: `Lịch làm việc của bạn đã được Admin cập nhật.`,
      relatedId: req.params.id,
      relatedType: 'PTSchedule',
      redirectUrl: '/pt/schedule',
      createdBy: 'Admin',
    }).catch(err => console.error('Notify PT schedule failed:', err.message))

    res.json({ message: 'Cập nhật lịch làm việc thành công' })
  } catch (error) {
    return sendError(res, error)
  }
}

export const getPTAvailability = async (req, res) => {
  try {
    const { id: userId } = req.params
    const { date } = req.query

    const user = await User.findById(userId)
    if (!user || user.role !== 'pt') throw new AppError('Không tìm thấy PT', 404)

    if (!date || Number.isNaN(new Date(date).getTime())) {
      throw new AppError('Thiếu hoặc sai tham số date (YYYY-MM-DD)', 400)
    }

    // Khung giờ trống sinh từ lịch làm việc cố định (TrainerSchedule),
    // loại trừ slot đã đặt / đang cover ca thay / trùng lớp nhóm.
    const { availability, windows, schedules } = await getAvailabilitySlots({ trainerId: userId, date })

    res.json({ availability, schedules, windows })
  } catch (error) {
    return sendError(res, error)
  }
}
