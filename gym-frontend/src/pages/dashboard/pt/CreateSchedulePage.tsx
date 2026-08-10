import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  DownOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  UpOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import {
  Button,
  Checkbox,
  DatePicker,
  InputNumber,
  message,
  Select,
  Spin,
  Tag,
} from 'antd'
import dayjs from 'dayjs'
import 'dayjs/locale/vi'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { useAuth } from '../../../hooks/useAuth'
import { bookingService, type Booking } from '../../../services/bookingService'
import { memberService } from '../../../services/memberService'
import { ptAssignmentService, type SuggestedSlot } from '../../../services/ptAssignmentService'
import { scheduleService } from '../../../services/scheduleService'
import { workoutService, type TemplateDayExercise, type WorkoutPlan } from '../../../services/workoutService'
import { getUserDisplayName } from '../../../utils/userDisplay'

const DAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

dayjs.locale('vi')

const formatDayLabel = (dayOfWeek: number) => {
  const shortLabel = dayjs().day(dayOfWeek).format('dd')
  return shortLabel === 'CN' ? 'Chủ nhật' : `Thứ ${shortLabel.slice(1)}`
}

const BUFFER_HOURS = 12

const findNearestTrainingDay = (preferredDays: number[]): dayjs.Dayjs => {
  const now = dayjs()
  const candidateDays = preferredDays.length > 0 ? preferredDays : [0, 1, 2, 3, 4, 5, 6]
  const cutoff = now.add(BUFFER_HOURS, 'hour')

  for (let offset = 0; offset < 21; offset++) {
    const candidate = cutoff.add(offset, 'day')
    if (candidateDays.includes(candidate.day())) {
      return candidate.startOf('day')
    }
  }

  return cutoff.add(21, 'day').startOf('day')
}

interface ScheduleDayEntry {
  cycleIndex: number
  dayOrder: number
  title: string
  muscleGroup: string
  exercises: { name: string; note: string }[]
  date: dayjs.Dayjs | null
  time: dayjs.Dayjs | null
  endTime?: string
  className?: string
  classCode?: string
}

