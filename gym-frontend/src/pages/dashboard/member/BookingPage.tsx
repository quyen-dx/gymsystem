import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'
import { Button, Tag, message, Input, Spin, Modal } from 'antd'
import { CheckCircleFilled, FireOutlined, AimOutlined, ThunderboltOutlined, HeartOutlined, RiseOutlined, MedicineBoxOutlined, SafetyOutlined, QuestionCircleOutlined, EnvironmentOutlined, TeamOutlined, UserOutlined, ArrowLeftOutlined, ArrowRightOutlined, CalendarOutlined } from '@ant-design/icons'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import MembershipRequired from '../../../components/membership/MembershipRequired'
import { membershipService } from '../../../services/membershipService'
import { trainingRequestService, type TrainingRequest } from '../../../services/trainingRequestService'
import YourRequestPanel from '../../../components/member/YourRequestPanel'
import { memberService, type EnrollmentStatus } from '../../../services/memberService'
import { socketService } from '../../../services/socketService'
import { getUserDisplayName } from '../../../utils/userDisplay'
import { planFeatureService, type PlanFeature } from '../../../services/planFeatureService'
import { enrollmentService } from '../../../services/ptAssignmentService'
import { authService } from '../../../services/authService'
import PreferredTrainerPicker from '../../../components/member/PreferredTrainerPicker'
import type { PT } from '../../../types/admin/trainer'

const SPECIALIZATIONS: Array<{
  value: string
  label: string
  color: string
  icon: ReactNode
  disabled?: boolean
}> = [
  { value: 'GYM', label: 'GYM', color: '#6366f1', icon: <ThunderboltOutlined /> },
  { value: 'CARDIO', label: 'Cardio', color: '#06b6d4', icon: <AimOutlined /> },
  { value: 'STRENGTH TRAINING', label: 'Strength Training', color: '#a855f7', icon: <SafetyOutlined /> },
  { value: 'YOGA', label: 'Yoga', color: '#84cc16', icon: <EnvironmentOutlined /> },
  { value: 'BOXING', label: 'Boxing', color: '#f97316', icon: <FireOutlined /> },
  { value: 'CROSSFIT', label: 'Crossfit', color: '#8b5cf6', icon: <QuestionCircleOutlined /> },
  { value: 'PILATES', label: 'Pilates', color: '#10b981', icon: <RiseOutlined /> },
  { value: 'ZUMBA', label: 'Zumba', color: '#ef4444', icon: <HeartOutlined /> },
]

const GOALS = [
  { value: 'Giảm mỡ', icon: <FireOutlined />, color: '#f97316' },
  { value: 'Tăng cân', icon: <RiseOutlined />, color: '#10b981' },
  { value: 'Tăng cơ', icon: <ThunderboltOutlined />, color: '#6366f1' },
  { value: 'Tăng sức bền', icon: <HeartOutlined />, color: '#ef4444' },
  { value: 'Nâng cao thể lực', icon: <RiseOutlined />, color: '#06b6d4' },
  { value: 'Phục hồi sau chấn thương', icon: <MedicineBoxOutlined />, color: '#84cc16' },
  { value: 'Duy trì sức khỏe', icon: <SafetyOutlined />, color: '#22c55e' },
  { value: 'Người mới cần được hướng dẫn trực tiếp', icon: <QuestionCircleOutlined />, color: '#a855f7' },
]

const TIME_SLOTS = ['06:00-08:00', '08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00', '16:00-18:00', '18:00-20:00', '20:00-22:00']
const WEEKS_OPTIONS = [1, 2, 3, 4, 8, 12]
const DAYS = [
  { value: 0, label: 'Chủ nhật', short: 'CN' },
  { value: 1, label: 'Thứ 2', short: 'T2' },
  { value: 2, label: 'Thứ 3', short: 'T3' },
  { value: 3, label: 'Thứ 4', short: 'T4' },
  { value: 4, label: 'Thứ 5', short: 'T5' },
  { value: 5, label: 'Thứ 6', short: 'T6' },
  { value: 6, label: 'Thứ 7', short: 'T7' },
]

interface ScheduleWindow {
  dayOfWeek: number
  start: string
  end: string
}

