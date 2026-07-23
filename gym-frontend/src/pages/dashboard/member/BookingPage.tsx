import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Tag, Radio, message, Input, Spin, Tooltip } from 'antd'
import { CheckCircleFilled, FireOutlined, AimOutlined, ThunderboltOutlined, HeartOutlined, RiseOutlined, MedicineBoxOutlined, SafetyOutlined, QuestionCircleOutlined, EnvironmentOutlined, TeamOutlined, UserOutlined, ArrowLeftOutlined, CalendarOutlined, LockOutlined } from '@ant-design/icons'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import MembershipRequired from '../../../components/membership/MembershipRequired'
import { membershipService } from '../../../services/membershipService'
import { trainingRequestService, type TrainingRequest } from '../../../services/trainingRequestService'
import { memberService, type EnrollmentStatus } from '../../../services/memberService'
import { socketService } from '../../../services/socketService'
import { planFeatureService, type PlanFeature } from '../../../services/planFeatureService'

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
  const [membershipLoading, setMembershipLoading] = useState(true)
  const [canRequest, setCanRequest] = useState(false)
  const [planName, setPlanName] = useState<string | null>(null)

  const [requests, setRequests] = useState<TrainingRequest[]>([])
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

  useEffect(() => {
    membershipService.getMyMembership().then((res) => {
      const m = res.data.membership
      const cycle = res.data.cycle
      const statusOk = m?.status === 'active' || m?.status === 'pending_cancel'
      const pendingOk = cycle?.status === 'pending_initial_activation'
      const notExpired = statusOk ? Number(m?.remainingDays || 0) > 0 : true
      const allowed = (statusOk || pendingOk) && notExpired
      setCanRequest(allowed)
      setPlanName(m?.planNameVi || m?.plan?.nameVi || null)
    }).catch(() => setCanRequest(false))
      .finally(() => setMembershipLoading(false))

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

  const loadData = async () => {
    if (!canRequest) return
    const reqRes = await trainingRequestService.getMyRequests()
    setRequests(reqRes.data.requests || [])
  }

  useEffect(() => { if (canRequest) loadData() }, [canRequest])

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
        specialization,
        goals,
        desiredSessions,
        timeSlots,
        daysOfWeek,
        isNewToGym,
        healthNotes,
      })
      setSubmitted(true)
      setSpecialization('GYM'); setGoals([]); setDesiredSessions(3); setTimeSlots([]); setDaysOfWeek([]); setIsNewToGym(false); setHealthNotes('')
      loadData()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Gửi yêu cầu thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  const statusTag = (s: string) => {
    const map: Record<string, [string, string]> = { pending: ['orange', 'Chờ xử lý'], assigned: ['green', 'Đã xếp lớp'], cancelled: ['red', 'Đã hủy'] }
    const [color, label] = map[s] || ['default', s]
    return <Tag color={color}>{label}</Tag>
  }

  const pendingRequests = requests.filter((r) => r.status === 'pending')
  const hasPending = pendingRequests.length > 0

  const canBookGroup = featuresLoading ? true : hasFeature('BOOK_PT_GROUP')
  const canBookPTPrivate = featuresLoading ? true : hasFeature('BOOK_PT_PRIVATE')
  const canBookPTGroup = featuresLoading ? true : hasFeature('BOOK_PT_GROUP')

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
              <h1 className="text-2xl font-bold text-[var(--gs-text)]">Bạn đã có PT phụ trách</h1>
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
                    <span className="text-sm font-semibold text-[var(--gs-text)]">[{enrollment.class.code}] {enrollment.class.name}</span>
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
                  {enrollment.workout.goal && <span className="text-xs text-[var(--gs-text-muted)]">({enrollment.workout.goal})</span>}
                </div>
              )}
            </div>
            <p className="text-sm text-center text-[var(--gs-text-muted)]">
              Lịch tập của bạn đã được lên sẵn. Xem chi tiết tại mục "Lịch tập".
            </p>
            <Button type="primary" size="large" block icon={<CalendarOutlined />}
              onClick={() => navigate('/workout')}>
              Xem lịch tập của tôi
            </Button>
            <div className="text-center">
              <button type="button" className="text-xs text-[var(--gs-text-muted)] underline hover:text-[var(--gs-text)]"
                onClick={() => setShowBookingOptions(true)}>
                Muốn đăng ký thêm dịch vụ khác?
              </button>
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
            {enrollment?.hasPendingRequest && !enrollment.hasActiveEnrollment && (
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <Tooltip title={canBookPTPrivate ? undefined : 'Gói tập của bạn không hỗ trợ PT riêng 1-1'}>
                <div className={`relative rounded-2xl border-2 border-[var(--theme-border)] bg-[var(--gs-card)] p-8 text-left transition-all duration-200 ${
                  canBookPTPrivate ? 'hover:scale-[1.03] hover:border-[var(--theme-accent)] hover:shadow-lg cursor-pointer' : 'opacity-60'
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
                  <div className="text-5xl mb-4 text-[var(--gs-text-muted)]"><UserOutlined /></div>
                  <h3 className="text-xl font-bold text-[var(--gs-text)] mb-2">Đăng ký PT riêng 1-1</h3>
                  <p className="text-sm text-[var(--gs-text-muted)] leading-relaxed">
                    1 kèm 1 với huấn luyện viên cá nhân, cam kết đầu ra, thiết lập giáo án chuẩn xác 100% cho riêng bạn.
                  </p>
                </div>
              </Tooltip>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setBookingType(null)}
                className="text-[var(--gs-text-muted)] hover:text-[var(--gs-text)] !px-1" />
              <div>
                <h2 className="text-lg font-semibold text-[var(--gs-text)]">Đăng ký tập luyện nhóm</h2>
                <p className="text-sm text-[var(--gs-text-muted)]">Chia sẻ nhu cầu của bạn, admin sẽ xếp bạn vào lớp phù hợp</p>
              </div>
            </div>
            {pendingRequests.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold text-[var(--gs-text)]">Yêu cầu đã gửi</h2>
                <div className="flex flex-wrap gap-3">
                  {pendingRequests.map((r) => {
                    const specLabel = SPECIALIZATIONS.find(s => s.value === r.specialization)?.label || r.specialization || 'GYM'
                    const displayText = r.goals?.[0] ? `${specLabel} - ${r.goals[0]}` : specLabel
                    return (
                      <div key={r._id} className="rounded-xl border border-[var(--theme-border)] bg-[var(--gs-card)] p-3 flex items-center gap-3">
                        <span className="text-sm text-[var(--gs-text)] uppercase">{displayText}</span>
                        {statusTag(r.status)}
                        <Button size="small" danger onClick={() => trainingRequestService.cancelMyRequest(r._id).then(loadData)}>
                          Hủy
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {submitted && !hasPending ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center dark:border-green-800 dark:bg-green-900/20">
                <CheckCircleFilled className="text-4xl text-green-500 mb-3" />
                <h2 className="text-xl font-semibold text-green-700 dark:text-green-400">Đã gửi yêu cầu thành công!</h2>
                <p className="text-sm text-green-600 dark:text-green-500 mt-1">Admin sẽ xem xét và xếp bạn vào lớp phù hợp.</p>
                <Button className="mt-4" onClick={() => setSubmitted(false)}>Gửi yêu cầu khác</Button>
              </div>
            ) : (
              <>
                {hasPending && (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Bạn hiện đang có một yêu cầu tập luyện đang chờ xử lý. Vui lòng đợi Admin duyệt hoặc hủy yêu cầu hiện tại để gửi yêu cầu mới.
                    </p>
                  </div>
                )}
                <div className={`rounded-2xl border border-[var(--theme-border)] bg-[var(--gs-card)] p-6 space-y-6 ${hasPending ? 'pointer-events-none opacity-60' : ''}`}>
                {/* Specialization */}
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

                {/* Goal — only show when Gym is selected */}
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

                {/* Sessions per week */}
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

                {/* Time slots */}
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

                {/* Days of week */}
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

                {/* New to gym */}
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

                {/* Health notes */}
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
      </div>
    </MemberLayout>
  )
}
