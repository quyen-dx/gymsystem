import mongoose from 'mongoose'
import WorkoutSchedule from '../models/WorkoutSchedule.js'
import PTAssignment from '../models/PTAssignment.js'
import TrainingClass from '../models/TrainingClass.js'
import TrainingAssignment from '../models/TrainingAssignment.js'
import Workout from '../models/Workout.js'
import Booking from '../models/Booking.js'
import CheckIn from '../models/CheckIn.js'
import MembershipCycle from '../models/MembershipCycle.js'
import User from '../models/User.js'
import { validatePTAssignment, findPTMemberConflicts, toMinutes } from '../services/ptScheduleValidationService.js'
import { recordAuditLog } from '../services/auditLogService.js'
import { NOTIFICATION_TYPES } from '../models/Notification.js'
import { createNotification } from '../services/notificationService.js'
import { assignTemplateIndexes, buildPlanSummary, findNextPlanIndex, buildSessionFromTemplateDay } from '../services/workoutPlanProgressService.js'

const isAdmin = (user) => ['admin', 'super_admin'].includes(user?.role)

// Chỉ PT phụ trách member (PT 1-1 hoặc PT dạy lớp nhóm của member) — hoặc admin — mới được tạo lịch cho member đó
const assertCanManageMember = async ({ memberId, req }) => {
  if (isAdmin(req.user)) return true
  const [pt1on1, group] = await Promise.all([
    PTAssignment.exists({ memberId, ptId: req.user._id, status: 'active' }),
    TrainingAssignment.exists({ memberId, trainerId: req.user._id, status: 'active' }),
  ])
  if (!pt1on1 && !group) {
    const err = new Error('Bạn không phụ trách hội viên này')
    err.statusCode = 403
    throw err
  }
  return true
}

// Validate từng buổi trong payload tạo lịch: gói còn hạn + lịch làm việc PT + không trùng slot PT với member khác
export const validateScheduleSessions = async ({ memberId, ptId, sessions }) => {
  const errors = []
  for (const s of sessions || []) {
    if (!s.date || !s.time) {
      errors.push(`Buổi ${s.dayOrder || '?'} thiếu ngày hoặc khung giờ tập`)
      continue
    }
    const dayStart = new Date(s.date)
    dayStart.setHours(0, 0, 0, 0)

    const activeCycle = await MembershipCycle.findOne({
      memberId,
      status: 'active',
      expiresAt: { $gte: dayStart },
    }).lean()
    if (!activeCycle) {
      errors.push(`Buổi ${s.dayOrder}: hội viên cần gói tập còn hiệu lực vào ngày ${dayStart.toLocaleDateString('vi-VN')}`)
      continue
    }

    const startTime = String(s.time).split('-')[0].trim()
    const ptCheck = await validatePTAssignment({
      trainerId: ptId,
      date: dayStart,
      slot: s.endTime ? `${startTime}-${s.endTime}` : startTime,
    })
    if (!ptCheck.ok) {
      errors.push(`Buổi ${s.dayOrder} (${dayStart.toLocaleDateString('vi-VN')} ${startTime}): ${ptCheck.message}`)
      continue
    }

    const conflicts = await findPTMemberConflicts({
      ptId,
      date: dayStart,
      slot: s.endTime ? `${startTime}-${s.endTime}` : startTime,
      excludeMemberId: memberId,
    })
    if (conflicts.length > 0) {
      const c = conflicts[0]
      errors.push(`Buổi ${s.dayOrder} (${startTime}): PT đã có lịch với ${c.memberName} cùng khung giờ`)
    }
  }
  return errors
}

/**
 * Build display location from a (populated) TrainingClass: "Floor - Zone", e.g. "Tầng 1 - P201".
 */
export const buildClassLocation = (cls) => {
  const parts = []
  if (cls?.floorId && typeof cls.floorId === 'object' && cls.floorId.name) parts.push(cls.floorId.name)
  if (cls?.zoneId && typeof cls.zoneId === 'object' && cls.zoneId.name) parts.push(cls.zoneId.name)
  return parts.join(' - ')
}

/**
 * For sessions missing endTime / className / location / classCode,
 * match against the PT's TrainingClass to fill them in OR correct wrong values.
 */
const enrichSessions = async (schedules) => {
  if (!schedules.length) return schedules

  const ptIds = [...new Set(schedules.map(s => {
    const p = s.assignedBy
    return String((p && typeof p === 'object' ? p._id : p) || '')
  }).filter(Boolean))]

  if (!ptIds.length) return schedules

  const assignments = await TrainingAssignment.find({ trainerId: { $in: ptIds }, status: 'active' })
    .populate({
      path: 'classId',
      populate: [
        { path: 'zoneId', select: 'name maxCapacity' },
        { path: 'floorId', select: 'name' },
      ],
    })
    .lean()

  for (const schedule of schedules) {
    const ptId = String(schedule.assignedBy && typeof schedule.assignedBy === 'object' ? schedule.assignedBy._id : schedule.assignedBy)
    const ptAssignments = assignments.filter(a => String(a.trainerId) === ptId)

    for (const session of schedule.sessions || []) {
      if (!session.date || !session.time) continue

      const dayOfWeek = new Date(session.date).getDay()
      const sessionTime = session.time

      const matched = ptAssignments
        .map(a => a.classId)
        .filter(Boolean)
        .find(c =>
          (c.daysOfWeek || []).includes(dayOfWeek) && c.startTime === sessionTime
        )

      if (matched) {
        if (!session.endTime || session.endTime === '') session.endTime = matched.endTime || ''
        session.className = matched.name || ''
        session.classCode = matched.code || ''

        session.location = buildClassLocation(matched)
      }
    }
  }
  return schedules
}

