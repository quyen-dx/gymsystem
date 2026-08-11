import { CheckCircleFilled, CloseOutlined, EnvironmentOutlined, ReloadOutlined, SwapOutlined } from '@ant-design/icons'
import { Button, DatePicker, Empty, Input, message, Modal, Select, Spin, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import MembershipRequired from '../../../components/membership/MembershipRequired'
import { useAuth } from '../../../hooks/useAuth'
import { bookingService } from '../../../services/bookingService'
import type { Booking } from '../../../services/bookingService'
import { membershipService } from '../../../services/membershipService'
import { memberService, type EnrollmentStatus } from '../../../services/memberService'
import { scheduleService } from '../../../services/scheduleService'
import { ptAssignmentService } from '../../../services/ptAssignmentService'
import type { PTAssignment } from '../../../services/ptAssignmentService'
import { trainerService } from '../../../services/trainerService'
import { trainingRequestService } from '../../../services/trainingRequestService'
import type { TrainingRequest } from '../../../services/trainingRequestService'
import { getUserDisplayName } from '../../../utils/userDisplay'
import type { WorkoutSchedule, ScheduleSession } from '../../../services/workoutService'

const badgeForDate = (date: dayjs.Dayjs): { label: string; color: string } => {
  const today = dayjs().startOf('day')
  if (date.isSame(today, 'day')) return { label: 'Hôm nay', color: 'blue' }
  if (date.isAfter(today)) return { label: 'Sắp tới', color: 'default' }
  return { label: 'Đã qua', color: 'default' }
}

const PERFORMANCE_LABEL: Record<string, string> = {
  excellent: 'Xuất sắc',
  good: 'Tốt',
  average: 'Khá',
  below_average: 'Trung bình',
  poor: 'Kém',
}
const PERFORMANCE_COLOR: Record<string, string> = {
  excellent: 'green',
  good: 'blue',
  average: 'cyan',
  below_average: 'gold',
  poor: 'red',
}

const exerciseResultText = (ex: { setsDone?: number; repsDone?: number; weightUsed?: number; durationMin?: number }) => {
  const parts: string[] = []
  if (ex.setsDone) parts.push(`${ex.setsDone} hiệp`)
  if (ex.repsDone) parts.push(`${ex.repsDone} lần`)
  if (ex.weightUsed) parts.push(`${ex.weightUsed}kg`)
  if (ex.durationMin) parts.push(`${ex.durationMin} phút`)
  return parts.length ? parts.join(' × ') : null
}

const MobileCard = ({
  row,
  onDetail,
  onReschedule,
  onCancel,
}: {
  row: ScheduleRow
  onDetail: (r: ScheduleRow) => void
  onReschedule?: (r: ScheduleRow) => void
  onCancel?: (r: ScheduleRow) => void
}) => {
  const badge = badgeForDate(row.date)
  const canModify = isRowModifiable(row)
  return (
    <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-4 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-[var(--gs-text)]">{row.dayLabel}</span>
        <div className="flex items-center gap-2">
          {row.session.className ? <span className="text-xs text-[var(--gs-text-muted)]">{row.session.className}</span> : <span className="text-xs text-[var(--gs-text-muted)]">PT: {row.ptName}</span>}
          <Tag color={badge.color}>{badge.label}</Tag>
        </div>
      </div>
      <div className="space-y-2 text-xs text-[var(--gs-text-muted)]">
        <div className="flex items-start gap-2">
          <span className="w-20 shrink-0">Ngày</span>
          <span className="text-[var(--gs-text)]">{row.date.format('DD/MM/YYYY')}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="w-20 shrink-0">Thời gian</span>
          <span className="text-[var(--gs-text)]">{row.time} - {row.endTime}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="w-20 shrink-0">Địa điểm</span>
          <span className="text-[var(--gs-text)]">{row.location}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="w-20 shrink-0">PT</span>
          <span className="text-[var(--gs-text)]">{row.ptName}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="w-20 shrink-0">Buổi tập</span>
          <span className="font-medium text-[var(--gs-text)]">{row.title}</span>
          {row.session.status === 'cancelled' && <Tag color="red">Đã hủy</Tag>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button type="primary" size="small" onClick={() => onDetail(row)} className="flex-1">Xem chi tiết</Button>
        {canModify && (
          <>
            <Button size="small" icon={<SwapOutlined />} onClick={() => onReschedule?.(row)} className="flex-1">Đổi lịch</Button>
            <Button size="small" danger icon={<CloseOutlined />} onClick={() => onCancel?.(row)} className="flex-1">Hủy</Button>
          </>
        )}
      </div>
    </div>
  )
}

const NoSessions = () => <p className="text-sm text-[var(--gs-text-muted)]">Không có buổi tập nào</p>

const TIME_FILTERS = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7days', label: '7 ngày tới' },
  { value: '30days', label: '30 ngày tới' },
  { value: 'all', label: 'Tất cả' },
]

type TimeFilter = 'today' | '7days' | '30days' | 'all'

const DAY_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

const TIME_SLOTS = ['06:00-08:00', '08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00', '16:00-18:00', '18:00-20:00', '20:00-22:00']

interface ScheduleWindow {
  dayOfWeek: number
  start: string
  end: string
}

// Giống trang đặt lịch: chuyển lịch làm việc cố định của PT (TrainerSchedule) thành cửa sổ giờ theo từng ngày
function getDayWindows(schedules: { dayOfWeek: number; shift: string; startTime?: string; endTime?: string }[]): Map<number, ScheduleWindow[]> {
  const SHIFT_FALLBACK: Record<string, [string, string]> = {
    morning: ['06:00', '12:00'],
    afternoon: ['12:00', '18:00'],
    evening: ['18:00', '22:00'],
  }
  const map = new Map<number, ScheduleWindow[]>()
  for (const s of schedules) {
    const [start, end] = SHIFT_FALLBACK[s.shift] || ['', '']
    const window = {
      dayOfWeek: s.dayOfWeek,
      start: s.startTime || start,
      end: s.endTime || end,
    }
    if (!map.has(s.dayOfWeek)) map.set(s.dayOfWeek, [])
    map.get(s.dayOfWeek)!.push(window)
  }
  return map
}

function toMinutes(t: string): number {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function presetFitsWindow(presetStart: string, presetEnd: string, window: ScheduleWindow): boolean {
  return toMinutes(presetStart) >= toMinutes(window.start) && toMinutes(presetEnd) <= toMinutes(window.end)
}

function slotsOverlap(a: string, b: string): boolean {
  const parse = (s: string) => {
    const [start, end] = String(s || '').split('-')
    return [toMinutes(start), toMinutes(end)]
  }
  const [as, ae] = parse(a)
  const [bs, be] = parse(b)
  if (!ae || !be) return true
  return as < be && bs < ae
}

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Lý do không thể chọn khung giờ — giống validate khi đặt lịch
function slotUnavailableReason(slot: string, date: dayjs.Dayjs | null, windows: Map<number, ScheduleWindow[]>, busy: Array<{ date: string; slot: string }>, isCurrent: boolean): string | null {
  if (!date) return null
  const dayWindows = windows.get(date.day())
  // Đã có dữ liệu lịch PT nhưng ngày này PT không làm việc → chặn hết
  if (dayWindows === undefined) {
    return windows.size > 0 ? 'PT không làm việc vào ngày này' : null
  }
  const [start, end] = slot.split('-')
  const fitsSchedule = dayWindows.some((w) => presetFitsWindow(start, end, w))
  if (!fitsSchedule) return 'Không nằm trong lịch làm việc của PT'
  if (!isCurrent) {
    const dateKey = date.format('YYYY-MM-DD')
    if (busy.some((b) => toLocalDateKey(new Date(b.date)) === dateKey && slotsOverlap(slot, b.slot))) {
      return 'PT đã có lịch bận vào ngày này'
    }
  }
  return null
}

// Ngày PT không làm việc (đã có dữ liệu lịch) → không cho chọn trong DatePicker
function isPTWorkingDay(date: dayjs.Dayjs, windows: Map<number, ScheduleWindow[]>): boolean {
  if (windows.size === 0) return true
  return windows.has(date.day())
}

interface ScheduleRow {
  key: string
  stt: number
  source: 'workout' | 'booking'
  date: dayjs.Dayjs
  dayLabel: string
  time: string
  endTime: string
  location: string
  ptName: string
  title: string
  status: 'pending' | 'completed' | 'skipped' | 'cancelled' | 'no_show'
  scheduleId: string
  session: ScheduleSession
  schedule?: WorkoutSchedule
  booking?: Booking
}

function ptDisplayName(schedule: WorkoutSchedule): string {
  const pt = (schedule.assignedBy as any)
  if (!pt) return 'PT của bạn'
  if (typeof pt === 'string') return 'PT'
  return getUserDisplayName(pt, 'PT của bạn')
}

function getPtNameFromBooking(booking: Booking): string {
  const pt = booking.ptId
  if (!pt || typeof pt === 'string') return 'PT của bạn'
  return getUserDisplayName(pt, 'PT của bạn')
}

function splitSlot(slot: string): { start: string; end: string } {
  const [start = '', end = ''] = String(slot || '').split('-').map((part) => part.trim())
  return {
    start: start || '—',
    end: end || '—',
  }
}

function scheduleRowKey(date: dayjs.Dayjs, time: string, ptName: string) {
  return `${date.format('YYYY-MM-DD')}__${time || ''}__${ptName || ''}`
}

function nextDateForRequestDay(dayOfWeek: number, slot: string) {
  const today = dayjs().startOf('day')
  let diff = Number(dayOfWeek) - today.day()
  if (diff < 0) diff += 7
  let target = today.add(diff, 'day')
  const start = String(slot || '').split('-')[0]?.trim()
  if (start) {
    const [hour = 0, minute = 0] = start.split(':').map(Number)
    const startDateTime = target.hour(hour || 0).minute(minute || 0).second(0)
    if (startDateTime.isBefore(dayjs())) target = target.add(7, 'day')
  }
  return target
}

function trainerNameFromRequest(request: TrainingRequest) {
  const trainer = request.assignedTrainerId
  if (!trainer || typeof trainer === 'string') return 'PT của bạn'
  return getUserDisplayName(trainer, 'PT của bạn')
}

function trainerNameFromAssignment(assignment: PTAssignment) {
  const trainer = assignment.ptId
  if (!trainer || typeof trainer === 'string') return 'PT của bạn'
  return getUserDisplayName(trainer, 'PT của bạn')
}

// Buổi thuộc lịch của PT: chỉ được đổi/hủy khi chưa diễn ra và chưa hoàn thành
const isRowModifiable = (row: ScheduleRow): boolean => {
  if (row.date.isBefore(dayjs().startOf('day'))) return false
  if (row.source === 'workout') return row.session.status === 'pending'
  if (row.source === 'booking' && row.booking) {
    return ['awaiting_payment', 'confirmed'].includes(row.booking.status)
  }
  return false
}

export default function WorkoutPage() {
  const { user } = useAuth()
  const [membershipLoading, setMembershipLoading] = useState(true)
  const [canView, setCanView] = useState(false)
  const [planName, setPlanName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [schedules, setSchedules] = useState<WorkoutSchedule[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [ptRequests, setPtRequests] = useState<TrainingRequest[]>([])
  const [ptAssignment, setPtAssignment] = useState<PTAssignment | null>(null)
  const [enrollmentStatus, setEnrollmentStatus] = useState<EnrollmentStatus | null>(null)
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('7days')
  const [detailSession, setDetailSession] = useState<ScheduleSession | null>(null)
  const [detailPtName, setDetailPtName] = useState<string>('')
  const [rescheduleTarget, setRescheduleTarget] = useState<ScheduleRow | null>(null)
  const [cancelTarget, setCancelTarget] = useState<ScheduleRow | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState<dayjs.Dayjs | null>(null)
  const [rescheduleSlot, setRescheduleSlot] = useState<string | undefined>(undefined)
  const [rescheduleReason, setRescheduleReason] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [ptWindows, setPtWindows] = useState<Map<number, ScheduleWindow[]>>(new Map())
  const [ptBusy, setPtBusy] = useState<Array<{ date: string; slot: string }>>([])

  useEffect(() => {
    ;(async () => {
      if (!user?._id) return
      try {
        const res = await membershipService.getMyMembership()
        const membership = res.data.membership
        const statusOk = membership?.status === 'active' || membership?.status === 'pending_cancel'
        const notExpired = statusOk ? Number(membership?.remainingDays || 0) > 0 : true
        const allowed = statusOk && notExpired
        setCanView(allowed)
        if (membership) {
          const name = membership.planNameVi || membership.plan?.nameVi || null
          setPlanName(name)
        }
      } catch {
        setCanView(false)
      } finally {
        setMembershipLoading(false)
      }
    })()
  }, [user?._id])

  const loadSchedules = useCallback(async () => {
    setLoading(true)
    try {
      const [scheduleRes, bookingRes, requestRes, assignmentRes, enrollmentRes] = await Promise.allSettled([
        scheduleService.getMySchedules(),
        bookingService.getMyBookings(),
        trainingRequestService.getMyRequests({ type: 'pt1on1' }),
        ptAssignmentService.getMyAssignment(),
        memberService.getMyEnrollmentStatus(),
      ])

      setSchedules(scheduleRes.status === 'fulfilled' ? scheduleRes.value.data.schedules || [] : [])
      setBookings(bookingRes.status === 'fulfilled' ? bookingRes.value.data || [] : [])
      setPtRequests(requestRes.status === 'fulfilled' ? requestRes.value.data.requests || [] : [])
      setPtAssignment(assignmentRes.status === 'fulfilled' ? assignmentRes.value.data.assignment || null : null)
      setEnrollmentStatus(enrollmentRes.status === 'fulfilled' ? enrollmentRes.value.data || null : null)
    } catch {
      setSchedules([])
      setBookings([])
      setPtRequests([])
      setPtAssignment(null)
      setEnrollmentStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?._id && canView) loadSchedules()
  }, [user?._id, canView, loadSchedules])

  useEffect(() => {
    const refreshAfterTrainingCleanup = () => { loadSchedules() }
    window.addEventListener('gympro:training-cleanup', refreshAfterTrainingCleanup)
    return () => window.removeEventListener('gympro:training-cleanup', refreshAfterTrainingCleanup)
  }, [loadSchedules])

  const now = dayjs().startOf('day')

  const allRows: ScheduleRow[] = useMemo(() => {
    const result: ScheduleRow[] = []
    const workoutSessionKeys = new Set<string>()
    const concreteScheduleKeys = new Set<string>()

    for (const s of schedules) {
      if (s.status !== 'active') continue
      for (const session of s.sessions || []) {
        const d = dayjs(session.date)
        const ptName = ptDisplayName(s)
        const key = scheduleRowKey(d, session.time || '—', ptName)
        workoutSessionKeys.add(key)
        concreteScheduleKeys.add(key)
        result.push({
          key: `${s._id}-${session.dayOrder}`,
          stt: 0,
          source: 'workout',
          date: d,
          dayLabel: DAY_LABELS[d.day()],
          time: session.time || '—',
          endTime: session.endTime || '—',
          location: session.location || '—',
          ptName,
          title: session.title || session.muscleGroup || 'Buổi tập',
          status: session.status,
          scheduleId: s._id,
          session,
          schedule: s,
        })
      }
    }

    for (const booking of bookings) {
      // The workout calendar is for official sessions only. Payment actions
      // are shown with the member's pending PT request instead.
      if (booking.status !== 'confirmed') continue

      const d = dayjs(booking.date)
      const { start, end } = splitSlot(booking.slot)
      const ptName = getPtNameFromBooking(booking)
      const duplicateKey = scheduleRowKey(d, start, ptName)
      if (workoutSessionKeys.has(duplicateKey)) continue
      concreteScheduleKeys.add(duplicateKey)

      const title = booking.status === 'confirmed'
        ? 'Lịch PT 1-1'
        : 'Lịch PT 1-1 - chờ thanh toán'

      result.push({
        key: `booking-${booking._id}`,
        stt: 0,
        source: 'booking',
        date: d,
        dayLabel: DAY_LABELS[d.day()],
        time: start,
        endTime: end,
        location: 'Lịch PT 1-1',
        ptName,
        title,
        status: 'pending',
        scheduleId: booking._id,
        booking,
        session: {
          dayOrder: 0,
          date: booking.date,
          time: start,
          endTime: end,
          location: 'Lịch PT 1-1',
          title,
          muscleGroup: 'PT 1-1',
          exercises: [],
          status: 'pending',
          feedback: booking.note || '',
        },
      })
    }

    for (const request of ptRequests) {
      if (request.type !== 'pt1on1') continue
      if (!['assigned', 'active'].includes(request.status)) continue
      if (!request.assignedTrainerId) continue
      if (bookings.some((b) => b.requestId && String(b.requestId) === String(request._id))) continue

      const pairs = request.daySlots?.length
        ? request.daySlots
        : (() => {
            const slot = (request.timeSlots || []).find(Boolean)
            const days = request.daysOfWeek || []
            return slot && days.length ? days.map((day) => ({ day, slot })) : []
          })()
      if (!pairs.length) continue

      const ptName = trainerNameFromRequest(request)

      for (const pair of pairs) {
        const { start, end } = splitSlot(pair.slot)
        const d = nextDateForRequestDay(pair.day, pair.slot)
        const duplicateKey = scheduleRowKey(d, start, ptName)
        if (concreteScheduleKeys.has(duplicateKey)) continue
        concreteScheduleKeys.add(duplicateKey)

        result.push({
          key: `request-${request._id}-${pair.day}-${pair.slot}`,
          stt: 0,
          source: 'booking',
          date: d,
          dayLabel: DAY_LABELS[d.day()],
          time: start,
          endTime: end,
          location: 'Lịch PT 1-1',
          ptName,
          title: 'Lịch PT 1-1',
          status: 'pending',
          scheduleId: request._id,
          session: {
            dayOrder: 0,
            date: d.toISOString(),
            time: start,
            endTime: end,
            location: 'Lịch PT 1-1',
            title: 'Lịch PT 1-1',
            muscleGroup: (request.goals || []).join(', ') || 'PT 1-1',
            exercises: [],
            status: 'pending',
            feedback: request.note || '',
          },
        })
      }
    }

    // Lịch lớp ở enrollment chỉ là lịch mẫu. Không cộng nó vào khi hội viên đã có
    // lịch PT/booking thực tế, nếu không sẽ xuất hiện thêm các ngày chưa hề đặt.
    const hasConcreteSchedule = result.some((row) => row.source === 'workout' || !!row.booking)
    const enrolledClass = enrollmentStatus?.class
    if (!hasConcreteSchedule && enrolledClass && Array.isArray(enrolledClass.daysOfWeek) && enrolledClass.daysOfWeek.length > 0 && enrolledClass.time) {
      const { start, end } = splitSlot(enrolledClass.time)
      const ptName = enrolledClass.ptName || 'PT của bạn'
      const title = enrolledClass.name || 'Lớp tập nhóm'

      for (const day of enrolledClass.daysOfWeek) {
        const d = nextDateForRequestDay(day, enrolledClass.time)
        const duplicateKey = scheduleRowKey(d, start, ptName)
        if (concreteScheduleKeys.has(duplicateKey)) continue
        concreteScheduleKeys.add(duplicateKey)

        result.push({
          key: `class-${enrolledClass.classId}-${day}`,
          stt: 0,
          source: 'booking',
          date: d,
          dayLabel: DAY_LABELS[d.day()],
          time: start,
          endTime: end,
          location: enrolledClass.name || 'Lớp tập nhóm',
          ptName,
          title,
          status: 'pending',
          scheduleId: enrolledClass.classId,
          session: {
            dayOrder: 0,
            date: d.toISOString(),
            time: start,
            endTime: end,
            location: enrolledClass.name || 'Lớp tập nhóm',
            title,
            muscleGroup: 'Lớp nhóm',
            exercises: [],
            status: 'pending',
            feedback: '',
          },
        })
      }
    }

    const hasUpcomingRow = result.some((row) => !row.date.isBefore(dayjs().startOf('day')))
    const assignmentRequest = ptAssignment?.trainingRequest
    if (ptAssignment && ['active', 'pending_end_approval'].includes(ptAssignment.status) && !hasUpcomingRow) {
      const ptName = trainerNameFromAssignment(ptAssignment)
      const pairs = assignmentRequest?.daySlots?.length
        ? assignmentRequest.daySlots
        : (() => {
            const slot = (assignmentRequest?.timeSlots || []).find(Boolean)
            const days = assignmentRequest?.daysOfWeek || []
            return slot && days.length ? days.map((day) => ({ day, slot })) : []
          })()

      if (pairs.length > 0) {
        for (const pair of pairs) {
          const { start, end } = splitSlot(pair.slot)
          const d = nextDateForRequestDay(pair.day, pair.slot)
          const duplicateKey = scheduleRowKey(d, start, ptName)
          if (concreteScheduleKeys.has(duplicateKey)) continue
          concreteScheduleKeys.add(duplicateKey)

          result.push({
            key: `assignment-${ptAssignment._id}-${pair.day}-${pair.slot}`,
            stt: 0,
            source: 'booking',
            date: d,
            dayLabel: DAY_LABELS[d.day()],
            time: start,
            endTime: end,
            location: 'Lịch PT 1-1',
            ptName,
            title: 'Lịch PT 1-1',
            status: 'pending',
            scheduleId: ptAssignment._id,
            session: {
              dayOrder: 0,
              date: d.toISOString(),
              time: start,
              endTime: end,
              location: 'Lịch PT 1-1',
              title: 'Lịch PT 1-1',
              muscleGroup: (assignmentRequest?.goals || []).join(', ') || 'PT 1-1',
              exercises: [],
              status: 'pending',
              feedback: assignmentRequest?.note || '',
            },
          })
        }
      } else {
        const d = dayjs()
        result.push({
          key: `assignment-${ptAssignment._id}`,
          stt: 0,
          source: 'booking',
          date: d,
          dayLabel: DAY_LABELS[d.day()],
          time: '—',
          endTime: '—',
          location: 'PT 1-1',
          ptName,
          title: 'Đã có PT phụ trách - chờ tạo lịch chi tiết',
          status: 'pending',
          scheduleId: ptAssignment._id,
          session: {
            dayOrder: 0,
            date: d.toISOString(),
            time: '',
            endTime: '',
            location: 'PT 1-1',
            title: 'Đã có PT phụ trách - chờ tạo lịch chi tiết',
            muscleGroup: 'PT 1-1',
            exercises: [],
            status: 'pending',
            feedback: 'PT đã nhận phụ trách. Vui lòng chờ PT tạo giáo án/lịch chi tiết.',
          },
        })
      }
    }

    result.sort((a, b) => a.date.unix() - b.date.unix())

    return result.map((r, idx) => ({ ...r, stt: idx + 1 }))
  }, [bookings, ptAssignment, ptRequests, schedules, enrollmentStatus])

  const futureRows = useMemo(() => allRows.filter((r) => !r.date.isBefore(now)), [allRows, now])

  const filteredRows = useMemo(() => {
    switch (timeFilter) {
      case 'today':
        return futureRows.filter((r) => r.date.isSame(now, 'day'))
      case '7days':
        return futureRows.filter((r) => r.date.isBefore(now.add(7, 'day')))
      case '30days':
        return futureRows.filter((r) => r.date.isBefore(now.add(30, 'day')))
      case 'all':
      default:
        return futureRows
    }
  }, [futureRows, timeFilter, now])

  const nearestWindow = useMemo(() => {
    if (futureRows.length > 0) {
      const from = futureRows[0].date
      return { from, to: from.add(6, 'day') }
    }
    const past = allRows.filter((r) => r.date.isBefore(now))
    if (past.length === 0) return null
    const last = past[past.length - 1].date
    return { from: last.subtract(6, 'day'), to: last }
  }, [allRows, futureRows, now])

  const isShowingNearest = timeFilter === '7days' && filteredRows.length === 0 && nearestWindow !== null

  const displayRows = useMemo(() => {
    if (!isShowingNearest || !nearestWindow) return filteredRows
    return allRows.filter((r) => !r.date.isBefore(nearestWindow.from) && !r.date.isAfter(nearestWindow.to))
  }, [isShowingNearest, nearestWindow, allRows, filteredRows])

  const openDetail = (row: ScheduleRow) => {
    setDetailSession(row.session)
    setDetailPtName(row.ptName)
  }

  const openReschedule = (row: ScheduleRow) => {
    setRescheduleDate(row.date.isBefore(dayjs().startOf('day')) ? null : row.date)
    const initialSlot = row.source === 'booking' && row.booking
      ? row.booking.slot
      : row.session.endTime
        ? `${row.session.time}-${row.session.endTime}`
        : row.session.time || undefined
    setRescheduleSlot(TIME_SLOTS.find((s) => s === initialSlot) || initialSlot)
    setRescheduleReason('')
    setRescheduleTarget(row)

    // Load lịch làm việc + giờ bận của PT để validate khung giờ giống trang đặt lịch
    setPtWindows(new Map())
    setPtBusy([])
    const rawPt = row.source === 'workout'
      ? row.schedule?.assignedBy
      : row.booking?.ptId
    const ptId = rawPt && typeof rawPt === 'object' ? rawPt._id : rawPt
    if (ptId) {
      trainerService.getAvailablePTById(ptId)
        .then((res) => {
          const pt = res.data?.pt || res.data
          if (pt?.schedules) setPtWindows(getDayWindows(pt.schedules))
          if (Array.isArray(pt?.busyBookings)) setPtBusy(pt.busyBookings)
        })
        .catch(() => {
          setPtWindows(new Map())
          setPtBusy([])
        })
    }
  }

  const openCancel = (row: ScheduleRow) => {
    setCancelReason('')
    setCancelTarget(row)
  }

  const submitReschedule = async () => {
    if (!rescheduleTarget || !rescheduleDate || !rescheduleSlot) return
    const start = rescheduleSlot.split('-')[0].trim()
    const end = rescheduleSlot.split('-')[1]?.trim() || ''
    const dateStr = rescheduleDate.format('YYYY-MM-DD')
    setActionLoading(true)
    try {
      if (rescheduleTarget.source === 'workout') {
        await scheduleService.rescheduleSession(
          rescheduleTarget.scheduleId,
          rescheduleTarget.session.dayOrder,
          { date: dateStr, time: start, endTime: end, reason: rescheduleReason.trim() || undefined },
        )
      } else if (rescheduleTarget.booking) {
        // Booking đã được PT xác nhận → member đổi lịch phải qua PT duyệt
        await bookingService.requestRescheduleBooking(rescheduleTarget.booking._id, {
          date: dateStr,
          slot: rescheduleSlot,
          reason: rescheduleReason.trim() || undefined,
        })
        message.success('Đã gửi yêu cầu đổi lịch. PT sẽ xác nhận trước khi lịch mới được áp dụng.')
        setRescheduleTarget(null)
        loadSchedules()
        return
      }
      message.success('Đổi lịch tập thành công')
      setRescheduleTarget(null)
      loadSchedules()
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể đổi lịch tập')
    } finally {
      setActionLoading(false)
    }
  }

  const submitCancel = async () => {
    if (!cancelTarget) return
    setActionLoading(true)
    try {
      if (cancelTarget.source === 'workout') {
        await scheduleService.cancelSession(
          cancelTarget.scheduleId,
          cancelTarget.session.dayOrder,
          { reason: cancelReason.trim() || undefined },
        )
      } else if (cancelTarget.booking) {
        await bookingService.cancelBooking(cancelTarget.booking._id, cancelReason.trim() || 'Hội viên hủy lịch')
      }
      message.success('Hủy lịch tập thành công')
      setCancelTarget(null)
      loadSchedules()
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể hủy lịch tập')
    } finally {
      setActionLoading(false)
    }
  }

  const rescheduleSlots = useMemo(() => {
    const isPastSlot = (slot: string) => {
      if (!rescheduleDate || !rescheduleDate.isSame(dayjs(), 'day')) return false
      const nowMin = dayjs().hour() * 60 + dayjs().minute()
      const [h = 0, m = 0] = slot.split('-')[0].trim().split(':').map(Number)
      return h * 60 + m <= nowMin
    }
    const isCurrentSlot = (slot: string) => {
      if (!rescheduleTarget) return false
      if (!rescheduleDate?.isSame(rescheduleTarget.date, 'day')) return false
      const currentSlot = rescheduleTarget.source === 'booking' && rescheduleTarget.booking
        ? rescheduleTarget.booking.slot
        : rescheduleTarget.session.endTime
          ? `${rescheduleTarget.session.time}-${rescheduleTarget.session.endTime}`
          : rescheduleTarget.session.time
      return slot === currentSlot
    }
    return TIME_SLOTS.filter((slot) => {
      if (isPastSlot(slot)) return false
      const reason = slotUnavailableReason(slot, rescheduleDate, ptWindows, ptBusy, isCurrentSlot(slot))
      return reason === null
    })
  }, [rescheduleDate, ptWindows, ptBusy, rescheduleTarget])

  // Nếu khung giờ đang chọn không còn khả dụng (đổi ngày/PT bận) thì reset lại
  useEffect(() => {
    if (!rescheduleTarget || !rescheduleDate || !rescheduleSlot) return
    if (!rescheduleSlots.includes(rescheduleSlot)) setRescheduleSlot(undefined)
  }, [rescheduleDate, rescheduleSlots, rescheduleSlot, rescheduleTarget])

  const columns: ColumnsType<ScheduleRow> = [
    { title: 'STT', width: 52, align: 'center', render: (_, r) => <span className="font-medium text-[var(--gs-text)]">{r.stt}</span> },
    { title: 'Ngày', width: 90, render: (_, r) => <span className="text-[var(--gs-text)]">{r.date.format('DD/MM')}</span> },
    { title: 'Thứ', width: 80, render: (_, r) => <span className="text-[var(--gs-text)]">{r.dayLabel}</span> },
    { title: 'Giờ bắt đầu', width: 90, render: (_, r) => <span className="text-[var(--gs-text-muted)]">{r.time}</span> },
    { title: 'Giờ kết thúc', width: 90, render: (_, r) => <span className="text-[var(--gs-text-muted)]">{r.endTime}</span> },
    {
      title: 'Địa điểm', width: 120, ellipsis: true,
      render: (_, r) =>
        r.location !== '—'
          ? <span className="flex items-center gap-1 text-xs text-[var(--gs-text)]"><EnvironmentOutlined className="text-[var(--theme)]" />{r.location}</span>
          : <span className="text-[var(--gs-text-muted)]">—</span>,
    },
    { title: 'PT phụ trách', width: 140, ellipsis: true, 
      render: (_, r) => (
        <span className="text-[var(--gs-text)]">
          {r.ptName}
        </span>
      ),
    },
    { title: 'Buổi tập', width: 160, render: (_, r) => (
      <span className="flex items-center gap-1.5 font-medium text-[var(--gs-text)]">
        <span className="truncate">{r.title}</span>
        {r.session.status === 'cancelled' && <Tag color="red">Đã hủy</Tag>}
      </span>
    ) },
    {
      title: 'Chi tiết', width: 80, align: 'center',
      render: (_, r) => <Button type="link" size="small" onClick={() => openDetail(r)}>Xem</Button>,
    },
    {
      title: 'Thao tác', width: 200, align: 'center',
      render: (_, r) => isRowModifiable(r) ? (
        <div className="flex items-center justify-center gap-1.5">
          <Button size="small" icon={<SwapOutlined />} onClick={() => openReschedule(r)}>Đổi lịch</Button>
          <Button size="small" danger icon={<CloseOutlined />} onClick={() => openCancel(r)}>Hủy</Button>
        </div>
      ) : (
        <span className="text-xs text-[var(--gs-text-muted)]">—</span>
      ),
    },
  ]

  return (
    <MemberLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        {membershipLoading ? (
          <div className="text-sm text-[var(--gs-text-muted)]">Đang kiểm tra thông tin gói tập...</div>
        ) : !canView ? (
          <MembershipRequired planName={planName} featureLabel="xem lịch tập" />
        ) : (
          <>
            <div className="mb-5 flex items-start justify-between max-[767px]:flex-col max-[767px]:gap-3">
              <div>
                <h1 className="text-xl font-bold text-[var(--gs-text)] max-[767px]:text-lg">Lịch tập của tôi</h1>
                <p className="mt-0.5 text-sm text-[var(--gs-text-muted)]">Thời khóa biểu tập luyện</p>
              </div>
              <div className="flex items-center gap-3 max-[767px]:w-full max-[767px]:flex-col max-[767px]:gap-2">
                <Select value={timeFilter} onChange={setTimeFilter} options={TIME_FILTERS} className="max-[767px]:!w-full" style={{ width: 150 }} size="middle" />
                <Button icon={<ReloadOutlined />} onClick={loadSchedules} loading={loading} className="max-[767px]:w-full max-[767px]:min-h-[44px]">Tải lại</Button>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center"><Spin size="large" /></div>
            ) : allRows.length === 0 ? (
              <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-[var(--gs-border)] bg-[var(--gs-card)] p-8">
                <Empty description="Bạn chưa có lịch tập. Hãy liên hệ PT để được tạo lịch nhé!" />
              </div>
            ) : (
              <>
              {isShowingNearest && (
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--gs-border)] bg-[var(--gs-card-soft)] px-3 py-1 text-sm text-[var(--gs-text-muted)]">
                  Đang hiển thị lịch gần nhất.
                </div>
              )}
              <div className="workout-table-desktop rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)]">
                <Table
                  dataSource={displayRows}
                  columns={columns}
                  pagination={false}
                  rowKey="key"
                  size="middle"
                  locale={{
                    emptyText: <NoSessions />,
                  }}
                  scroll={{ x: 900 }}
                />
                  <div className="border-t border-[var(--gs-border)] px-4 py-2.5 text-sm text-[var(--gs-text-muted)]">
                    Đang xem 1-{displayRows.length} / {allRows.length} buổi
                  </div>
                </div>
              <div className="workout-cards-mobile space-y-3">
                {displayRows.length > 0 ? (
                  displayRows.map((row) => (
                    <MobileCard
                      key={row.key}
                      row={row}
                      onDetail={openDetail}
                      onReschedule={openReschedule}
                      onCancel={openCancel}
                    />
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-[var(--gs-border)] bg-[var(--gs-card)] p-8 text-center">
                    <NoSessions />
                  </div>
                )}
              </div>
              </>
            )}
          </>
        )}
      </div>

      <Modal
        title={null}
        open={!!detailSession}
        onCancel={() => setDetailSession(null)}
        footer={null}
        width={560}
        destroyOnClose
      >
        {detailSession && (
          <div className="space-y-5">
            {/* Header: date, time, location, PT */}
            <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-4">
              <h3 className="text-lg font-bold text-[var(--gs-text)]">
                {detailSession.title || detailSession.muscleGroup || 'Buổi tập'}
              </h3>
              <div className="mt-3 space-y-1.5 text-sm">
                {detailSession.date && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[var(--gs-text-soft)] w-24 shrink-0">Ngày</span>
                    <span className="text-[var(--gs-text)]">{dayjs(detailSession.date).format('DD/MM/YYYY')} — {DAY_LABELS[dayjs(detailSession.date).day()]}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--gs-text-soft)] w-24 shrink-0">Giờ tập</span>
                  <span className="text-[var(--gs-text)]">
                    {detailSession.time || '—'}{detailSession.endTime ? ` → ${detailSession.endTime}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--gs-text-soft)] w-24 shrink-0">Địa điểm</span>
                  <span className="flex items-center gap-1 text-[var(--gs-text)]">
                    <EnvironmentOutlined className="text-[var(--theme)]" />
                    {detailSession.location || '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--gs-text-soft)] w-24 shrink-0">PT phụ trách</span>
                  <span className="text-[var(--gs-text)]">{detailPtName || '—'}</span>
                </div>
                {detailSession.status === 'completed' && detailSession.performance && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[var(--gs-text-soft)] w-24 shrink-0">Kết quả buổi</span>
                    <Tag color={PERFORMANCE_COLOR[detailSession.performance] || 'default'}>
                      {PERFORMANCE_LABEL[detailSession.performance] || detailSession.performance}
                    </Tag>
                  </div>
                )}
              </div>
              {detailSession.feedback && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card-soft)] px-3 py-2">
                  <span className="text-xs font-medium text-[var(--gs-text-soft)] w-24 shrink-0 pt-0.5">Ghi chú</span>
                  <span className="text-sm italic text-[var(--gs-text-muted)]">{detailSession.feedback}</span>
                </div>
              )}
            </div>

            {/* Exercise list — read only */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-[var(--gs-text)]">Danh sách bài tập</h4>
              {(!detailSession.exercises || detailSession.exercises.length === 0) ? (
                <p className="text-sm italic text-[var(--gs-text-muted)]">Chưa có bài tập nào</p>
              ) : (
                detailSession.exercises.map((ex: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] px-4 py-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--theme-accent)]/10 text-xs font-bold text-[var(--theme)]">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-[var(--gs-text)]">{ex.name}</span>
                      {ex.note && <span className="ml-2 text-xs text-[var(--gs-text-muted)]">{ex.note}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {ex.completed && <CheckCircleFilled className="text-green-500" />}
                      {exerciseResultText(ex) && (
                        <span className="rounded-full bg-[var(--theme-accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--theme)]">
                          {exerciseResultText(ex)}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {detailSession.feedback && (
              <div className="flex items-start gap-2 rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card-soft)] px-3 py-2">
                <span className="text-xs font-medium text-[var(--gs-text-soft)] w-24 shrink-0 pt-0.5">Ghi chú PT</span>
                <span className="text-sm italic text-[var(--gs-text-muted)]">{detailSession.feedback}</span>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="Đổi lịch tập"
        open={!!rescheduleTarget}
        onCancel={() => setRescheduleTarget(null)}
        width={520}
        destroyOnClose
        footer={[
          <Button key="back" onClick={() => setRescheduleTarget(null)}>Hủy bỏ</Button>,
          <Button
            key="submit"
            type="primary"
            icon={<SwapOutlined />}
            loading={actionLoading}
            disabled={!rescheduleDate || !rescheduleSlot}
            onClick={submitReschedule}
          >
            Xác nhận đổi lịch
          </Button>,
        ]}
      >
        {rescheduleTarget && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card-soft)] px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[var(--gs-text)]">{rescheduleTarget.title}</span>
                <Tag color="blue">{rescheduleTarget.dayLabel}</Tag>
              </div>
              <p className="mt-1 text-[var(--gs-text-muted)]">
                Buổi hiện tại: {rescheduleTarget.date.format('DD/MM/YYYY')} — {rescheduleTarget.time}{rescheduleTarget.endTime ? ` → ${rescheduleTarget.endTime}` : ''}
              </p>
              <p className="text-[var(--gs-text-muted)]">PT phụ trách: {rescheduleTarget.ptName}</p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--gs-text)]">Ngày tập mới</label>
              <DatePicker
                className="w-full"
                value={rescheduleDate}
                onChange={setRescheduleDate}
                format="DD/MM/YYYY"
                placeholder="Chọn ngày tập mới"
                disabledDate={(current) => {
                  if (current.isBefore(dayjs().startOf('day'))) return true
                  return !isPTWorkingDay(current, ptWindows)
                }}
              />
              {ptWindows.size > 0 && rescheduleDate && !isPTWorkingDay(rescheduleDate, ptWindows) && (
                <p className="mt-1 text-xs text-[var(--gs-text-muted)]">PT không làm việc vào ngày này. Vui lòng chọn ngày khác.</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--gs-text)]">Khung giờ mới</label>
              {(() => {
                const currentSlot = rescheduleTarget && (rescheduleTarget.source === 'booking' && rescheduleTarget.booking
                  ? rescheduleTarget.booking.slot
                  : rescheduleTarget.session.endTime
                    ? `${rescheduleTarget.session.time}-${rescheduleTarget.session.endTime}`
                    : rescheduleTarget.session.time)
                const isCurrentDate = !!rescheduleTarget && !!rescheduleDate && rescheduleDate.isSame(rescheduleTarget.date, 'day')
                const slotState = (s: string) => {
                  const isCurrent = isCurrentDate && s === currentSlot
                  const reason = rescheduleDate
                    ? slotUnavailableReason(s, rescheduleDate, ptWindows, ptBusy, isCurrent)
                    : null
                  const past = rescheduleDate?.isSame(dayjs(), 'day')
                    ? toMinutes(s.split('-')[0].trim()) <= dayjs().hour() * 60 + dayjs().minute()
                    : false
                  return { disabled: !!reason || past, note: reason || (past ? 'Khung giờ đã qua trong hôm nay' : null) }
                }
                return (
                  <>
                    <Select
                      className="w-full"
                      value={rescheduleSlot}
                      onChange={setRescheduleSlot}
                      placeholder="Chọn khung giờ tập mới"
                      options={TIME_SLOTS.map((s) => {
                        const [start, end] = s.split('-').map((part) => part.trim())
                        const state = slotState(s)
                        return { value: s, label: `${start} - ${end}`, disabled: state.disabled }
                      })}
                      optionRender={(option) => {
                        const s = option.value as string
                        const state = slotState(s)
                        return (
                          <span className="flex items-center justify-between gap-2">
                            <span>{(option.data.label as string) || s}</span>
                            {state.note && <span className="text-xs text-[var(--gs-text-muted)]">{state.note}</span>}
                          </span>
                        )
                      }}
                    />
                    {rescheduleDate && rescheduleSlots.length === 0 && (
                      <p className="mt-1 text-xs text-[var(--gs-text-muted)]">
                        Không có khung giờ khả dụng cho ngày này (PT không làm việc hoặc đã bận). Vui lòng chọn ngày khác.
                      </p>
                    )}
                  </>
                )
              })()}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--gs-text)]">Lý do đổi lịch <span className="text-xs text-[var(--gs-text-muted)]">(không bắt buộc)</span></label>
              <Input.TextArea
                value={rescheduleReason}
                onChange={(e) => setRescheduleReason(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Nhập lý do đổi lịch để PT nắm được..."
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="Hủy lịch tập"
        open={!!cancelTarget}
        onCancel={() => setCancelTarget(null)}
        width={520}
        destroyOnClose
        footer={[
          <Button key="back" onClick={() => setCancelTarget(null)}>Trở lại</Button>,
          <Button key="submit" type="primary" danger icon={<CloseOutlined />} loading={actionLoading} onClick={submitCancel}>
            Xác nhận hủy lịch
          </Button>,
        ]}
      >
        {cancelTarget && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card-soft)] px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[var(--gs-text)]">{cancelTarget.title}</span>
                <Tag color="red">{cancelTarget.dayLabel}</Tag>
              </div>
              <p className="mt-1 text-[var(--gs-text-muted)]">
                {cancelTarget.date.format('DD/MM/YYYY')} — {cancelTarget.time}{cancelTarget.endTime ? ` → ${cancelTarget.endTime}` : ''}
              </p>
              <p className="text-[var(--gs-text-muted)]">PT phụ trách: {cancelTarget.ptName}</p>
            </div>

            <p className="text-sm text-[var(--gs-text)]">
              Bạn có chắc chắn muốn hủy buổi tập này? Sau khi hủy, buổi tập sẽ được đánh dấu là đã hủy và PT sẽ được thông báo.
            </p>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--gs-text)]">Lý do hủy lịch <span className="text-xs text-[var(--gs-text-muted)]">(không bắt buộc)</span></label>
              <Input.TextArea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Nhập lý do hủy lịch để PT nắm được..."
              />
            </div>
          </div>
        )}
      </Modal>
    </MemberLayout>
  )
}
