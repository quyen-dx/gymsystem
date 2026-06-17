import User from '../models/User.js'
import PT from '../models/PT.js'
import PTSchedule from '../models/PTSchedule.js'
import Booking from '../models/Booking.js'
import { recordAuditLog } from '../services/auditLogService.js'
import { invalidateContextCache } from '../services/conversationContextCache.js'
import AppError from '../utils/appError.js'
import { isValidEmail, normalizePhone } from '../utils/identifier.js'

const sendError = (res, error) => {
  console.error(error)
  if (error?.code === 11000) {
    if (error.keyPattern?.email) return res.status(400).json({ message: 'Email đã được sử dụng' })
    if (error.keyPattern?.phone) return res.status(400).json({ message: 'Số điện thoại đã được sử dụng' })
  }
  return res.status(error.statusCode || 500).json({ message: error.message || 'Lỗi máy chủ' })
}

export const getPTs = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', specialty, minRating, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query

    const userFilter = { role: 'pt' }

    if (search) {
      const phone = search.replace(/\s/g, '')
      const isPhoneSearch = /^(0|\+84)\d{8,9}$/.test(phone)
      if (isPhoneSearch) {
        userFilter.phone = { $regex: phone.replace(/^0/, '(+84|0)'), $options: 'i' }
      } else {
        userFilter.name = { $regex: search, $options: 'i' }
      }
    }

    if (status === 'active') userFilter.isActive = true
    else if (status === 'locked') userFilter.isActive = false

    const totalUsers = await User.countDocuments(userFilter)
    const users = await User.find(userFilter)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean()

    const userIds = users.map((u) => u._id)
    const ptRecords = await PT.find({ userId: { $in: userIds } }).lean()
    const ptMap = {}
    ptRecords.forEach((pt) => { ptMap[pt.userId.toString()] = pt })

    const ptIds = ptRecords.map((pt) => pt._id)
    const scheduleMap = {}
    if (ptIds.length > 0) {
      const schedules = await PTSchedule.find({ ptId: { $in: ptIds } }).lean()
      schedules.forEach((s) => {
        const key = s.ptId.toString()
        if (!scheduleMap[key]) scheduleMap[key] = []
        scheduleMap[key].push(s)
      })
    }

    const stats = await Booking.aggregate([
      { $match: { ptId: { $in: ptIds }, status: { $ne: 'cancelled' } } },
      { $lookup: { from: 'pts', localField: 'ptId', foreignField: '_id', as: 'pt' } },
      { $unwind: { path: '$pt', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$pt.userId', count: { $sum: 1 } } },
    ])
    const bookingCountMap = {}
    stats.forEach((s) => { bookingCountMap[s._id.toString()] = s.count })

    let specialtyFilter = null
    if (specialty) specialtyFilter = new RegExp(specialty, 'i')

    const result = users
      .filter((u) => {
        if (!specialtyFilter) return true
        const pt = ptMap[u._id.toString()]
        return pt?.specialties?.some((s) => specialtyFilter.test(s))
      })
      .map((u) => {
        const pt = ptMap[u._id.toString()]
        const ptId = pt?._id?.toString()
        return {
          _id: u._id,
          name: u.name,
          fullName: u.fullName,
          email: u.email,
          phone: u.phone,
          avatar: u.avatar,
          dateOfBirth: u.dateOfBirth,
          gender: u.gender,
          isActive: u.isActive,
          status: u.status,
          createdAt: u.createdAt,
          // PT-specific fields from PT model
          specialties: pt?.specialties || [],
          bio: pt?.bio || '',
          experienceYears: pt?.experienceYears || 0,
          certificates: pt?.certificates || [],
          rating: pt?.rating || 0,
          introVideoUrl: pt?.introVideoUrl || '',
          totalSessions: pt?.totalSessions || 0,
          totalStudents: pt?.totalStudents || 0,
          ptId: ptId,
          schedules: scheduleMap[ptId] || [],
          bookingCount: bookingCountMap[u._id.toString()] || 0,
        }
      })

    res.json({
      pts: result,
      pagination: {
        total: totalUsers,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalUsers / Number(limit)),
      },
    })
  } catch (error) {
    return sendError(res, error)
  }
}

