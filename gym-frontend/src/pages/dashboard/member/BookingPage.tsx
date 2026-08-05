import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'
import { Button, Tag, Radio, message, Input, Spin, Tooltip, Avatar, Modal } from 'antd'
import { CheckCircleFilled, FireOutlined, AimOutlined, ThunderboltOutlined, HeartOutlined, RiseOutlined, MedicineBoxOutlined, SafetyOutlined, QuestionCircleOutlined, EnvironmentOutlined, TeamOutlined, UserOutlined, ArrowLeftOutlined, CalendarOutlined, LockOutlined, PhoneOutlined, MailOutlined, SearchOutlined, CloseCircleFilled } from '@ant-design/icons'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import MembershipRequired from '../../../components/membership/MembershipRequired'
import { membershipService } from '../../../services/membershipService'
import { trainingRequestService, type TrainingRequest } from '../../../services/trainingRequestService'
import YourRequestPanel from '../../../components/member/YourRequestPanel'
import { memberService, type EnrollmentStatus } from '../../../services/memberService'
import { socketService } from '../../../services/socketService'
import { planFeatureService, type PlanFeature } from '../../../services/planFeatureService'
import { trainerService } from '../../../services/trainerService'
import { enrollmentService } from '../../../services/ptAssignmentService'
import { authService } from '../../../services/authService'
import type { PT } from '../../../types/admin/trainer'