export const createSchedule = async (req, res) => {
  try {
    const { templateId, memberId, sessions, weekIndex, totalWeeks } = req.body
    const ptId = req.user._id

    if (!templateId || !memberId || !sessions || !Array.isArray(sessions) || sessions.length === 0) {
      return res.status(400).json({ message: 'Thiếu thông tin: templateId, memberId, sessions' })
    }

    // 1. Quyền: chỉ PT phụ trách member (hoặc admin)
    await assertCanManageMember({ memberId, req })

    // 2. Validate từng buổi: gói còn hạn, lịch làm việc PT, không trùng slot PT với member khác
    const validationErrors = await validateScheduleSessions({ memberId, ptId, sessions })
    if (validationErrors.length > 0) {
      return res.status(409).json({ message: validationErrors.join('; ') })
    }

    const template = await Workout.findById(templateId)
    if (!template || !template.isTemplate) {
      return res.status(404).json({ message: 'Không tìm thấy giáo án mẫu' })
    }

    // 3. Chính sách 1 member = 1 PT active cho PT 1-1
    const { createAssignment } = await import('../services/ptAssignmentService.js')
    const existingOtherPt = await PTAssignment.findOne({
      memberId,
      status: 'active',
      ptId: { $ne: ptId },
    }).lean()
    if (existingOtherPt) {
      return res.status(409).json({ message: 'Hội viên này đã có PT phụ trách khác đang hoạt động' })
    }

    // 3b. Mỗi member chỉ có 1 kế hoạch (WorkoutSchedule) đang hoạt động — tránh trùng giáo án
    const existingActive = await WorkoutSchedule.findOne({ memberId, status: 'active', deletedAt: null }).lean()
    if (existingActive) {
      return res.status(409).json({ message: 'Hội viên này đã có giáo án đang hoạt động. Vui lòng kết thúc giáo án cũ trước khi tạo lịch mới.' })
    }

    // Match each session to its training class
    const matchedClassMap = new Map()
    for (const s of sessions) {
      if (!s.date || !s.time) continue
      const dayOfWeek = new Date(s.date).getDay()
      const matchQuery = { ptId, daysOfWeek: dayOfWeek, startTime: s.time, status: 'active' }
      if (s.endTime) matchQuery.endTime = s.endTime
      const match = await TrainingClass.findOne(matchQuery).populate('zoneId', 'name').populate('floorId', 'name').lean()
      if (match) {
        matchedClassMap.set(s.dayOrder, match)
      } else {
        console.warn(
          `[createSchedule] No exact class match for session dayOrder=${s.dayOrder} ` +
          `date=${s.date} time=${s.time} endTime=${s.endTime} ptId=${ptId}`
        )
      }
    }

    // Slot thứ j của lịch ↔ buổi thứ j của giáo án; buổi vượt quá số slot → giữ ở trạng thái chờ (WAITING)
    const mappedSessions = sessions.map((s) => {
      const matched = matchedClassMap.get(s.dayOrder)
      return {
        dayOrder: s.dayOrder,
        date: new Date(s.date),
        time: s.time || '',
        endTime: s.endTime || '',
        className: matched?.name || '',
        classCode: matched?.code || '',
        location: buildClassLocation(matched) || '',
        title: s.title || '',
        muscleGroup: s.muscleGroup || '',
        exercises: (s.exercises || []).map((ex) => ({
          name: ex.name,
          note: ex.note || '',
          completed: false,
        })),
        status: 'pending',
        feedback: '',
        changeHistory: [{ action: 'created', by: req.user._id, byRole: req.user.role }],
      }
    })
    const assignedSessions = assignTemplateIndexes({ template, sessions: mappedSessions })

    const schedule = await WorkoutSchedule.create({
      memberId,
      templateId,
      assignedBy: ptId,
      startDate: new Date(),
      weekIndex: weekIndex || 1,
      totalWeeks: totalWeeks || 1,
      status: 'active',
      sessions: assignedSessions,
    })

    const pa = await createAssignment({ memberId, ptId })
    pa.workoutId = templateId
    await pa.save()

    recordAuditLog({
      req,
      module: 'schedule',
      action: 'create_schedule',
      entity: schedule,
      entityName: `Lịch tập - member ${memberId}`,
      details: `${sessions.length} buổi, template ${templateId}`,
    }).catch((err) => console.error('Audit createSchedule failed:', err.message))

    const populated = await WorkoutSchedule.findById(schedule._id)
      .populate('templateId', 'name goal description')
      .populate('assignedBy', 'name fullName email')

    createNotification({
      receiverId: memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
      title: 'Lịch tập mới đã được tạo',
      content: `Lịch tập mới của bạn đã được PT tạo.`,
      relatedId: schedule._id,
      relatedType: 'WorkoutSchedule',
      redirectUrl: '/my-schedules',
      createdBy: 'PT',
    }).catch(err => console.error('Notify schedule created failed:', err.message))

    res.status(201).json({ schedule: populated, planSummary: buildPlanSummary({ template, sessions: schedule.sessions }) })
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message })
  }
}

/**
 * Tạo nhiều lịch (mỗi tuần 1 lịch) trong MỘT transaction — tránh race condition
 * "1 member chỉ có 1 giáo án đang hoạt động" khi gửi các tuần song song.
 * Body: { templateId, memberId, assignmentId?, weeks: [{ weekIndex, sessions }] }
 */
export const bulkCreateSchedules = async (req, res) => {
  const mongoSession = await mongoose.startSession()
  mongoSession.startTransaction()
  try {
    const { templateId, memberId, assignmentId, weeks } = req.body || {}
    const ptId = req.user._id

    if (!templateId || !memberId || !Array.isArray(weeks) || weeks.length === 0) {
      await mongoSession.abortTransaction()
      return res.status(400).json({ message: 'Thiếu thông tin: templateId, memberId, weeks' })
    }

    const isAdminUser = isAdmin(req.user)

    // Quyền: PT phụ trách member (hoặc admin)
    if (!isAdminUser) {
      const can = await assertCanManageMember({ memberId, req })
      if (!can) throw new Error('Bạn không phụ trách hội viên này')
    }

    // Quyền với assignment (nếu có)
    let existingAssignment = null
    if (assignmentId) {
      existingAssignment = await PTAssignment.findById(assignmentId).session(mongoSession)
      if (!existingAssignment) {
        await mongoSession.abortTransaction()
        return res.status(404).json({ message: 'Không tìm thấy phân công' })
      }
      if (!isAdminUser && String(existingAssignment.ptId) !== String(ptId)) {
        await mongoSession.abortTransaction()
        return res.status(403).json({ message: 'Bạn không phụ trách phân công này' })
      }
    }

    // Chính sách 1 member = 1 PT active cho PT 1-1
    const otherActive = await PTAssignment.findOne({ memberId, status: 'active', ptId: { $ne: ptId } }).session(mongoSession).lean()
    if (otherActive) {
      await mongoSession.abortTransaction()
      return res.status(409).json({ message: 'Hội viên này đã có PT phụ trách khác đang hoạt động' })
    }

    // 1 member chỉ có 1 giáo án đang hoạt động
    const existingActive = await WorkoutSchedule.findOne({ memberId, status: 'active', deletedAt: null }).session(mongoSession).lean()
    if (existingActive) {
      await mongoSession.abortTransaction()
      return res.status(409).json({ message: 'Hội viên này đã có giáo án đang hoạt động. Vui lòng kết thúc giáo án cũ trước khi tạo lịch mới.' })
    }

    const template = await Workout.findById(templateId).session(mongoSession)
    if (!template || !template.isTemplate) {
      await mongoSession.abortTransaction()
      return res.status(404).json({ message: 'Không tìm thấy giáo án mẫu' })
    }

    // Validate toàn bộ buổi của tất cả tuần trước khi tạo
    const allErrors = []
    for (const week of weeks) {
      const errors = await validateScheduleSessions({ memberId, ptId, sessions: week.sessions || [] })
      for (const e of errors) allErrors.push(`Tuần ${week.weekIndex || '?'}: ${e}`)
    }
    if (allErrors.length > 0) {
      await mongoSession.abortTransaction()
      return res.status(409).json({ message: allErrors.join('; ') })
    }

    // Khớp lớp cho từng buổi (chỉ để enrich thông tin className/location HIỂN THỊ —
    // KHÔNG tự đăng ký member vào lớp nhóm: member book PT 1-1, không đồng nghĩa đăng ký lớp)
    const totalWeeks = weeks.length
    const createdSchedules = []
    const weekSessionsMap = []

    for (const week of weeks) {
      const matchedClassMap = new Map()
      for (const s of week.sessions || []) {
        if (!s.date || !s.time) continue
        const dayOfWeek = new Date(s.date).getDay()
        const matchQuery = { ptId, daysOfWeek: dayOfWeek, startTime: s.time, status: 'active' }
        if (s.endTime) matchQuery.endTime = s.endTime
        const match = await TrainingClass.findOne(matchQuery).populate('zoneId', 'name').populate('floorId', 'name').session(mongoSession).lean()
        if (match) {
          matchedClassMap.set(s.dayOrder, match)
        }
      }

      const mappedSessions = (week.sessions || []).map((s) => {
        const matched = matchedClassMap.get(s.dayOrder)
        return {
          dayOrder: s.dayOrder,
          date: new Date(s.date),
          time: s.time || '',
          endTime: s.endTime || '',
          className: matched?.name || '',
          classCode: matched?.code || '',
          location: buildClassLocation(matched) || '',
          title: s.title || '',
          muscleGroup: s.muscleGroup || '',
          exercises: (s.exercises || []).map((ex) => ({ name: ex.name, note: ex.note || '', completed: false })),
          status: 'pending',
          feedback: '',
          changeHistory: [{ action: 'created', by: req.user._id, byRole: req.user.role }],
        }
      })
      weekSessionsMap.push({ week, sessions: mappedSessions })
    }

    // Gán buổi giáo án CHO TOÀN BỘ các tuần: sort theo ngày thực tế (tuần 1 trước tuần 2),
    // slot thứ j ↔ buổi thứ j. VD: T2(T1)→Buổi 1, T3(T1)→Buổi 2, T2(T2)→Buổi 3, T3(T2)→Buổi 4.
    // Giáo án nhiều buổi hơn số slot → buổi thừa để WAITING (tạm bỏ, mở khi có thêm buổi PT).
    const mergedSessions = assignTemplateIndexes({
      template,
      sessions: weekSessionsMap.flatMap((w) => w.sessions),
    })
    let cursor = 0
    for (const item of weekSessionsMap) {
      const chunk = mergedSessions.slice(cursor, cursor + item.sessions.length)
      cursor += item.sessions.length
      if (chunk.length === 0) continue
      const schedule = new WorkoutSchedule({
        memberId,
        templateId,
        assignedBy: ptId,
        startDate: new Date(),
        weekIndex: item.week.weekIndex || 1,
        totalWeeks,
        status: 'active',
        sessions: chunk,
      })
      createdSchedules.push(schedule)
    }

    const saved = await WorkoutSchedule.insertMany(createdSchedules, { session: mongoSession })

    // Gán giáo án vào assignment
    let pa = existingAssignment
    if (!pa) {
      const { createAssignment } = await import('../services/ptAssignmentService.js')
      pa = await createAssignment({ memberId, ptId, session: mongoSession })
    }
    pa.workoutId = templateId
    await pa.save({ session: mongoSession })

    await mongoSession.commitTransaction()

    const firstSchedule = saved[0]
    const populated = await WorkoutSchedule.find({ _id: { $in: saved.map((s) => s._id) } })
      .populate('templateId', 'name goal description')
      .populate('assignedBy', 'name fullName email')

    recordAuditLog({
      req,
      module: 'schedule',
      action: 'bulk_create_schedules',
      entity: firstSchedule,
      entityName: `Tạo ${saved.length} lịch (${totalWeeks} tuần) - member ${memberId}`,
      details: `template ${templateId}, assignment ${assignmentId || 'không'}`,
    }).catch((err) => console.error('Audit bulkCreateSchedules failed:', err.message))

    for (const s of saved) {
      createNotification({
        receiverId: memberId,
        receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
        title: 'Lịch tập mới đã được tạo',
        content: totalWeeks > 1 ? `Lịch tập ${totalWeeks} tuần mới đã được PT tạo.` : `Lịch tập mới của bạn đã được PT tạo.`,
        relatedId: s._id,
        relatedType: 'WorkoutSchedule',
        redirectUrl: '/my-schedules',
        createdBy: 'PT',
      }).catch(err => console.error('Notify bulk schedule failed:', err.message))
    }

    res.status(201).json({
      message: `Đã tạo ${saved.length} lịch tập thành công`,
      schedules: populated,
      planSummary: buildPlanSummary({ template, sessions: mergedSessions }),
    })
  } catch (error) {
    await mongoSession.abortTransaction()
    res.status(error.statusCode || 500).json({ message: error.message })
  } finally {
    mongoSession.endSession()
  }
}

