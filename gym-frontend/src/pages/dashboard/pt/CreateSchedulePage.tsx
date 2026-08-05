import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  DownOutlined,
  ExclamationCircleOutlined,
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
  Tooltip,
} from 'antd'
import dayjs from 'dayjs'
import 'dayjs/locale/vi'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { useAuth } from '../../../hooks/useAuth'
import { memberService } from '../../../services/memberService'
import { ptAssignmentService, type SuggestedSlot } from '../../../services/ptAssignmentService'
import { scheduleService } from '../../../services/scheduleService'
import { workoutService, type TemplateDay, type TemplateDayExercise, type WorkoutPlan } from '../../../services/workoutService'
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

  const [pageLoading, setPageLoading] = useState(true)
  const [templates, setTemplates] = useState<WorkoutPlan[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined)
  const [scheduleDays, setScheduleDays] = useState<ScheduleDayEntry[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [allAvailableSlots, setAllAvailableSlots] = useState<SuggestedSlot[]>([])
  const [clientInfo, setClientInfo] = useState<{ fullName: string; preferredTime?: string } | null>(null)
  const [preferredTimeSlots, setPreferredTimeSlots] = useState<string[]>([])
  const [preferredDaysOfWeek, setPreferredDaysOfWeek] = useState<number[]>([])
  const [memberPrefs, setMemberPrefs] = useState<{ goals: string[]; desiredSessions: number; healthNotes: string; isNewToGym: boolean; note: string; specialization: string } | null>(null)

  const [startDate, setStartDate] = useState<dayjs.Dayjs | null>(null)
  const [isRepeating, setIsRepeating] = useState(false)
  const [repeatWeeks, setRepeatWeeks] = useState<number>(4)
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<number>>(new Set())

  // dayOrder → dayOfWeek (0-6) as assigned by slot click
  const [dayOrderDow, setDayOrderDow] = useState<Map<number, number>>(new Map())
  // dayOrder → slot detail (startTime/endTime/className/classCode)
  const slotInfoRef = useRef<Map<number, { startTime: string; endTime: string; className: string; classCode: string }>>(new Map())

  const normalizeTime = (str: string) => str.replace(/\s+/g, '').toLowerCase()
  const hasTimePref = preferredTimeSlots.length > 0
  const hasDayPref = preferredDaysOfWeek.length > 0
  const hasAnyPref = hasTimePref || hasDayPref

  const loadData = useCallback(async () => {
    if (!memberId) return
    setPageLoading(true)
    try {
      const [memberRes, tmplRes, slotsRes, prefsRes, assignmentsRes] = await Promise.all([
        memberService.getMemberById(memberId),
        workoutService.getTemplates(),
        ptAssignmentService.getSuggestedSlots(),
        ptAssignmentService.getMemberPreferences(memberId),
        ptAssignmentService.getPTClients(),
      ])
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
      const memberData = memberRes.data?.member
      setClientInfo(memberData ? { fullName: getUserDisplayName(memberData, ''), preferredTime: memberData.preferredTime } : null)
      setTemplates(Array.isArray(tmplRes.data) ? tmplRes.data : [])
      setAllAvailableSlots(slotsRes.data.slots || [])
      setPreferredTimeSlots(effectiveTimeSlots)
      setPreferredDaysOfWeek(effectiveDays)
      const pd = prefsRes.data
      if (pd && (pd.goals?.length > 0 || pd.desiredSessions > 0 || pd.healthNotes || pd.isNewToGym || pd.note || pd.specialization)) {
        setMemberPrefs({ goals: effectiveGoals, desiredSessions: pd.desiredSessions || 0, healthNotes: pd.healthNotes || '', isNewToGym: pd.isNewToGym || false, note: pd.note || '', specialization: effectiveSpecialization })
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

    for (let c = 0; c < cycles; c++) {
      const weekFirst = startDate.add(c * 7, 'day')
      const weekStart = weekFirst.subtract(weekFirst.day(), 'day')

      for (let i = 0; i < templateDays.length; i++) {
        const dof = i + 1
        const day = templateDays[i]
        const targetDow = dayOrderDow.get(dof)
        const si = slotInfoRef.current.get(dof)

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
  }, [templateDays, startDate, isRepeating, repeatWeeks, dayOrderDow])

  useEffect(() => { rebuildSchedule() }, [rebuildSchedule])

  const handleTemplateChange = (id: string) => {
    setSelectedTemplateId(id)
    setStartDate(findNearestTrainingDay(preferredDaysOfWeek))
    setDayOrderDow(new Map())
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

  const handleClearSlot = (dayOrder: number) => {
    setDayOrderDow(prev => {
      const next = new Map(prev)
      next.delete(dayOrder)
      return next
    })
    slotInfoRef.current.delete(dayOrder)
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

      const weekPromises: Promise<any>[] = []
      let weekNum = 0
      const totalWeeks = cycles.size
      for (const [_, items] of cycles) {
        weekNum++
        const sessions = items.map(d => ({
          dayOrder: d.dayOrder, date: d.date!.format('YYYY-MM-DD'), time: d.time ? d.time.format('HH:mm') : '',
          endTime: d.endTime || '', className: d.className || '', classCode: d.classCode || '',
          title: `${d.title}${isRepeating ? ` (Tuần ${weekNum})` : ''}`,
          muscleGroup: d.muscleGroup, exercises: d.exercises,
        }))
        if (assignmentId && weekNum === 1) {
          weekPromises.push(ptAssignmentService.createScheduleAndAssignWorkout(assignmentId, {
            templateId: selectedTemplateId, memberId, sessions,
            weekIndex: weekNum, totalWeeks,
          }))
        } else {
          weekPromises.push(scheduleService.createSchedule({
            templateId: selectedTemplateId, memberId, sessions,
            weekIndex: weekNum, totalWeeks,
          }))
        }
      }
      await Promise.all(weekPromises)
      message.success(isRepeating ? `Đã tạo lịch tập ${weekNum} tuần thành công` : 'Đã tạo lịch tập thành công')
      navigate('/pt/clients')
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể tạo lịch tập')
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
    if (memberPrefs) {
      setFilterSpecialty(memberPrefs.specialization || '')
      setFilterGoals(memberPrefs.goals || [])
      setFilterSessions(memberPrefs.desiredSessions || 0)
    }
  }, [memberPrefs])

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (filterSpecialty && t.specializationId !== filterSpecialty) return false
      if (filterGoals.length > 0 && !filterGoals.includes(t.goal)) return false
      if (filterSessions > 0 && (t.days?.length || 0) !== filterSessions) return false
      return true
    })
  }, [templates, filterSpecialty, filterGoals, filterSessions])

  const allFilled = scheduleDays.length > 0 && scheduleDays.every(d => d.time)
  const neededSlots = templateDays?.length || 0
  const filledDowCount = dayOrderDow.size

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
                    <Tag color="blue" className="text-xs">{isRepeating ? `${repeatWeeks} tuần × ${templateDays.length} buổi/tuần = ${repeatWeeks * templateDays.length} buổi` : `${templateDays.length} buổi`}</Tag>
                    {templateDays.map((d, i) => {
                      const dow = dayOrderDow.get(i + 1)
                      return <Tag key={i} className="text-xs">{d.muscleGroup || `Buổi ${i + 1}`}: {dow != null ? DAY_SHORT[dow] : '?'}</Tag>
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Section 3: Slot suggestions ── */}
          {selectedTemplateId && startDate && allAvailableSlots.length > 0 && (
            <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-5">
              <p className="mb-3 text-sm font-semibold text-[var(--gs-text)]">
                Khung giờ gợi ý từ lịch dạy của bạn
                <span className="ml-2 text-xs font-normal text-[var(--gs-text-muted)]">(đã chọn {filledDowCount}/{neededSlots} buổi)</span>
              </p>
              {(() => {
                const available = allAvailableSlots.filter(s => !s.isFull)
                const normPrefTimes = preferredTimeSlots.map(t => normalizeTime(t))
                const matched: SuggestedSlot[] = []
                const unmatched: SuggestedSlot[] = []
                for (const s of available) {
                  const timeOk = !hasTimePref || normPrefTimes.some(pt => pt === normalizeTime(s.time))
                  const dayOk = !hasDayPref || preferredDaysOfWeek.includes(s.dayOfWeek)
                  ;(timeOk && dayOk ? matched : unmatched).push(s)
                }
                const noSlots = matched.length === 0 && unmatched.length === 0

                const renderSlotBtn = (slot: SuggestedSlot) => {
                  const usedByDayOrder = Array.from(dayOrderDow.entries()).find(([dayOrder, dow]) => {
                    if (dow !== slot.dayOfWeek) return false
                    const si = slotInfoRef.current.get(dayOrder)
                    return si?.startTime === slot.startTime && si?.endTime === slot.endTime
                  })?.[0]
                  return (
                    <button key={`${slot.dayOfWeek}-${slot.time}`} type="button"
                      onClick={() => {
                        const free = [...Array(neededSlots).keys()].map(k => k + 1).filter(d => !dayOrderDow.has(d))
                        if (free.length > 0) handleSlotClick(slot, free[0])
                      }}
                      className="flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-left text-xs transition-all hover:bg-green-500/10"
                      style={{ borderColor: usedByDayOrder ? 'var(--theme-accent)' : '#22C55E', background: usedByDayOrder ? 'color-mix(in srgb, var(--theme-accent) 15%, transparent)' : undefined }}
                    >
                      <ClockCircleOutlined style={{ color: '#22C55E' }} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[var(--gs-text)]">{formatDayLabel(slot.dayOfWeek)}</span>
                          {usedByDayOrder ? <Tag className="m-0 text-[10px] leading-none" color="blue" style={{ fontSize: 10, lineHeight: '16px' }}>Buổi {usedByDayOrder}</Tag> : <span className="text-[10px] text-green-500">Khớp</span>}
                        </div>
                        <div className="text-green-400">{slot.startTime} - {slot.endTime}</div>
                        <div className="text-[var(--gs-text-muted)]">[{slot.classCode}] {slot.className}</div>
                      </div>
                      <Tag className="m-0 text-[10px] leading-none" style={{ fontSize: 10, lineHeight: '16px' }}>{slot.count}/{slot.maxCapacity || 5}</Tag>
                    </button>
                  )
                }

                const renderDisabledSlot = (slot: SuggestedSlot) => (
                  <Tooltip key={`${slot.dayOfWeek}-${slot.time}`} title="Không nằm trong khung giờ mong muốn của hội viên">
                    <span className="flex cursor-not-allowed items-center gap-2 rounded-lg border-2 border-[var(--gs-border)] px-3 py-2 text-left text-xs opacity-40 grayscale">
                      <ClockCircleOutlined style={{ color: 'var(--gs-text-muted)' }} />
                      <div className="flex-1"><span className="font-medium text-[var(--gs-text)]">{formatDayLabel(slot.dayOfWeek)}</span><span className="ml-2 text-[10px] text-[var(--gs-text-muted)]">Không khớp</span><div className="text-green-400">{slot.startTime} - {slot.endTime}</div><div className="text-[var(--gs-text-muted)]">[{slot.classCode}] {slot.className}</div></div>
                      <Tag className="m-0 text-[10px] leading-none" style={{ fontSize: 10, lineHeight: '16px' }}>{slot.count}/{slot.maxCapacity || 5}</Tag>
                    </span>
                  </Tooltip>
                )

                return (
                  <>
                    {noSlots && hasAnyPref && <p className="mb-2 text-xs text-[var(--gs-text-muted)]">Không có khung giờ nào phù hợp.</p>}
                    {noSlots && !hasAnyPref && <p className="text-xs text-[var(--gs-text-muted)]">Tất cả các ca đã đầy.</p>}
                    <div className="flex flex-wrap gap-2">
                      {matched.map(s => renderSlotBtn(s))}
                      {hasAnyPref && unmatched.map(s => renderDisabledSlot(s))}
                      {!hasAnyPref && unmatched.map(s => renderSlotBtn(s))}
                    </div>
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
                        {items.map((day, i) => (
                          <div key={i} className="rounded-lg border border-[var(--gs-border)] p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2"><span className="text-sm font-semibold text-[var(--gs-text)]">Buổi {day.dayOrder}</span><Tag className="m-0 text-xs">{day.title}</Tag><span className="text-xs text-[var(--gs-text-muted)]">{day.exercises.length} bài tập</span></div>
                              {dayOrderDow.has(day.dayOrder) ? <Button size="small" danger type="text" onClick={() => handleClearSlot(day.dayOrder)}>Bỏ</Button> : <span className="text-xs text-[var(--gs-text-muted)]">Chưa chọn giờ</span>}
                            </div>
                            {day.time && day.date && (
                              <div className="mt-1 space-y-0.5">
                                <div className="flex items-center gap-2 text-xs text-green-400"><CheckCircleFilled />{formatDayLabel(day.date.day())}, {day.date.format('DD/MM/YYYY')}<span className="text-[var(--gs-text-muted)]">{day.time.format('HH:mm')}{day.endTime ? ` - ${day.endTime}` : ''}</span></div>
                                {day.className && <div className="text-xs text-[var(--gs-text-muted)]">📍 {day.className}{day.classCode ? ` (${day.classCode})` : ''}</div>}
                              </div>
                            )}
                            <div className="mt-2 flex flex-wrap gap-1">{day.exercises.map((ex, ei) => <Tag key={ei} className="text-xs">{ex.name}{ex.note ? ` (${ex.note})` : ''}</Tag>)}</div>
                          </div>
                        ))}
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