export const getPTById = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: 'pt' }).lean()
    if (!user) throw new AppError('Không tìm thấy PT', 404)

    const pt = await PT.findOne({ userId: user._id }).lean()
    const schedules = pt ? await PTSchedule.find({ ptId: pt._id }).lean() : []

    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const bookings = await Booking.find({
      ptId: pt?._id,
      date: { $gte: weekStart, $lt: weekEnd },
      status: { $ne: 'cancelled' },
    })
      .populate('memberId', 'name avatar phone')
      .sort({ date: 1, slot: 1 })
      .lean()

    res.json({
      pt: {
        _id: user._id,
        name: user.name,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        isActive: user.isActive,
        status: user.status,
        createdAt: user.createdAt,
        specialties: pt?.specialties || [],
        bio: pt?.bio || '',
        experienceYears: pt?.experienceYears || 0,
        certificates: pt?.certificates || [],
        rating: pt?.rating || 0,
        introVideoUrl: pt?.introVideoUrl || '',
        totalSessions: pt?.totalSessions || 0,
        totalStudents: pt?.totalStudents || 0,
        schedules,
      },
      bookings,
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

    const bookings = await Booking.find({
      ptId: pt._id,
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

    const scheduleSlots = await PTSchedule.find({ ptId: pt._id }).lean()

    res.json({ schedule: days, availableSlots: scheduleSlots })
  } catch (error) {
    return sendError(res, error)
  }
}

export const createPT = async (req, res) => {
  try {
    const { name, email, phone, password, dateOfBirth, gender, specialties, bio, experienceYears, certificates, introVideoUrl } = req.body

    if (!name?.trim()) throw new AppError('Họ tên là bắt buộc', 400)

    const userData = {
      name: name.trim(),
      role: 'pt',
      provider: email ? 'email' : 'phone',
      isVerified: true,
      password: password || 'pt123',
    }
    if (email) userData.email = email.toLowerCase().trim()
    if (phone) userData.phone = normalizePhone(phone)
    if (dateOfBirth) userData.dateOfBirth = new Date(dateOfBirth)
    if (gender) userData.gender = gender

    if (req.files?.avatar?.[0]) {
      userData.avatar = req.files.avatar[0].path
    }

    const user = await User.create(userData)

    const ptData = {
      userId: user._id,
      specialties: typeof specialties === 'string' ? JSON.parse(specialties) : (specialties || []),
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
    invalidateContextCache('ptList')
    invalidateContextCache('ptAvailability')

    res.status(201).json({ message: 'Thêm PT thành công', pt: { ...pt.toObject(), user: { _id: user._id, name: user.name, email: user.email, phone: user.phone, avatar: user.avatar } } })
  } catch (error) {
    return sendError(res, error)
  }
}

export const updatePT = async (req, res) => {
  try {
    const { name, email, phone, dateOfBirth, gender, specialties, bio, experienceYears, certificates, introVideoUrl } = req.body

    const user = await User.findById(req.params.id)
    if (!user || user.role !== 'pt') throw new AppError('Không tìm thấy PT', 404)

    if (name) user.name = name.trim()
    if (email) user.email = email.toLowerCase().trim()
    if (phone) {
      const np = normalizePhone(phone)
      if (!np) throw new AppError('Số điện thoại không hợp lệ', 400)
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

    if (specialties !== undefined) pt.specialties = typeof specialties === 'string' ? JSON.parse(specialties) : specialties
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
    invalidateContextCache('ptList')
    invalidateContextCache('ptAvailability')

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
    invalidateContextCache('ptList')
    invalidateContextCache('ptAvailability')

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

    let pt = await PT.findOne({ userId: user._id })
    if (!pt) {
      pt = await PT.create({ userId: user._id })
    }

    await PTSchedule.deleteMany({ ptId: pt._id })

    if (Array.isArray(schedules) && schedules.length > 0) {
      await PTSchedule.insertMany(
        schedules.map((s) => ({ ptId: pt._id, dayOfWeek: s.dayOfWeek, shift: s.shift })),
      )
    }
    invalidateContextCache('ptAvailability')

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

    const pt = await PT.findOne({ userId })
    if (!pt) throw new AppError('Không tìm thấy thông tin PT', 404)

    const queryDate = new Date(date)
    const dayOfWeek = queryDate.getDay()

    // Get PT's working schedule for this day
    const schedules = await PTSchedule.find({ ptId: pt._id, dayOfWeek })

    // Get shift mapping
    const shifts = {
      morning: { start: 6, end: 12 },
      afternoon: { start: 12, end: 18 },
      evening: { start: 18, end: 22 },
    }

    const availability = {}

    // Generate 10-minute slots for each shift
    for (const schedule of schedules) {
      const shift = shifts[schedule.shift]
      if (!shift) continue

      for (let hour = shift.start; hour < shift.end; hour++) {
        for (let minute = 0; minute < 60; minute += 10) {
          const slot = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
          availability[slot] = true
        }
      }
    }

    // Check for existing bookings and mark as unavailable
    const bookings = await Booking.find({
      ptId: pt._id,
      date: queryDate,
      status: { $in: ['pending', 'confirmed'] },
    })

    bookings.forEach((booking) => {
      availability[booking.slot] = false
    })

    // If no schedules, all slots are unavailable
    if (schedules.length === 0) {
      for (const slots of Object.keys(availability)) {
        availability[slots] = false
      }
    }

    res.json({ availability, schedules: schedules.map((s) => s.shift) })
  } catch (error) {
    return sendError(res, error)
  }
}