/**
 * PT/admin thêm MỘT slot (buổi lịch) vào giáo án đang hoạt động của member.
 * Slot mới tự động nhận BUỔI KẾ TIẾP chưa hoàn thành trong giáo án mẫu
 * (member mua thêm buổi PT → buổi đang chờ được mở).
 */
export const addScheduleSession = async (req, res) => {
  try {
    const { scheduleId } = req.params
    const { date, time, endTime, title } = req.body || {}

    if (!date || !time) {
      return res.status(400).json({ message: 'Thiếu ngày hoặc khung giờ tập' })
    }

    const schedule = await WorkoutSchedule.findById(scheduleId)
    if (!schedule || schedule.deletedAt) {
      return res.status(404).json({ message: 'Không tìm thấy lịch tập' })
    }
    if (schedule.status !== 'active') {
      return res.status(400).json({ message: 'Lịch tập không còn hoạt động' })
    }

    const isAdminUser = isAdmin(req.user)
    const isAssignedPt = String(schedule.assignedBy) === String(req.user._id)
    if (!isAdminUser && !isAssignedPt) {
      return res.status(403).json({ message: 'Chỉ PT phụ trách mới được thêm buổi tập' })
    }

    const newDate = new Date(date)
    newDate.setHours(0, 0, 0, 0)
    const startTime = String(time).split('-')[0].trim()
    const [hour = 0, minute = 0] = startTime.split(':').map(Number)
    const newStart = new Date(newDate)
    newStart.setHours(hour || 0, minute || 0, 0, 0)
    if (newStart <= new Date()) {
      return res.status(400).json({ message: 'Không thể thêm buổi tập vào thời gian đã qua' })
    }

    const memberId = schedule.memberId

    // Gói tập còn hiệu lực vào ngày mới
    const activeCycle = await MembershipCycle.findOne({ memberId, status: 'active', expiresAt: { $gte: newDate } }).lean()
    if (!activeCycle) {
      return res.status(403).json({ message: 'Hội viên cần có gói tập còn hiệu lực vào ngày tập mới' })
    }

    // PT làm việc vào khung giờ đó
    const ptCheck = await validatePTAssignment({
      trainerId: schedule.assignedBy,
      date: newDate,
      slot: endTime ? `${startTime}-${endTime}` : startTime,
    })
    if (!ptCheck.ok) {
      return res.status(400).json({ message: ptCheck.message })
    }

    // Không trùng ngày + khung giờ với buổi khác trong cùng lịch
    const sameScheduleConflict = schedule.sessions.some((s) =>
      s.status === 'pending' &&
      new Date(s.date).getFullYear() === newDate.getFullYear() &&
      new Date(s.date).getMonth() === newDate.getMonth() &&
      new Date(s.date).getDate() === newDate.getDate() &&
      (s.time || '').split('-')[0].trim() === startTime,
    )
    if (sameScheduleConflict) {
      return res.status(409).json({ message: 'Hội viên đã có buổi tập ở ngày và khung giờ này' })
    }

    // Không trùng với lịch PT 1-1 của member ở lịch khác
    const dayEnd = new Date(newDate)
    dayEnd.setDate(dayEnd.getDate() + 1)
    const otherScheduleConflict = await WorkoutSchedule.findOne({
      _id: { $ne: schedule._id },
      memberId,
      status: 'active',
      sessions: { $elemMatch: { date: { $gte: newDate, $lt: dayEnd }, time: startTime, status: 'pending' } },
    })
    if (otherScheduleConflict) {
      return res.status(409).json({ message: 'Hội viên đã có buổi tập ở ngày và khung giờ này' })
    }

    // Không trùng với booking PT 1-1
    const bookingConflict = await Booking.findOne({
      memberId,
      date: { $gte: newDate, $lt: dayEnd },
      slot: new RegExp(`^${startTime}`),
      status: { $in: ['pending', 'awaiting_payment', 'confirmed'] },
    })
    if (bookingConflict) {
      return res.status(409).json({ message: 'Hội viên đã có lịch PT 1-1 ở ngày và khung giờ này' })
    }

    // Không trùng khung giờ PT với member khác
    const ptMemberConflicts = await findPTMemberConflicts({
      ptId: schedule.assignedBy,
      date: newDate,
      slot: endTime ? `${startTime}-${endTime}` : startTime,
      excludeScheduleId: schedule._id,
      excludeMemberId: memberId,
    })
    if (ptMemberConflicts.length > 0) {
      const c = ptMemberConflicts[0]
      return res.status(409).json({ message: `PT đã có lịch với ${c.memberName} cùng khung giờ này` })
    }

    // Buổi kế tiếp chưa có slot hợp lệ trong TOÀN BỘ lịch active của member
    // (member có lịch nhiều tuần = nhiều WorkoutSchedule riêng; buổi 3,4 ở tuần 2 đã có slot
    //  → slot mới phải mở buổi 5 chứ không mở lại buổi 3)
    const template = await Workout.findById(schedule.templateId)
    const memberSchedules = await WorkoutSchedule.find({ memberId, status: 'active', deletedAt: null })
    const allMemberSessions = memberSchedules.flatMap((s) => s.sessions || [])
    const nextIndex = template ? findNextPlanIndex({ template, sessions: allMemberSessions }) : null
    const maxDayOrder = schedule.sessions.reduce((max, s) => Math.max(max, s.dayOrder || 0), 0)

    const newSession = buildSessionFromTemplateDay({
      template,
      index: nextIndex,
      base: {
        dayOrder: maxDayOrder + 1,
        date: newDate,
        time: startTime,
        endTime: endTime || '',
        title,
        changeHistory: [{ action: 'created', by: req.user._id, byRole: req.user.role }],
      },
    })

    schedule.sessions.push(newSession)
    await schedule.save()

    recordAuditLog({
      req,
      module: 'schedule',
      action: 'add_schedule_session',
      entity: schedule,
      entityName: `Lịch ${scheduleId} - thêm buổi ${newSession.dayOrder}`,
      details: `${newDate.toLocaleDateString('vi-VN')} ${startTime}${nextIndex ? ` — gán buổi ${nextIndex} của giáo án` : ''}`,
    }).catch((err) => console.error('Audit addScheduleSession failed:', err.message))

    createNotification({
      receiverId: memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
      title: 'Thêm buổi tập mới',
      content: `PT đã thêm buổi tập ${newDate.toLocaleDateString('vi-VN')} ${startTime}${nextIndex ? ` (Buổi ${nextIndex}: ${newSession.muscleGroup || newSession.title})` : ''}.`,
      relatedId: schedule._id,
      relatedType: 'WorkoutSchedule',
      redirectUrl: '/my-schedules',
      createdBy: 'PT',
    }).catch(err => console.error('Notify add session failed:', err.message))

    const populated = await WorkoutSchedule.findById(schedule._id)
      .populate('templateId', 'name goal description days')
      .populate('assignedBy', 'name fullName email')

    res.status(201).json({
      message: nextIndex
        ? `Đã thêm buổi tập và gán Buổi ${nextIndex} (${newSession.muscleGroup || newSession.title}) của giáo án`
        : 'Đã thêm buổi tập (giáo án đã hoàn thành toàn bộ buổi — PT có thể soạn nội dung riêng)',
      schedule: populated,
      planSummary: buildPlanSummary({ template, sessions: allMemberSessions }),
    })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi thêm buổi tập', error: error.message })
  }
}