export default function CreateSchedulePage() {
  useAuth()
  const navigate = useNavigate()
  const { memberId } = useParams<{ memberId: string }>()
  const [searchParams] = useSearchParams()
  const assignmentId = searchParams.get('assignmentId') || undefined
  // Từ nút "Sử dụng" ở thư viện giáo án (PTClientsPage truyền sang)
  const templateIdParam = searchParams.get('templateId') || undefined
  const bookedCountParam = searchParams.get('booked') || ''
  const bookedCount = bookedCountParam ? parseInt(bookedCountParam, 10) : 0

  const [pageLoading, setPageLoading] = useState(true)
  const [templates, setTemplates] = useState<WorkoutPlan[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined)
  const [scheduleDays, setScheduleDays] = useState<ScheduleDayEntry[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [allAvailableSlots, setAllAvailableSlots] = useState<SuggestedSlot[]>([])
  const [clientInfo, setClientInfo] = useState<{ fullName: string; preferredTime?: string } | null>(null)
  const [preferredTimeSlots, setPreferredTimeSlots] = useState<string[]>([])
  const [preferredDaysOfWeek, setPreferredDaysOfWeek] = useState<number[]>([])
  const [bookedSlots, setBookedSlots] = useState<Array<{ dayOfWeek: number; slot: string; date: string }>>([])
  const [skippedBookedDayOrders, setSkippedBookedDayOrders] = useState<Set<number>>(new Set())
  const [memberPrefs, setMemberPrefs] = useState<{ goals: string[]; desiredSessions: number; weeks: number; healthNotes: string; isNewToGym: boolean; note: string; specialization: string } | null>(null)

  const [startDate, setStartDate] = useState<dayjs.Dayjs | null>(null)
  const [isRepeating, setIsRepeating] = useState(false)
  const [repeatWeeks, setRepeatWeeks] = useState<number>(4)
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<number>>(new Set())

  // dayOrder → dayOfWeek (0-6) as assigned by slot click
  const [dayOrderDow, setDayOrderDow] = useState<Map<number, number>>(new Map())
  // dayOrder → slot detail (startTime/endTime/className/classCode)
  const slotInfoRef = useRef<Map<number, { startTime: string; endTime: string; className: string; classCode: string }>>(new Map())

  const normalizeTime = (str: string) => str.replace(/\s+/g, '').toLowerCase()
  // Slot "khớp" nếu trùng/đè khung giờ mong muốn (không so chuỗi chính xác —
  // pref 18:00-20:00 vẫn khớp slot 18:00-19:00, 19:00-20:00)
  const slotOverlapsPrefs = (slotTime: string, prefs: string[]) => {
    const parse = (t: string) => {
      const m = String(t).match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/)
      if (!m) return null
      const toMin = (s: string) => { const [h, mm] = s.split(':').map(Number); return h * 60 + (mm || 0) }
      return { start: toMin(m[1]), end: toMin(m[2]) }
    }
    const s = parse(normalizeTime(slotTime))
    if (!s) return false
    return prefs.some((p) => {
      const r = parse(normalizeTime(p))
      if (!r) return false
      return s.start < r.end && r.start < s.end
    })
  }
  const hasTimePref = preferredTimeSlots.length > 0
  const hasDayPref = preferredDaysOfWeek.length > 0
  const hasAnyPref = hasTimePref || hasDayPref

  const loadData = useCallback(async () => {
    if (!memberId) return
    setPageLoading(true)
    try {
      const [memberRes, tmplRes, slotsRes, prefsRes, assignmentsRes, bookingsRes] = await Promise.all([
        memberService.getMemberById(memberId),
        workoutService.getTemplates(),
        ptAssignmentService.getSuggestedSlots(),
        ptAssignmentService.getMemberPreferences(memberId),
        ptAssignmentService.getPTClients(),
        bookingService.getPTBookings({ memberId, from: 'today' }),
      ])
      const activeBookings: Booking[] = (bookingsRes.data || []).filter((b: Booking) =>
        b.status === 'confirmed' && b.slot)
      setBookedSlots(
        Array.from(new Map(
          activeBookings.map((b) => [
            `${new Date(b.date).getDay()}_${b.slot}`,
            { dayOfWeek: new Date(b.date).getDay(), slot: b.slot, date: b.date },
          ]),
        ).values()),
      )
      const assignments = assignmentsRes.data?.assignments || []
      const assignment = assignments.find((item) => assignmentId
        ? String(item._id) === String(assignmentId)
        : String(typeof item.memberId === 'object' ? item.memberId._id : item.memberId) === String(memberId))
      const currentSchedule = assignment?.currentSchedule || assignment?.schedule
      const acceptedProposal = assignment?.acceptedProposal
      const matchedClass = assignment?.matchedClass || assignment?.classId
      const classData = matchedClass && typeof matchedClass === 'object' ? matchedClass : null
      const effectiveTimeSlots = currentSchedule?.timeSlots?.length
        ? currentSchedule.timeSlots
        : currentSchedule?.startTime && currentSchedule?.endTime
          ? [`${currentSchedule.startTime.slice(0, 5)}-${currentSchedule.endTime.slice(0, 5)}`]
          : acceptedProposal?.timeSlots?.length
            ? acceptedProposal.timeSlots
            : acceptedProposal?.startTime && acceptedProposal?.endTime
              ? [`${acceptedProposal.startTime.slice(0, 5)}-${acceptedProposal.endTime.slice(0, 5)}`]
              : classData?.startTime && classData?.endTime
                ? [`${classData.startTime.slice(0, 5)}-${classData.endTime.slice(0, 5)}`]
                : prefsRes.data?.timeSlots || []
      const effectiveDays = currentSchedule?.daysOfWeek?.length
        ? currentSchedule.daysOfWeek
        : acceptedProposal?.daysOfWeek?.length
          ? acceptedProposal.daysOfWeek
          : classData?.daysOfWeek?.length
            ? classData.daysOfWeek
            : prefsRes.data?.daysOfWeek || []
      const effectiveSpecialization = currentSchedule?.specialization
        || acceptedProposal?.specialization
        || classData?.specialization
        || prefsRes.data?.specialization
        || ''
      const effectiveGoals = acceptedProposal?.goals?.length ? acceptedProposal.goals : prefsRes.data?.goals || []
      const requestedWeeks = Math.min(Math.max(Number(assignment?.requestWeeks ?? prefsRes.data?.weeks) || 1, 1), 12)
      const memberData = memberRes.data?.member
      setClientInfo(memberData ? { fullName: getUserDisplayName(memberData, ''), preferredTime: memberData.preferredTime } : null)
      setTemplates(Array.isArray(tmplRes.data) ? tmplRes.data : [])
      setAllAvailableSlots(slotsRes.data.slots || [])
      // Tự chọn template từ nút "Sử dụng" + bỏ lọc để template luôn hiển thị
      if (templateIdParam && Array.isArray(tmplRes.data) && tmplRes.data.some((t) => t._id === templateIdParam)) {
        setSelectedTemplateId(templateIdParam)
        setFilterSpecialty('')
        setFilterGoals([])
        setFilterSessions(0)
      }
      setPreferredTimeSlots(effectiveTimeSlots)
      setPreferredDaysOfWeek(effectiveDays)
      // Áp dụng thời lượng của đúng yêu cầu PT đang phụ trách, không dùng mặc định 4 tuần.
      setRepeatWeeks(requestedWeeks)
      setIsRepeating(requestedWeeks > 1)
      const pd = prefsRes.data
      if (pd && (pd.goals?.length > 0 || pd.desiredSessions > 0 || pd.healthNotes || pd.isNewToGym || pd.note || pd.specialization)) {
        setMemberPrefs({ goals: effectiveGoals, desiredSessions: pd.desiredSessions || 0, weeks: requestedWeeks, healthNotes: pd.healthNotes || '', isNewToGym: pd.isNewToGym || false, note: pd.note || '', specialization: effectiveSpecialization })
      }
    } catch {
      message.error('Không thể tải dữ liệu')
    } finally {
      setPageLoading(false)
    }
  }, [memberId])

  useEffect(() => { loadData() }, [loadData])

  const templateDays = useMemo(() => {
    if (!selectedTemplateId) return null
    const tmpl = templates.find((t) => t._id === selectedTemplateId)
    if (!tmpl?.days?.length) return null
    return tmpl.days
  }, [selectedTemplateId, templates])

  const rebuildSchedule = useCallback(() => {
    if (!templateDays || !startDate) {
      setScheduleDays([])
      return
    }

    const cycles = isRepeating ? repeatWeeks : 1
    const entries: ScheduleDayEntry[] = []

    // Số vị trí/tuần: member đã đặt ca cố định thì lấy theo số ca đã đặt, ngược lại theo số buổi giáo án
    const slotsPerWeek = (bookedSlots.length > 0
      ? Math.min(bookedSlots.length, templateDays.length)
      : templateDays.length) || 1

    for (let c = 0; c < cycles; c++) {
      const weekFirst = startDate.add(c * 7, 'day')
      const weekStart = weekFirst.subtract(weekFirst.day(), 'day')

      for (let p = 1; p <= slotsPerWeek; p++) {
        // Slot thứ j của toàn bộ lịch (theo thứ tự tuần/ngày) ↔ buổi thứ j của giáo án.
        // Tuần 1: T2→Buổi 1, T3→Buổi 2; Tuần 2: T2→Buổi 3, T3→Buổi 4.
        // Giáo án hết buổi (ít buổi hơn số slot) → lặp lại từ buổi 1.
        const globalSlot = c * slotsPerWeek + (p - 1)
        const templateIdx = globalSlot % templateDays.length
        const day = templateDays[templateIdx]
        const dof = templateIdx + 1
        const targetDow = dayOrderDow.get(p)
        const si = slotInfoRef.current.get(p)

        // Hội viên đã đặt lịch → chỉ giữ các buổi đã chọn khung giờ (không ép đủ số buổi của giáo án)
        if (bookedSlots.length > 0 && targetDow == null) continue

        let date: dayjs.Dayjs | null = null
        let time: dayjs.Dayjs | null = null

        if (targetDow != null) {
          const baseDow = weekStart.day()
          let diff = targetDow - baseDow
          if (diff < 0) diff += 7
          date = weekStart.add(diff, 'day')

          if (si?.startTime) {
            time = dayjs(`${date.format('YYYY-MM-DD')}T${si.startTime}`)
          }
        }

        entries.push({
          cycleIndex: c,
          dayOrder: dof,
          title: day.muscleGroup || `Buổi ${dof}`,
          muscleGroup: day.muscleGroup || '',
          exercises: (day.exercises || []).map((ex: TemplateDayExercise) => ({ name: ex.name, note: ex.note || '' })),
          date,
          time,
          endTime: si?.endTime,
          className: si?.className,
          classCode: si?.classCode,
        })
      }
    }

    // Sort by date ascending
    entries.sort((a, b) => { const au = a.date?.unix() ?? Infinity; const bu = b.date?.unix() ?? Infinity; return au - bu })
    setScheduleDays(entries)
  }, [templateDays, startDate, isRepeating, repeatWeeks, dayOrderDow, bookedSlots])

  useEffect(() => { rebuildSchedule() }, [rebuildSchedule])

  const handleTemplateChange = (id: string) => {
    setSelectedTemplateId(id)
    setStartDate(findNearestTrainingDay(preferredDaysOfWeek))
    setDayOrderDow(new Map())
    setSkippedBookedDayOrders(new Set())
    slotInfoRef.current = new Map()
    setCollapsedWeeks(new Set())
    setScheduleDays([])
  }

  const handleSlotClick = (slot: SuggestedSlot, dayOrder: number) => {
    setDayOrderDow(prev => {
      const next = new Map(prev)
      next.set(dayOrder, slot.dayOfWeek)
      return next
    })
    slotInfoRef.current.set(dayOrder, {
      startTime: slot.startTime,
      endTime: slot.endTime,
      className: slot.className,
      classCode: slot.classCode,
    })
  }

  const applyBookedSlot = (booking: { dayOfWeek: number; slot: string }, dayOrder: number) => {
    const [startTime = '', endTime = ''] = booking.slot.replace(/\s/g, '').split('-')
    if (!startTime || !endTime) return
    slotInfoRef.current.set(dayOrder, { startTime, endTime, className: '', classCode: '' })
    setDayOrderDow((prev) => {
      const next = new Map(prev)
      next.set(dayOrder, booking.dayOfWeek)
      return next
    })
    setSkippedBookedDayOrders((prev) => {
      const next = new Set(prev)
      next.delete(dayOrder)
      return next
    })
  }

  const handleClearSlot = (dayOrder: number) => {
    setDayOrderDow(prev => {
      const next = new Map(prev)
      next.delete(dayOrder)
      return next
    })
    slotInfoRef.current.delete(dayOrder)
    if (bookedSlots.length > 0) {
      setSkippedBookedDayOrders((prev) => new Set(prev).add(dayOrder))
    }
  }

  const handleSubmit = async () => {
    if (!selectedTemplateId || !memberId) return
    const unfilled = scheduleDays.filter(d => !d.time)
    if (unfilled.length > 0) {
      message.warning(`Còn ${unfilled.length} buổi chưa chọn khung giờ`)
      return
    }
    setSubmitting(true)
    try {
      const cycles = new Map<number, typeof scheduleDays>()
      for (const d of scheduleDays) { if (!cycles.has(d.cycleIndex)) cycles.set(d.cycleIndex, []); cycles.get(d.cycleIndex)!.push(d) }

      let weekNum = 0
      const weeksPayload: { weekIndex: number; sessions: unknown[] }[] = []
      for (const [cycleIndex, items] of cycles) {
        weekNum++
        weeksPayload.push({
          weekIndex: cycleIndex,
          sessions: items.map(d => ({
            dayOrder: d.dayOrder, date: d.date!.format('YYYY-MM-DD'), time: d.time ? d.time.format('HH:mm') : '',
            endTime: d.endTime || '', className: d.className || '', classCode: d.classCode || '',
            title: `${d.title}${isRepeating ? ` (Tuần ${weekNum})` : ''}`,
            muscleGroup: d.muscleGroup, exercises: d.exercises,
          })),
        })
      }
      await scheduleService.bulkCreateSchedules({
        templateId: selectedTemplateId,
        memberId,
        assignmentId,
        weeks: weeksPayload,
      })
      message.success(isRepeating ? `Đã tạo lịch tập ${weekNum} tuần thành công` : 'Đã tạo lịch tập thành công')
      navigate('/pt/clients')
    } catch (error: unknown) {
      const e = error as { response?: { data?: { message?: string } } }
      message.error(e?.response?.data?.message || 'Không thể tạo lịch tập')
    } finally {
      setSubmitting(false)
    }
  }

  const weeks = useMemo(() => {
    const map = new Map<number, ScheduleDayEntry[]>()
    for (const d of scheduleDays) { if (!map.has(d.cycleIndex)) map.set(d.cycleIndex, []); map.get(d.cycleIndex)!.push(d) }
    return Array.from(map.entries()).sort(([a], [b]) => a - b)
  }, [scheduleDays])

  const allSpecialties = useMemo(() => {
    const set = new Set(templates.map((t) => t.specializationId).filter(Boolean))
    return Array.from(set).sort()
  }, [templates])

  const allGoals = useMemo(() => {
    const set = new Set(templates.map((t) => t.goal).filter(Boolean))
    return Array.from(set).sort()
  }, [templates])

  const allSessionCounts = useMemo(() => {
    const set = new Set(templates.map((t) => t.days?.length || 0))
    return Array.from(set).sort((a, b) => a - b)
  }, [templates])

  // Filter state — init from memberPrefs when it loads
  const [filterSpecialty, setFilterSpecialty] = useState<string>('')
  const [filterGoals, setFilterGoals] = useState<string[]>([])
  const [filterSessions, setFilterSessions] = useState<number>(0)

  useEffect(() => {
    // Khi có templateIdParam (từ nút "Sử dụng"), không ghi đè bộ lọc theo memberPrefs
    // vì có thể lọc sạch template đang được chọn.
    if (memberPrefs && !templateIdParam) {
      setFilterSpecialty(memberPrefs.specialization || '')
      setFilterGoals(memberPrefs.goals || [])
      setFilterSessions(memberPrefs.desiredSessions || 0)
    }
  }, [memberPrefs, templateIdParam])

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (filterSpecialty && t.specializationId !== filterSpecialty) return false
      if (filterGoals.length > 0 && !filterGoals.includes(t.goal)) return false
      if (filterSessions > 0 && (t.days?.length || 0) !== filterSessions) return false
      return true
    })
  }, [templates, filterSpecialty, filterGoals, filterSessions])

  // Hội viên đặt N buổi → lịch cần đủ N buổi (không bắt buộc đủ số buổi của giáo án mẫu)
  const neededSlots = (bookedSlots.length > 0
    ? Math.min(bookedSlots.length, templateDays?.length || 0)
    : templateDays?.length) || 0
  const filledDowCount = dayOrderDow.size
  const allFilled = filledDowCount >= neededSlots && neededSlots > 0
  const scheduledWeekCount = isRepeating ? repeatWeeks : 1
  const scheduledSessionCount = scheduledWeekCount * neededSlots

  // Lịch PT 1-1 đã được xác nhận là lịch chính thức. Dùng nguyên khung giờ đã đặt,
  // không buộc PT chọn lại các ca con trong khung giờ đó.
  useEffect(() => {
    if (bookedSlots.length === 0 || dayOrderDow.size > 0) return
    if (!selectedTemplateId || !startDate) return
    bookedSlots.slice(0, neededSlots).forEach((booking, index) => {
      if (!skippedBookedDayOrders.has(index + 1)) applyBookedSlot(booking, index + 1)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookedSlots, selectedTemplateId, startDate, neededSlots, skippedBookedDayOrders])

  if (pageLoading) {
    return <DashboardLayout><div className="flex min-h-[400px] items-center justify-center"><Spin size="large" /></div></DashboardLayout>
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl px-4 py-6 max-[767px]:px-3 max-[767px]:py-4">
        <div className="cs-header mb-6 flex items-center gap-4 max-[767px]:relative max-[767px]:min-h-[44px]">
          <Button className="cs-back-btn" icon={<ArrowLeftOutlined />} shape="circle" onClick={() => navigate('/pt/clients')} />
          <div className="cs-title-area">
            <h1 className="text-2xl font-bold text-[var(--gs-text)] max-[767px]:text-lg">Tạo lịch</h1>
            <p className="mt-0.5 text-sm text-[var(--gs-text-muted)] max-[767px]:text-[13px]">{clientInfo ? `Hội viên: ${clientInfo.fullName}` : 'Đang tải...'}</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* ── Section 1: Member info ── */}
          {clientInfo && (
            <div className="cs-card rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-5">
              <p className="text-lg font-bold text-[var(--gs-text)] max-[767px]:text-base">{clientInfo.fullName}</p>
              {memberPrefs ? (
                <div className="cs-member-info-grid mt-3 grid grid-cols-2 gap-x-6 gap-y-2">
                  {memberPrefs.specialization && <div className="cs-info-row flex items-center gap-2"><span className="cs-label text-xs font-medium text-[var(--gs-text-muted)] w-28 shrink-0">Chuyên môn:</span><Tag color="blue" className="m-0 text-xs">{memberPrefs.specialization}</Tag></div>}
                  {memberPrefs.goals.length > 0 && <div className="cs-info-row flex items-center gap-2"><span className="cs-label text-xs font-medium text-[var(--gs-text-muted)] w-28 shrink-0">Mục tiêu:</span><div className="flex flex-wrap gap-1">{memberPrefs.goals.map((g, i) => <Tag key={i} color="purple" className="m-0 text-xs">{g}</Tag>)}</div></div>}
                  {memberPrefs.desiredSessions > 0 && <div className="cs-info-row flex items-center gap-2"><span className="cs-label text-xs font-medium text-[var(--gs-text-muted)] w-28 shrink-0">Số buổi/tuần:</span><span className="text-sm font-semibold text-[var(--gs-text)]">{memberPrefs.desiredSessions} buổi</span></div>}
                  {clientInfo.preferredTime && <div className="cs-info-row flex items-center gap-2"><span className="cs-label text-xs font-medium text-[var(--gs-text-muted)] w-28 shrink-0">Khung giờ:</span><span className="text-sm text-[var(--gs-text)]">{clientInfo.preferredTime}</span></div>}
                  {preferredTimeSlots.length > 0 && <div className="cs-info-row flex items-start gap-2"><span className="cs-label text-xs font-medium text-[var(--gs-text-muted)] w-28 shrink-0 pt-0.5">Ca đăng ký:</span><div className="flex flex-wrap gap-1">{preferredTimeSlots.map((t, i) => <Tag key={i} color="cyan" className="m-0 text-xs">{t}</Tag>)}</div></div>}
                  {preferredDaysOfWeek.length > 0 ? (
                    <div className="cs-info-row flex items-start gap-2">
                      <span className="cs-label text-xs font-medium text-[var(--gs-text-muted)] w-28 shrink-0 pt-0.5">Ngày mong muốn:</span>
                      <div className="flex flex-wrap gap-1">{preferredDaysOfWeek.map((d, i) => <Tag key={i} color="blue" className="m-0 text-xs">{formatDayLabel(d)}</Tag>)}</div>
                    </div>
                  ) : (
                    <div className="cs-info-row flex items-start gap-2">
                      <span className="cs-label text-xs font-medium text-[var(--gs-text-muted)] w-28 shrink-0 pt-0.5">Ngày mong muốn:</span>
                      <Tag className="m-0 text-xs text-[var(--gs-text-muted)]" style={{ background: 'transparent', borderColor: 'var(--gs-border)' }}>Không yêu cầu cụ thể — để PT sắp xếp</Tag>
                    </div>
                  )}
                  {memberPrefs.note && <div className="cs-info-row flex items-start gap-2"><span className="cs-label text-xs font-medium text-[var(--gs-text-muted)] w-28 shrink-0">Ghi chú:</span><span className="text-xs text-[var(--gs-text-muted)]">{memberPrefs.note}</span></div>}
                  {memberPrefs.isNewToGym && <Tag color="orange" className="text-xs max-[767px]:mt-1" icon={<ExclamationCircleOutlined />}>Người mới cần hướng dẫn cơ bản</Tag>}
                </div>
              ) : (<p className="mt-1 text-xs text-[var(--gs-text-muted)]">Chưa có thông tin đăng ký</p>)}
              {memberPrefs?.healthNotes && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2">
                  <WarningOutlined className="mt-0.5 text-sm text-yellow-500" />
                  <div><p className="text-xs font-semibold text-yellow-400">Lưu ý sức khỏe</p><p className="text-xs text-yellow-300/80">{memberPrefs.healthNotes}</p></div>
                </div>
              )}
            </div>
          )}

          {/* ── Section 2: Template + start + repeat ── */}
          <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-5 space-y-4">
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-[var(--gs-text)]">Chọn giáo án mẫu</label>
              <div className="cs-filter-row flex flex-wrap items-end gap-3">
                <div className="cs-filter-item flex-1 min-w-[140px] max-[767px]:!w-full">
                  <label className="mb-1 block text-[11px] font-medium text-[var(--gs-text-muted)]">Chuyên môn</label>
                  <Select className="w-full" size="small" value={filterSpecialty} onChange={(v) => { setFilterSpecialty(v); setSelectedTemplateId(undefined) }}
                    options={[
                      { value: '', label: 'Tất cả' },
                      ...allSpecialties.map((s) => ({ value: s, label: s })),
                    ]} />
                </div>
                <div className="cs-filter-item flex-1 min-w-[180px] max-[767px]:!w-full">
                  <label className="mb-1 block text-[11px] font-medium text-[var(--gs-text-muted)]">Mục tiêu</label>
                  <Select className="w-full" size="small" mode="multiple" value={filterGoals} onChange={(v) => { setFilterGoals(v); setSelectedTemplateId(undefined) }}
                    maxTagCount={2}
                    options={allGoals.map((g) => ({ value: g, label: g }))} />
                </div>
                <div className="cs-filter-item w-[120px] max-[767px]:!w-full">
                  <label className="mb-1 block text-[11px] font-medium text-[var(--gs-text-muted)]">Số buổi/tuần</label>
                  <Select className="w-full" size="small" value={filterSessions} onChange={(v) => { setFilterSessions(v); setSelectedTemplateId(undefined) }}
                    options={[
                      { value: 0, label: 'Tất cả' },
                      ...allSessionCounts.map((n) => ({ value: n, label: `${n} buổi` })),
                    ]} />
                </div>
              </div>
              <Select className="w-full" placeholder="Chọn giáo án mẫu..." value={selectedTemplateId} onChange={handleTemplateChange}
                notFoundContent={
                  <div className="py-4 text-center">
                    <p className="text-sm text-[var(--gs-text-muted)]">Không có giáo án nào khớp với bộ lọc hiện tại.</p>
                    <p className="mt-1 text-xs text-[var(--gs-text-muted)]">Hãy thử điều chỉnh lại bộ lọc hoặc tạo giáo án mới.</p>
                    <div className="mt-3 flex justify-center gap-2">
                      {filterSpecialty && <Button size="small" onClick={() => setFilterSpecialty('')}>Bỏ lọc chuyên môn</Button>}
                      {filterGoals.length > 0 && <Button size="small" onClick={() => setFilterGoals([])}>Bỏ lọc mục tiêu</Button>}
                      {filterSessions > 0 && <Button size="small" onClick={() => setFilterSessions(0)}>Bỏ lọc số buổi</Button>}
                    </div>
                  </div>
                }>
                {filteredTemplates.length > 0 ? filteredTemplates.map((t) => (
                  <Select.Option key={t._id} value={t._id}>
                    {t.workoutName || t.name} ({t.days?.length || 0} buổi{t.goal ? ` — ${t.goal}` : ''})
                  </Select.Option>
                )) : (
                  <Select.Option key="__empty" value="__empty" disabled style={{ display: 'none' }} />
                )}
              </Select>
              {selectedTemplateId && templateDays && (memberPrefs?.desiredSessions > 0 || bookedCount > 0) && (
                <div className="mt-2 flex flex-col gap-1 rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-2">
                  {memberPrefs && memberPrefs.desiredSessions > 0 && templateDays.length !== memberPrefs.desiredSessions && (
                    <div className="flex items-start gap-2">
                      <WarningOutlined className="mt-0.5 text-sm text-orange-500" />
                      <p className="text-xs text-orange-400">
                        Giáo án có <b>{templateDays.length} buổi/tuần</b> nhưng hội viên đăng ký <b>{memberPrefs.desiredSessions} buổi/tuần</b>. Nên chọn giáo án có số buổi phù hợp (hoặc nhân bản rồi chỉnh số buổi).
                      </p>
                    </div>
                  )}
                  {bookedCount > 0 && (
                    <div className="flex items-start gap-2">
                      <InfoCircleOutlined className="mt-0.5 text-sm text-blue-500" />
                      <p className="text-xs text-blue-300">
                        Hội viên đang có <b>{bookedCount} buổi PT 1-1</b> đã book — tránh đặt lịch tập trùng khung giờ với các buổi này.
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 max-[767px]:flex-col max-[767px]:items-stretch">
                <span className="text-xs text-[var(--gs-text-muted)]">{filteredTemplates.length} giáo án khớp</span>
                {(filterSpecialty || filterGoals.length > 0 || filterSessions > 0) && (
                  <>
                    <Button size="small" type="link" className="cs-reset-link !text-xs" onClick={() => {
                      if (memberPrefs) {
                        setFilterSpecialty(memberPrefs.specialization || '')
                        setFilterGoals(memberPrefs.goals || [])
                        setFilterSessions(memberPrefs.desiredSessions || 0)
                      }
                    }}>Đặt lại theo hội viên</Button>
                    <Button size="small" className="cs-reset-btn" onClick={() => {
                      if (memberPrefs) {
                        setFilterSpecialty(memberPrefs.specialization || '')
                        setFilterGoals(memberPrefs.goals || [])
                        setFilterSessions(memberPrefs.desiredSessions || 0)
                      }
                    }}>Đặt lại theo hội viên</Button>
                  </>
                )}
              </div>
            </div>

            {selectedTemplateId && templateDays && (
              <>
                <div className="flex flex-wrap gap-4 items-end">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--gs-text-muted)]">Ngày bắt đầu</label>
                    <DatePicker value={startDate} onChange={(val) => {
                      if (val) {
                        setStartDate(val)
                      } else {
                        setStartDate(null)
                      }
                      setCollapsedWeeks(new Set(isRepeating ? [1] : []))
                    }}
                      style={{ width: 180 }} placeholder="Chọn ngày bắt đầu" disabledDate={(d) => d.isBefore(dayjs(), 'day')} />
                    {startDate && (
                      <p className="mt-1 text-[11px] text-[var(--gs-text-muted)]">
                        Buổi tập đầu tiên: {formatDayLabel(startDate.day())}, {startDate.format('DD/MM/YYYY')}
                        <span className="ml-1 text-[var(--gs-text-soft)]">— cách hiện tại ít nhất {BUFFER_HOURS} giờ</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox checked={isRepeating} onChange={e => { setIsRepeating(e.target.checked); if (!e.target.checked) setCollapsedWeeks(new Set()) }}><span className="text-sm">Lặp lại lịch tập</span></Checkbox>
                    {isRepeating && <div className="flex items-center gap-2"><span className="text-xs text-[var(--gs-text-muted)]">Số tuần:</span>
                      <InputNumber min={1} max={52} value={repeatWeeks} onChange={v => { setRepeatWeeks(v || 1); setCollapsedWeeks(new Set([1])) }} style={{ width: 72 }} size="small" /></div>}
                  </div>
                </div>
                {startDate && (
                  <div className="flex flex-wrap gap-1">
                    <Tag color="blue" className="text-xs">{isRepeating ? `${repeatWeeks} tuần × ${neededSlots} buổi/tuần = ${scheduledSessionCount} buổi` : `${neededSlots} buổi`}</Tag>
                    {templateDays.slice(0, neededSlots).map((d, i) => {
                      const dow = dayOrderDow.get(i + 1)
                      return <Tag key={i} className="text-xs">{d.muscleGroup || `Buổi ${i + 1}`}: {dow != null ? DAY_SHORT[dow] : '?'}</Tag>
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Section 3: Slot suggestions ── */}
          {selectedTemplateId && startDate && (
            <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[var(--gs-text)]">
                {bookedSlots.length > 0
                  ? 'Lịch đặt của hội viên'
                  : 'Khung giờ gợi ý từ lịch dạy của bạn'}
                </p>
                <span className="text-xs text-[var(--gs-text-muted)]">Đã chọn {filledDowCount}/{neededSlots} buổi/tuần</span>
              </div>
              {bookedSlots.length > 0 && (
                <div className="mb-4 rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium text-cyan-200">Buổi hội viên đã đặt</p>
                    <span className="text-xs text-cyan-300">
                      {bookedSlots.length} buổi/tuần{memberPrefs?.weeks && memberPrefs.weeks > 1 ? ` × ${memberPrefs.weeks} tuần = ${bookedSlots.length * memberPrefs.weeks} buổi` : ''}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {bookedSlots.map((booking, index) => {
                      const selectedInfo = slotInfoRef.current.get(index + 1)
                      const isSkipped = skippedBookedDayOrders.has(index + 1)
                      return (
                        <div key={`${booking.dayOfWeek}-${booking.slot}`} className="rounded-md border border-cyan-400/20 bg-[var(--gs-card)] px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[var(--gs-text)]">Buổi {index + 1}</span>
                            <div className="flex items-center gap-2">
                              <Tag color={isSkipped ? 'default' : 'green'} className="m-0 text-[10px]">
                                {isSkipped ? 'Đã bỏ khỏi giáo án' : 'Đã áp dụng'}
                              </Tag>
                              <Button
                                size="small"
                                type="link"
                                danger={!isSkipped}
                                className="h-auto p-0 text-xs"
                                onClick={() => isSkipped ? applyBookedSlot(booking, index + 1) : handleClearSlot(index + 1)}
                              >
                                {isSkipped ? 'Thêm lại' : 'Bỏ'}
                              </Button>
                            </div>
                          </div>
                          <p className="mt-1 text-sm font-medium text-cyan-200">{formatDayLabel(booking.dayOfWeek)}, {booking.slot.replace('-', ' - ')}</p>
                          {selectedInfo && !isSkipped && (
                            <p className="mt-1 text-[11px] text-[var(--gs-text-muted)]">
                              Thời gian áp dụng: {selectedInfo.startTime} - {selectedInfo.endTime}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <p className="mt-3 text-xs text-cyan-200">
                    Các khung giờ này được áp dụng trực tiếp cho giáo án. PT không cần chọn lại ca nhỏ.
                  </p>
                </div>
              )}
              {bookedSlots.length === 0 && (() => {
                const available = allAvailableSlots.filter(s => !s.isFull)
                const bookedMatching = bookedSlots.length > 0
                  ? available.filter(s => bookedSlots.some(b =>
                      b.dayOfWeek === s.dayOfWeek && slotOverlapsPrefs(`${s.startTime}-${s.endTime}`, [b.slot])))
                  : []
                const pool = bookedSlots.length > 0 && bookedMatching.length > 0 ? bookedMatching : available
                const matched: SuggestedSlot[] = []
                const unmatched: SuggestedSlot[] = []
                for (const s of pool) {
                  const timeOk = !hasTimePref || slotOverlapsPrefs(s.time, preferredTimeSlots)
                  const dayOk = !hasDayPref || preferredDaysOfWeek.includes(s.dayOfWeek)
                  ;(timeOk && dayOk ? matched : unmatched).push(s)
                }
                const noSlots = matched.length === 0 && unmatched.length === 0
                const selectSlot = (slot: SuggestedSlot) => {
                  if (bookedSlots.length > 0) {
                    const bookingIndex = bookedSlots.findIndex((booking) =>
                      booking.dayOfWeek === slot.dayOfWeek
                      && slotOverlapsPrefs(`${slot.startTime}-${slot.endTime}`, [booking.slot]))
                    if (bookingIndex >= 0) {
                      handleSlotClick(slot, bookingIndex + 1)
                      return
                    }
                  }
                  const free = [...Array(neededSlots).keys()].map(k => k + 1).filter(d => !dayOrderDow.has(d))
                  if (free.length > 0) handleSlotClick(slot, free[0])
                }

                const renderBookedSlotButton = (slot: SuggestedSlot, bookingIndex: number) => {
                  const dayOrder = bookingIndex + 1
                  const selectedInfo = slotInfoRef.current.get(dayOrder)
                  const selected = selectedInfo?.startTime === slot.startTime && selectedInfo?.endTime === slot.endTime
                  return (
                    <button key={`${slot.dayOfWeek}-${slot.time}`} type="button"
                      onClick={() => handleSlotClick(slot, dayOrder)}
                      className="flex min-h-[64px] items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-xs transition-all hover:border-[var(--theme-accent)]"
                      style={{
                        borderColor: selected ? 'var(--theme-accent)' : 'var(--gs-border)',
                        background: selected ? 'color-mix(in srgb, var(--theme-accent) 15%, transparent)' : undefined,
                      }}
                    >
                      <div>
                        <p className="font-semibold text-[var(--gs-text)]">{slot.startTime} - {slot.endTime}</p>
                        {slot.className && <p className="mt-0.5 text-[11px] text-[var(--gs-text-muted)]">{slot.className}</p>}
                      </div>
                      <Tag color={selected ? 'purple' : 'default'} className="m-0 text-[10px]">
                        {selected ? 'Đang chọn' : 'Chọn'}
                      </Tag>
                    </button>
                  )
                }

                const renderSlotBtn = (slot: SuggestedSlot) => {
                  const usedByDayOrder = Array.from(dayOrderDow.entries()).find(([dayOrder, dow]) => {
                    if (dow !== slot.dayOfWeek) return false
                    const si = slotInfoRef.current.get(dayOrder)
                    return si?.startTime === slot.startTime && si?.endTime === slot.endTime
                  })?.[0]
                  return (
                    <button key={`${slot.dayOfWeek}-${slot.time}`} type="button"
                      onClick={() => selectSlot(slot)}
                      className="flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-left text-xs transition-all hover:bg-green-500/10"
                      style={{ borderColor: usedByDayOrder ? 'var(--theme-accent)' : '#22C55E', background: usedByDayOrder ? 'color-mix(in srgb, var(--theme-accent) 15%, transparent)' : undefined }}
                    >
                      <ClockCircleOutlined style={{ color: '#22C55E' }} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[var(--gs-text)]">{formatDayLabel(slot.dayOfWeek)}</span>
                          {usedByDayOrder ? <Tag className="m-0 text-[10px] leading-none" color="blue" style={{ fontSize: 10, lineHeight: '16px' }}>Đã gán cho buổi {usedByDayOrder}</Tag> : <span className="text-[10px] text-green-500">Chọn ca này</span>}
                        </div>
                        <div className="text-green-400">{slot.startTime} - {slot.endTime}</div>
                        {slot.className && <div className="text-[var(--gs-text-muted)]">{slot.className}</div>}
                      </div>
                    </button>
                  )
                }

                const renderUnmatchedSlot = (slot: SuggestedSlot) => {
                  const usedByDayOrder = Array.from(dayOrderDow.entries()).find(([dayOrder, dow]) => {
                    if (dow !== slot.dayOfWeek) return false
                    const si = slotInfoRef.current.get(dayOrder)
                    return si?.startTime === slot.startTime && si?.endTime === slot.endTime
                  })?.[0]
                  return (
                    <button key={`${slot.dayOfWeek}-${slot.time}`} type="button"
                      onClick={() => selectSlot(slot)}
                      className="flex items-center gap-2 rounded-lg border-2 border-[var(--gs-border)] px-3 py-2 text-left text-xs transition-all hover:bg-blue-500/10"
                      style={{ background: usedByDayOrder ? 'color-mix(in srgb, var(--theme-accent) 10%, transparent)' : undefined, borderColor: usedByDayOrder ? 'var(--theme-accent)' : undefined }}
                    >
                      <ClockCircleOutlined style={{ color: 'var(--gs-text-muted)' }} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[var(--gs-text)]">{formatDayLabel(slot.dayOfWeek)}</span>
                          {usedByDayOrder
                            ? <Tag className="m-0 text-[10px] leading-none" color="blue" style={{ fontSize: 10, lineHeight: '16px' }}>Đã gán cho buổi {usedByDayOrder}</Tag>
                            : <span className="text-[10px] text-[var(--gs-text-muted)]">Có thể chọn</span>}
                        </div>
                        <div className="text-[var(--gs-text)]">{slot.startTime} - {slot.endTime}</div>
                        {slot.className && <div className="text-[var(--gs-text-muted)]">{slot.className}</div>}
                      </div>
                    </button>
                  )
                }

                return (
                  <>
                    {noSlots && hasAnyPref && <p className="mb-2 text-xs text-[var(--gs-text-muted)]">Không có khung giờ nào phù hợp.</p>}
                    {noSlots && !hasAnyPref && (
                      <p className="mb-2 text-xs text-[var(--gs-text-muted)]">
                        {allAvailableSlots.length === 0
                          ? 'Bạn chưa dạy lớp nhóm nào và chưa có lịch làm việc (TrainerSchedule) để gợi ý khung giờ. Vui lòng cập nhật lịch làm việc trong "Lịch dạy" trước.'
                          : 'Tất cả các ca đã đầy.'}
                      </p>
                    )}
                    {bookedSlots.length > 0 && (matched.length > 0 || unmatched.length > 0) && (
                      <p className="mb-2 text-xs text-[var(--gs-text-muted)]">Chọn ca PT phù hợp trong khung giờ hội viên đã đặt</p>
                    )}
                    {bookedSlots.length > 0 ? (
                      <div className="grid gap-3 lg:grid-cols-2">
                        {bookedSlots.map((booking, bookingIndex) => {
                          const candidates = matched.filter((slot) =>
                            slot.dayOfWeek === booking.dayOfWeek
                            && slotOverlapsPrefs(`${slot.startTime}-${slot.endTime}`, [booking.slot]))
                          return (
                            <div key={`${booking.dayOfWeek}-${booking.slot}`} className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card-soft)] p-3">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-[var(--gs-text)]">Buổi {bookingIndex + 1}: {formatDayLabel(booking.dayOfWeek)}</span>
                                <Tag color="cyan" className="m-0 text-[10px]">{booking.slot.replace('-', ' - ')}</Tag>
                              </div>
                              {candidates.length > 0 ? (
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {candidates.map((slot) => renderBookedSlotButton(slot, bookingIndex))}
                                </div>
                              ) : (
                                <p className="text-xs text-[var(--gs-text-muted)]">Chưa có ca PT khả dụng trong khung giờ này.</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {matched.map(s => renderSlotBtn(s))}
                        {unmatched.map(s => renderUnmatchedSlot(s))}
                      </div>
                    )}
                  </>
                )
              })()}
            </div>
          )}

          {/* ── Section 4: Scheduled days ── */}
          {scheduleDays.length > 0 && (
            <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-5">
              <p className="mb-3 text-sm font-semibold text-[var(--gs-text)]">
                Các buổi tập {allFilled ? '✅ Đã đủ lịch' : ''}
              </p>
              {weeks.map(([cycleIndex, items]) => {
                const validDates = items.filter(it => it.date).map(it => it.date!)
                const ws = validDates[0]; const we = validDates[validDates.length - 1]
                const isCollapsed = collapsedWeeks.has(cycleIndex)
                return (
                  <div key={cycleIndex} className="mb-2 rounded-lg border border-[var(--gs-border)] overflow-hidden">
                    <button type="button" className="flex w-full items-center justify-between bg-[var(--gs-card-soft)] px-4 py-2.5 text-left hover:bg-[var(--gs-border)]/30 transition-colors"
                      onClick={() => setCollapsedWeeks(prev => { const n = new Set(prev); if (n.has(cycleIndex)) n.delete(cycleIndex); else n.add(cycleIndex); return n })}>
                      <span className="text-sm font-semibold text-[var(--gs-text)]">
                        {isRepeating ? `Tuần ${cycleIndex + 1}` : 'Buổi tập'}
                        {ws && we && <span className="ml-2 text-xs font-normal text-[var(--gs-text-muted)]">({ws.format('DD/MM')} - {we.format('DD/MM')})</span>}
                      </span>
                      <span className="text-xs text-[var(--gs-text-muted)]">{items.length} buổi{isCollapsed ? <DownOutlined className="ml-2" /> : <UpOutlined className="ml-2" />}</span>
                    </button>
                    {!isCollapsed && (
                      <div className="space-y-2 p-3">
                        {items.map((day, i) => {
                          const position = ((day.dayOrder - 1) % (neededSlots || 1)) + 1
                          return (
                            <div key={i} className="rounded-lg border border-[var(--gs-border)] p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2"><span className="text-sm font-semibold text-[var(--gs-text)]">Buổi {day.dayOrder}</span><Tag className="m-0 text-xs">{day.title}</Tag><span className="text-xs text-[var(--gs-text-muted)]">{day.exercises.length} bài tập</span></div>
                                {dayOrderDow.has(position) ? <Button size="small" danger type="text" onClick={() => handleClearSlot(position)}>Bỏ</Button> : <span className="text-xs text-[var(--gs-text-muted)]">Chưa chọn giờ</span>}
                              </div>
                              {day.time && day.date && (
                                <div className="mt-1 space-y-0.5">
                                  <div className="flex items-center gap-2 text-xs text-green-400"><CheckCircleFilled />{formatDayLabel(day.date.day())}, {day.date.format('DD/MM/YYYY')}<span className="text-[var(--gs-text-muted)]">{day.time.format('HH:mm')}{day.endTime ? ` - ${day.endTime}` : ''}</span></div>
                                  {day.className && <div className="text-xs text-[var(--gs-text-muted)]">📍 {day.className}{day.classCode ? ` (${day.classCode})` : ''}</div>}
                                </div>
                              )}
                              <div className="mt-2 flex flex-wrap gap-1">{day.exercises.map((ex, ei) => <Tag key={ei} className="text-xs">{ex.name}{ex.note ? ` (${ex.note})` : ''}</Tag>)}</div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {selectedTemplateId && startDate && (
          <div className="cs-footer mt-6 flex justify-end gap-3 border-t border-[var(--gs-border)] pt-4">
            <Button onClick={() => navigate('/pt/clients')} className="max-[767px]:min-h-[44px]">Hủy</Button>
            <Button type="primary" size="large" loading={submitting} disabled={!allFilled} onClick={handleSubmit} className="max-[767px]:min-h-[44px]">
              {isRepeating ? `Tạo lịch tập (${weeks.length} tuần)` : 'Tạo lịch tập'}
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