const SPECIALIZATIONS = [
  { value: 'GYM', label: 'GYM', color: '#6366f1', icon: <ThunderboltOutlined /> },
  { value: 'YOGA', label: 'Yoga', color: '#84cc16', icon: <EnvironmentOutlined />, disabled: true },
  { value: 'BOXING', label: 'Boxing', color: '#f97316', icon: <FireOutlined />, disabled: true },
  { value: 'ZUMBA', label: 'Zumba', color: '#ef4444', icon: <HeartOutlined />, disabled: true },
  { value: 'PILATES', label: 'Pilates', color: '#10b981', icon: <RiseOutlined />, disabled: true },
  { value: 'CARDIO', label: 'Cardio', color: '#06b6d4', icon: <AimOutlined />, disabled: true },
  { value: 'CROSSFIT', label: 'Crossfit', color: '#8b5cf6', icon: <QuestionCircleOutlined />, disabled: true },
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

const TIME_SLOTS = ['07:00-09:00', '09:00-11:00', '12:00-14:00', '14:00-16:00', '16:00-18:00', '18:00-20:00', '20:00-22:00']
const DAYS = [
  { value: 0, label: 'Chủ nhật', short: 'CN' },
  { value: 1, label: 'Thứ 2', short: 'T2' },
  { value: 2, label: 'Thứ 3', short: 'T3' },
  { value: 3, label: 'Thứ 4', short: 'T4' },
  { value: 4, label: 'Thứ 5', short: 'T5' },
  { value: 5, label: 'Thứ 6', short: 'T6' },
  { value: 6, label: 'Thứ 7', short: 'T7' },
]

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
  const [desiredSessions, setDesiredSessions] = useState<number>(3)
  const [timeSlots, setTimeSlots] = useState<string[]>([])
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([])
  const [isNewToGym, setIsNewToGym] = useState(false)
  const [healthNotes, setHealthNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [bookingType, setBookingType] = useState<string | null>(null)

  // PT 1-1 form
  const [ptSpecialization, setPtSpecialization] = useState<string>('GYM')
  const [ptGoals, setPtGoals] = useState<string[]>([])
  const [ptPhone, setPtPhone] = useState('')
  const [ptEmail, setPtEmail] = useState('')
  const [ptPreferredTrainer, setPtPreferredTrainer] = useState<'none' | 'specific'>('none')
  const [ptPreferredTrainerId, setPtPreferredTrainerId] = useState<string | null>(null)
  const [ptNote, setPtNote] = useState('')
  const [ptSubmitting, setPtSubmitting] = useState(false)
  const [ptSubmitted, setPtSubmitted] = useState(false)
  const [pt1on1Requests, setPt1on1Requests] = useState<TrainingRequest[]>([])

  // Realtime PT search
  const [ptSearchQuery, setPtSearchQuery] = useState('')
  const [ptSearchResults, setPtSearchResults] = useState<PT[]>([])
  const [ptSearchLoading, setPtSearchLoading] = useState(false)
  const [ptSearchOpen, setPtSearchOpen] = useState(false)
  const ptSearchRef = useRef<HTMLDivElement>(null)
  const ptSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

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

  const isRequestInProgress = (request: TrainingRequest) =>
    REQUEST_IN_PROGRESS_STATUSES.has(request.status)

  const loadGroupRequests = async () => {
    if (!canRequest) return
    const reqRes = await trainingRequestService.getMyRequests({ type: 'group', activeOnly: true })
    setRequests((reqRes.data.requests || []).filter(isRequestInProgress))
  }

  const loadPt1on1Requests = async () => {
    if (!canRequest) return
    const reqRes = await trainingRequestService.getMyRequests({ type: 'pt1on1', activeOnly: true })
    setPt1on1Requests((reqRes.data.requests || []).filter(isRequestInProgress))
  }

  useEffect(() => { if (canRequest) loadGroupRequests() }, [canRequest])
  useEffect(() => { if (canRequest) loadPt1on1Requests() }, [canRequest])

  const toggleTimeSlot = (s: string) => {
    setTimeSlots((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }

  const toggleDay = (d: number) => {
    setDaysOfWeek((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])
  }

  const handleSubmit = async () => {
    if (!specialization) { message.warning('Chọn chuyên môn muốn tập'); return }
    if (!desiredSessions) { message.warning('Chọn số buổi mong muốn'); return }
    if (timeSlots.length === 0) { message.warning('Chọn ít nhất 1 khung giờ'); return }

    setSubmitting(true)
    try {
      await trainingRequestService.create({
        type: 'group',
        specialization,
        goals,
        desiredSessions,
        timeSlots,
        daysOfWeek,
        isNewToGym,
        healthNotes,
      })
      setSubmitted(false)
      setSpecialization('GYM'); setGoals([]); setDesiredSessions(3); setTimeSlots([]); setDaysOfWeek([]); setIsNewToGym(false); setHealthNotes('')
      await loadGroupRequests()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Gửi yêu cầu thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePt1on1Submit = async () => {
    if (!ptSpecialization) { message.warning('Chọn chuyên môn muốn tập'); return }
    if (!ptPhone.trim()) { message.warning('Vui lòng nhập số điện thoại'); return }
    if (!ptEmail.trim()) { message.warning('Vui lòng nhập email'); return }

    setPtSubmitting(true)
    try {
      await trainingRequestService.create({
        type: 'pt1on1',
        specialization: ptSpecialization,
        goals: ptGoals,
        contactPhone: ptPhone,
        contactEmail: ptEmail,
        preferredTrainerId: ptPreferredTrainer === 'specific' ? ptPreferredTrainerId : null,
        note: ptNote,
      })
      setPtSubmitted(false)
      setPtSpecialization('GYM'); setPtGoals([]); setPtNote(''); setPtPreferredTrainer('none'); setPtPreferredTrainerId(null)
      await loadPt1on1Requests()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Gửi yêu cầu thất bại')
    } finally {
      setPtSubmitting(false)
    }
  }

  const doPtSearch = async (query: string) => {
    if (abortRef.current) abortRef.current.abort()
    if (!query.trim()) {
      setPtSearchResults([])
      setPtSearchOpen(false)
      return
    }
    setPtSearchLoading(true)
    setPtSearchOpen(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await trainerService.getPTs({ search: query, isActive: true, limit: 10 })
      if (!controller.signal.aborted) {
        setPtSearchResults(res.data.pts || [])
        setPtSearchOpen(true)
      }
    } catch {
      if (!controller.signal.aborted) setPtSearchResults([])
    } finally {
      if (!controller.signal.aborted) setPtSearchLoading(false)
    }
  }

  const handlePtSearchChange = (value: string) => {
    setPtSearchQuery(value)
    if (ptSearchTimerRef.current) clearTimeout(ptSearchTimerRef.current)
    if (!value.trim()) {
      setPtSearchResults([])
      setPtSearchOpen(false)
      return
    }
    ptSearchTimerRef.current = setTimeout(() => doPtSearch(value), 300)
  }

  const selectTrainer = (trainer: PT) => {
    setPtPreferredTrainerId(trainer._id)
    const name = trainer.fullName || trainer.name || ''
    const contact = trainer.phone || (trainer.email && trainer.email !== 'undefined' ? trainer.email : '')
    setPtSearchQuery(name + (contact ? ' • ' + contact : ''))
    setPtSearchOpen(false)
  }

  const clearSelectedTrainer = () => {
    setPtPreferredTrainerId(null)
    setPtSearchQuery('')
    setPtSearchResults([])
    setPtSearchOpen(false)
  }

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ptSearchRef.current && !ptSearchRef.current.contains(e.target as Node)) {
        setPtSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    return () => {
      if (ptSearchTimerRef.current) clearTimeout(ptSearchTimerRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  const statusTag = (s: string) => {
    const map: Record<string, [string, string]> = {
      pending: ['orange', 'Chờ xử lý'],
      message_sent: ['blue', 'Đang xem xét'],
      waiting_assignment: ['purple', 'Chờ phân công lại'],
      assigned: ['green', 'Đã phân công'],
      declined_by_member: ['red', 'Đã từ chối đổi PT'],
      cancelled: ['red', 'Đã hủy'],
    }
    const [color, label] = map[s] || ['default', s]
    return <Tag color={color}>{label}</Tag>
  }

  const pendingGroupRequests = requests.filter((r) => r.status === 'pending')
  const hasPendingGroup = pendingGroupRequests.length > 0

  const pendingPt1on1Requests = pt1on1Requests.filter((r) => r.status === 'pending')
  const hasPendingPt1on1 = pendingPt1on1Requests.length > 0

  const activeGroupRequest = requests.find(isRequestInProgress)
  const activePt1on1Request = pt1on1Requests.find(isRequestInProgress)
  const hasOpenRequest = !!activeGroupRequest || !!activePt1on1Request

  const canBookGroup = featuresLoading ? true : hasFeature('BOOK_PT_GROUP')
  const canBookPTPrivate = featuresLoading ? true : hasFeature('BOOK_PT_PRIVATE')

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
        ) : enrollment?.hasActiveEnrollment && !showBookingOptions ? (
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
                  <span className="text-sm font-semibold text-[var(--gs-text)]">{enrollment.pt.name}</span>
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
              <YourRequestPanel request={activeGroupRequest} onReload={() => { setSubmitted(false); setPtSubmitted(false); loadGroupRequests(); loadPt1on1Requests() }} />
            )}
            {activePt1on1Request && (
              <YourRequestPanel request={activePt1on1Request} onReload={() => { setSubmitted(false); setPtSubmitted(false); loadGroupRequests(); loadPt1on1Requests() }} />
            )}
            {(!activeGroupRequest || !activePt1on1Request) && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {!activeGroupRequest && (
                <Tooltip title={canBookGroup ? undefined : 'Gói tập của bạn không hỗ trợ tập nhóm'}>
                  <button type="button"
                    onClick={() => canBookGroup && setBookingType('group')}
                    disabled={!canBookGroup}
                    className={`group relative rounded-2xl border-2 border-[var(--theme-border)] bg-[var(--gs-card)] p-8 text-left transition-all duration-200 ${
                      canBookGroup
                        ? 'hover:scale-[1.03] hover:border-[var(--theme-accent)] hover:shadow-lg cursor-pointer'
                        : 'opacity-60 cursor-not-allowed'
                    }`}>
                    <div className="text-5xl mb-4 text-[var(--theme-accent)]"><TeamOutlined /></div>
                    <h3 className="text-xl font-bold text-[var(--gs-text)] mb-2">Đăng ký tập luyện nhóm</h3>
                    <p className="text-sm text-[var(--gs-text-muted)] leading-relaxed">
                      Tập luyện theo nhóm, huấn luyện viên hỗ trợ giáo án cá nhân hóa, tiết kiệm chi phí.
                    </p>
                    {!canBookGroup && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/5">
                        <LockOutlined className="text-2xl text-[var(--gs-text-muted)]" />
                      </div>
                    )}
                  </button>
                </Tooltip>
              )}
              {!activePt1on1Request && (
                <Tooltip title={canBookPTPrivate ? undefined : 'Gói tập của bạn không hỗ trợ PT riêng 1-1'}>
                  <button type="button"
                    onClick={() => canBookPTPrivate && setBookingType('pt1on1')}
                    disabled={!canBookPTPrivate}
                    className={`group relative rounded-2xl border-2 border-[var(--theme-border)] bg-[var(--gs-card)] p-8 text-left transition-all duration-200 ${
                      canBookPTPrivate
                        ? 'hover:scale-[1.03] hover:border-[var(--theme-accent)] hover:shadow-lg cursor-pointer'
                        : 'opacity-60 cursor-not-allowed'
                    }`}>
                    {!canBookPTPrivate && (
                      <div className="absolute -top-2.5 right-4 z-10">
                        <span className="inline-block rounded-full bg-gradient-to-r from-orange-400 to-pink-500 px-3 py-1 text-[11px] font-bold text-white uppercase tracking-wide shadow-md">
                          {featuresLoading ? 'Sắp ra mắt' : 'Không khả dụng'}
                        </span>
                      </div>
                    )}
                    {!canBookPTPrivate && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/5 z-0">
                        <LockOutlined className="text-2xl text-[var(--gs-text-muted)]" />
                      </div>
                    )}
                    <div className="text-5xl mb-4 text-[var(--gs-text)]"><UserOutlined /></div>
                    <h3 className="text-xl font-bold text-[var(--gs-text)] mb-2">Đăng ký PT riêng 1-1</h3>
                    <p className="text-sm text-[var(--gs-text-muted)] leading-relaxed">
                      1 kèm 1 với huấn luyện viên cá nhân, cam kết đầu ra, thiết lập giáo án chuẩn xác 100% cho riêng bạn.
                    </p>
                  </button>
                </Tooltip>
              )}
            </div>
            )}
          </div>
        ) : bookingType === 'group' ? (
          <>
            {activeGroupRequest && (
              <>
                <YourRequestPanel request={activeGroupRequest} onReload={() => { setSubmitted(false); setPtSubmitted(false); loadGroupRequests(); loadPt1on1Requests() }} />
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

                {specialization === 'GYM' && (
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
                )}

                <div>
                  <label className="block text-sm font-medium text-[var(--gs-text)] mb-2">Số buổi mong muốn mỗi tuần *</label>
                  <Radio.Group onChange={(e) => setDesiredSessions(e.target.value)} value={desiredSessions}>
                    <div className="flex flex-col gap-2">
                      <Radio value={3}>
                        <span className="text-sm">3 buổi/tuần <span className="text-[var(--gs-text-muted)] text-xs">(Khuyến nghị)</span></span>
                      </Radio>
                      <Radio value={4}>
                        <span className="text-sm">4 buổi/tuần</span>
                      </Radio>
                      <Radio value={5}>
                        <span className="text-sm">5 buổi/tuần</span>
                      </Radio>
                    </div>
                  </Radio.Group>
                  <p className="text-xs text-[var(--gs-text-muted)] mt-2">Khuyến nghị tập từ 3–5 buổi/tuần để đạt hiệu quả luyện tập tốt nhất.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--gs-text)] mb-2">Khung giờ mong muốn *</label>
                  <div className="flex flex-wrap gap-2">
                    {TIME_SLOTS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleTimeSlot(s)}
                        className={`rounded-lg border px-3 py-1.5 text-sm transition-all ${
                          timeSlots.includes(s)
                            ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)] text-[var(--theme-accent)]'
                            : 'border-[var(--theme-border)] text-[var(--gs-text)] hover:border-[var(--theme-accent)]'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--gs-text)] mb-2">Ngày có thể tập *</label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDay(d.value)}
                        className={`rounded-lg border px-3 py-1.5 text-sm transition-all ${
                          daysOfWeek.includes(d.value)
                            ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)] text-[var(--theme-accent)]'
                            : 'border-[var(--theme-border)] text-[var(--gs-text)] hover:border-[var(--theme-accent)]'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-[var(--gs-text-muted)] mt-2">
                    Đây chỉ là các ngày bạn có thể tham gia tập. Lịch tập chính thức sẽ được Admin sắp xếp dựa trên lịch trống của PT và lớp học.
                  </p>
                </div>

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
                  <label className="block text-sm font-medium text-[var(--gs-text)] mb-2">Ghi chú sức khỏe</label>
                  <Input.TextArea rows={2} value={healthNotes} onChange={(e) => setHealthNotes(e.target.value)}
                    placeholder="VD: Có vấn đề về lưng, không chạy bộ được..." />
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
                <YourRequestPanel request={activePt1on1Request} onReload={() => { setSubmitted(false); setPtSubmitted(false); loadGroupRequests(); loadPt1on1Requests() }} />
                <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setBookingType(null)}
                  className="text-[var(--gs-text-muted)] hover:text-[var(--gs-text)] !px-1">
                  Quay lại lựa chọn dịch vụ
                </Button>
              </>
            )}
            {!activePt1on1Request && (
            <>
            <div className="flex items-center gap-3">
              <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setBookingType(null)}
                className="text-[var(--gs-text-muted)] hover:text-[var(--gs-text)] !px-1" />
              <div>
                <h2 className="text-lg font-semibold text-[var(--gs-text)]">Đăng ký PT riêng 1-1</h2>
                <p className="text-sm text-[var(--gs-text-muted)]">Gửi yêu cầu, Admin sẽ phân công PT phù hợp cho bạn</p>
              </div>
            </div>

            {pendingPt1on1Requests.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-[var(--gs-text)]">Yêu cầu đã gửi</h2>
                <div className="flex flex-wrap gap-3">
                  {pendingPt1on1Requests.map((r) => {
                    const specLabel = SPECIALIZATIONS.find(s => s.value === r.specialization)?.label || r.specialization || 'GYM'
                    const displayText = r.goals?.[0] ? `${specLabel} - ${r.goals[0]}` : specLabel
                    return (
                      <div key={r._id} className="rounded-xl border border-[var(--theme-border)] bg-[var(--gs-card)] p-3 flex items-center gap-3">
                        <span className="text-sm text-[var(--gs-text)] uppercase">{displayText}</span>
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

            {ptSubmitted && !hasPendingPt1on1 ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center dark:border-green-800 dark:bg-green-900/20">
                <CheckCircleFilled className="text-4xl text-green-500 mb-3" />
                <h2 className="text-xl font-semibold text-green-700 dark:text-green-400">Đã gửi yêu cầu thành công!</h2>
                <p className="text-sm text-green-600 dark:text-green-500 mt-1">Admin sẽ phân công PT phù hợp cho bạn. PT sẽ chủ động liên hệ qua SĐT hoặc Email.</p>
                <Button className="mt-4" onClick={() => setPtSubmitted(false)}>Gửi yêu cầu khác</Button>
              </div>
            ) : (
              <>
                {hasPendingPt1on1 && (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Bạn hiện đang có yêu cầu PT 1-1 đang chờ xử lý.
                    </p>
                  </div>
                )}
                <div className={`rounded-2xl border border-[var(--theme-border)] bg-[var(--gs-card)] p-6 space-y-6 ${hasPendingPt1on1 ? 'pointer-events-none opacity-60' : ''}`}>

                  {/* Section 1: Thông tin tập luyện */}
                  <div>
                    <h3 className="text-base font-semibold text-[var(--gs-text)] mb-4">1. Thông tin tập luyện</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--gs-text)] mb-2">Chuyên môn *</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {SPECIALIZATIONS.map((s) => (
                            <button
                              key={s.value}
                              type="button"
                              disabled={s.disabled}
                              onClick={() => setPtSpecialization(s.value)}
                              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all ${
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
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {GOALS.map((g) => (
                            <button
                              key={g.value}
                              type="button"
                              onClick={() => setPtGoals((prev) => prev.includes(g.value) ? prev.filter((x) => x !== g.value) : [...prev, g.value])}
                              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all ${
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

                  {/* Section 2: Thông tin liên hệ */}
                  <div>
                    <h3 className="text-base font-semibold text-[var(--gs-text)] mb-4">2. Thông tin liên hệ</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--gs-text)] mb-1">
                          <PhoneOutlined className="mr-1" /> Số điện thoại *
                        </label>
                        <Input
                          value={ptPhone}
                          onChange={(e) => setPtPhone(e.target.value)}
                          placeholder="Nhập số điện thoại"
                          prefix={<PhoneOutlined />}
                          className="!rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[var(--gs-text)] mb-1">
                          <MailOutlined className="mr-1" /> Email *
                        </label>
                        <Input
                          value={ptEmail}
                          onChange={(e) => setPtEmail(e.target.value)}
                          placeholder="Nhập email"
                          prefix={<MailOutlined />}
                          className="!rounded-xl"
                        />
                      </div>
                      <p className="text-xs text-[var(--gs-text-muted)] italic">
                        PT sẽ sử dụng các thông tin này để liên hệ và trao đổi lịch tập.
                      </p>
                    </div>
                  </div>

                  {/* Section 3: PT mong muốn */}
                  <div>
                    <h3 className="text-base font-semibold text-[var(--gs-text)] mb-4">3. PT mong muốn</h3>
                    <div className="space-y-3">
                      <Radio.Group value={ptPreferredTrainer} onChange={(e) => setPtPreferredTrainer(e.target.value)}>
                        <div className="flex flex-col gap-2">
                          <Radio value="none">
                            <span className="text-sm">Không yêu cầu</span>
                          </Radio>
                          <Radio value="specific">
                            <span className="text-sm">Có PT mong muốn</span>
                          </Radio>
                        </div>
                      </Radio.Group>

                      {ptPreferredTrainer === 'specific' && (
                        <div ref={ptSearchRef} className="relative">
                          <div className="relative">
                            <Input
                              value={ptSearchQuery}
                              onChange={(e) => handlePtSearchChange(e.target.value)}
                              onFocus={() => ptSearchQuery.trim() && setPtSearchOpen(true)}
                              placeholder="Số điện thoại hoặc email của PT"
                              prefix={<SearchOutlined style={{ color: 'var(--gs-text-muted)' }} />}
                              suffix={
                                ptPreferredTrainerId && ptSearchQuery ? (
                                  <CloseCircleFilled
                                    style={{ color: 'var(--gs-text-muted)', cursor: 'pointer' }}
                                    onClick={clearSelectedTrainer}
                                  />
                                ) : ptSearchLoading ? (
                                  <Spin size="small" />
                                ) : null
                              }
                              className="!rounded-xl"
                            />
                          </div>

                          {ptSearchOpen && (
                            <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] shadow-lg max-h-[280px] overflow-y-auto">
                              {ptSearchLoading && ptSearchResults.length === 0 ? (
                                <div className="flex items-center justify-center py-6">
                                  <Spin size="small" />
                                </div>
                              ) : ptSearchResults.length === 0 ? (
                                <div className="py-6 text-center text-sm text-[var(--gs-text-muted)]">
                                  Không tìm thấy PT có số điện thoại hoặc email này.
                                </div>
                              ) : (
                                ptSearchResults.map((t) => (
                                  <div
                                    key={t._id}
                                    onClick={() => selectTrainer(t)}
                                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-[var(--gs-active-bg)] ${
                                      ptPreferredTrainerId === t._id ? 'bg-[var(--theme-accent-muted)]' : ''
                                    }`}
                                  >
                                    <Avatar src={t.avatar} size={36} className="shrink-0">
                                      {(t.fullName || t.name || 'PT').charAt(0)}
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm font-medium text-[var(--gs-text)] truncate">
                                        {t.fullName || t.name}
                                      </div>
                                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-[var(--gs-text-muted)]">
                                        {t.specialties?.length > 0 && (
                                          <span>{t.specialties.join(' • ')}</span>
                                        )}
                                        {t.phone && <span>{t.phone}</span>}
                                        {t.email && t.email !== 'undefined' && <span className="truncate max-w-[160px]">{t.email}</span>}
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section 4: Ghi chú */}
                  <div>
                    <h3 className="text-base font-semibold text-[var(--gs-text)] mb-4">4. Ghi chú</h3>
                    <Input.TextArea
                      rows={3}
                      value={ptNote}
                      onChange={(e) => setPtNote(e.target.value)}
                      placeholder="Ví dụ:
- Tôi muốn tập tăng cơ.
- Đã từng chấn thương vai.
- Muốn PT có kinh nghiệm.
- Tôi sẽ trao đổi lịch trực tiếp với PT."
                      className="!rounded-xl"
                    />
                  </div>

                  <Button type="primary" size="large" block loading={ptSubmitting} onClick={handlePt1on1Submit}>
                    Gửi yêu cầu
                  </Button>
                </div>
              </>
            )}
            </>
            )}
          </>
        )}
      </div>

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