export const getMySchedules = async (req, res) => {
  try {
    const memberId = req.user._id

    let schedules = await WorkoutSchedule.find({ memberId, status: { $in: ['active', 'completed'] }, deletedAt: null })
      .populate('templateId', 'name goal description')
      .populate('assignedBy', 'name fullName email')
      .sort({ createdAt: -1 })

    schedules = await enrichSessions(schedules)
    // Lịch đang hoạt động hiển thị trước, lịch sử đã hoàn thành ở sau
    const statusOrder = { active: 0, completed: 1 }
    schedules.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9))
    for (const s of schedules) {
      if (s.sessions?.length) {
        s.sessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      }
    }

    res.json({ schedules })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const getMemberSchedules = async (req, res) => {
  try {
    const { memberId } = req.params

    if (!mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({ message: 'ID hội viên không hợp lệ' })
    }

    // PT chỉ xem được lịch của member mình phụ trách (1-1 hoặc lớp nhóm); admin xem tất cả
    if (!isAdmin(req.user)) {
      const [pt1on1, group] = await Promise.all([
        PTAssignment.exists({ memberId, ptId: req.user._id, status: 'active' }),
        TrainingAssignment.exists({ memberId, trainerId: req.user._id, status: 'active' }),
      ])
      if (!pt1on1 && !group) {
        return res.status(403).json({ message: 'Bạn không phụ trách hội viên này' })
      }
    }

    let schedules = await WorkoutSchedule.find({ memberId, status: { $in: ['active', 'completed'] }, deletedAt: null })
      .populate('templateId', 'name goal description')
      .populate('assignedBy', 'name fullName email')
      .sort({ createdAt: -1 })

    schedules = await enrichSessions(schedules)

    const statusOrder = { active: 0, completed: 1 }
    schedules.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9))
    for (const s of schedules) {
      if (s.sessions?.length) {
        s.sessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      }
    }

    res.json({ schedules })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

/**
 * Lịch dạy PT 1-1 của PT: toàn bộ WorkoutSchedule do PT này tạo (active + completed),
 * kèm thông tin member — dùng cho trang "Lịch dạy 1-1".
 */
export const getMyTeachingSchedules = async (req, res) => {
  try {
    const ptId = req.user._id

    let schedules = await WorkoutSchedule.find({ assignedBy: ptId, status: { $in: ['active', 'completed'] }, deletedAt: null })
      .populate('memberId', 'name fullName memberCode avatar')
      .populate('templateId', 'name goal description')
      .sort({ createdAt: -1 })

    schedules = await enrichSessions(schedules)

    const statusOrder = { active: 0, completed: 1 }
    schedules.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9))
    for (const s of schedules) {
      if (s.sessions?.length) {
        s.sessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      }
    }

    res.json({ schedules })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

/**
 * Lấy thông tin lớp nhóm: hội viên đang hoạt động trong lớp + ai đã được gán giáo án.
 * PT nhóm / admin.
 */