function toMinutes(t: string): number {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

// Ngày tới gần nhất của thứ (khớp logic nextRequestDate phía backend khi tạo booking)
function nextBookingDate(day: number, slot: string): Date {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let diff = day - today.getDay()
  if (diff < 0) diff += 7
  const target = new Date(today)
  target.setDate(today.getDate() + diff)
  const [h = 0, m = 0] = String(slot || '').split('-')[0].trim().split(':').map(Number)
  const slotStart = new Date(target)
  slotStart.setHours(h, m, 0, 0)
  if (slotStart <= now) target.setDate(target.getDate() + 7)
  return target
}

const formatShortDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`

// Chuyển lịch làm việc cố định của PT (TrainerSchedule) thành cửa sổ giờ làm theo từng ngày
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

function presetFitsWindow(presetStart: string, presetEnd: string, window: ScheduleWindow): boolean {
  return toMinutes(presetStart) >= toMinutes(window.start) && toMinutes(presetEnd) <= toMinutes(window.end)
}

// Lịch bận của PT (busyBookings từ API) — chặn ngay trong form khi chọn ngày/giờ
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

// Các ngày sắp tới của dayOfWeek trong weeks tuần (bắt đầu tuần tới)
function nextDatesForDay(dayOfWeek: number, weeks: number): Date[] {
  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const currentDay = today.getDay()
  let diff = dayOfWeek - currentDay
  if (diff < 0) diff += 7
  const dates: Date[] = []
  for (let w = 0; w < weeks; w++) {
    const target = new Date(today)
    target.setDate(today.getDate() + diff + w * 7)
    dates.push(target)
  }
  return dates
}

function isSlotBusyForDay(pt: PT, day: number, slot: string, weeks: number): boolean {
  const busy = pt.busyBookings || []
  if (!busy.length) return false
  const keys = new Set(nextDatesForDay(day, weeks).map(toLocalDateKey))
  return busy.some((b) => {
    try {
      return keys.has(toLocalDateKey(new Date(b.date))) && slotsOverlap(slot, b.slot)
    } catch {
      return false
    }
  })
}

// Khóa ngày/giờ theo lịch làm việc + lịch bận của PT đã chọn (dùng chung cho 2 form)
function useScheduleLock(pt: PT | null, daysOfWeek: number[], weeks: number) {
  const ptDayWindows = useMemo(
    () => (pt ? getDayWindows(pt.schedules || []) : new Map<number, ScheduleWindow[]>()),
    [pt],
  )
  const ptWorkingDays = useMemo(() => new Set(ptDayWindows.keys()), [ptDayWindows])

  const isDayLocked = (day: number) => pt !== null && ptDayWindows.size > 0 && !ptWorkingDays.has(day)

  const slotEnabled = (slot: string): boolean => {
    if (!pt) return true
    const [start, end] = slot.split('-')
    if (daysOfWeek.length === 0) {
      if (ptDayWindows.size === 0) return true
      for (const windows of ptDayWindows.values()) {
        if (windows.some((w) => presetFitsWindow(start, end, w))) return true
      }
      return false
    }
    return daysOfWeek.every((day) => {
      const windows = ptDayWindows.get(day)
      const fitsSchedule = !windows || windows.some((w) => presetFitsWindow(start, end, w))
      if (!fitsSchedule) return false
      return !isSlotBusyForDay(pt, day, slot, weeks)
    })
  }

  // Kiểm tra 1 cặp (ngày, khung giờ) cụ thể — dùng cho form PT 1-1 chọn giờ riêng từng ngày
  const slotEnabledForDay = (day: number, slot: string): boolean => {
    if (!pt) return true
    const [start, end] = slot.split('-')
    const windows = ptDayWindows.get(day)
    const fitsSchedule = !windows || windows.some((w) => presetFitsWindow(start, end, w))
    if (!fitsSchedule) return false
    return !isSlotBusyForDay(pt, day, slot, weeks)
  }

  const slotDisabledReasonForDay = (day: number, slot: string): string | null => {
    if (!pt) return null
    const [start, end] = slot.split('-')
    const windows = ptDayWindows.get(day)
    const fitsSchedule = !windows || windows.some((w) => presetFitsWindow(start, end, w))
    if (!fitsSchedule) return 'Không nằm trong lịch làm việc của PT mong muốn'
    if (isSlotBusyForDay(pt, day, slot, weeks)) return 'PT đã có lịch bận vào ngày này'
    return null
  }

  const slotDisabledReason = (slot: string): string | null => {
    if (!pt) return null
    const [start, end] = slot.split('-')
    const busyDays = daysOfWeek.filter((day) => isSlotBusyForDay(pt, day, slot, weeks))
    if (busyDays.length > 0) {
      const labels = busyDays.map((d) => DAYS.find((x) => x.value === d)?.short || `D${d}`)
      return `PT đã có lịch bận vào ${labels.join(', ')}`
    }
    if (daysOfWeek.length === 0 && ptDayWindows.size > 0) {
      for (const windows of ptDayWindows.values()) {
        if (windows.some((w) => presetFitsWindow(start, end, w))) return null
      }
      return 'Không nằm trong lịch làm việc của PT mong muốn'
    }
    const anyDayNotFitting = daysOfWeek.some((day) => {
      const windows = ptDayWindows.get(day)
      return !!windows && !windows.some((w) => presetFitsWindow(start, end, w))
    })
    return anyDayNotFitting ? 'Không nằm trong lịch làm việc của PT mong muốn' : null
  }

  return { ptDayWindows, ptWorkingDays, isDayLocked, slotEnabled, slotEnabledForDay, slotDisabledReasonForDay, slotDisabledReason }
}

// Khi chọn/đổi PT mong muốn → bỏ những ngày/giờ không nằm trong lịch làm việc/bận của PT
function prunedSelection(
  pt: PT | null,
  days: number[],
  slots: string[],
  weeks: number,
  ptDayWindows: Map<number, ScheduleWindow[]>,
): { days: number[]; slots: string[] } {
  if (!pt || ptDayWindows.size === 0) return { days, slots }
  const keptDays = days.filter((d) => ptDayWindows.has(d))
  const keptSlots = slots.filter((s) => {
    const [start, end] = s.split('-')
    return keptDays.every((day) => {
      const windows = ptDayWindows.get(day)
      const fitsSchedule = !windows || windows.some((w) => presetFitsWindow(start, end, w))
      if (!fitsSchedule) return false
      return !isSlotBusyForDay(pt, day, s, weeks)
    })
  })
  return { days: keptDays, slots: keptSlots }
}

function useMemberFeatureCodes(): { codes: string[]; loading: boolean; features: PlanFeature[] } {
  const [allFeatures, setAllFeatures] = useState<PlanFeature[]>([])
  const [codes, setCodes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const [featRes, memRes] = await Promise.all([
          planFeatureService.getAll({ isActive: true }),
          membershipService.getMyMembership(),
        ])
        if (cancelled) return

        const features = featRes.data.data || []
        setAllFeatures(features)

        const m = memRes.data.membership
        const planFeatures = m?.plan?.featureIds || []

        if (planFeatures.length > 0) {
          setCodes(planFeatures.map((f) => f.code))
        } else {
          setCodes(features.map((f) => f.code))
        }
      } catch {
        if (!cancelled) setCodes([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return { codes, loading, features: allFeatures }
}

export default function BookingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [membershipLoading, setMembershipLoading] = useState(true)
  const [canRequest, setCanRequest] = useState(false)
  const [planName, setPlanName] = useState<string | null>(null)

  const [requests, setRequests] = useState<TrainingRequest[]>([])

  // Group training form
  const [specialization, setSpecialization] = useState<string>('GYM')
  const [goals, setGoals] = useState<string[]>([])
  const [timeSlots, setTimeSlots] = useState<string[]>([])
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([])
  const [groupWeeks, setGroupWeeks] = useState(1)
  const [groupPreferredTrainer, setGroupPreferredTrainer] = useState<PT | null>(null)
  const [isNewToGym, setIsNewToGym] = useState(false)
  const [healthNotes, setHealthNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [bookingType, setBookingType] = useState<string | null>(null)

  // PT 1-1 form
  const [ptSpecialization, setPtSpecialization] = useState<string>('GYM')
  // PT 1-1: 'gym_assign' = phòng gym phân công PT (chuyên môn bắt buộc) | 'specific' = hội viên tự chọn PT (chuyên môn không bắt buộc)
  const [ptPickMode, setPtPickMode] = useState<'gym_assign' | 'specific'>('gym_assign')
  const [ptSpecTouched, setPtSpecTouched] = useState(false)
  const [ptGoals, setPtGoals] = useState<string[]>([])
  const [ptPhone, setPtPhone] = useState('')
  const [ptEmail, setPtEmail] = useState('')
  // PT 1-1: mỗi ngày chọn 1 khung giờ riêng { day -> slot }
  const [ptDaySlotMap, setPtDaySlotMap] = useState<Record<number, string>>({})
  const [ptWeeks, setPtWeeks] = useState(1)
  const [ptHealthNotes, setPtHealthNotes] = useState('')
  const [preferredTrainer, setPreferredTrainer] = useState<PT | null>(null)
  const [ptNote, setPtNote] = useState('')
  const [ptSubmitting, setPtSubmitting] = useState(false)
  const [ptSubmitted, setPtSubmitted] = useState(false)
  const [ptConfirmOpen, setPtConfirmOpen] = useState(false)
  const [ptFormStep, setPtFormStep] = useState<1 | 2>(1)
  const [pt1on1Requests, setPt1on1Requests] = useState<TrainingRequest[]>([])

  const [enrollmentLoading, setEnrollmentLoading] = useState(true)
  const [enrollment, setEnrollment] = useState<EnrollmentStatus | null>(null)
  const [showBookingOptions, setShowBookingOptions] = useState(false)

  const { codes: featureCodes, loading: featuresLoading } = useMemberFeatureCodes()

  const hasFeature = (code: string) => featureCodes.includes(code)

  const fetchEnrollment = async () => {
    try {
      const res = await memberService.getMyEnrollmentStatus()
      setEnrollment(res.data)
    } catch { /* ignore */ }
  }

  // Re-fetch enrollment whenever membership/canRequest changes (to catch external cancel/change)
  useEffect(() => {
    if (canRequest) {
      fetchEnrollment().finally(() => setEnrollmentLoading(false))
    } else {
      setEnrollment(null)
      setShowBookingOptions(false)
    }
  }, [canRequest])

  // Re-check membership on window focus (catch external cancel/change from other tabs)
  useEffect(() => {
    const onFocus = () => {
      membershipService.getMyMembership().then((res) => {
        const m = res.data.membership
        const statusOk = m?.status === 'active' || m?.status === 'pending_cancel'
        const notExpired = statusOk ? Number(m?.remainingDays || 0) > 0 : true
        const allowed = statusOk && notExpired
        setCanRequest(allowed)
        setPlanName(m?.planNameVi || m?.plan?.nameVi || null)
      }).catch(() => setCanRequest(false))
      if (canRequest) {
        loadGroupRequests()
        loadPt1on1Requests()
      }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [canRequest])

  const [leavingTraining, setLeavingTraining] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)

  const confirmLeaveCurrentTraining = () => {
    setShowLeaveConfirm(true)
  }

  const leaveCurrentTraining = async () => {
    setShowLeaveConfirm(false)
    setLeavingTraining(true)
    try {
      await enrollmentService.leaveCurrentTraining({ reason: 'Hội viên muốn rời toàn bộ dịch vụ PT' })
      setShowBookingOptions(false)
      setBookingType(null)
      await fetchEnrollment()
      await Promise.all([loadGroupRequests(), loadPt1on1Requests()])
      window.dispatchEvent(new CustomEvent('gympro:training-cleanup'))
      message.success('Bạn đã rời dịch vụ PT thành công.')
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Không thể rời dịch vụ PT')
    } finally {
      setLeavingTraining(false)
    }
  }

  useEffect(() => {
    membershipService.getMyMembership().then((res) => {
      const m = res.data.membership
      const statusOk = m?.status === 'active' || m?.status === 'pending_cancel'
      const notExpired = statusOk ? Number(m?.remainingDays || 0) > 0 : true
      const allowed = statusOk && notExpired
      setCanRequest(allowed)
      setPlanName(m?.planNameVi || m?.plan?.nameVi || null)
    }).catch(() => setCanRequest(false))
      .finally(() => setMembershipLoading(false))

    authService.getProfile().then((res) => {
      const u = res.data?.user
      if (u?.phone) setPtPhone(u.phone)
      if (u?.email) setPtEmail(u.email)
    }).catch(() => {})

    fetchEnrollment().finally(() => setEnrollmentLoading(false))
  }, [])

  useEffect(() => {
    const handler = (data: { type: string }) => {
      if (data.type === 'assignment_ended') {
        fetchEnrollment()
      }
    }
    socketService.connect()
    socketService.on('pt_end_request:status_changed', handler)
    return () => { socketService.off('pt_end_request:status_changed', handler) }
  }, [])

  // Realtime cho yêu cầu PT 1-1 / PT nhóm của hội viên (nhận event qua room cá nhân)
  useEffect(() => {
    if (!canRequest) return
    socketService.connect()
    const reload = () => { loadGroupRequests(); loadPt1on1Requests() }
    const events = ['pt_request_created', 'pt_request_updated', 'pt_request_waiting_assignment', 'pt_request_assigned', 'pt_request_cancelled', 'pt_request_rejected']
    for (const ev of events) socketService.on(ev, reload)
    return () => {
      for (const ev of events) socketService.off(ev, reload)
    }
  }, [canRequest])

  const REQUEST_IN_PROGRESS_STATUSES = new Set([
    'pending',
    'processing',
    'message_sent',
    'waiting_member',
    'waiting_assignment',
    'waiting_reassign',
  ])

  // PT 1-1: 'assigned' vẫn chờ PT xác nhận nên tiếp tục chặn tạo yêu cầu mới.
  // Khi đã 'confirmed', PTAssignment là nguồn sự thật cho quan hệ PT - hội viên.
  // Không dùng request confirmed cũ để khóa form vì nó có thể thuộc gói đã hết hạn.
  const PT1ON1_ACTIVE_STATUSES = new Set([
    ...REQUEST_IN_PROGRESS_STATUSES,
    'assigned',
  ])

  const isRequestInProgress = (request: TrainingRequest) =>
    REQUEST_IN_PROGRESS_STATUSES.has(request.status)

  const loadGroupRequests = async () => {
    if (!canRequest) return
    const reqRes = await trainingRequestService.getMyRequests({ type: 'group', activeOnly: true })
    setRequests((reqRes.data.requests || []).filter(isRequestInProgress))
  }

  const loadPt1on1Requests = async () => {
    if (!canRequest) return
    const reqRes = await trainingRequestService.getMyRequests({ type: 'pt1on1' })
    setPt1on1Requests((reqRes.data.requests || []).filter((r) => PT1ON1_ACTIVE_STATUSES.has(r.status)))
  }

  useEffect(() => { if (canRequest) loadGroupRequests() }, [canRequest])
  useEffect(() => { if (canRequest) loadPt1on1Requests() }, [canRequest])

  const toggleTimeSlot = (s: string) => {
    if (!groupLock.slotEnabled(s)) {
      message.warning(groupLock.slotDisabledReason(s) || 'Khung giờ này không nằm trong lịch làm việc của PT mong muốn.')
      return
    }
    setTimeSlots((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }

  const toggleDay = (d: number) => {
    if (groupLock.isDayLocked(d)) {
      message.warning('PT này không làm việc vào ngày này. Vui lòng chọn ngày khác.')
      return
    }
    setDaysOfWeek((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])
  }

  const togglePtDaySlot = (day: number, slot: string) => {
    if (pt1on1Lock.isDayLocked(day)) {
      message.warning('PT này không làm việc vào ngày này. Vui lòng chọn ngày khác.')
      return
    }
    if (!pt1on1Lock.slotEnabledForDay(day, slot)) {
      message.warning(pt1on1Lock.slotDisabledReasonForDay(day, slot) || 'Khung giờ này không khả dụng cho ngày đã chọn.')
      return
    }
    setPtDaySlotMap((prev) => {
      if (prev[day] === slot) {
        const next = { ...prev }
        delete next[day]
        return next
      }
      return { ...prev, [day]: slot }
    })
  }

  const validateAgainstTrainer = (
    pt: PT | null,
    ptDayWindows: Map<number, ScheduleWindow[]>,
    days: number[],
    slots: string[],
  ): string[] => {
    if (!pt || ptDayWindows.size === 0) return []
    const invalid: string[] = []
    for (const day of days) {
      const windows = ptDayWindows.get(day)
      for (const slot of slots) {
        const [start, end] = slot.split('-')
        if (!windows || !windows.some((w) => presetFitsWindow(start, end, w))) {
          invalid.push(`${DAYS.find((x) => x.value === day)?.short || day} ${slot.replace('-', ' - ')}`)
        }
      }
    }
    return invalid
  }

  const handleSubmit = async () => {
    if (!specialization) { message.warning('Chọn chuyên môn muốn tập'); return }
    if (timeSlots.length === 0) { message.warning('Chọn ít nhất 1 khung giờ mong muốn'); return }
    if (daysOfWeek.length === 0) { message.warning('Chọn ít nhất 1 ngày có thể tập'); return }
    const groupInvalid = validateAgainstTrainer(groupPreferredTrainer, groupLock.ptDayWindows, daysOfWeek, timeSlots)
    if (groupPreferredTrainer && groupInvalid.length > 0) {
      message.warning(`Ngày/giờ (${groupInvalid.join(', ')}) không nằm trong lịch làm việc của PT ${getUserDisplayName(groupPreferredTrainer, '')}. Vui lòng chọn lại theo lịch của PT.`)
      return
    }

    setSubmitting(true)
    try {
      await trainingRequestService.create({
        type: 'group',
        specialization,
        goals,
        timeSlots,
        daysOfWeek,
        weeks: groupWeeks,
        preferredTrainerId: groupPreferredTrainer?._id ?? null,
        isNewToGym,
        healthNotes,
      })
      message.success('Gửi yêu cầu thành công. Admin sẽ kiểm tra và sắp xếp PT/lịch tập phù hợp cho bạn.')
      setSubmitted(false)
      setSpecialization('GYM'); setGoals([]); setTimeSlots([]); setDaysOfWeek([]); setGroupWeeks(1); setGroupPreferredTrainer(null); setIsNewToGym(false); setHealthNotes('')
      await loadGroupRequests()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Gửi yêu cầu thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  const buildPtDaySlots = () => Object.entries(ptDaySlotMap)
    .map(([day, slot]) => ({ day: Number(day), slot }))
    .sort((a, b) => a.day - b.day)

  // Kiểm tra dữ liệu trước khi mở modal xác nhận
  const validatePt1on1Form = () => {
    if (ptPickMode === 'specific') {
      if (!preferredTrainer) {
        message.warning('Vui lòng chọn PT bạn muốn theo học')
        return false
      }
    } else if (!ptSpecialization) {
      message.warning('Chọn chuyên môn muốn tập')
      return false
    }
    if (buildPtDaySlots().length === 0) {
      message.warning('Chọn ít nhất 1 ngày kèm khung giờ tập')
      return false
    }
    return true
  }

  const handlePt1on1Submit = async () => {
    setPtSubmitting(true)
    try {
      await trainingRequestService.create({
        type: 'pt1on1',
        // Tự chọn PT cụ thể mà không chọn chuyên môn → backend lấy chuyên môn từ PT đó
        specialization: ptPickMode === 'specific' && !ptSpecTouched ? undefined : ptSpecialization,
        goals: ptGoals,
        contactPhone: ptPhone,
        contactEmail: ptEmail,
        daySlots: buildPtDaySlots(),
        weeks: ptWeeks,
        healthNotes: ptHealthNotes,
        preferredTrainerId: ptPickMode === 'specific' ? preferredTrainer?._id ?? null : null,
        note: ptNote,
      })
      setPtConfirmOpen(false)
      message.success('Gửi yêu cầu thành công. Admin sẽ kiểm tra và sắp xếp PT/lịch tập phù hợp cho bạn.')
      setPtSubmitted(false)
      setPtSpecialization('GYM'); setPtSpecTouched(false); setPtPickMode('gym_assign'); setPtGoals([]); setPtDaySlotMap({}); setPtWeeks(1); setPtHealthNotes(''); setPtNote(''); setPreferredTrainer(null); setPtFormStep(1)
      await loadPt1on1Requests()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Gửi yêu cầu thất bại')
    } finally {
      setPtSubmitting(false)
    }
  }

  const goToPtStep = (step: 1 | 2) => {
    if (ptPickMode === 'specific') {
      if (!preferredTrainer) {
        message.warning('Vui lòng chọn PT bạn muốn theo học')
        return
      }
    } else if (!ptSpecialization) {
      message.warning('Chọn chuyên môn muốn tập')
      return
    }
    setPtFormStep(step)
  }

  // Lịch làm việc + lịch bận của PT đã chọn — dùng để khóa ngày/giờ không phù hợp
  const pt1on1Lock = useScheduleLock(preferredTrainer, Object.keys(ptDaySlotMap).map(Number), ptWeeks)
  const groupLock = useScheduleLock(groupPreferredTrainer, daysOfWeek, groupWeeks)

  // Khi chọn/đổi PT mong muốn hoặc số tuần → bỏ những cặp ngày/giờ không còn khả dụng
  useEffect(() => {
    setPtDaySlotMap((prev) => {
      let changed = false
      const next: Record<number, string> = {}
      for (const [dayStr, slot] of Object.entries(prev)) {
        const day = Number(dayStr)
        if (pt1on1Lock.isDayLocked(day) || !pt1on1Lock.slotEnabledForDay(day, slot)) changed = true
        else next[day] = slot
      }
      return changed ? next : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferredTrainer, ptWeeks, pt1on1Lock.ptDayWindows])

  useEffect(() => {
    const { days, slots } = prunedSelection(groupPreferredTrainer, daysOfWeek, timeSlots, groupWeeks, groupLock.ptDayWindows)
    if (days.length !== daysOfWeek.length || days.some((d, i) => d !== daysOfWeek[i])) setDaysOfWeek(days)
    if (slots.length !== timeSlots.length || slots.some((s, i) => s !== timeSlots[i])) setTimeSlots(slots)
  }, [groupPreferredTrainer, daysOfWeek, timeSlots, groupWeeks, groupLock.ptDayWindows])

  const statusTag = (s: string) => {
    const map: Record<string, [string, string]> = {
      pending: ['orange', 'Chờ Admin xử lý'],
      message_sent: ['blue', 'Đang xem xét'],
      waiting_assignment: ['purple', 'Chờ phân công lại'],
      assigned: ['blue', 'Chờ PT xác nhận'],
      declined_by_member: ['red', 'Đã từ chối đổi PT'],
      cancelled: ['red', 'Đã hủy'],
    }
    const [color, label] = map[s] || ['default', s]
    return <Tag color={color}>{label}</Tag>
  }

  const pendingGroupRequests = requests.filter((r) => r.status === 'pending')
  const hasPendingGroup = pendingGroupRequests.length > 0

  const activePt1on1Requests = pt1on1Requests.filter((r) => PT1ON1_ACTIVE_STATUSES.has(r.status))
  const hasActivePt1on1 = activePt1on1Requests.length > 0

  const activeGroupRequest = requests.find(isRequestInProgress)
  const activePt1on1Request = pt1on1Requests.find(isRequestInProgress)
  const hasOpenRequest = !!activeGroupRequest || !!activePt1on1Request

  const canBookGroup = featuresLoading ? true : hasFeature('BOOK_PT_GROUP')
  const canBookPTPrivate = featuresLoading ? true : hasFeature('BOOK_PT_PRIVATE')
  const showGroupOption = !activeGroupRequest && canBookGroup
  const showPt1on1Option = !activePt1on1Request && canBookPTPrivate
  const hasVisibleBookingOption = showGroupOption || showPt1on1Option
  const bookingOptionGridClass = showGroupOption && showPt1on1Option
    ? 'grid grid-cols-1 gap-6 md:grid-cols-2'
    : 'grid grid-cols-1 gap-6'

  // Loại hình assignment chỉ quyết định nội dung trạng thái hiện tại.
  // Thao tác rời luôn là leaveCurrentTraining(), không phụ thuộc loại hình.
  const assignmentType = enrollment?.assignmentType
    ?? (enrollment?.class ? 'group' : enrollment?.pt ? 'private' : null)
  const isGroupEnrollment = assignmentType === 'group'
  const isPrivateEnrollment = assignmentType === 'private'

  return (
    <MemberLayout>
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {membershipLoading ? (
          <div className="text-sm text-[var(--gs-text-muted)]">Đang kiểm tra...</div>
        ) : !canRequest ? (
          <MembershipRequired planName={planName} featureLabel="đăng ký tập luyện" />
        ) : enrollmentLoading ? (
          <div className="flex min-h-[200px] items-center justify-center"><Spin size="large" /></div>
        ) : enrollment?.hasActiveEnrollment && !showBookingOptions && !activePt1on1Request ? (
          <div className="max-w-2xl mx-auto pt-8 space-y-4">
            <div className="text-center mb-4">
              <div className="text-5xl mb-3">✅</div>
              <h1 className="text-2xl font-bold text-[var(--gs-text)]">
                {isGroupEnrollment ? 'Bạn đã được xếp lớp' : isPrivateEnrollment ? 'Bạn đã có PT phụ trách' : 'Bạn đã đăng ký tập luyện'}
              </h1>
            </div>
            <div className="rounded-2xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 space-y-3">
              {enrollment.pt && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--gs-text-muted)] w-20 shrink-0">PT:</span>
                  <span className="text-sm font-semibold text-[var(--gs-text)]">{getUserDisplayName(enrollment.pt, 'PT')}</span>
                </div>
              )}
              {enrollment.class && (
                <div className="flex items-start gap-2">
                  <span className="text-xs font-medium text-[var(--gs-text-muted)] w-20 shrink-0 pt-0.5">Lớp:</span>
                  <div>
                    <span className="text-sm font-semibold text-[var(--gs-text)]">{enrollment.class.name}</span>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {enrollment.class.daysOfWeek?.map((d, i) => {
                        const dayLabel = DAYS.find(dd => dd.value === d)?.label || `D${d}`
                        return <Tag key={i} className="m-0 text-xs">{dayLabel}</Tag>
                      })}
                      <span className="text-xs text-[var(--gs-text-muted)] ml-1 leading-6">{enrollment.class.time}</span>
                    </div>
                  </div>
                </div>
              )}
              {enrollment.workout && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--gs-text-muted)] w-20 shrink-0">Giáo án:</span>
                  <Tag color="blue" className="m-0 text-xs">{enrollment.workout.name}</Tag>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button danger size="large" block loading={leavingTraining}
                onClick={confirmLeaveCurrentTraining}>
                Rời dịch vụ PT
              </Button>
            </div>
            
          </div>
        ) : bookingType === null ? (
          <div className="max-w-2xl mx-auto pt-8 space-y-2">
            {enrollment?.hasActiveEnrollment && showBookingOptions && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-center dark:border-amber-700 dark:bg-amber-900/20">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Bạn đang có lịch tập đang hoạt động. Đăng ký thêm dịch vụ mới có thể cần admin xác nhận lại.
                </p>
              </div>
            )}
            {hasOpenRequest && !enrollment.hasActiveEnrollment && (
              <div className="rounded-xl border border-blue-300 bg-blue-50 p-3 text-center dark:border-blue-700 dark:bg-blue-900/20">
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  Bạn có 1 yêu cầu đang chờ xử lý. Vui lòng đợi admin duyệt hoặc hủy yêu cầu cũ trước khi gửi yêu cầu mới.
                </p>
              </div>
            )}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-[var(--gs-text)]">Đăng ký dịch vụ tập luyện</h1>
              <p className="text-sm text-[var(--gs-text-muted)] mt-2">Chọn hình thức tập luyện phù hợp với bạn</p>
            </div>
            {activeGroupRequest && (
              <YourRequestPanel request={activeGroupRequest} onReload={() => { setSubmitted(false); setPtSubmitted(false); loadGroupRequests(); loadPt1on1Requests() }} onLeaveService={confirmLeaveCurrentTraining} />
            )}
            {activePt1on1Request && (
              <YourRequestPanel request={activePt1on1Request} onReload={() => { setSubmitted(false); setPtSubmitted(false); loadGroupRequests(); loadPt1on1Requests() }} onLeaveService={confirmLeaveCurrentTraining} />
            )}
            {(!activeGroupRequest || !activePt1on1Request) && (
              hasVisibleBookingOption ? (
                <div className={bookingOptionGridClass}>
                  {showGroupOption && (
                    <button type="button"
                      onClick={() => setBookingType('group')}
                      className="group relative rounded-2xl border-2 border-[var(--theme-border)] bg-[var(--gs-card)] p-8 text-left transition-all duration-200 hover:scale-[1.03] hover:border-[var(--theme-accent)] hover:shadow-lg cursor-pointer">
                      <div className="text-5xl mb-4 text-[var(--theme-accent)]"><TeamOutlined /></div>
                      <h3 className="text-xl font-bold text-[var(--gs-text)] mb-2">Đăng ký tập luyện nhóm</h3>
                      <p className="text-sm text-[var(--gs-text-muted)] leading-relaxed">
                        Tập luyện theo nhóm, huấn luyện viên hỗ trợ giáo án cá nhân hóa, tiết kiệm chi phí.
                      </p>
                    </button>
                  )}
                  {showPt1on1Option && (
                    <button type="button"
                      onClick={() => setBookingType('pt1on1')}
                      className="group relative rounded-2xl border-2 border-[var(--theme-border)] bg-[var(--gs-card)] p-8 text-left transition-all duration-200 hover:scale-[1.03] hover:border-[var(--theme-accent)] hover:shadow-lg cursor-pointer">
                      <div className="text-5xl mb-4 text-[var(--gs-text)]"><UserOutlined /></div>
                      <h3 className="text-xl font-bold text-[var(--gs-text)] mb-2">Đăng ký PT riêng 1-1</h3>
                      <p className="text-sm text-[var(--gs-text-muted)] leading-relaxed">
                        1 kèm 1 với huấn luyện viên cá nhân, cam kết đầu ra, thiết lập giáo án chuẩn xác cho riêng bạn.
                      </p>
                    </button>
                  )}
                </div>
              ) : (
                !featuresLoading && !hasOpenRequest && (
                  <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--gs-card)] p-6 text-center">
                    <p className="text-sm font-medium text-[var(--gs-text)]">Gói tập hiện tại chưa hỗ trợ dịch vụ PT.</p>
                    <p className="mt-1 text-xs text-[var(--gs-text-muted)]">Vui lòng nâng cấp gói tập để đặt lịch PT nhóm hoặc PT riêng 1-1.</p>
                  </div>
                )
              )
            )}
          </div>
        ) : bookingType === 'group' ? (
          <>
            {activeGroupRequest && (
              <>
                <YourRequestPanel request={activeGroupRequest} onReload={() => { setSubmitted(false); setPtSubmitted(false); loadGroupRequests(); loadPt1on1Requests() }} onLeaveService={confirmLeaveCurrentTraining} />
                <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setBookingType(null)}
                  className="text-[var(--gs-text-muted)] hover:text-[var(--gs-text)] !px-1">
                  Quay lại lựa chọn dịch vụ
                </Button>
              </>
            )}
            {!activeGroupRequest && (
            <>
            <div className="flex items-center gap-3">
              <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setBookingType(null)}
                className="text-[var(--gs-text-muted)] hover:text-[var(--gs-text)] !px-1" />
              <div>
                <h2 className="text-lg font-semibold text-[var(--gs-text)]">Đăng ký tập luyện nhóm</h2>
                <p className="text-sm text-[var(--gs-text-muted)]">Chia sẻ nhu cầu của bạn, admin sẽ xếp bạn vào lớp phù hợp</p>
              </div>
            </div>
            {pendingGroupRequests.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-[var(--gs-text)]">Yêu cầu đã gửi</h2>
                <div className="flex flex-wrap gap-3">
                  {pendingGroupRequests.map((r) => {
                    const specLabel = SPECIALIZATIONS.find(s => s.value === r.specialization)?.label || r.specialization || 'GYM'
                    const displayText = r.goals?.[0] ? `${specLabel} - ${r.goals[0]}` : specLabel
                    return (
                      <div key={r._id} className="rounded-xl border border-[var(--theme-border)] bg-[var(--gs-card)] p-3 flex items-center gap-3">
                        <span className="text-sm text-[var(--gs-text)] uppercase">{displayText}</span>
                        {statusTag(r.status)}
                        <Button size="small" danger onClick={() => trainingRequestService.cancelMyRequest(r._id).then(loadGroupRequests)}>
                          Hủy
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {submitted && !hasPendingGroup ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center dark:border-green-800 dark:bg-green-900/20">
                <CheckCircleFilled className="text-4xl text-green-500 mb-3" />
                <h2 className="text-xl font-semibold text-green-700 dark:text-green-400">Đã gửi yêu cầu thành công!</h2>
                <p className="text-sm text-green-600 dark:text-green-500 mt-1">Admin sẽ xem xét và xếp bạn vào lớp phù hợp.</p>
                <Button className="mt-4" onClick={() => setSubmitted(false)}>Gửi yêu cầu khác</Button>
              </div>
            ) : (
              <>
                {hasPendingGroup && (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Bạn hiện đang có một yêu cầu tập luyện đang chờ xử lý. Vui lòng đợi Admin duyệt hoặc hủy yêu cầu hiện tại để gửi yêu cầu mới.
                    </p>
                  </div>
                )}
                <div className={`rounded-2xl border border-[var(--theme-border)] bg-[var(--gs-card)] p-6 space-y-6 ${hasPendingGroup ? 'pointer-events-none opacity-60' : ''}`}>

                  {/* Section 1: PT mong muon */}
                  <div>
                    <h3 className="text-base font-semibold text-[var(--gs-text)] mb-4">1. PT mong muốn <span className="text-sm font-normal text-[var(--gs-text-muted)]">(không bắt buộc)</span></h3>
                    <PreferredTrainerPicker
                      value={groupPreferredTrainer}
                      onChange={setGroupPreferredTrainer}
                      hint="Chọn PT bạn muốn theo học. Nếu PT bận hoặc không phù hợp, Admin vẫn có thể phân công PT khác phù hợp hơn."
                    />
                    {groupPreferredTrainer && (
                      <div className="mt-2 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-sm">
                        <span className="text-[var(--gs-text)]">
                          PT mong muốn: <b className="text-[var(--theme-accent)]">{getUserDisplayName(groupPreferredTrainer, '')}</b>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Section 2: Thong tin tap luyen */}
                  <div>
                    <h3 className="text-base font-semibold text-[var(--gs-text)] mb-4">2. Thông tin tập luyện</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--gs-text)] mb-2">Chuyên môn muốn tập *</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {SPECIALIZATIONS.map((s) => (
                            <button
                              key={s.value}
                              type="button"
                              disabled={s.disabled}
                              onClick={() => setSpecialization(s.value)}
                              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all ${
                                s.disabled ? 'opacity-30 cursor-not-allowed' : ''
                              } ${
                                specialization === s.value
                                  ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)] text-[var(--theme-accent)]'
                                  : 'border-[var(--theme-border)] text-[var(--gs-text)] hover:border-[var(--theme-accent)]'
                              }`}
                            >
                              <span style={{ color: s.disabled ? undefined : s.color }}>{s.icon}</span>
                              <span>{s.label}</span>
                              {s.disabled && <span className="text-[10px] text-[var(--gs-text-muted)] ml-auto">Sắp ra mắt</span>}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-[var(--gs-text)] mb-2">Mục tiêu tập luyện <span className="text-[var(--gs-text-muted)] font-normal">(không bắt buộc — gợi ý cho PT thiết kế giáo án)</span></label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {GOALS.map((g) => (
                            <button
                              key={g.value}
                              type="button"
                              onClick={() => setGoals((prev) => prev.includes(g.value) ? prev.filter((x) => x !== g.value) : [...prev, g.value])}
                              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all ${
                                goals.includes(g.value)
                                  ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)] text-[var(--theme-accent)]'
                                  : 'border-[var(--theme-border)] text-[var(--gs-text)] hover:border-[var(--theme-accent)]'
                              }`}
                            >
                              <span style={{ color: g.color }}>{g.icon}</span>
                              <span>{g.value}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Lich mong muon */}
                  <div>
                    <h3 className="text-base font-semibold text-[var(--gs-text)] mb-4">3. Lịch mong muốn</h3>
                    <div className="space-y-5">
                      <div>
                        <label className="block text-sm font-medium text-[var(--gs-text)] mb-2">Khung giờ mong muốn *</label>
                        <div className="flex flex-wrap gap-2">
                          {TIME_SLOTS.map((s) => {
                            const slotDisabled = !groupLock.slotEnabled(s)
                            const slotTitle = slotDisabled ? groupLock.slotDisabledReason(s) || 'Khung giờ không khả dụng' : undefined
                            return (
                              <button
                                key={s}
                                type="button"
                                disabled={slotDisabled}
                                title={slotTitle}
                                onClick={() => toggleTimeSlot(s)}
                                className={`rounded-lg border px-3 py-1.5 text-sm transition-all ${
                                  timeSlots.includes(s)
                                    ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)] text-[var(--theme-accent)]'
                                    : 'border-[var(--theme-border)] text-[var(--gs-text)] hover:border-[var(--theme-accent)]'
                                } ${slotDisabled ? 'opacity-40 cursor-not-allowed hover:border-[var(--theme-border)]' : ''}`}
                              >
                                {s.replace('-', ' - ')}
                              </button>
                            )
                          })}
                        </div>
                        {groupPreferredTrainer && (groupPreferredTrainer.busyBookings?.length || 0) > 0 && (
                          <p className="mt-2 text-xs text-[var(--gs-text-muted)]">
                            PT này có một số khung giờ đã được đặt trong thời gian bạn chọn — các khung đó đã bị khóa.
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-[var(--gs-text)] mb-2">Ngày có thể tập *</label>
                        <div className="flex flex-wrap gap-2">
                          {DAYS.map((d) => {
                            const dayDisabled = groupLock.isDayLocked(d.value)
                            return (
                              <button
                                key={d.value}
                                type="button"
                                disabled={dayDisabled}
                                title={dayDisabled ? 'PT này không làm việc vào ngày này' : undefined}
                                onClick={() => toggleDay(d.value)}
                                className={`rounded-lg border px-3 py-1.5 text-sm transition-all ${
                                  daysOfWeek.includes(d.value)
                                    ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)] text-[var(--theme-accent)]'
                                    : 'border-[var(--theme-border)] text-[var(--gs-text)] hover:border-[var(--theme-accent)]'
                                } ${dayDisabled ? 'opacity-40 cursor-not-allowed hover:border-[var(--theme-border)]' : ''}`}
                              >
                                {d.label}
                              </button>
                            )
                          })}
                        </div>
                        <p className="mt-2 text-xs text-[var(--gs-text-muted)]">
                          {groupPreferredTrainer && groupLock.ptDayWindows.size > 0 ? (
                            <>PT <span className="font-medium text-[var(--gs-text)]">{getUserDisplayName(groupPreferredTrainer, '')}</span> chỉ làm việc vào: <span className="font-medium text-[var(--gs-text)]">{DAYS.filter((x) => groupLock.ptWorkingDays.has(x.value)).map((x) => x.short).join(', ')}</span> — các ngày khác đã được khóa.</>
                          ) : groupPreferredTrainer ? (
                            <>PT <span className="font-medium text-[var(--gs-text)]">{getUserDisplayName(groupPreferredTrainer, '')}</span> chưa cập nhật lịch làm việc — bạn có thể chọn ngày/giờ bất kỳ, Admin sẽ sắp xếp theo lịch trống của PT.</>
                          ) : (
                            <>Đây là những ngày bạn có thể tham gia. Lịch tập chính thức sẽ được Admin sắp xếp dựa trên số lượng thành viên, lịch lớp và lịch làm việc của PT.</>
                          )}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-[var(--gs-text)] mb-2">Thời lượng đăng ký (lặp lại hàng tuần) *</label>
                        <div className="flex flex-wrap gap-2">
                          {WEEKS_OPTIONS.map((w) => (
                            <button
                              key={w}
                              type="button"
                              onClick={() => setGroupWeeks(w)}
                              className={`rounded-lg border px-3 py-1.5 text-sm transition-all ${
                                groupWeeks === w
                                  ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)] text-[var(--theme-accent)]'
                                  : 'border-[var(--theme-border)] text-[var(--gs-text)] hover:border-[var(--theme-accent)]'
                              }`}
                            >
                              {w} tuần
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-[var(--gs-text-muted)] mt-2">
                          VD: chọn 3 tuần + ngày T2, T3 → lịch tập lặp lại T2, T3 mỗi tuần trong 3 tuần (6 buổi).
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Thong tin bo sung */}
                  <div>
                    <h3 className="text-base font-semibold text-[var(--gs-text)] mb-4">4. Thông tin bổ sung</h3>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id="isNewToGym"
                          checked={isNewToGym}
                          onChange={(e) => setIsNewToGym(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <label htmlFor="isNewToGym" className="text-sm text-[var(--gs-text)] cursor-pointer">
                          Tôi là người mới, cần được hướng dẫn từ cơ bản
                        </label>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-[var(--gs-text)] mb-2">Lưu ý sức khỏe khi tập <span className="font-normal text-[var(--gs-text-muted)]">(không bắt buộc)</span></label>
                        <Input.TextArea rows={2} value={healthNotes} onChange={(e) => setHealthNotes(e.target.value)}
                          placeholder="VD: Có vấn đề về lưng, không chạy bộ được..." />
                      </div>
                    </div>
                  </div>

                  <Button type="primary" size="large" block loading={submitting} onClick={handleSubmit}>
                    Gửi yêu cầu
                  </Button>
                </div>
            </>
            )}
            </>
            )}
          </>
        ) : (
          <>
            {activePt1on1Request && (
              <>
                <YourRequestPanel request={activePt1on1Request} onReload={() => { setSubmitted(false); setPtSubmitted(false); loadGroupRequests(); loadPt1on1Requests() }} onLeaveService={confirmLeaveCurrentTraining} />
                <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setBookingType(null)}
                  className="text-[var(--gs-text-muted)] hover:text-[var(--gs-text)] !px-1">
                  Quay lại lựa chọn dịch vụ
                </Button>
              </>
            )}
            {!activePt1on1Request && (
            <>
            <div className="flex items-center gap-3 rounded-2xl border border-transparent py-1">
              <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setBookingType(null)}
                className="text-[var(--gs-text-muted)] hover:text-[var(--gs-text)] !px-1" />
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-[var(--gs-text)]">Đăng ký PT riêng 1-1</h2>
                <p className="mt-0.5 text-sm text-[var(--gs-text-muted)]">Hoàn tất 2 bước ngắn để gửi yêu cầu đến phòng gym</p>
              </div>
            </div>

            {activePt1on1Requests.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-[var(--gs-text)]">Yêu cầu đã gửi</h2>
                <div className="flex flex-wrap gap-3">
                  {activePt1on1Requests.map((r) => {
                    const specLabel = SPECIALIZATIONS.find(s => s.value === r.specialization)?.label || r.specialization || 'GYM'
                    const displayText = r.goals?.[0] ? `${specLabel} - ${r.goals[0]}` : specLabel
                    const trainer = r.assignedTrainerId && typeof r.assignedTrainerId !== 'string' ? r.assignedTrainerId : null
                    return (
                      <div key={r._id} className="rounded-xl border border-[var(--theme-border)] bg-[var(--gs-card)] p-3 flex items-center gap-3">
                        <span className="text-sm text-[var(--gs-text)] uppercase">{displayText}</span>
                        {trainer && (r.status === 'assigned' || r.status === 'confirmed') && (
                          <span className="text-xs text-[var(--gs-text-muted)]">
                            PT: <span className="font-medium text-[var(--gs-text)]">{getUserDisplayName(trainer, '')}</span>
                          </span>
                        )}
                        {statusTag(r.status)}
                        {r.status === 'pending' && (
                          <Button size="small" danger onClick={() => trainingRequestService.cancelMyRequest(r._id).then(loadPt1on1Requests)}>
                            Hủy
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {ptSubmitted && !hasActivePt1on1 ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center dark:border-green-800 dark:bg-green-900/20">
                <CheckCircleFilled className="text-4xl text-green-500 mb-3" />
                <h2 className="text-xl font-semibold text-green-700 dark:text-green-400">Đã gửi yêu cầu thành công!</h2>
                <p className="text-sm text-green-600 dark:text-green-500 mt-1">Admin sẽ phân công PT phù hợp cho bạn. Sau khi PT xác nhận, lịch tập sẽ xuất hiện trong mục Lịch tập của bạn.</p>
                <Button className="mt-4" onClick={() => setPtSubmitted(false)}>Gửi yêu cầu khác</Button>
              </div>
            ) : (
              <>
                {hasActivePt1on1 && (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2">
                      Bạn đang có yêu cầu PT 1-1 đang xử lý.
                      <span className="inline-flex">{statusTag(activePt1on1Requests[0].status)}</span>
                    </p>
                  </div>
                )}
                <div className={`rounded-2xl border border-[var(--theme-border)] bg-[var(--gs-card)] p-4 shadow-sm sm:p-6 lg:p-7 space-y-7 ${hasActivePt1on1 ? 'pointer-events-none opacity-60' : ''}`}>

                  {/* Bước hiện tại */}
                  {ptFormStep === 1 ? (
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--theme-border)] bg-[var(--gs-bg-subtle)] p-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--theme-accent)] text-sm font-bold text-white">1</span>
                        <div>
                          <div className="text-sm font-semibold text-[var(--gs-text)]">Thông tin tập luyện</div>
                          <div className="mt-0.5 text-xs text-[var(--gs-text-muted)]">Chọn PT, chuyên môn và mục tiêu của bạn</div>
                        </div>
                      </div>
                      <span className="rounded-full border border-[var(--theme-border)] px-2.5 py-1 text-xs font-medium text-[var(--gs-text-muted)]">Bước 1/2</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--theme-border)] bg-[var(--gs-bg-subtle)] p-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--theme-accent)] text-sm font-bold text-white">2</span>
                        <div>
                          <div className="text-sm font-semibold text-[var(--gs-text)]">PT & Lịch mong muốn</div>
                          <div className="mt-0.5 text-xs text-[var(--gs-text-muted)]">Chọn các buổi tập lặp lại hàng tuần</div>
                        </div>
                      </div>
                      <Button size="small" icon={<ArrowLeftOutlined />} onClick={() => setPtFormStep(1)}>
                        Quay lại
                      </Button>
                    </div>
                  )}

                  {ptFormStep === 1 ? (
                    <>
                  {/* Section 1: Thong tin tap luyen */}
                  <div>
                    <div className="mb-5 flex items-end justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-[var(--gs-text)]">Thông tin tập luyện</h3>
                        <p className="mt-1 text-sm text-[var(--gs-text-muted)]">Ưu tiên lựa chọn phù hợp nhất với nhu cầu của bạn.</p>
                      </div>
                      <span className="hidden rounded-full bg-[var(--theme-accent-muted)] px-3 py-1 text-xs font-medium text-[var(--theme-accent)] sm:inline">Bước 1</span>
                    </div>
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-[var(--gs-text)] mb-2">Bạn muốn chọn PT như thế nào?</label>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => { setPtPickMode('gym_assign'); setPreferredTrainer(null) }}
                            className={`rounded-2xl border p-4 text-left text-sm transition-all ${
                              ptPickMode === 'gym_assign'
                                ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)]'
                                : 'border-[var(--theme-border)] hover:border-[var(--theme-accent)]'
                            }`}
                          >
                            <div className={`font-medium ${ptPickMode === 'gym_assign' ? 'text-[var(--theme-accent)]' : 'text-[var(--gs-text)]'}`}>Phòng gym phân công PT</div>
                            <div className="mt-0.5 text-xs text-[var(--gs-text-muted)]">Admin sẽ chọn PT phù hợp nhất với bạn</div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPtPickMode('specific')}
                            className={`rounded-2xl border p-4 text-left text-sm transition-all ${
                              ptPickMode === 'specific'
                                ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)]'
                                : 'border-[var(--theme-border)] hover:border-[var(--theme-accent)]'
                            }`}
                          >
                            <div className={`font-medium ${ptPickMode === 'specific' ? 'text-[var(--theme-accent)]' : 'text-[var(--gs-text)]'}`}>Tôi muốn chọn PT cụ thể</div>
                            <div className="mt-0.5 text-xs text-[var(--gs-text-muted)]">Tự chọn PT theo ý thích của bạn</div>
                          </button>
                        </div>
                        {ptPickMode === 'specific' && (
                          <div className="mt-4">
                            <label className="block text-sm font-medium text-[var(--gs-text)] mb-2">PT mong muốn *</label>
                            <PreferredTrainerPicker
                              value={preferredTrainer}
                              onChange={setPreferredTrainer}
                              showModeToggle={false}
                              hint="Admin sẽ xác nhận lịch tập với PT. Nếu PT không có lịch trống, bạn sẽ được gợi ý PT khác phù hợp."
                            />
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--gs-text)] mb-2">
                          Chuyên môn {ptPickMode === 'gym_assign' ? '*' : ''}
                          {ptPickMode === 'specific' && (
                            <span className="font-normal text-[var(--gs-text-muted)]">(không bắt buộc — gợi ý cho PT thiết kế giáo án)</span>
                          )}
                        </label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                          {SPECIALIZATIONS.map((s) => (
                            <button
                              key={s.value}
                              type="button"
                              disabled={s.disabled}
                              onClick={() => { setPtSpecialization(s.value); setPtSpecTouched(true) }}
                              className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all ${
                                s.disabled ? 'opacity-30 cursor-not-allowed' : ''
                              } ${
                                ptSpecialization === s.value
                                  ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)] text-[var(--theme-accent)]'
                                  : 'border-[var(--theme-border)] text-[var(--gs-text)] hover:border-[var(--theme-accent)]'
                              }`}
                            >
                              <span style={{ color: s.disabled ? undefined : s.color }}>{s.icon}</span>
                              <span>{s.label}</span>
                              {s.disabled && <span className="text-[10px] text-[var(--gs-text-muted)] ml-auto">Sắp ra mắt</span>}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-[var(--gs-text)] mb-2">Mục tiêu tập luyện</label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {GOALS.map((g) => (
                            <button
                              key={g.value}
                              type="button"
                              onClick={() => setPtGoals((prev) => prev.includes(g.value) ? prev.filter((x) => x !== g.value) : [...prev, g.value])}
                              className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all ${
                                ptGoals.includes(g.value)
                                  ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)] text-[var(--theme-accent)]'
                                  : 'border-[var(--theme-border)] text-[var(--gs-text)] hover:border-[var(--theme-accent)]'
                              }`}
                            >
                              <span style={{ color: g.color }}>{g.icon}</span>
                              <span>{g.value}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Thong tin bo sung */}
                  <div>
                    <h3 className="mb-4 text-lg font-semibold text-[var(--gs-text)]">Thông tin bổ sung <span className="text-sm font-normal text-[var(--gs-text-muted)]">(không bắt buộc)</span></h3>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-[var(--gs-text)] mb-2">Lưu ý sức khỏe khi tập <span className="font-normal text-[var(--gs-text-muted)]">(không bắt buộc)</span></label>
                        <Input.TextArea
                          rows={4}
                          value={ptHealthNotes}
                          onChange={(e) => setPtHealthNotes(e.target.value)}
                          placeholder="Ví dụ: Đau đầu gối khi squat, cần hạn chế bài tập tác động mạnh..."
                          className="!rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--gs-text)] mb-2">Ghi chú khác <span className="font-normal text-[var(--gs-text-muted)]">(không bắt buộc)</span></label>
                        <Input.TextArea
                          rows={4}
                          value={ptNote}
                          onChange={(e) => setPtNote(e.target.value)}
                          placeholder="Ví dụ: Tôi muốn tập trung nhiều hơn vào tăng cơ..."
                          className="!rounded-xl"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-[var(--theme-border)] pt-5 sm:flex-row sm:items-center">
                    <p className="text-xs text-[var(--gs-text-muted)]">Bước tiếp theo: chọn ngày và khung giờ tập.</p>
                    <Button type="primary" size="large" icon={<ArrowRightOutlined />} onClick={() => goToPtStep(2)}>
                      Tiếp theo
                    </Button>
                  </div>
                    </>
                  ) : (
                    <>
                  {/* Section 1: Lich mong muon */}
                  <div>
                    <h3 className="mb-5 text-lg font-semibold text-[var(--gs-text)]">
                      {ptPickMode === 'specific' && preferredTrainer ? (
                        <>Lịch mong muốn với PT <span className="text-[var(--theme-accent)]">{getUserDisplayName(preferredTrainer, '')}</span></>
                      ) : (
                        <>Lịch mong muốn</>
                      )}
                    </h3>
                    {ptPickMode === 'specific' && preferredTrainer && (
                      <div className="mb-5 flex items-center gap-2 rounded-2xl border border-[var(--theme-border)] bg-[var(--gs-bg-subtle)] px-4 py-3 text-sm">
                        <span className="text-[var(--gs-text)]">
                          PT mong muốn: <b className="text-[var(--theme-accent)]">{getUserDisplayName(preferredTrainer, '')}</b>
                        </span>
                      </div>
                    )}
                    <div className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-[var(--gs-text)] mb-2">Ngày và khung giờ mong muốn * <span className="font-normal text-[var(--gs-text-muted)]">(chọn 1 khung giờ cho mỗi ngày bạn muốn tập)</span></label>
                        <div className="overflow-x-auto rounded-2xl border border-[var(--theme-border)] bg-[var(--gs-bg-subtle)] p-1.5 shadow-sm">
                          <table className="w-full min-w-[860px] border-separate border-spacing-0 text-sm">
                            <thead>
                              <tr className="bg-[var(--gs-bg-subtle)]">
                                <th className="px-3 py-3 text-left text-xs font-semibold text-[var(--gs-text-muted)] whitespace-nowrap">Ngày</th>
                                {TIME_SLOTS.map((s) => (
                                  <th key={s} className="px-1 py-3 text-center text-[11px] font-semibold text-[var(--gs-text-muted)] whitespace-nowrap">
                                    {s.replace('-', ' - ')}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {DAYS.map((d) => {
                                const dayLocked = pt1on1Lock.isDayLocked(d.value)
                                return (
                                  <tr key={d.value} className={dayLocked ? 'opacity-50' : ''}>
                                    <td className="px-3 py-2 text-xs font-medium text-[var(--gs-text)] whitespace-nowrap border-t border-[var(--gs-border)]">
                                      {d.label}
                                    </td>
                                    {TIME_SLOTS.map((s) => {
                                      const disabled = dayLocked || !pt1on1Lock.slotEnabledForDay(d.value, s)
                                      const selected = ptDaySlotMap[d.value] === s
                                      const title = dayLocked
                                        ? 'PT này không làm việc vào ngày này'
                                        : pt1on1Lock.slotDisabledReasonForDay(d.value, s) || undefined
                                      return (
                                        <td key={s} className="p-0.5 text-center border-t border-[var(--gs-border)]">
                                          <button
                                            type="button"
                                            disabled={disabled}
                                            title={title}
                                            onClick={() => togglePtDaySlot(d.value, s)}
                                            className={`w-full rounded-lg border px-1 py-2 text-[11px] leading-tight transition-all ${
                                              selected
                                                ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)] text-[var(--theme-accent)] font-semibold'
                                                : disabled
                                                  ? 'border-transparent bg-[var(--gs-card)] text-[var(--gs-text-muted)] opacity-40 cursor-not-allowed'
                                                  : 'border-[var(--theme-border)] text-[var(--gs-text)] hover:border-[var(--theme-accent)]'
                                            }`}
                                          >
                                            {s}
                                          </button>
                                        </td>
                                      )
                                    })}
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-3 space-y-2">
                          <p className="text-xs text-[var(--gs-text-muted)]">
                            {preferredTrainer && pt1on1Lock.ptDayWindows.size > 0 ? (
                              <>PT <span className="font-medium text-[var(--gs-text)]">{getUserDisplayName(preferredTrainer, '')}</span> chỉ làm việc vào: <span className="font-medium text-[var(--gs-text)]">{DAYS.filter((d) => pt1on1Lock.ptWorkingDays.has(d.value)).map((d) => d.short).join(', ')}</span> — các ngày/khung giờ khác đã được khóa.</>
                            ) : preferredTrainer ? (
                              <>PT <span className="font-medium text-[var(--gs-text)]">{getUserDisplayName(preferredTrainer, '')}</span> chưa cập nhật lịch làm việc — bạn có thể chọn ngày/giờ bất kỳ, Admin sẽ sắp xếp theo lịch trống của PT.</>
                            ) : (
                              <>Đây là những ngày và khung giờ bạn có thể tham gia. Lịch tập chính thức sẽ được Admin sắp xếp dựa trên lịch làm việc và lịch trống của PT.</>
                            )}
                          </p>
                          {preferredTrainer && (preferredTrainer.busyBookings?.length || 0) > 0 && (
                            <p className="text-xs text-[var(--gs-text-muted)]">
                              PT này có một số khung giờ đã được đặt trong thời gian bạn chọn — các khung đó đã bị khóa.
                            </p>
                          )}
                          <p className="rounded-xl border border-[var(--theme-border)] bg-[var(--gs-bg-subtle)] px-3 py-2.5 text-xs leading-relaxed">
                            {Object.keys(ptDaySlotMap).length > 0 ? (
                              <>Lịch mong muốn đã chọn: <span className="font-medium text-[var(--theme-accent)]">{Object.entries(ptDaySlotMap).map(([day, slot]) => `${DAYS.find((x) => x.value === Number(day))?.short || day} (${formatShortDate(nextBookingDate(Number(day), slot))}) ${slot.replace('-', ' - ')}`).join(', ')}</span></>
                            ) : (
                              <span className="text-[var(--gs-text-muted)]">Chưa chọn ngày/khung giờ nào.</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-[var(--gs-text)] mb-2">Thời lượng đăng ký (lặp lại hàng tuần) *</label>
                        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                          {WEEKS_OPTIONS.map((w) => (
                            <button
                              key={w}
                              type="button"
                              onClick={() => setPtWeeks(w)}
                              className={`rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                                ptWeeks === w
                                  ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)] text-[var(--theme-accent)]'
                                  : 'border-[var(--theme-border)] text-[var(--gs-text)] hover:border-[var(--theme-accent)]'
                              }`}
                            >
                              {w} tuần
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-[var(--gs-text-muted)] mt-2">
                          VD: chọn 3 tuần + T2 18:00-20:00, T5 18:00-20:00 → lịch tập lặp lại mỗi tuần trong 3 tuần (6 buổi).
                        </p>
                      </div>

                    </div>
                  </div>

                  <div className="flex flex-col-reverse gap-3 border-t border-[var(--theme-border)] pt-5 sm:flex-row">
                    <Button size="large" className="sm:min-w-32" icon={<ArrowLeftOutlined />} onClick={() => setPtFormStep(1)}>
                      Quay lại
                    </Button>
                    <Button type="primary" size="large" block onClick={() => { if (validatePt1on1Form()) setPtConfirmOpen(true) }}>
                      Gửi yêu cầu
                    </Button>
                  </div>
                    </>
                  )}
                </div>
              </>
            )}
            </>
            )}
          </>
        )}
      </div>

      {/* Xác nhận gửi yêu cầu PT 1-1 */}
      <Modal
        title="Xác nhận gửi yêu cầu PT 1-1"
        open={ptConfirmOpen}
        onCancel={() => setPtConfirmOpen(false)}
        onOk={handlePt1on1Submit}
        okText="Xác nhận gửi yêu cầu"
        okButtonProps={{ loading: ptSubmitting }}
        cancelText="Chỉnh sửa lại"
        centered
      >
        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--gs-bg-subtle)] p-4 text-sm space-y-2.5">
          <div className="flex items-center gap-2">
            <UserOutlined className="text-[var(--theme-accent)]" />
            <span className="text-[var(--gs-text-muted)]">PT:</span>
            <span className="font-medium text-[var(--gs-text)]">
              {ptPickMode === 'specific' && preferredTrainer
                ? getUserDisplayName(preferredTrainer, '')
                : 'Phòng gym phân công'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarOutlined className="text-[var(--theme-accent)]" />
            <span className="text-[var(--gs-text-muted)]">Chuyên môn:</span>
            <span className="font-medium text-[var(--gs-text)]">
              {ptPickMode === 'specific' && !ptSpecTouched ? 'Theo PT (không chọn)' : ptSpecialization}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CalendarOutlined className="text-[var(--theme-accent)] mt-0.5" />
            <span className="text-[var(--gs-text-muted)]">Lịch mong muốn:</span>
            <span className="font-medium text-[var(--gs-text)]">
              {Object.entries(ptDaySlotMap).map(([day, slot]) => `${DAYS.find((x) => x.value === Number(day))?.short || day} ${slot.replace('-', ' - ')}`).join(', ') || '—'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarOutlined className="text-[var(--theme-accent)]" />
            <span className="text-[var(--gs-text-muted)]">Số tuần:</span>
            <span className="font-medium text-[var(--gs-text)]">{ptWeeks} tuần</span>
          </div>
          {ptGoals.length > 0 && (
            <div className="flex items-start gap-2">
              <AimOutlined className="text-[var(--theme-accent)] mt-0.5" />
              <span className="text-[var(--gs-text-muted)]">Mục tiêu:</span>
              <span className="font-medium text-[var(--gs-text)]">{ptGoals.join(', ')}</span>
            </div>
          )}
        </div>
        <p className="mt-3 text-xs text-[var(--gs-text-muted)]">
          Sau khi gửi, yêu cầu sẽ được Admin xử lý. Bạn có thể hủy yêu cầu trong khi đang chờ xử lý.
        </p>
      </Modal>

      <Modal
        title="Xác nhận rời dịch vụ PT"
        open={showLeaveConfirm}
        onCancel={() => setShowLeaveConfirm(false)}
        onOk={leaveCurrentTraining}
        okText="Xác nhận rời dịch vụ"
        cancelText="Hủy"
        okButtonProps={{ danger: true, loading: leavingTraining }}
        width={520}
      >
        <p className="text-sm text-[var(--gs-text)]">Bạn sắp rời dịch vụ PT.</p>
        <p className="mt-3 text-sm text-[var(--gs-text-muted)]">
          Sau khi xác nhận, hệ thống sẽ:
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-[var(--gs-text-muted)] list-disc pl-5">
          <li>Chấm dứt PT phụ trách hiện tại.</li>
          <li>Tự động rời tất cả lớp PT đang tham gia.</li>
          <li>Hủy các lịch PT 1-1 chưa diễn ra.</li>
          <li>Xóa các booking/PT assignment liên quan.</li>
        </ul>
        <p className="mt-3 text-sm text-[var(--gs-text-muted)]">
          Sau này bạn có thể đăng ký PT khác bất cứ lúc nào.
        </p>
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
          Nếu tiếp tục, thao tác này sẽ có hiệu lực ngay.
        </p>
      </Modal>
    </MemberLayout>
  )
}
