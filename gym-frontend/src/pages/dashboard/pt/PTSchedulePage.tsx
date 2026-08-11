import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, DatePicker, Empty, Input, List, Select, Spin, Tag, message, Modal } from 'antd'
import { BookOutlined, CheckCircleFilled, ClockCircleOutlined, LeftOutlined, RightOutlined, SwapOutlined, UserOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { useAuth } from '../../../hooks/useAuth'
import { trainerService, type PTWeekBooking, type WeekAttendee, type WeekAttendeeMember } from '../../../services/trainerService'
import { shiftChangeService, type ScheduleReplacement, type ShiftChangeRequest } from '../../../services/shiftChangeService'
import { socketService } from '../../../services/socketService'
import { useTheme } from '../../../context/ThemeProvider'
import { scheduleService } from '../../../services/scheduleService'
import { workoutService, type LibraryWorkout } from '../../../services/workoutService'
import type { TrainingClass } from '../../../services/trainingGroupService'

function getFloorName(f: string | { _id: string; name: string } | undefined): string {
  if (!f) return ''
  return typeof f === 'object' ? f.name : ''
}
function getZoneName(z: string | { _id: string; name: string } | undefined): string {
  if (!z) return ''
  return typeof z === 'object' ? z.name : ''
}

function bookingMemberName(b: PTWeekBooking): string {
  if (typeof b.memberId === 'object' && b.memberId) return b.memberId.name || 'Hội viên'
  return 'Hội viên'
}

const DAY_LABEL_MAP_VN = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']

// Thứ Hai của tuần chứa d — không phụ thuộc locale dayjs (vi locale có weekStart=1)
const startOfVnWeek = (d: dayjs.Dayjs) => d.subtract((d.day() + 6) % 7, 'day').startOf('day')

// Trạng thái yêu cầu thay ca đang "mở" → khóa đúng ca đã gửi
const ACTIVE_REQUEST_STATUSES = ['pending', 'waiting_assignment', 'assigned', 'accepted']

interface ModalClassOption {
  key: string
  classId: string
  name: string
  startTime: string
  endTime: string
  floorName: string
  zoneName: string
  isReplacement: boolean
}

export default function PTSchedulePage() {
  const { dark } = useTheme()
  const { user } = useAuth()
  const [classes, setClasses] = useState<TrainingClass[]>([])
  const [swapModalOpen, setSwapModalOpen] = useState(false)
  const [swapDate, setSwapDate] = useState<dayjs.Dayjs | null>(null)
  const [swapReason, setSwapReason] = useState('')
  const [swapSubmitting, setSwapSubmitting] = useState(false)
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set())

  // Gán giáo án cho lớp nhóm
  const [classStatusMap, setClassStatusMap] = useState<Record<string, { assignedCount: number; totalMembers: number }>>({})
  const [assignModal, setAssignModal] = useState<{ open: boolean; trainingClass: TrainingClass | null }>({ open: false, trainingClass: null })
  const [templates, setTemplates] = useState<LibraryWorkout[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>()
  const [assignSubmitting, setAssignSubmitting] = useState(false)
  const [assignResult, setAssignResult] = useState<Awaited<ReturnType<typeof scheduleService.groupAssign>>['data'] | null>(null)

  // Week picker: default to Monday of current week
  const [weekStart, setWeekStart] = useState(() => startOfVnWeek(dayjs()))
  const [attendees, setAttendees] = useState<WeekAttendee[]>([])
  const [replacements, setReplacements] = useState<ScheduleReplacement[]>([])
  const [weekBookings, setWeekBookings] = useState<PTWeekBooking[]>([])
  const [myRequests, setMyRequests] = useState<ShiftChangeRequest[]>([])
  const [modalReplacements, setModalReplacements] = useState<ScheduleReplacement[]>([])
  const [memberModal, setMemberModal] = useState<{ open: boolean; title: string; members: WeekAttendeeMember[] }>({ open: false, title: '', members: [] })

  const goPrevWeek = () => setWeekStart(prev => prev.subtract(7, 'day'))
  const goNextWeek = () => setWeekStart(prev => prev.add(7, 'day'))
  const goCurrentWeek = () => setWeekStart(startOfVnWeek(dayjs()))

  const weekLabel = `${weekStart.format('DD/MM')} - ${weekStart.add(6, 'day').format('DD/MM/YYYY')}`
  const isCurrentWeek = weekStart.isSame(startOfVnWeek(dayjs()), 'day')

  const loadClasses = async () => {
    try {
      const res = await trainerService.getPTMyClasses()
      const data = res.data?.classes || []
      setClasses(data)
      const entries = await Promise.all(
        data.map(async (c: TrainingClass) => {
          try {
            const sres = await scheduleService.getClassSchedules(String(c._id))
            return [String(c._id), { assignedCount: sres.data.assignedCount, totalMembers: sres.data.totalMembers }] as const
          } catch {
            return [String(c._id), { assignedCount: 0, totalMembers: 0 }] as const
          }
        })
      )
      setClassStatusMap(Object.fromEntries(entries))
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => { loadClasses() }, [])

  // Fetch attendees + lịch PT 1-1 (booking) cho tuần được chọn
  const loadAttendees = useCallback(async () => {
    const weekKey = weekStart.format('YYYY-MM-DD')
    try {
      const res = await trainerService.getPTMyWeekAttendees(weekKey)
      setAttendees(res.data?.attendees || [])
      setReplacements(res.data?.replacements || [])
    } catch {
      // silent
    }
    try {
      const res = await trainerService.getPTMyWeekBookings(weekKey)
      setWeekBookings(res.data?.bookings || [])
    } catch {
      setWeekBookings([])
    }
  }, [weekStart])

  useEffect(() => { loadAttendees() }, [loadAttendees])

  // Realtime: cập nhật lịch ngay khi có thay ca liên quan (admin gán / PT chấp nhận)
  useEffect(() => {
    socketService.connect()
    const handler = () => { loadAttendees() }
    socketService.on('shift_change:my_updated', handler)
    socketService.on('pt_request_updated', handler)
    return () => {
      socketService.off('shift_change:my_updated', handler)
      socketService.off('pt_request_updated', handler)
    }
  }, [loadAttendees])

  // Yêu cầu thay ca của PT để khóa đúng ca đã gửi (PT + Class + Date)
  const loadMyRequests = useCallback(async () => {
    try {
      const res = await shiftChangeService.getMyRequests()
      setMyRequests(res.data?.requests || [])
    } catch {
      // silent
    }
  }, [])

  useEffect(() => { loadMyRequests() }, [loadMyRequests])

  // Ca đã có yêu cầu thay ca đang mở → khóa: key = "YYYY-MM-DD_classId"
  const lockedClassKeys = useMemo(() => {
    const set = new Set<string>()
    for (const req of myRequests) {
      if (!ACTIVE_REQUEST_STATUSES.includes(req.status)) continue
      const dk = dayjs(req.targetDate).format('YYYY-MM-DD')
      for (const it of req.items || []) {
        if (!it.classId) continue
        set.add(`${dk}_${String(it.classId)}`)
      }
    }
    return set
  }, [myRequests])

  // Lấy ca thay (ScheduleReplacement) cho tuần chứa ngày được chọn trong modal
  useEffect(() => {
    if (!swapDate) { setModalReplacements([]); return }
    const monday = startOfVnWeek(dayjs(swapDate))
    shiftChangeService.getMyReplacements(monday.format('YYYY-MM-DD'))
      .then(res => setModalReplacements(res.data?.replacements || []))
      .catch(() => setModalReplacements([]))
  }, [swapDate])

  // Build lookup: "dayOfWeek_classCode" -> WeekAttendee
  const attendeesMap = useMemo(() => {
    const map = new Map<string, WeekAttendee>()
    for (const a of attendees) {
      map.set(`${a.dayOfWeek}_${a.code}`, a)
    }
    return map
  }, [attendees])

  // Build lookup: "YYYY-MM-DD_classId" -> ScheduleReplacement (thay ca còn hiệu lực)
  const replacementsMap = useMemo(() => {
    const map = new Map<string, ScheduleReplacement>()
    for (const r of replacements) {
      const classId = typeof r.classId === 'object' ? r.classId?._id : r.classId
      if (!classId) continue
      const key = `${dayjs(r.date).format('YYYY-MM-DD')}_${classId}`
      if (!map.has(key)) map.set(key, r)
    }
    return map
  }, [replacements])

  const isReplacingMe = (r: ScheduleReplacement) => String(r.replacementTrainerId) === String(user?._id)

  // Ca thay PT B đã chấp nhận (status=approved, còn hiệu lực) — keyed theo YYYY-MM-DD
  const myReplacementForDate = useMemo(() => {
    const map = new Map<string, ScheduleReplacement[]>()
    for (const r of replacements) {
      if (!isReplacingMe(r)) continue
      const key = dayjs(r.date).format('YYYY-MM-DD')
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.startTime || a.classStartTime || '').localeCompare(b.startTime || b.classStartTime || ''))
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replacements, user?._id])

  // Toàn bộ ca của ngày được chọn (từ lịch PT): ca chính + ca thay PT đã nhận
  const modalClasses = useMemo(() => {
    if (!swapDate) return []
    const dow = swapDate.day()
    const dateKey = swapDate.format('YYYY-MM-DD')
    const seen = new Set<string>()
    const options: ModalClassOption[] = []
    for (const c of classes) {
      if (!c.daysOfWeek.includes(dow)) continue
      seen.add(String(c._id))
      options.push({
        key: `own_${c._id}`,
        classId: String(c._id),
        name: c.name || '',
        startTime: c.startTime || '',
        endTime: c.endTime || '',
        floorName: getFloorName(c.floorId),
        zoneName: getZoneName(c.zoneId),
        isReplacement: false,
      })
    }
    for (const r of modalReplacements) {
      if (!isReplacingMe(r)) continue
      if (dayjs(r.date).format('YYYY-MM-DD') !== dateKey) continue
      const cid = typeof r.classId === 'object' ? r.classId?._id : r.classId
      if (!cid || seen.has(String(cid))) continue
      seen.add(String(cid))
      options.push({
        key: `repl_${r._id}`,
        classId: String(cid),
        name: r.className || '',
        startTime: r.startTime || r.classStartTime || '',
        endTime: r.endTime || r.classEndTime || '',
        floorName: r.floorName || '',
        zoneName: r.zoneName || '',
        isReplacement: true,
      })
    }
    return options.sort((a, b) => a.startTime.localeCompare(b.startTime))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapDate, classes, modalReplacements, user?._id])

  const toggleClass = (id: string) => {
    if (!swapDate) return
    const dk = swapDate.format('YYYY-MM-DD')
    if (lockedClassKeys.has(`${dk}_${id}`)) return
    setSelectedClassIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (!swapDate) return
    const dk = swapDate.format('YYYY-MM-DD')
    setSelectedClassIds(new Set(modalClasses.filter(o => !lockedClassKeys.has(`${dk}_${o.classId}`)).map(o => o.classId)))
  }
  const deselectAll = () => setSelectedClassIds(new Set())

  // Chỉ tính ca thật sự được phép gửi (loại ca đã khóa)
  const validSelectedClassIds = useMemo(() => {
    if (!swapDate) return new Set<string>()
    const dk = swapDate.format('YYYY-MM-DD')
    return new Set(Array.from(selectedClassIds).filter(id => !lockedClassKeys.has(`${dk}_${id}`)))
  }, [selectedClassIds, swapDate, lockedClassKeys])

  const selectedCount = validSelectedClassIds.size
  const hasSelected = selectedCount > 0

  const handleSwapSubmit = async () => {
    if (!swapDate || !hasSelected) { message.warning('Vui lòng chọn ngày và ít nhất 1 ca chưa gửi yêu cầu'); return }
    setSwapSubmitting(true)
    try {
      await shiftChangeService.create({
        targetDate: swapDate.format('YYYY-MM-DD'),
        reason: swapReason,
        classIds: Array.from(validSelectedClassIds),
      })
      message.success('Đã gửi yêu cầu thay ca')
      setSwapModalOpen(false)
      resetForm()
      loadMyRequests()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      message.error(e?.response?.data?.message || 'Gửi yêu cầu thất bại')
    } finally {
      setSwapSubmitting(false)
    }
  }

  const resetForm = () => {
    setSwapDate(null)
    setSwapReason('')
    setSelectedClassIds(new Set())
  }

  const openAssignModal = async (c: TrainingClass) => {
    setAssignResult(null)
    setSelectedTemplateId(undefined)
    setAssignModal({ open: true, trainingClass: c })
    setTemplatesLoading(true)
    try {
      const res = await workoutService.getSharedTemplates({ limit: 100 })
      setTemplates(res.data?.workouts || [])
    } catch {
      message.error('Không tải được danh sách giáo án')
    } finally {
      setTemplatesLoading(false)
    }
  }

  // Preview: các buổi của template trùng lịch học của lớp + ngày sắp tới
  const assignPreview = useMemo(() => {
    const cls = assignModal.trainingClass
    if (!cls) return null
    const tpl = templates.find(t => t._id === selectedTemplateId)
    if (!tpl) return null
    const classDays = cls.daysOfWeek || []
    const now = dayjs()
    const days = (tpl.days || [])
      .filter(d => classDays.includes(d.dayOfWeek))
      .map(d => {
        const diff = (d.dayOfWeek - now.day() + 7) % 7
        let date = now.add(diff, 'day').startOf('day')
        if (date.isSame(now.startOf('day'), 'day') && now.format('HH:mm') >= (cls.startTime || '23:59')) {
          date = date.add(7, 'day')
        }
        return { ...d, date }
      })
    return { tpl, days }
  }, [assignModal.trainingClass, templates, selectedTemplateId])

  const assignClassStatus = assignModal.trainingClass
    ? classStatusMap[String(assignModal.trainingClass._id)] || { assignedCount: 0, totalMembers: 0 }
    : { assignedCount: 0, totalMembers: 0 }

  const handleAssignSubmit = async () => {
    const cls = assignModal.trainingClass
    if (!cls || !selectedTemplateId) { message.warning('Vui lòng chọn giáo án'); return }
    setAssignSubmitting(true)
    try {
      const res = await scheduleService.groupAssign(String(cls._id), selectedTemplateId)
      setAssignResult(res.data)
      message.success(res.data.message || 'Gán giáo án thành công')
      loadClasses()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      message.error(e?.response?.data?.message || 'Gán giáo án thất bại')
    } finally {
      setAssignSubmitting(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="rounded-[28px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-8 max-[640px]:p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">LỊCH PT</p>
          <div className="flex items-center justify-between mt-3">
            <h1 className="text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">Lịch làm việc</h1>
            <Button type="primary" icon={<SwapOutlined />} onClick={() => { loadMyRequests(); setSwapModalOpen(true) }}>
              Yêu cầu thay ca
            </Button>
          </div>
          <p className="mt-2 text-sm text-[var(--gs-text-muted)]">Quản lý lịch làm việc hàng tuần</p>
        </div>

        <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-6">
          <div className="pt-schedule-header flex items-center justify-between max-[767px]:flex-col max-[767px]:items-start max-[767px]:gap-2 mb-4">
            <h2 className="pt-schedule-title text-lg font-semibold text-[var(--gs-text)] max-[767px]:text-lg">Lịch làm việc tuần</h2>
            <div className="pt-schedule-nav flex items-center gap-2 max-[767px]:w-full max-[767px]:justify-between">
              <Button size="small" icon={<LeftOutlined />} onClick={goPrevWeek} className="max-[767px]:min-h-[36px]" />
              <Button size="small" type={isCurrentWeek ? 'primary' : 'default'} onClick={goCurrentWeek} className="max-[767px]:min-h-[36px]">
                Tuần này
              </Button>
              <span className="pt-schedule-week-label text-sm text-[var(--gs-text-muted)] min-w-[130px] text-center max-[767px]:text-xs">{weekLabel}</span>
              <Button size="small" icon={<RightOutlined />} onClick={goNextWeek} className="max-[767px]:min-h-[36px]" />
            </div>
          </div>
          <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3">
            {Array.from({ length: 7 }, (_, idx) => idx).map((idx) => {
              const actualDate = weekStart.add(idx, 'day')
              const dayLabel = DAY_LABEL_MAP_VN[actualDate.day()]
              const dateStr = actualDate.format('DD/MM')
              const dateKey = actualDate.format('YYYY-MM-DD')
              const dayClasses = classes
                .filter(c => c.daysOfWeek.includes(actualDate.day()))
                .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
              const mainClassIds = new Set(dayClasses.map(c => String(c._id)))
              const myRepls = (myReplacementForDate.get(dateKey) || []).filter(r => {
                const cid = typeof r.classId === 'object' ? r.classId?._id : r.classId
                if (cid && mainClassIds.has(String(cid))) return false
                // PT gốc đã kết thúc phụ trách lớp → chỉ render khi lớp còn >= 2 hội viên (realtime)
                if (r.originalTrainerActive === false) {
                  const count = attendeesMap.get(`${actualDate.day()}_${r.classCode || ''}`)?.count ?? 0
                  if (count < 2) return false
                }
                return true
              })
              const dayBookingList = weekBookings
                .filter((b) => dayjs(b.date).format('YYYY-MM-DD') === dateKey)
                .sort((a, b) => String(a.slot || '').localeCompare(String(b.slot || '')))
              const hasAny = dayClasses.length > 0 || myRepls.length > 0 || dayBookingList.length > 0
              return (
                <div key={idx} className="flex flex-col sm:flex-row gap-4 p-4 items-start rounded-lg border border-[var(--gs-border)]">
                  <div className="w-40 shrink-0">
                    <p className="text-lg font-bold text-slate-100">{dayLabel}</p>
                    <p className="text-xs text-[var(--gs-text-muted)]">{dateStr}</p>
                  </div>
                  <div className="flex-1 w-full">
                    {!hasAny ? (
                      <div className="border border-dashed border-zinc-800 rounded-lg p-4 text-center text-zinc-500 text-sm">🏝️ Không có lịch</div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {dayClasses.map((c, i) => {
                          const attendee = attendeesMap.get(`${actualDate.day()}_${c.code || ''}`)
                          const count = attendee?.count ?? 0
                          const repl = replacementsMap.get(`${dateKey}_${c._id}`)
                          const cs = classStatusMap[String(c._id)] || { assignedCount: 0, totalMembers: 0 }
                          return (
                            <div key={c._id}>
                              {i > 0 && <div className="border-t border-zinc-800 pt-4 mb-0" />}
                              <div
                                className={`space-y-1.5 rounded-xl px-3 py-2 -mx-3 ${
                                  repl && !isReplacingMe(repl)
                                    ? 'bg-amber-400/10 border border-amber-400/30'
                                    : ''
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <p className="font-bold text-green-500">{c.startTime || '--:--'} - {c.endTime || '--:--'}</p>
                                  <div className="flex items-center gap-2">
                                    {repl && !isReplacingMe(repl) && (
                                      <Tag
                                        className="m-0 text-[11px] font-medium bg-amber-400/20 text-amber-300 border-amber-400/40"
                                        color="gold"
                                      >
                                        🔁 Thay ca
                                      </Tag>
                                    )}
                                    <div
                                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors ${
                                        count > 0
                                          ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                                          : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                      }`}
                                      onClick={() => {
                                        if (count > 0 && attendee) {
                                          setMemberModal({ open: true, title: `${c.name} • ${dayLabel} ${dateStr} • ${c.startTime}-${c.endTime}`, members: attendee.members })
                                        }
                                      }}
                                    >
                                      <UserOutlined />
                                      <span>{count > 0 ? `${count} hội viên` : '0 hội viên'}</span>
                                    </div>
                                  </div>
                                </div>
                                <p className="font-medium text-[var(--gs-text)]">{c.name}</p>
                                <div className="flex items-center justify-between gap-2">
                                  <Tag
                                    className="m-0 text-[11px]"
                                    color={cs.assignedCount > 0 ? 'green' : 'default'}
                                  >
                                    {cs.assignedCount > 0
                                      ? `Giáo án: ${cs.assignedCount}/${cs.totalMembers} hội viên`
                                      : 'Chưa gán giáo án'}
                                  </Tag>
                                  <Button
                                    size="small"
                                    type="link"
                                    icon={<BookOutlined />}
                                    disabled={c.status !== 'active'}
                                    onClick={() => openAssignModal(c)}
                                    className="!text-[var(--theme-accent)]"
                                  >
                                    Gán giáo án
                                  </Button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                    style={{ background: dark ? 'rgba(182,70,47,0.2)' : 'rgba(182,70,47,0.12)', color: dark ? 'rgb(235,130,100)' : 'rgb(150,55,35)' }}>
                                    {c.specialization || 'GYM'}
                                  </span>
                                  {repl && !isReplacingMe(repl) && (
                                    <span className="text-[11px] text-amber-300/90">Do PT khác đứng lớp hôm này</span>
                                  )}
                                </div>
                                <p className="text-xs text-[var(--gs-text-muted)]">📍 {[getFloorName(c.floorId), getZoneName(c.zoneId)].filter(Boolean).join(' - ')}</p>
                              </div>
                            </div>
                          )
                        })}
                        {myRepls.map((r) => {
                          const replAttendee = attendeesMap.get(`${actualDate.day()}_${r.classCode || ''}`)
                          const replCount = replAttendee?.count ?? 0
                          return (
                            <div key={`repl-${r._id}`}>
                              <div className="space-y-1.5 rounded-xl px-3 py-2 -mx-3 border border-yellow-400/60 bg-yellow-400/10">
                                <div className="flex items-center justify-between">
                                  <p className="font-bold text-yellow-400">{r.startTime || r.classStartTime || '--:--'} - {r.endTime || r.classEndTime || '--:--'}</p>
                                  <div className="flex items-center gap-2">
                                    <Tag className="m-0 text-[11px] font-medium bg-yellow-400/20 text-yellow-300 border-yellow-400/50" color="gold">
                                      Ca thay
                                    </Tag>
                                    <div
                                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors ${
                                        replCount > 0
                                          ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                                          : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                      }`}
                                      onClick={() => {
                                        if (replCount > 0 && replAttendee) {
                                          setMemberModal({ open: true, title: `${r.className} • ${dayLabel} ${dateStr} • ${r.startTime || r.classStartTime || '--:--'}-${r.endTime || r.classEndTime || '--:--'}`, members: replAttendee.members })
                                        }
                                      }}
                                    >
                                      <UserOutlined />
                                      <span>{replCount > 0 ? `${replCount} hội viên` : '0 hội viên'}</span>
                                    </div>
                                  </div>
                                </div>
                                <p className="font-medium text-[var(--gs-text)]">{r.className}</p>
                                <div className="flex items-center gap-2">
                                  <span
                                    className="inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                    style={{ background: dark ? 'rgba(234,179,8,0.2)' : 'rgba(234,179,8,0.12)', color: dark ? 'rgb(253,224,71)' : 'rgb(161,98,7)' }}
                                  >
                                    {r.specialization || 'GYM'}
                                  </span>
                                  {r.originalTrainerName && (
                                    <span className="text-[11px] text-yellow-300/90">Thay cho PT {r.originalTrainerName}</span>
                                  )}
                                </div>
                                <p className="text-xs text-[var(--gs-text-muted)]">📍 {[r.floorName, r.zoneName].filter(Boolean).join(' - ')}</p>
                              </div>
                            </div>
                          )
                        })}
                      {dayBookingList.map((b) => (
                          <div key={`pt11-${b._id}`}>
                            <div className="space-y-1.5 rounded-xl px-3 py-2 -mx-3 border border-blue-500/40 bg-blue-500/10">
                              <div className="flex items-center justify-between">
                                <p className="font-bold text-sky-400">{String(b.slot || '').replace('-', ' - ')}</p>
                                <Tag className="m-0 text-[11px] font-medium bg-blue-500/20 text-sky-300 border-blue-500/40" color="blue">
                                  Lịch PT 1-1
                                </Tag>
                              </div>
                              <p className="font-medium text-[var(--gs-text)]">
                                <UserOutlined className="mr-1.5 text-sky-400" />
                                {bookingMemberName(b)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <Modal
        title="Yêu cầu thay ca"
        open={swapModalOpen}
        onCancel={() => { setSwapModalOpen(false); resetForm() }}
        onOk={handleSwapSubmit}
        confirmLoading={swapSubmitting}
        okText="Gửi yêu cầu"
        okButtonProps={{ disabled: !swapDate || !hasSelected }}
        width={560}
      >
        <div className="space-y-4 pt-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--gs-text)]">Ngày cần thay ca</label>
            <DatePicker className="w-full" value={swapDate} onChange={(val) => { setSwapDate(val); setSelectedClassIds(new Set()) }}
              disabledDate={(d) => d.isBefore(dayjs(), 'day')} placeholder="Chọn ngày" />
          </div>

          {swapDate && modalClasses.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-[var(--gs-text)]">
                  Chọn ca cần đổi — {DAY_LABEL_MAP_VN[swapDate.day()]}, {swapDate.format('DD/MM/YYYY')}
                </label>
                <div className="flex gap-1">
                  <Button size="small" type="link" onClick={selectAll}>Chọn tất cả</Button>
                  <Button size="small" type="link" onClick={deselectAll}>Bỏ chọn</Button>
                </div>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {modalClasses.map(o => {
                  const locked = lockedClassKeys.has(`${swapDate!.format('YYYY-MM-DD')}_${o.classId}`)
                  const loc = [o.floorName, o.zoneName].filter(Boolean).join(' - ')
                  const checked = validSelectedClassIds.has(o.classId)
                  return (
                    <label key={o.key}
                      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                        locked
                          ? 'border-[var(--gs-border)] bg-[var(--gs-card-soft)] opacity-60 cursor-not-allowed'
                          : checked
                            ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)] cursor-pointer'
                            : 'border-[var(--gs-border)] hover:border-[var(--theme-accent)] cursor-pointer'
                      }`}
                    >
                      <Checkbox checked={checked} disabled={locked} onChange={() => toggleClass(o.classId)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${locked ? 'text-[var(--gs-text-muted)]' : 'text-[var(--gs-text)]'}`}>
                            {o.startTime || '--:--'} - {o.endTime || '--:--'}
                          </span>
                          <Tag className="m-0 text-[11px]" color={o.isReplacement ? 'gold' : 'blue'}>{o.name}</Tag>
                          {o.isReplacement && <span className="text-[10px] font-medium text-amber-400/90">Ca thay</span>}
                        </div>
                        {loc && <p className="mt-0.5 text-xs text-[var(--gs-text-muted)]">📍 {loc}</p>}
                        {locked && (
                          <p className="mt-1 text-[11px] font-medium text-amber-500">
                            <ClockCircleOutlined className="mr-1" />
                            Đã gửi yêu cầu thay ca
                          </p>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {swapDate && modalClasses.length === 0 && (
            <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card-soft)] px-3 py-2">
              <p className="text-xs text-[var(--gs-text-muted)]">Không có ca dạy nào vào ngày này.</p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--gs-text)]">Lý do <span className="text-[var(--gs-text-muted)] font-normal">(không bắt buộc)</span></label>
            <Input.TextArea rows={2} value={swapReason} onChange={e => setSwapReason(e.target.value)} placeholder="VD: Có việc cá nhân, sức khỏe..." />
          </div>

          {hasSelected && swapDate && (
            <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card-soft)] px-3 py-2">
              <p className="text-xs text-[var(--gs-text-muted)]">
                Hệ thống sẽ gửi yêu cầu đổi{' '}
                <strong className="text-[var(--gs-text)]">{selectedCount} ca</strong>{' '}
                ({modalClasses.filter(o => validSelectedClassIds.has(o.classId)).map(o => `${o.startTime}-${o.endTime}, ${o.name}`).join('; ')})
                {' '}vào {DAY_LABEL_MAP_VN[swapDate.day()]}, {swapDate.format('DD/MM/YYYY')} lên admin duyệt.
              </p>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        title={memberModal.title}
        open={memberModal.open}
        onCancel={() => setMemberModal(prev => ({ ...prev, open: false }))}
        footer={null}
        width={400}
      >
        {memberModal.members.length > 0 ? (
          <List
            dataSource={memberModal.members}
            renderItem={(m) => {
              const checkedIn = m.checkedIn
              const checkedInAt = m.checkedInAt
              return (
                <List.Item>
                  <div className="flex items-center gap-2 w-full">
                    <UserOutlined className="text-[var(--gs-text-muted)]" />
                    <span className="text-sm text-[var(--gs-text)]">{m.name}</span>
                    {m.memberCode && (
                      <span className="text-xs text-[var(--gs-text-muted)]">({m.memberCode})</span>
                    )}
                    <div className="ml-auto flex-shrink-0">
                      {checkedIn !== undefined ? (
                        checkedIn ? (
                          <Tag icon={<CheckCircleFilled />} color="success" className="m-0">
                            Đã check-in {checkedInAt ? ` ${new Date(checkedInAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : ''}
                          </Tag>
                        ) : (
                          <Tag icon={<ClockCircleOutlined />} color="default" className="m-0">
                            Chưa check-in
                          </Tag>
                        )
                      ) : (
                        <Tag color="default" className="m-0 text-[var(--gs-text-muted)]">-</Tag>
                      )}
                    </div>
                  </div>
                </List.Item>
              )
            }}
          />
        ) : (
          <Empty description="Không có hội viên" />
        )}
      </Modal>

      <Modal
        title={assignModal.trainingClass ? `Gán giáo án cho lớp ${assignModal.trainingClass.name}` : 'Gán giáo án cho lớp'}
        open={assignModal.open}
        onCancel={() => setAssignModal(prev => ({ ...prev, open: false }))}
        onOk={handleAssignSubmit}
        confirmLoading={assignSubmitting}
        okText="Gán cho hội viên trong lớp"
        okButtonProps={{ disabled: !selectedTemplateId || !assignPreview || assignPreview.days.length === 0 }}
        width={640}
      >
        {!assignResult ? (
          <div className="space-y-4 pt-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--gs-text)]">Chọn giáo án mẫu</label>
              <Select
                className="w-full"
                placeholder="Chọn giáo án"
                loading={templatesLoading}
                value={selectedTemplateId}
                onChange={setSelectedTemplateId}
                showSearch
                optionFilterProp="label"
                options={templates.map(t => ({
                  value: t._id,
                  label: `${t.name || t.workoutName} • ${t.goal || ''}`,
                }))}
                notFoundContent={templatesLoading ? <Spin size="small" /> : 'Không có giáo án nào'}
              />
            </div>

            {assignPreview && (
              <>
                <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card-soft)] px-3 py-2">
                  <p className="text-xs text-[var(--gs-text-muted)]">
                    Lớp: <strong className="text-[var(--gs-text)]">{assignModal.trainingClass?.name}</strong>{' '}
                    ({assignModal.trainingClass?.startTime} - {assignModal.trainingClass?.endTime}) •{' '}
                    {assignClassStatus.totalMembers} hội viên đang hoạt động
                    {assignClassStatus.assignedCount > 0 && ` • ${assignClassStatus.assignedCount} đã có giáo án (sẽ bỏ qua)`}
                  </p>
                </div>
                {assignPreview.days.length > 0 ? (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {assignPreview.days.map(d => (
                      <div key={d.dayOfWeek} className="flex items-center gap-3 rounded-lg border border-[var(--gs-border)] px-3 py-2">
                        <span className="text-xs font-semibold text-[var(--theme-accent)] shrink-0">
                          {d.date.format('DD/MM')} • {assignModal.trainingClass?.startTime}-{assignModal.trainingClass?.endTime}
                        </span>
                        <span className="text-sm text-[var(--gs-text)]">{d.muscleGroup || `Buổi`}</span>
                        <span className="ml-auto text-xs text-[var(--gs-text-muted)] shrink-0">{d.exercises?.length || 0} bài tập</span>
                      </div>
                    ))}
                    <p className="text-[11px] text-[var(--gs-text-muted)]">
                      Chỉ lấy buổi trùng lịch học của lớp ({assignModal.trainingClass?.daysOfWeek.join(', ')} ngày trong tuần).
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-[var(--gs-border)] px-3 py-2 text-center text-xs text-[var(--gs-text-muted)]">
                    Giáo án này không có buổi nào trùng lịch học của lớp — chọn giáo án khác.
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4 pt-3">
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2">
              <p className="text-sm font-medium text-green-400">{assignResult.message}</p>
            </div>

            {assignResult.sessions.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-medium text-[var(--gs-text)]">Các buổi đã dựng ({assignResult.sessions.length})</p>
                <div className="space-y-1">
                  {assignResult.sessions.map(s => (
                    <div key={s.dayOrder} className="flex items-center gap-3 rounded-lg border border-[var(--gs-border)] px-3 py-1.5 text-xs">
                      <span className="font-semibold text-[var(--theme-accent)]">{dayjs(s.date).format('DD/MM')} {s.time}-{s.endTime}</span>
                      <span className="text-[var(--gs-text)]">{s.title}</span>
                      <span className="ml-auto text-[var(--gs-text-muted)]">{s.exercisesCount} bài tập</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {assignResult.created.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-medium text-green-400">Đã gán ({assignResult.created.length})</p>
                <div className="space-y-1">
                  {assignResult.created.map(c => (
                    <div key={c.memberId} className="flex items-center gap-2 rounded-lg border border-[var(--gs-border)] px-3 py-1.5 text-xs">
                      <CheckCircleFilled className="text-green-500" />
                      <span className="text-[var(--gs-text)]">{c.memberName}</span>
                      {c.memberCode && <span className="text-[var(--gs-text-muted)]">({c.memberCode})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {assignResult.skipped.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-medium text-amber-400">Bỏ qua ({assignResult.skipped.length})</p>
                <div className="space-y-1">
                  {assignResult.skipped.map(s => (
                    <div key={s.memberId} className="rounded-lg border border-[var(--gs-border)] px-3 py-1.5 text-xs">
                      <span className="font-medium text-[var(--gs-text)]">{s.memberName}</span>
                      <span className="text-[var(--gs-text-muted)]"> — {s.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
      </div>
    </DashboardLayout>
  )
}