export const getClassSchedules = async (req, res) => {
  try {
    const { classId } = req.params
    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({ message: 'ID lớp không hợp lệ' })
    }

    const trainingClass = await TrainingClass.findOne({ _id: classId, deletedAt: null })
      .populate('ptId', 'name fullName email')
      .populate('floorId', 'name')
      .populate('zoneId', 'name')
      .lean()
    if (!trainingClass) {
      return res.status(404).json({ message: 'Không tìm thấy lớp' })
    }
    if (!isAdmin(req.user) && String(trainingClass.ptId?._id || trainingClass.ptId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Bạn không phụ trách lớp này' })
    }

    const assignments = await TrainingAssignment.find({ classId, status: 'active' })
      .populate('memberId', 'name fullName memberCode avatar')
      .lean()
    const members = assignments
      .map((a) => a.memberId)
      .filter(Boolean)

    const schedules = await WorkoutSchedule.find({ classId, status: 'active', deletedAt: null })
      .populate('templateId', 'name goal')
      .populate('memberId', 'name fullName memberCode')
      .lean()

    const assignedMap = new Map()
    for (const s of schedules) {
      const m = s.memberId
      if (!m) continue
      assignedMap.set(String(m._id || m), {
        memberId: String(m._id || m),
        memberName: m.fullName || m.name || '',
        memberCode: m.memberCode || '',
        scheduleId: String(s._id),
        templateName: s.templateId?.name || '',
        sessionsCount: (s.sessions || []).length,
      })
    }

    res.json({
      trainingClass,
      members,
      assigned: [...assignedMap.values()],
      assignedCount: assignedMap.size,
      totalMembers: members.length,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

/**
 * Gán giáo án (template) cho toàn bộ hội viên đang hoạt động trong một lớp nhóm.
 * Body: { classId, templateId }
 * Sessions được dựng tự động: ngày = ngày sắp tới của dayOfWeek trong template
 * (chỉ lấy dayOfWeek trùng lịch học của lớp), giờ = startTime/endTime của lớp.
 * Trả về { created[], skipped[] } — bỏ qua member đã có giáo án active.
 */
export const groupAssignWorkout = async (req, res) => {
  try {
    const { classId, templateId } = req.body || {}

    if (!mongoose.Types.ObjectId.isValid(classId) || !mongoose.Types.ObjectId.isValid(templateId)) {
      return res.status(400).json({ message: 'classId và templateId là bắt buộc' })
    }

    const trainingClass = await TrainingClass.findOne({ _id: classId, deletedAt: null })
      .populate('ptId', 'name fullName')
      .populate('zoneId', 'name')
      .populate('floorId', 'name')
      .lean()
    if (!trainingClass) {
      return res.status(404).json({ message: 'Không tìm thấy lớp' })
    }
    if (!isAdmin(req.user) && String(trainingClass.ptId?._id || trainingClass.ptId) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Bạn không phụ trách lớp này' })
    }
    if (trainingClass.status !== 'active') {
      return res.status(400).json({ message: `Lớp chưa sẵn sàng để gán giáo án (trạng thái: ${trainingClass.status})` })
    }
    if (!trainingClass.startTime || !trainingClass.endTime) {
      return res.status(400).json({ message: 'Lớp chưa cài giờ bắt đầu/kết thúc, chưa gán được giáo án' })
    }

    const template = await Workout.findById(templateId).lean()
    if (!template || !template.isTemplate) {
      return res.status(404).json({ message: 'Không tìm thấy giáo án mẫu' })
    }
    if (!template.days || template.days.length === 0) {
      return res.status(400).json({ message: 'Giáo án mẫu không có buổi tập nào' })
    }

    const classDays = trainingClass.daysOfWeek || []
    const ptId = req.user._id

    // Dựng sessions: mỗi ngày trong template trùng lịch học của lớp -> ngày sắp tới của dayOfWeek đó
    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const sessions = []
    for (const day of template.days) {
      const dow = Number(day.dayOfWeek)
      if (!classDays.includes(dow)) continue
      let date = new Date(now)
      date.setDate(date.getDate() + ((dow - date.getDay() + 7) % 7))
      date.setHours(0, 0, 0, 0)
      if (date.getTime() === todayStart.getTime()) {
        const classStartMin = toMinutes(trainingClass.startTime)
        const nowMin = now.getHours() * 60 + now.getMinutes()
        if (nowMin >= classStartMin) date.setDate(date.getDate() + 7)
      }
      sessions.push({
        dayOrder: sessions.length + 1,
        date,
        time: trainingClass.startTime,
        endTime: trainingClass.endTime,
        className: trainingClass.name || '',
        classCode: trainingClass.code || '',
        location: buildClassLocation(trainingClass) || '',
        title: day.muscleGroup || `Buổi ${sessions.length + 1}`,
        muscleGroup: day.muscleGroup || '',
        exercises: (day.exercises || []).map((ex) => ({
          name: ex.name,
          note: ex.note || '',
          completed: false,
        })),
        status: 'pending',
        feedback: '',
        changeHistory: [{ action: 'created', by: ptId, byRole: req.user.role }],
      })
    }
    if (sessions.length === 0) {
      return res.status(400).json({ message: 'Không có ngày nào của giáo án trùng với lịch học của lớp. Hãy chọn giáo án khác hoặc chỉnh lịch lớp.' })
    }

    const assignments = await TrainingAssignment.find({ classId, status: 'active' })
      .populate('memberId', 'name fullName memberCode')
      .lean()
    const members = assignments
      .map((a) => a.memberId)
      .filter(Boolean)

    if (members.length === 0) {
      return res.status(400).json({ message: 'Lớp chưa có hội viên nào đang hoạt động' })
    }

    const created = []
    const skipped = []

    for (const member of members) {
      const memberId = String(member._id)
      const memberName = member.fullName || member.name || memberId

      const existingActive = await WorkoutSchedule.findOne({ memberId, status: 'active', deletedAt: null }).lean()
      if (existingActive) {
        skipped.push({ memberId, memberName, reason: 'Đã có giáo án đang hoạt động' })
        continue
      }

      const cycleCheck = await MembershipCycle.findOne({
        memberId,
        status: 'active',
        expiresAt: { $gte: sessions[0].date },
      }).lean()
      if (!cycleCheck) {
        skipped.push({ memberId, memberName, reason: 'Gói tập không còn hiệu lực vào ngày bắt đầu' })
        continue
      }

      const errors = []
      for (const s of sessions) {
        const conflicts = await findPTMemberConflicts({
          ptId,
          date: s.date,
          slot: s.endTime ? `${s.time}-${s.endTime}` : s.time,
          excludeMemberId: memberId,
        })
        if (conflicts.length > 0) {
          errors.push(`Buổi ${s.dayOrder} (${s.time}): PT đã có lịch 1-1 với ${conflicts[0].memberName} cùng khung giờ`)
        }
      }
      if (errors.length > 0) {
        skipped.push({ memberId, memberName, reason: errors.join('; ') })
        continue
      }

      try {
        const assignedSessions = assignTemplateIndexes({ template, sessions })
        const schedule = await WorkoutSchedule.create({
          memberId,
          templateId,
          assignedBy: ptId,
          trainerId: ptId,
          classId,
          startDate: sessions[0].date,
          weekIndex: 1,
          totalWeeks: template.duration || 1,
          status: 'active',
          sessions: assignedSessions,
        })
        created.push({ memberId, memberName, memberCode: member.memberCode || '', scheduleId: String(schedule._id) })
      } catch (err) {
        skipped.push({ memberId, memberName, reason: `Lỗi tạo: ${err.message}` })
      }
    }

    if (created.length > 0) {
      recordAuditLog({
        req,
        module: 'schedule',
        action: 'assign_group_schedule',
        entity: trainingClass,
        entityName: `Gán giáo án cho lớp ${trainingClass.name} (${trainingClass.code})`,
        details: `${created.length} member được gán, ${skipped.length} bỏ qua, ${sessions.length} buổi, template ${template.name}`,
      }).catch((err) => console.error('Audit groupAssign failed:', err.message))

      for (const c of created) {
        createNotification({
          receiverId: c.memberId,
          receiverRole: 'member',
          notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
          title: 'Lịch tập nhóm mới đã được tạo',
          content: `PT đã gán giáo án "${template.name}" cho lớp ${trainingClass.name} của bạn.`,
          relatedId: c.scheduleId,
          relatedType: 'WorkoutSchedule',
          redirectUrl: '/my-schedules',
          createdBy: 'PT',
        }).catch((err) => console.error('Notify groupAssign failed:', err.message))
      }
    }

    res.status(created.length > 0 ? 201 : 200).json({
      message: created.length > 0
        ? `Đã gán giáo án cho ${created.length} hội viên${skipped.length ? `, ${skipped.length} hội viên bỏ qua` : ''}`
        : 'Không gán được cho hội viên nào',
      created,
      skipped,
      sessions: sessions.map((s) => ({
        dayOrder: s.dayOrder,
        date: s.date,
        time: s.time,
        endTime: s.endTime,
        title: s.title,
        muscleGroup: s.muscleGroup,
        exercisesCount: (s.exercises || []).length,
      })),
      classId,
      templateId,
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

/**
 * Xem chi tiết 1 WorkoutSchedule — PT phụ trách / admin / chính member.
 */
export const getScheduleById = async (req, res) => {
  try {
    const { scheduleId } = req.params

    if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
      return res.status(400).json({ message: 'ID lịch tập không hợp lệ' })
    }

    const schedule = await WorkoutSchedule.findOne({ _id: scheduleId, deletedAt: null })
      .populate('memberId', 'name fullName memberCode avatar email phone')
      .populate('templateId', 'name goal description days')
      .populate('assignedBy', 'name fullName email')

    if (!schedule) {
      return res.status(404).json({ message: 'Không tìm thấy lịch tập' })
    }

    const isAdminUser = isAdmin(req.user)
    const isAssignedPt = String(schedule.assignedBy?._id || schedule.assignedBy) === String(req.user._id)
    const isOwnerMember = String(schedule.memberId?._id || schedule.memberId) === String(req.user._id)
    if (!isAdminUser && !isAssignedPt && !isOwnerMember) {
      return res.status(403).json({ message: 'Bạn không có quyền xem lịch tập này' })
    }

    const [enriched] = await enrichSessions([schedule])
    if (enriched?.sessions?.length) {
      enriched.sessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }

    const template = typeof enriched.templateId === 'object' ? enriched.templateId : null

    // planSummary tính trên TOÀN BỘ lịch active của member (nhiều tuần = nhiều schedule)
    // để không bị lệch: 4 slot trên 2 tuần + giáo án 5 buổi → buổi 5 đúng là đang chờ.
    let planSummary = null
    if (template) {
      const memberId = enriched.memberId?._id || enriched.memberId
      const memberSchedules = await WorkoutSchedule.find({ memberId, status: 'active', deletedAt: null })
      const allMemberSessions = memberSchedules.flatMap((s) => s.sessions || [])
      planSummary = buildPlanSummary({ template, sessions: allMemberSessions })
    }
    res.json({ schedule: enriched, planSummary })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

export const updateSessionStatus = async (req, res) => {
  try {
    const { scheduleId, dayOrder } = req.params
    const { status, feedback, performance, exercises } = req.body

    const schedule = await WorkoutSchedule.findById(scheduleId)
    if (!schedule) {
      return res.status(404).json({ message: 'Không tìm thấy lịch tập' })
    }

    // Chỉ PT phụ trách buổi này (hoặc admin) mới được cập nhật trạng thái/ghi kết quả.
    // Member chỉ dùng rescheduleSession/cancelSession ở các route riêng.
    const isAdminUser = isAdmin(req.user)
    const isAssignedPt = String(schedule.assignedBy) === String(req.user._id)
    if (!isAdminUser && !isAssignedPt) {
      return res.status(403).json({ message: 'Chỉ PT phụ trách mới được cập nhật buổi tập này' })
    }

    const session = schedule.sessions.find((s) => s.dayOrder === Number(dayOrder))
    if (!session) {
      return res.status(404).json({ message: 'Không tìm thấy buổi tập' })
    }

    // Trạng thái hợp lệ cho PT: completed / skipped (PT bỏ qua) / no_show (member vắng)
    const allowedStatuses = ['completed', 'skipped', 'no_show']
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Trạng thái buổi tập không hợp lệ' })
    }

    // P5: Nếu hội viên đã check-in buổi này thì không được đánh no_show/skipped
    // (member đã xác nhận có mặt qua hệ thống check-in)
    if (status && (status === 'no_show' || status === 'skipped')) {
      const sessionIndex = schedule.sessions.findIndex((s) => s.dayOrder === Number(dayOrder))
      const memberCheckedIn = await CheckIn.exists({
        memberId: schedule.memberId,
        scheduleId: schedule._id,
        sessionDate: session.date,
        sessionIndex: sessionIndex >= 0 ? sessionIndex : undefined,
        status: 'success',
      })
      if (memberCheckedIn) {
        return res.status(409).json({
          message: 'Hội viên đã check-in buổi này. Không thể đánh dấu no_show/skipped — hãy cập nhật kết quả cho buổi đã hoàn thành.',
        })
      }
    }

    // Buổi chưa diễn ra (ngày trong tương lai) không được ghi nhận kết quả/trạng thái.
    // Admin có quyền override; PT chỉ được sửa GIÁO ÁN qua endpoint /plan cho buổi tương lai.
    const changesResult = Boolean(status) || feedback !== undefined || performance !== undefined || Array.isArray(exercises)
    if (changesResult && !isAdminUser) {
      const sessionDay = new Date(session.date)
      sessionDay.setHours(0, 0, 0, 0)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (sessionDay > today) {
        return res.status(400).json({ message: 'Buổi tập chưa diễn ra, chưa thể ghi nhận kết quả' })
      }
    }

    const fromSnapshot = {
      status: session.status,
      feedback: session.feedback,
      performance: session.performance,
      completedAt: session.completedAt,
      exercises: session.exercises.map((ex) => ({
        name: ex.name, completed: ex.completed, setsDone: ex.setsDone, repsDone: ex.repsDone, weightUsed: ex.weightUsed, durationMin: ex.durationMin,
      })),
    }

    // Buổi đã hoàn thành/bỏ qua/hủy không được thay đổi trạng thái
    if (status && session.status !== 'pending') {
      return res.status(400).json({ message: 'Buổi tập này không còn ở trạng thái chờ, không thể thay đổi' })
    }

    const action = status ? 'status_changed' : (feedback !== undefined || performance !== undefined || exercises) ? 'result_updated' : null

    if (status) session.status = status
    if (feedback !== undefined) session.feedback = feedback
    if (performance !== undefined) {
      const allowedPerf = ['', 'excellent', 'good', 'average', 'below_average', 'poor']
      if (!allowedPerf.includes(performance)) {
        return res.status(400).json({ message: 'Đánh giá buổi tập không hợp lệ' })
      }
      session.performance = performance
    }
    if (exercises && Array.isArray(exercises)) {
      exercises.forEach((ex) => {
        const match = session.exercises.find((e) => e.name === ex.name)
        if (!match) return
        if (ex.completed !== undefined) match.completed = Boolean(ex.completed)
        if (ex.setsDone !== undefined) match.setsDone = Number(ex.setsDone) || 0
        if (ex.repsDone !== undefined) match.repsDone = Number(ex.repsDone) || 0
        if (ex.weightUsed !== undefined) match.weightUsed = Number(ex.weightUsed) || 0
        if (ex.durationMin !== undefined) match.durationMin = Number(ex.durationMin) || 0
        if (ex.note !== undefined) match.note = String(ex.note || '')
      })
    }

    if (status === 'completed' && !session.completedAt) {
      session.completedAt = new Date()
    }

    if (action) {
      session.changeHistory.push({
        action,
        from: fromSnapshot,
        to: {
          status: session.status,
          feedback: session.feedback,
          performance: session.performance,
          completedAt: session.completedAt,
          exercises: session.exercises.map((ex) => ({
            name: ex.name, completed: ex.completed, setsDone: ex.setsDone, repsDone: ex.repsDone, weightUsed: ex.weightUsed, durationMin: ex.durationMin,
          })),
        },
        by: req.user._id,
        byRole: req.user.role,
      })
    }

    await schedule.save()

    recordAuditLog({
      req,
      module: 'schedule',
      action: action === 'status_changed' ? 'update_session_status' : 'update_session_result',
      entity: schedule,
      entityName: `Lịch ${scheduleId} - buổi ${dayOrder}`,
      details: `status: ${fromSnapshot.status} → ${session.status}; performance: ${performance !== undefined ? performance : 'không đổi'}`,
    }).catch((err) => console.error('Audit updateSessionStatus failed:', err.message))

    if (status === 'completed') {
      createNotification({
        receiverId: schedule.memberId,
        receiverRole: 'member',
        notificationType: NOTIFICATION_TYPES.PT_SESSION_COMPLETED,
        title: 'Buổi tập đã hoàn thành',
        content: `Buổi tập "${session.title || session.muscleGroup || `Buổi ${session.dayOrder}`}" đã được hoàn thành${session.performance ? ' và PT đã ghi nhận kết quả' : ''}.`,
        relatedId: schedule._id,
        relatedType: 'WorkoutSchedule',
        redirectUrl: '/my-schedules',
        createdBy: 'PT',
      }).catch(err => console.error('Notify session completed failed:', err.message))
    }

    res.json({ message: 'Đã cập nhật buổi tập', schedule })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

const sameLocalDay = (a, b) => {
  const da = new Date(a)
  const db = new Date(b)
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}

/**
 * PT/admin gán/chỉnh giáo án cho MỘT buổi cụ thể (không đụng template gốc).
 * Chỉ áp dụng cho buổi còn ở trạng thái pending (chưa diễn ra).
 * Body: { title?, muscleGroup?, exercises: [{ name, note? }] }
 */
export const updateSessionPlan = async (req, res) => {
  try {
    const { scheduleId, dayOrder } = req.params
    const { title, muscleGroup, exercises } = req.body

    const schedule = await WorkoutSchedule.findById(scheduleId)
    if (!schedule) {
      return res.status(404).json({ message: 'Không tìm thấy lịch tập' })
    }

    const isAdminUser = isAdmin(req.user)
    const isAssignedPt = String(schedule.assignedBy) === String(req.user._id)
    if (!isAdminUser && !isAssignedPt) {
      return res.status(403).json({ message: 'Chỉ PT phụ trách mới được gán giáo án cho buổi này' })
    }

    const session = schedule.sessions.find((s) => s.dayOrder === Number(dayOrder))
    if (!session) {
      return res.status(404).json({ message: 'Không tìm thấy buổi tập' })
    }
    if (session.status !== 'pending') {
      return res.status(400).json({ message: 'Buổi tập đã diễn ra hoặc bị hủy, không thể thay đổi giáo án' })
    }
    if (!exercises || !Array.isArray(exercises) || exercises.length === 0) {
      return res.status(400).json({ message: 'Giáo án của buổi phải có ít nhất 1 bài tập' })
    }

    const fromSnapshot = {
      title: session.title,
      muscleGroup: session.muscleGroup,
      exercises: session.exercises.map((ex) => ({ name: ex.name, note: ex.note })),
    }

    const newExercises = exercises.map((ex) => {
      const name = String(ex?.name || '').trim()
      if (!name) throw new Error('Tên bài tập không được để trống')
      return {
        name,
        note: String(ex?.note || '').trim(),
        completed: false,
        setsDone: 0,
        repsDone: 0,
        weightUsed: 0,
        durationMin: 0,
      }
    })

    // Đổi giáo án buổi khác template gốc → giữ nguyên templateId của lịch (chỉ copy nội dung mới)
    if (title !== undefined) session.title = String(title).trim()
    if (muscleGroup !== undefined) session.muscleGroup = String(muscleGroup).trim()
    session.exercises = newExercises

    session.changeHistory.push({
      action: 'plan_updated',
      from: fromSnapshot,
      to: {
        title: session.title,
        muscleGroup: session.muscleGroup,
        exercises: session.exercises.map((ex) => ({ name: ex.name, note: ex.note })),
      },
      by: req.user._id,
      byRole: req.user.role,
    })

    await schedule.save()

    recordAuditLog({
      req,
      module: 'schedule',
      action: 'update_session_plan',
      entity: schedule,
      entityName: `Lịch ${scheduleId} - buổi ${dayOrder}`,
      details: `Cập nhật giáo án buổi ${dayOrder}: ${session.exercises.length} bài tập`,
    }).catch((err) => console.error('Audit updateSessionPlan failed:', err.message))

    res.json({ message: 'Đã cập nhật giáo án buổi tập', schedule })
  } catch (error) {
    res.status(400).json({ message: error.message || 'Lỗi cập nhật giáo án buổi tập' })
  }
}

/**
 * Member đổi lịch 1 buổi tập cụ thể (đổi ngày/giờ)
 */
export const rescheduleSession = async (req, res) => {
  try {
    const { scheduleId, dayOrder } = req.params
    const { date, time, endTime, reason } = req.body

    if (!date || !time) {
      return res.status(400).json({ message: 'Thiếu ngày hoặc giờ tập mới' })
    }

    const schedule = await WorkoutSchedule.findOne({ _id: scheduleId, memberId: req.user._id })
    if (!schedule) {
      return res.status(404).json({ message: 'Không tìm thấy lịch tập' })
    }
    if (schedule.status !== 'active') {
      return res.status(400).json({ message: 'Lịch tập không còn hoạt động' })
    }

    const session = schedule.sessions.find((s) => s.dayOrder === Number(dayOrder))
    if (!session) {
      return res.status(404).json({ message: 'Không tìm thấy buổi tập' })
    }
    if (session.status !== 'pending') {
      return res.status(400).json({ message: 'Chỉ đổi được lịch của buổi tập chưa diễn ra' })
    }

    const newDate = new Date(date)
    newDate.setHours(0, 0, 0, 0)

    const startTime = String(time).split('-')[0].trim()
    const [hour = 0, minute = 0] = startTime.split(':').map(Number)
    const newStart = new Date(newDate)
    newStart.setHours(hour || 0, minute || 0, 0, 0)

    if (newStart <= new Date()) {
      return res.status(400).json({ message: 'Không thể đổi sang thời gian đã qua' })
    }

    // 1. Gói tập phải còn hiệu lực vào ngày mới (giống luồng đặt lịch)
    const activeCycle = await MembershipCycle.findOne({
      memberId: req.user._id,
      status: 'active',
      expiresAt: { $gte: newDate },
    }).lean()
    if (!activeCycle) {
      return res.status(403).json({ message: 'Bạn cần có gói tập đang hoạt động để đổi lịch' })
    }

    // 2. PT phải làm việc, khung giờ trong ca, không nghỉ phép/cover/dạy lớp trùng giờ (giống luồng đặt lịch)
    const ptCheck = await validatePTAssignment({
      trainerId: schedule.assignedBy,
      date: newDate,
      slot: endTime ? `${startTime}-${endTime}` : startTime,
    })
    if (!ptCheck.ok) {
      return res.status(400).json({ message: ptCheck.message })
    }

    // Trùng với buổi khác trong cùng lịch
    const sameScheduleConflict = schedule.sessions.some((s) =>
      s.dayOrder !== Number(dayOrder) &&
      s.status === 'pending' &&
      sameLocalDay(s.date, newDate) &&
      (s.time || '').split('-')[0].trim() === startTime
    )
    if (sameScheduleConflict) {
      return res.status(409).json({ message: 'Bạn đã có buổi tập ở ngày và khung giờ này' })
    }

    // Trùng với buổi trong lịch khác
    const dayEnd = new Date(newDate)
    dayEnd.setDate(dayEnd.getDate() + 1)
    const otherScheduleConflict = await WorkoutSchedule.findOne({
      _id: { $ne: schedule._id },
      memberId: req.user._id,
      status: 'active',
      sessions: {
        $elemMatch: {
          date: { $gte: newDate, $lt: dayEnd },
          time: startTime,
          status: 'pending',
        },
      },
    })
    if (otherScheduleConflict) {
      return res.status(409).json({ message: 'Bạn đã có buổi tập ở ngày và khung giờ này' })
    }

    // Trùng với lịch đặt PT 1-1
    const bookingConflict = await Booking.findOne({
      memberId: req.user._id,
      date: { $gte: newDate, $lt: dayEnd },
      slot: new RegExp(`^${startTime}`),
      status: { $in: ['pending', 'awaiting_payment', 'confirmed'] },
    })
    if (bookingConflict) {
      return res.status(409).json({ message: 'Bạn đã có lịch PT 1-1 ở ngày và khung giờ này' })
    }

    // Trùng khung giờ của PT với member khác (giống luồng đặt lịch)
    const ptMemberConflicts = await findPTMemberConflicts({
      ptId: schedule.assignedBy,
      date: newDate,
      slot: endTime ? `${startTime}-${endTime}` : startTime,
      excludeScheduleId: schedule._id,
      excludeMemberId: req.user._id,
    })
    if (ptMemberConflicts.length > 0) {
      const c = ptMemberConflicts[0]
      return res.status(409).json({ message: `PT đã có lịch với ${c.memberName} cùng khung giờ này. Vui lòng chọn giờ khác.` })
    }

    const fromSnapshot = {
      date: session.date,
      time: session.time,
      endTime: session.endTime,
      status: session.status,
    }

    session.date = newDate
    session.time = startTime
    session.endTime = endTime || ''
    // Đổi giờ nên class tương ứng không còn khớp — để hệ thống tự khớp lại khi đọc
    session.className = ''
    session.classCode = ''
    session.location = ''
    session.feedback = reason ? `Hội viên đổi lịch: ${reason}` : 'Hội viên đổi lịch'

    session.changeHistory.push({
      action: 'rescheduled',
      from: fromSnapshot,
      to: { date: newDate, time: startTime, endTime: endTime || '' },
      reason: reason || '',
      by: req.user._id,
      byRole: 'member',
    })

    await schedule.save()

    recordAuditLog({
      req,
      module: 'schedule',
      action: 'reschedule_session',
      entity: schedule,
      entityName: `Lịch ${schedule._id} - buổi ${dayOrder}`,
      details: `Từ ${new Date(fromSnapshot.date).toLocaleDateString('vi-VN')} ${fromSnapshot.time || '—'} → ${new Date(newDate).toLocaleDateString('vi-VN')} ${startTime}${reason ? `. Lý do: ${reason}` : ''}`,
    }).catch((err) => console.error('Audit rescheduleSession failed:', err.message))

    const memberName = req.user?.fullName || req.user?.name || 'Hội viên'
    const memberCode = req.user?.memberCode || ''
    const ptInfo = await User.findById(schedule.assignedBy).select('fullName name').lean()

    createNotification({
      receiverId: schedule.assignedBy,
      receiverRole: 'pt',
      notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
      title: 'Hội viên đã đổi lịch tập',
      content: `Hội viên đã đổi buổi tập sang ${newDate.toLocaleDateString('vi-VN')} ${startTime}.`,
      relatedId: schedule._id,
      relatedType: 'WorkoutSchedule',
      redirectUrl: '/pt/clients',
      createdBy: 'System',
    }).catch(err => console.error('Notify session rescheduled failed:', err.message))

    createNotification({
      receiverId: null,
      receiverRole: 'admin',
      notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
      title: 'Hội viên đã đổi lịch tập',
      content: `Hội viên ${memberName}${memberCode ? ` (${memberCode})` : ''} đã đổi buổi tập sang ${newDate.toLocaleDateString('vi-VN')} ${startTime}${endTime ? ` → ${endTime}` : ''}. PT phụ trách: ${ptInfo?.fullName || ptInfo?.name || '—'}.`,
      relatedId: schedule._id,
      relatedType: 'WorkoutSchedule',
      redirectUrl: '/admin/members',
      createdBy: 'System',
    }).catch(err => console.error('Notify admin session rescheduled failed:', err.message))

    res.json({ message: 'Đổi lịch tập thành công', schedule })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi đổi lịch tập', error: error.message })
  }
}

/**
 * Member hủy 1 buổi tập cụ thể
 */
export const cancelSession = async (req, res) => {
  try {
    const { scheduleId, dayOrder } = req.params
    const { reason } = req.body

    const schedule = await WorkoutSchedule.findOne({ _id: scheduleId, memberId: req.user._id })
    if (!schedule) {
      return res.status(404).json({ message: 'Không tìm thấy lịch tập' })
    }

    const session = schedule.sessions.find((s) => s.dayOrder === Number(dayOrder))
    if (!session) {
      return res.status(404).json({ message: 'Không tìm thấy buổi tập' })
    }
    if (session.status !== 'pending') {
      return res.status(400).json({ message: 'Buổi tập này không còn hiệu lực để hủy' })
    }

    const fromSnapshot = { date: session.date, time: session.time, status: session.status, feedback: session.feedback }

    session.status = 'cancelled'
    session.feedback = reason ? `Hội viên hủy lịch: ${reason}` : 'Hội viên hủy lịch'

    session.changeHistory.push({
      action: 'cancelled',
      from: fromSnapshot,
      to: { status: 'cancelled' },
      reason: reason || '',
      by: req.user._id,
      byRole: 'member',
    })

    await schedule.save()

    recordAuditLog({
      req,
      module: 'schedule',
      action: 'cancel_session',
      entity: schedule,
      entityName: `Lịch ${schedule._id} - buổi ${dayOrder}`,
      details: `Buổi ${new Date(session.date).toLocaleDateString('vi-VN')} ${session.time || ''}${reason ? `. Lý do: ${reason}` : ''}`,
    }).catch((err) => console.error('Audit cancelSession failed:', err.message))

    const memberName = req.user?.fullName || req.user?.name || 'Hội viên'
    const memberCode = req.user?.memberCode || ''
    const ptInfo = await User.findById(schedule.assignedBy).select('fullName name').lean()

    createNotification({
      receiverId: schedule.assignedBy,
      receiverRole: 'pt',
      notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
      title: 'Hội viên đã hủy buổi tập',
      content: `Hội viên đã hủy buổi tập ${new Date(session.date).toLocaleDateString('vi-VN')} ${session.time || ''}.`,
      relatedId: schedule._id,
      relatedType: 'WorkoutSchedule',
      redirectUrl: '/pt/clients',
      createdBy: 'System',
    }).catch(err => console.error('Notify session cancelled failed:', err.message))

    createNotification({
      receiverId: null,
      receiverRole: 'admin',
      notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
      title: 'Hội viên đã hủy buổi tập',
      content: `Hội viên ${memberName}${memberCode ? ` (${memberCode})` : ''} đã hủy buổi tập ${new Date(session.date).toLocaleDateString('vi-VN')} ${session.time || ''}${reason ? `. Lý do: ${reason}` : ''}. PT phụ trách: ${ptInfo?.fullName || ptInfo?.name || '—'}.`,
      relatedId: schedule._id,
      relatedType: 'WorkoutSchedule',
      redirectUrl: '/admin/members',
      createdBy: 'System',
    }).catch(err => console.error('Notify admin session cancelled failed:', err.message))

    res.json({ message: 'Hủy lịch tập thành công', schedule })
  } catch (error) {
    res.status(500).json({ message: 'Lỗi hủy lịch tập', error: error.message })
  }
}

export const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params
    const { reason } = req.body || {}

    const schedule = await WorkoutSchedule.findById(id)
    if (!schedule) {
      return res.status(404).json({ message: 'Không tìm thấy lịch tập' })
    }

    // Chỉ PT tạo lịch (hoặc admin) được xóa lịch
    if (!isAdmin(req.user) && String(schedule.assignedBy) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Bạn không có quyền xóa lịch tập này' })
    }

    const memberId = schedule.memberId
    const templateId = schedule.templateId

    // Soft-delete: giữ bản ghi để không mất lịch sử nghiệp vụ
    schedule.status = 'cancelled'
    schedule.deletedAt = new Date()
    schedule.deletedBy = req.user._id
    schedule.deleteReason = reason || ''
    await schedule.save()

    // Neu khong con WorkoutSchedule active nao cho member nay, xoa workoutId khoi PTAssignment
    const remaining = await WorkoutSchedule.countDocuments({ memberId, status: 'active', deletedAt: null })
    if (remaining === 0) {
      await PTAssignment.updateMany(
        { memberId, status: 'active', workoutId: templateId },
        { $set: { workoutId: null } },
      )
    }

    recordAuditLog({
      req,
      module: 'schedule',
      action: 'delete_schedule',
      entity: schedule,
      entityName: `Lịch ${id}`,
      details: `Soft-delete lịch${reason ? ` - Lý do: ${reason}` : ''}`,
    }).catch((err) => console.error('Audit deleteSchedule failed:', err.message))

    createNotification({
      receiverId: memberId,
      receiverRole: 'member',
      notificationType: NOTIFICATION_TYPES.SCHEDULE_CHANGED,
      title: 'Lịch tập đã bị xóa',
      content: `Lịch tập của bạn đã bị xóa${reason ? ` (${reason})` : ''}.`,
      relatedId: null,
      relatedType: 'WorkoutSchedule',
      redirectUrl: '/my-schedules',
      createdBy: 'PT',
    }).catch(err => console.error('Notify schedule deleted failed:', err.message))

    res.json({ message: 'Đã xóa lịch tập' })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}
