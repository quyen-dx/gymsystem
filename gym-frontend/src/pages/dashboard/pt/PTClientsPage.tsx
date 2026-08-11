import {
  CheckCircleFilled,
  ClockCircleOutlined,
  DeleteOutlined,
  MailOutlined,
  PhoneOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import {
  Button,
  DatePicker,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { useAuth } from '../../../hooks/useAuth'
import { bookingService } from '../../../services/bookingService'
import type { Booking } from '../../../services/bookingService'
import { socketService } from '../../../services/socketService'
import {
  ptAssignmentService,
  type HistoryEntry,
  type PendingApproval,
  type PTAssignment,
  type PTAssignmentMember,
} from '../../../services/ptAssignmentService'
import { ptAssignmentEndService } from '../../../services/ptAssignmentEndService'
import { scheduleService } from '../../../services/scheduleService'
import { workoutService, type WorkoutSchedule } from '../../../services/workoutService'
import { getUserDisplayName } from '../../../utils/userDisplay'

const REASON_LABELS: Record<string, string> = {
  MEMBER_COMPLETED: 'Hội viên hoàn thành khóa học',
  MEMBER_REQUEST_CHANGE_PT: 'Hội viên yêu cầu đổi PT',
  MEMBER_QUIT: 'Hội viên xin nghỉ tập',
  PT_NO_LONGER_TEACHES: 'PT không còn phụ trách lớp',
  OTHER: 'Khác',
}

interface ClientInfo {
  _id: string
  name: string
  fullName?: string
  email?: string
  phone?: string
  memberCode?: string
  avatar?: string
  preferredTime?: string
  assignmentId?: string
  classId?: string | { _id: string; name?: string; code?: string }
  classEnrollment?: { _id: string; code: string; name: string } | null
  specialization?: string
  goals?: string[]
  workout?: { _id: string; name: string; goal?: string } | null
  scheduleCount?: number
  membershipStatus?: 'active' | 'expired' | null
  membershipStartAt?: string | null
  membershipExpiresAt?: string | null
  requestTimeSlots?: string[]
  requestDaysOfWeek?: number[]
  requestDaySlots?: Array<{ day: number; slot: string }>
  requestNote?: string
  requestContactPhone?: string
  requestContactEmail?: string
  type?: 'GROUP' | 'PT_1_1'
  cancelledAt?: string
  cancelReason?: string
}

function extractClient(assignment: PTAssignment): ClientInfo | null {
  const member = typeof assignment.memberId === 'object' ? assignment.memberId as PTAssignmentMember : null
  if (!member?._id) return null
  const w = assignment.workoutId
  const workout = w && typeof w === 'object'
    ? { _id: w._id, name: w.name, goal: w.goal }
    : null
  return {
    _id: member._id,
    name: getUserDisplayName(member, ''),
    fullName: member.fullName,
    email: member.email ?? undefined,
    phone: member.phone ?? undefined,
    memberCode: member.memberCode,
    avatar: member.avatar,
    preferredTime: member.preferredTime,
    assignmentId: assignment._id,
    classId: assignment.classId,
    classEnrollment: assignment.classEnrollment || null,
    specialization: assignment.specialization || '',
    goals: assignment.goals || [],
    workout,
    scheduleCount: assignment.scheduleCount ?? 0,
    membershipStatus: assignment.membershipStatus,
    membershipStartAt: assignment.membershipStartAt,
    membershipExpiresAt: assignment.membershipExpiresAt,
    requestTimeSlots: assignment.requestTimeSlots || assignment.currentSchedule?.timeSlots || assignment.acceptedProposal?.timeSlots || [],
    requestDaysOfWeek: assignment.requestDaysOfWeek || assignment.currentSchedule?.daysOfWeek || assignment.acceptedProposal?.daysOfWeek || [],
    requestDaySlots: assignment.requestDaySlots || [],
    requestNote: assignment.requestNote,
    requestContactPhone: assignment.requestContactPhone,
    requestContactEmail: assignment.requestContactEmail,
    type: assignment.type,
    cancelledAt: assignment.cancelledAt,
    cancelReason: assignment.cancelReason,
  }
}

const FORMAT_DATE = 'DD/MM/YYYY HH:mm'

function fmt(d: string | undefined | null): string {
  if (!d) return '—'
  return dayjs(d).format(FORMAT_DATE)
}

function fmtDate(d: string | undefined | null): string {
  if (!d) return '—'
  return dayjs(d).format('DD/MM/YYYY')
}

function remainingDays(expiresAt?: string | null): number | null {
  if (!expiresAt) return null
  const diff = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86400000))
}

export default function PTClientsPage() {
  useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const assignWorkoutId = searchParams.get('assignWorkout') || ''
  const [assignWorkoutName, setAssignWorkoutName] = useState<string>('')

  // Tải tên giáo án được chọn từ nút "Sử dụng" ở thư viện giáo án
  useEffect(() => {
    if (!assignWorkoutId) {
      setAssignWorkoutName('')
      return
    }
    workoutService.getWorkoutById(assignWorkoutId)
      .then((res) => {
        const d = (res.data as { workout?: unknown; data?: unknown })?.workout
          || (res.data as { data?: unknown })?.data
          || res.data
        if (d && typeof d === 'object') {
          const t = d as { workoutName?: string; name?: string }
          setAssignWorkoutName(t.workoutName || t.name || '')
        }
      })
      .catch(() => setAssignWorkoutName(''))
  }, [assignWorkoutId])

  const createScheduleUrl = (record: ClientInfo) => {
    const params = new URLSearchParams()
    if (record.assignmentId) params.set('assignmentId', record.assignmentId)
    if (assignWorkoutId) params.set('templateId', assignWorkoutId)
    const bookedCount = clientBookings[record._id]?.length
    if (bookedCount) params.set('booked', String(bookedCount))
    const qs = params.toString()
    return `/pt/clients/${record._id}/create-schedule${qs ? `?${qs}` : ''}`
  }

  const [activeTab, setActiveTab] = useState<'active' | 'pending' | 'history'>('active')
  const [serviceTab, setServiceTab] = useState<'pt1on1' | 'group'>('pt1on1')

  // Tab 1: Active clients
  const [clients, setClients] = useState<ClientInfo[]>([])
  const [clientsLoading, setClientsLoading] = useState(false)
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null)
  const [clientSchedules, setClientSchedules] = useState<Record<string, WorkoutSchedule[]>>({})
  const [clientBookings, setClientBookings] = useState<Record<string, Booking[]>>({})
  const [schedulesLoading, setSchedulesLoading] = useState<string | null>(null)
  const [bookingsLoading, setBookingsLoading] = useState<string | null>(null)
  const [filterSpecialization, setFilterSpecialization] = useState<string | undefined>(undefined)
  const [filterGoals, setFilterGoals] = useState<string[]>([])

  // Tab 2: Pending approvals
  const [pendingItems, setPendingItems] = useState<PendingApproval[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)

  // Tab 3: History
  const [historyItems, setHistoryItems] = useState<HistoryEntry[]>([])
  const [historyPagination, setHistoryPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 })
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyType, setHistoryType] = useState<string | undefined>(undefined)
  const [historyFromDate, setHistoryFromDate] = useState<string | undefined>(undefined)
  const [historyToDate, setHistoryToDate] = useState<string | undefined>(undefined)
  const [historySearch, setHistorySearch] = useState('')

  // End request modal
  const [endRequestModal, setEndRequestModal] = useState<{ open: boolean; client: ClientInfo | null }>({ open: false, client: null })
  const [submittingEnd, setSubmittingEnd] = useState(false)

  // ============ FETCH ============

  const fetchClients = useCallback(async () => {
    setClientsLoading(true)
    try {
      const res = await ptAssignmentService.getPTClients()
      const assignments = res.data?.assignments || []
      const members = assignments.map(extractClient).filter(Boolean) as ClientInfo[]
      setClients(members)
    } catch {
      message.error('Không thể tải danh sách khách hàng')
    } finally {
      setClientsLoading(false)
    }
  }, [])

  const fetchPending = useCallback(async () => {
    setPendingLoading(true)
    try {
      const res = await ptAssignmentService.getPTPendingApprovals()
      setPendingItems(res.data?.items || [])
    } catch {
      message.error('Không thể tải danh sách chờ duyệt')
    } finally {
      setPendingLoading(false)
    }
  }, [])

  const fetchHistory = useCallback(async (page = 1) => {
    setHistoryLoading(true)
    try {
      const params: Record<string, unknown> = { page, limit: 20 }
      if (historyType) params.type = historyType
      if (historyFromDate) params.fromDate = historyFromDate
      if (historyToDate) params.toDate = historyToDate
      if (historySearch.trim()) params.search = historySearch.trim()
      const res = await ptAssignmentService.getPTHistory(params)
      const { items, pagination } = res.data
      setHistoryItems(items || [])
      setHistoryPagination(pagination)
    } catch {
      message.error('Không thể tải lịch sử')
    } finally {
      setHistoryLoading(false)
    }
  }, [historyType, historyFromDate, historyToDate, historySearch])

  useEffect(() => {
    if (activeTab === 'active') {
      fetchClients()
    } else if (activeTab === 'pending') {
      fetchPending()
    } else {
      fetchHistory()
    }
  }, [activeTab, fetchClients, fetchPending, fetchHistory])

  // Socket: lang nghe thay doi trang thai yeu cau ket thuc phu trach
  useEffect(() => {
    const handler = (data: { type: string; memberId: string }) => {
      if (data.type === 'approved') {
        if (activeTab === 'pending') fetchPending()
        if (activeTab === 'active') fetchClients()
      } else if (data.type === 'rejected') {
        if (activeTab === 'pending') fetchPending()
        if (activeTab === 'active') fetchClients()
      }
    }
    // Socket: PT vừa chấp nhận hội viên PT 1-1 → danh sách học viên cập nhật ngay (không cần F5)
    const clientsUpdatedHandler = () => {
      if (activeTab === 'active') fetchClients()
    }
    socketService.connect()
    socketService.on('pt_end_request:status_changed', handler)
    socketService.on('pt_clients:updated', clientsUpdatedHandler)
    return () => {
      socketService.off('pt_end_request:status_changed', handler)
      socketService.off('pt_clients:updated', clientsUpdatedHandler)
    }
  }, [activeTab, fetchClients, fetchPending])

  // ============ SCHEDULE ============

  const fetchClientSchedules = useCallback(async (memberId: string) => {
    setSchedulesLoading(memberId)
    try {
      const res = await scheduleService.getMemberSchedules(memberId)
      const schedules = res.data.schedules || []
      setClientSchedules((prev) => ({ ...prev, [memberId]: schedules }))
    } catch {
      message.error('Không thể tải lịch tập')
    } finally {
      setSchedulesLoading(null)
    }
  }, [])

  const fetchClientBookings = useCallback(async (memberId: string) => {
    setBookingsLoading(memberId)
    try {
      const res = await bookingService.getPTBookings({ memberId, from: 'today' })
      setClientBookings((prev) => ({ ...prev, [memberId]: res.data || [] }))
    } catch {
      message.error('Không thể tải lịch PT 1-1 đã book')
    } finally {
      setBookingsLoading(null)
    }
  }, [])

  const handleExpand = (expanded: boolean, record: ClientInfo) => {
    if (expanded) {
      setExpandedMemberId(record._id)
      if (record.type === 'PT_1_1') {
        if (!clientBookings[record._id]) fetchClientBookings(record._id)
      } else if (!clientSchedules[record._id]) {
        fetchClientSchedules(record._id)
      }
    } else {
      setExpandedMemberId(null)
    }
  }

  const handleDeleteSchedule = async (schedule: WorkoutSchedule) => {
    try {
      await scheduleService.deleteSchedule(schedule._id)
      message.success('Đã xoá lịch tập')
      if (expandedMemberId) fetchClientSchedules(expandedMemberId)
      fetchClients()
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể xoá lịch tập')
    }
  }

  // ============ ADD SESSION (thêm buổi vào giáo án đang chạy) ============

  const [addSessionModal, setAddSessionModal] = useState<{
    open: boolean
    schedule: WorkoutSchedule | null
    memberId: string
    date: dayjs.Dayjs | null
    time: string
    submitting: boolean
  }>({ open: false, schedule: null, memberId: '', date: null, time: '', submitting: false })

  const openAddSession = (schedule: WorkoutSchedule, memberId: string) => {
    setAddSessionModal({ open: true, schedule, memberId, date: null, time: '', submitting: false })
  }

  const handleAddSession = async () => {
    const { schedule, date, time } = addSessionModal
    if (!schedule || !date || !time) {
      message.warning('Vui lòng chọn ngày và khung giờ cho buổi mới')
      return
    }
    setAddSessionModal((p) => ({ ...p, submitting: true }))
    try {
      const res = await scheduleService.addScheduleSession(schedule._id, {
        date: date.format('YYYY-MM-DD'),
        time,
      })
      message.success(res.data.message || 'Đã thêm buổi tập')
      const memberId = addSessionModal.memberId
      setAddSessionModal((p) => ({ ...p, open: false, schedule: null, date: null, time: '' }))
      if (memberId) fetchClientSchedules(memberId)
    } catch (error: unknown) {
      const e = error as { response?: { data?: { message?: string } } }
      message.error(e?.response?.data?.message || 'Không thể thêm buổi tập')
    } finally {
      setAddSessionModal((p) => ({ ...p, submitting: false }))
    }
  }

  // ============ END REQUEST ============

  const handleEndRequest = async () => {
    if (!endRequestModal.client) return

    setSubmittingEnd(true)
    try {
      const client = endRequestModal.client
      const classId = client.classId && typeof client.classId === 'object'
        ? (client.classId as { _id: string })._id
        : client.classId
      const { data } = await ptAssignmentEndService.create({
        memberId: client._id,
        reasonType: 'MEMBER_COMPLETED',
        assignmentId: client.assignmentId,
        classId,
      })
      message.success(data.message || 'Đã gửi yêu cầu kết thúc phụ trách')
      setEndRequestModal({ open: false, client: null })
      setExpandedMemberId(null)
      fetchClients()
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể gửi yêu cầu')
    } finally {
      setSubmittingEnd(false)
    }
  }

  // ============ COLUMNS ============

  const expandedScheduleColumns = (client: ClientInfo) => [
    {
      title: 'Giáo án',
      render: (_: unknown, record: WorkoutSchedule) => {
        const tpl = record.templateId as any
        const weekInfo = record.totalWeeks && record.totalWeeks > 1
          ? ` - Tuần ${record.weekIndex || '?'}/${record.totalWeeks}`
          : ''
        return (
          <div>
            <div className="font-medium text-[var(--gs-text)]">{tpl?.name || 'Giáo án mẫu'}{weekInfo}</div>
            <div className="text-xs text-[var(--gs-text-muted)]">{tpl?.goal || ''}</div>
          </div>
        )
      },
    },
    {
      title: 'Số buổi',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, record: WorkoutSchedule) => (
        <span>{record.sessions?.length || 0} buổi</span>
      ),
    },
    {
      title: 'Tiến độ',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, record: WorkoutSchedule) => {
        const sessions = record.sessions || []
        const done = sessions.filter((s) => s.status === 'completed').length
        return <span>{done}/{sessions.length}</span>
      },
    },
    {
      title: 'Trạng thái',
      width: 130,
      render: (_: unknown, record: WorkoutSchedule) => {
        const color = record.status === 'active' ? 'green' : record.status === 'completed' ? 'blue' : 'default'
        const label = record.status === 'active' ? 'Đang hoạt động' : record.status === 'completed' ? 'Hoàn thành' : '—'
        return <Tag color={color}>{label}</Tag>
      },
    },
    {
      title: 'Thao tác',
      width: 260,
      render: (_: unknown, record: WorkoutSchedule) => (
        <Space size={4}>
          <Button
            size="small"
            type="primary"
            ghost
            onClick={() => navigate(`/pt/clients/${client._id}/progress?assignmentId=${client.assignmentId || ''}&scheduleId=${record._id}`)}
          >
            Xem tiến độ
          </Button>
          {record.status === 'active' && (
            <Tooltip title="Thêm buổi tập mới — buổi kế tiếp của giáo án sẽ được mở">
              <Button size="small" icon={<PlusOutlined />} onClick={() => openAddSession(record, client._id)}>
                Thêm buổi
              </Button>
            </Tooltip>
          )}
          <Popconfirm
            title="Xoá lịch tập này?"
            okText="Xoá"
            cancelText="Huỷ"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDeleteSchedule(record)}
          >
            <Tooltip title="Xoá lịch tập">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // ============ PT 1-1: EXPAND CONTENT (giao diện riêng, không dùng chung với PT nhóm) ============

  const pt1on1Expand = (record: ClientInfo) => {
    const note = (record.requestNote || '').trim()
    const contactPhone = record.requestContactPhone || record.phone
    const contactEmail = record.requestContactEmail || record.email
    const phoneHref = contactPhone?.trim()
    const emailHref = contactEmail?.trim()
    const bookings = clientBookings[record._id] || []
    const sortedBookings = [...bookings].sort((a, b) => {
      const dateDiff = dayjs(a.date).valueOf() - dayjs(b.date).valueOf()
      if (dateDiff !== 0) return dateDiff
      return String(a.slot || '').localeCompare(String(b.slot || ''))
    })
    const requestDays = record.requestDaysOfWeek || []
    const requestSlots = record.requestTimeSlots || []
    const requestPairs = record.requestDaySlots || []
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
    const bookingStatusTag = (status: Booking['status']) => {
      const map: Record<Booking['status'], { color: string; label: string }> = {
        pending: { color: 'orange', label: 'Chờ PT xác nhận' },
        awaiting_payment: { color: 'gold', label: 'Chờ thanh toán' },
        confirmed: { color: 'green', label: 'Đã xác nhận' },
        cancelled: { color: 'red', label: 'Đã hủy' },
        completed: { color: 'blue', label: 'Hoàn thành' },
        member_no_show: { color: 'red', label: 'Member vắng mặt' },
        pt_no_show: { color: 'magenta', label: 'PT vắng mặt' },
        needs_review: { color: 'orange', label: 'Cần kiểm tra' },
      }
      const item = map[status] || { color: 'default', label: status }
      return <Tag color={item.color} className="m-0">{item.label}</Tag>
    }

    // Responsive: mobile label/value xuống dòng; desktop "label : value" cùng dòng
    const Row = ({ label, children }: { label: string; children: ReactNode }) => (
      <div className="flex flex-col gap-0.5 text-sm md:flex-row md:items-start md:gap-2">
        <span className="shrink-0 text-[var(--gs-text-muted)] md:w-36">{label}:</span>
        <span className="min-w-0 text-[var(--gs-text)]">{children}</span>
      </div>
    )

    const SectionCard = ({ title, children }: { title: string; children: ReactNode }) => (
      <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--theme-accent)]">
          {title}
        </div>
        {children}
      </div>
    )

    return (
      <div className="space-y-4 p-4">
        {/* Kết thúc phụ trách */}
        <div className="flex justify-end gap-2">
          <Button
            size="small"
            icon={<ReloadOutlined />}
            loading={bookingsLoading === record._id}
            onClick={() => fetchClientBookings(record._id)}
          >
            Tải lại
          </Button>
          <Button
            danger
            onClick={() => setEndRequestModal({ open: true, client: record })}
          >
            Kết thúc phụ trách
          </Button>
        </div>

        {/* 4 section trong 2 cột */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Cột trái */}
          <div className="flex flex-col gap-4">
            <SectionCard title="Thông tin hội viên">
              <div className="mb-3 flex flex-col items-center gap-3 text-center md:flex-row md:text-left">
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: record.avatar ? `url(${record.avatar}) center/cover` : 'var(--gs-border)',
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div className="text-base font-semibold text-[var(--gs-text)]">{getUserDisplayName(record, 'Thành viên')}</div>
                  <div className="text-sm text-[var(--gs-text-muted)]">{record.memberCode ? `Mã hội viên: ${record.memberCode}` : ''}</div>
                </div>
              </div>
              <div className="space-y-2">
                <Row label="Chuyên môn">{record.specialization || '—'}</Row>
                <Row label="Mục tiêu">{record.goals?.length ? record.goals.join(', ') : '—'}</Row>
              </div>
            </SectionCard>

            <SectionCard title="Thông tin liên hệ">
              <div className="space-y-2">
                <Row label="Điện thoại">
                  <span className="flex items-center gap-2">
                    <span>{contactPhone || '—'}</span>
                    {phoneHref && (
                      <Tooltip title="Gọi điện">
                        <button
                          type="button"
                          aria-label="Gọi điện"
                          onClick={() => { window.location.href = `tel:${phoneHref}` }}
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--theme-accent)] text-white shadow-sm transition-transform hover:brightness-110 active:scale-95 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] focus-visible:ring-offset-2 lg:hidden"
                        >
                          <PhoneOutlined />
                        </button>
                      </Tooltip>
                    )}
                  </span>
                </Row>
                <Row label="Email">
                  <span className="flex items-center gap-2">
                    <span>{contactEmail || '—'}</span>
                    {emailHref && (
                      <Tooltip title="Gửi email">
                        <button
                          type="button"
                          aria-label="Gửi email"
                          onClick={() => { window.location.href = `mailto:${emailHref}` }}
                          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--theme-accent)] text-white shadow-sm transition-transform hover:brightness-110 active:scale-95 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] focus-visible:ring-offset-2 lg:hidden"
                        >
                          <MailOutlined />
                        </button>
                      </Tooltip>
                    )}
                  </span>
                </Row>
              </div>
            </SectionCard>
          </div>

          {/* Cột phải */}
          <div className="flex flex-col gap-4">
            <SectionCard title="Lịch PT 1-1 đã book">
              {bookingsLoading === record._id ? (
                <div className="py-4 text-sm text-[var(--gs-text-muted)]">Đang tải lịch...</div>
              ) : sortedBookings.length > 0 ? (
                <div className="space-y-3">
                  {sortedBookings.map((booking) => (
                    <div key={booking._id} className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-bg)] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-semibold text-[var(--gs-text)]">
                          {dayjs(booking.date).format('dddd, DD/MM/YYYY')}
                        </div>
                        {bookingStatusTag(booking.status)}
                      </div>
                      <div className="mt-2 grid gap-2 text-sm text-[var(--gs-text-muted)] sm:grid-cols-2">
                        <span>Khung giờ: <b className="text-[var(--gs-text)]">{booking.slot || '—'}</b></span>
                        <span>Loại: <b className="text-[var(--gs-text)]">PT 1-1</b></span>
                      </div>
                      {booking.note && (
                        <div className="mt-2 text-sm text-[var(--gs-text-muted)]">Ghi chú: {booking.note}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg border border-dashed border-[var(--gs-border)] bg-[var(--gs-bg)] p-3 text-sm text-[var(--gs-text-muted)]">
                    Chưa có buổi booking cụ thể.
                  </div>
                  {(requestDays.length > 0 || requestSlots.length > 0 || requestPairs.length > 0) && (
                    <div className="space-y-2">
                      {requestPairs.length > 0 ? (
                        <Row label="Lịch mong muốn">
                          {requestPairs.map((p) => `${dayNames[p.day] || p.day} ${p.slot.replace('-', ' - ')}`).join(', ')}
                        </Row>
                      ) : (
                        <>
                          <Row label="Ngày member chọn">
                            {requestDays.length > 0 ? requestDays.map((d) => dayNames[d] || d).join(', ') : '—'}
                          </Row>
                          <Row label="Khung giờ mong muốn">
                            {requestSlots.length > 0 ? requestSlots.join(', ') : '—'}
                          </Row>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Ghi chú">
              <div className="text-sm text-[var(--gs-text)]">
                {note ? note : <span className="text-[var(--gs-text-muted)]">— Không có ghi chú.</span>}
              </div>
            </SectionCard>
          </div>
        </div>

        {/* Lưu ý */}
        <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-bg)] p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--theme-accent)]">
            Lưu ý
          </div>
          <div className="flex items-start gap-2 text-sm text-[var(--gs-text)]">
            <div className="flex shrink-0 gap-2 pt-0.5 text-[var(--theme-accent)]">
              <PhoneOutlined />
              <MailOutlined />
            </div>
            <span>PT và hội viên chủ động liên hệ qua số điện thoại hoặc email để thống nhất lịch tập.</span>
          </div>
        </div>
      </div>
    )
  }

  const pt1on1ActiveColumns = [
    {
      title: 'Hội viên',
      width: 260,
      render: (_: unknown, record: ClientInfo) => (
        <Space>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: record.avatar ? `url(${record.avatar}) center/cover` : 'var(--gs-border)',
              flexShrink: 0,
            }}
          />
          <div>
            <div
              style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--gs-text)' }}
              onClick={() => navigate(`/admin/members/${record._id}`)}
            >
              {getUserDisplayName(record, 'Thành viên')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--gs-text-muted)' }}>
              {record.memberCode ? `${record.memberCode} • ` : ''}
              {record.phone || record.email || '—'}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Chuyên môn',
      width: 110,
      render: (_: unknown, record: ClientInfo) => {
        if (record.specialization) {
          return <Tag color="blue">{record.specialization}</Tag>
        }
        return <span className="text-sm text-[var(--gs-text-muted)]">—</span>
      },
    },
    {
      title: 'Mục tiêu',
      width: 170,
      render: (_: unknown, record: ClientInfo) => {
        const goals = record.goals || []
        if (goals.length > 0) {
          return (
            <Space size={4} wrap>
              {goals.map((g, i) => (
                <Tag key={i} color="green">{g}</Tag>
              ))}
            </Space>
          )
        }
        return <span className="text-sm text-[var(--gs-text-muted)]">—</span>
      },
    },
    {
      title: 'Lịch book',
      width: 120,
      render: (_: unknown, record: ClientInfo) => {
        const bookingCount = clientBookings[record._id]?.length
        const fallbackCount = record.requestDaysOfWeek?.length || 0
        return <Tag color={bookingCount ? 'blue' : 'purple'}>{bookingCount ?? fallbackCount} buổi</Tag>
      },
    },
    {
      title: 'Trạng thái',
      width: 130,
      render: (_: unknown, record: ClientInfo) => (
        record.membershipStatus === 'active'
          ? <Tag color="blue">Đang hoạt động</Tag>
          : <Tag color="red">Đã hết hạn</Tag>
      ),
    },
    {
      title: 'Thao tác',
      width: 200,
      render: (_: unknown, record: ClientInfo) => (
        <Button
          size="small"
          icon={<PlusOutlined />}
          type="primary"
          onClick={() => navigate(createScheduleUrl(record))}
        >
          Tạo lịch & Gán giáo án
        </Button>
      ),
    },
  ]

  const groupActiveColumns = [
    {
      title: 'Hội viên',
      width: 260,
      render: (_: unknown, record: ClientInfo) => (
        <Space>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: record.avatar
                ? `url(${record.avatar}) center/cover`
                : 'var(--gs-border)',
              flexShrink: 0,
            }}
          />
          <div>
            <div
              style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--gs-text)' }}
              onClick={() => navigate(`/admin/members/${record._id}`)}
            >
              {getUserDisplayName(record, 'Thành viên')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--gs-text-muted)' }}>
              {record.memberCode ? `${record.memberCode} • ` : ''}
              {record.phone || record.email || '—'}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Lớp',
      width: 140,
      render: (_: unknown, record: ClientInfo) => {
        const ce = record.classEnrollment
        if (ce) {
          return <span className="text-sm text-[var(--gs-text)]">{ce.name}</span>
        }
        return <span className="text-sm text-[var(--gs-text-muted)] italic">Chưa xếp lớp</span>
      },
    },
    {
      title: 'Chuyên môn',
      width: 100,
      render: (_: unknown, record: ClientInfo) => {
        if (record.specialization) {
          return <Tag color="blue">{record.specialization}</Tag>
        }
        return <span className="text-sm text-[var(--gs-text-muted)]">—</span>
      },
    },
    {
      title: 'Giáo án',
      width: 180,
      render: (_: unknown, record: ClientInfo) => {
        if (record.workout) {
          return (
            <div>
              <div className="text-sm font-medium text-[var(--gs-text)]">{record.workout.name}</div>
              {record.workout.goal && (
                <div className="text-xs text-[var(--gs-text-muted)]">{record.workout.goal}</div>
              )}
            </div>
          )
        }
        return <span className="text-sm text-[var(--gs-text-muted)]">Chưa có giáo án</span>
      },
    },
    {
      title: 'Lịch',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, record: ClientInfo) => (
        <Tag color={(record.scheduleCount ?? 0) > 0 ? 'blue' : 'default'}>
          {record.scheduleCount ?? 0} lịch
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      width: 220,
      render: (_: unknown, record: ClientInfo) => (
        <Button
          size="small"
          icon={<PlusOutlined />}
          type="primary"
          onClick={() => navigate(createScheduleUrl(record))}
        >
          Tạo lịch & Gán giáo án
        </Button>
      ),
    },
  ]

  const pendingColumns = [
    {
      title: 'Hội viên',
      width: 200,
      render: (_: unknown, record: PendingApproval) => {
        const member = typeof record.memberId === 'object' ? record.memberId as PTAssignmentMember : null
        return (
          <div>
            <div className="font-medium text-[var(--gs-text)]">{getUserDisplayName(member, '—')}</div>
            {member?.memberCode && (
              <div className="text-xs text-[var(--gs-text-muted)]">{member.memberCode}</div>
            )}
          </div>
        )
      },
    },
    {
      title: 'Lớp',
      width: 160,
      render: (_: unknown, record: PendingApproval) => {
        const cls = typeof record.classId === 'object' ? record.classId : null
        return cls
          ? <span className="text-sm text-[var(--gs-text)]">{cls.name}</span>
          : <span className="text-sm text-[var(--gs-text-muted)]">—</span>
      },
    },
    {
      title: 'Giáo án hiện tại',
      width: 160,
      render: (_: unknown, record: PendingApproval) => {
        if (record.workoutData) {
          return (
            <div>
              <div className="text-sm font-medium text-[var(--gs-text)]">{record.workoutData.name}</div>
              {record.workoutData.goal && <div className="text-xs text-[var(--gs-text-muted)]">{record.workoutData.goal}</div>}
            </div>
          )
        }
        const ass = typeof record.assignmentId === 'object' ? record.assignmentId : null
        if (ass?.workoutId) return <span className="text-sm text-[var(--gs-text-muted)]">Đã gán</span>
        return <span className="text-sm text-[var(--gs-text-muted)]">—</span>
      },
    },
    {
      title: 'Ngày gửi yêu cầu',
      width: 140,
      render: (_: unknown, record: PendingApproval) => (
        <span className="text-sm text-[var(--gs-text-muted)]">{fmt(record.createdAt)}</span>
      ),
    },
    {
      title: 'Lý do',
      width: 220,
      render: (_: unknown, record: PendingApproval) => {
        const label = REASON_LABELS[record.reasonType] || record.reasonType
        if (record.reasonType === 'OTHER' && record.reasonDetail) {
          return <span className="text-sm text-[var(--gs-text)]">{record.reasonDetail}</span>
        }
        return <span className="text-sm text-[var(--gs-text)]">{label}</span>
      },
    },
    {
      title: 'Trạng thái',
      width: 140,
      render: () => (
        <Tag color="orange" icon={<ClockCircleOutlined />}>Đang chờ Admin phê duyệt</Tag>
      ),
    },
  ]

  const historyColumns = [
    {
      title: 'Hội viên',
      width: 180,
      render: (_: unknown, record: HistoryEntry) => {
        const member = typeof record.memberId === 'object' ? record.memberId as PTAssignmentMember : null
        return (
          <div>
            <div className="font-medium text-[var(--gs-text)]">{getUserDisplayName(member, '—')}</div>
            {member?.memberCode && (
              <div className="text-xs text-[var(--gs-text-muted)]">{member.memberCode}</div>
            )}
          </div>
        )
      },
    },
    {
      title: 'Loại',
      width: 150,
      render: (_: unknown, record: HistoryEntry) => {
        if (record._type === 'workout_end') {
          return <Tag color="blue">Kết thúc giáo án</Tag>
        }
        return <Tag color="purple">Kết thúc phụ trách</Tag>
      },
    },
    {
      title: 'Lớp',
      width: 140,
      render: (_: unknown, record: HistoryEntry) => {
        if (record._type === 'assignment_end') {
          const cls = typeof record.classId === 'object' ? record.classId : null
          return cls
            ? <span className="text-sm text-[var(--gs-text)]">{cls.name}</span>
            : <span className="text-sm text-[var(--gs-text-muted)]">—</span>
        }
        return <span className="text-sm text-[var(--gs-text-muted)]">—</span>
      },
    },
    {
      title: 'Ngày giờ',
      width: 150,
      render: (_: unknown, record: HistoryEntry) => {
        if (record._type === 'workout_end') {
          return <span className="text-sm text-[var(--gs-text-muted)]">{fmt(record.endedAt)}</span>
        }
        return (
          <div>
            <div className="text-xs text-[var(--gs-text-muted)]">Gửi yêu cầu: {fmt(record.requestedAt)}</div>
            <div className="text-xs text-[var(--gs-text-muted)]">Phê duyệt: {fmt(record.approvedAt)}</div>
          </div>
        )
      },
    },
    {
      title: 'Lý do',
      width: 220,
      render: (_: unknown, record: HistoryEntry) => {
        if (record._type === 'workout_end') {
          return <span className="text-sm text-[var(--gs-text-muted)]">—</span>
        }
        const label = REASON_LABELS[record.reasonType || ''] || record.reasonType || '—'
        if (record.reasonType === 'OTHER' && record.reasonDetail) {
          return <span className="text-sm text-[var(--gs-text)]">{record.reasonDetail}</span>
        }
        return <span className="text-sm text-[var(--gs-text)]">{label}</span>
      },
    },
    {
      title: 'PT',
      width: 120,
      render: (_: unknown, record: HistoryEntry) => {
        const pt = typeof record.ptId === 'object' ? record.ptId : null
        return <span className="text-sm text-[var(--gs-text-muted)]">{pt ? getUserDisplayName(pt, '—') : '—'}</span>
      },
    },
  ]

  // ============ RENDER TABS ============

  const isPt1on1 = serviceTab === 'pt1on1'
  const pt1on1Count = clients.filter(c => c.type === 'PT_1_1').length
  const groupCount = clients.filter(c => c.type === 'GROUP').length
  const activeLabel = isPt1on1 ? 'Đang phụ trách' : 'Đang hướng dẫn'
  const serviceClients = clients.filter(c => (c.type === 'PT_1_1') === isPt1on1)

  const specializationOptions = Array.from(new Set(
    serviceClients.map(c => c.specialization).filter(Boolean)
  )).sort().map(s => ({ value: s, label: s }))

  const goalOptions = Array.from(new Set(
    serviceClients.flatMap(c => c.goals || [])
  )).sort().map(g => ({ value: g, label: g }))

  const filteredClients = clients.filter(c => {
    if ((c.type === 'PT_1_1') !== isPt1on1) return false
    if (filterSpecialization) {
      if (c.specialization !== filterSpecialization) return false
    }
    if (filterGoals.length > 0) {
      const cGoals = c.goals || []
      if (!filterGoals.some(g => cGoals.includes(g))) return false
    }
    return true
  })

  const filteredPending = pendingItems.filter(p =>
    (p.type === 'PT_1_1') === isPt1on1
  )
  const filteredHistory = historyItems.filter(h =>
    (h.type === 'PT_1_1') === isPt1on1
  )
  const pendingCols = isPt1on1
    ? pendingColumns.filter(c => c.title !== 'Lớp' && c.title !== 'Giáo án hiện tại')
    : pendingColumns
  const historyCols = isPt1on1
    ? historyColumns.filter(c => c.title !== 'Lớp')
    : historyColumns

  const activeTabEl = (
    <div className="member-scroll-x">
      {assignWorkoutId && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-2">
          <span className="text-sm text-blue-300">
            Đã chọn giáo án: <b>{assignWorkoutName || 'Đang tải...'}</b> — chọn hội viên rồi bấm "Tạo lịch & Gán giáo án" để áp dụng.
          </span>
          <Button size="small" onClick={() => navigate('/pt/clients')}>Hủy chọn</Button>
        </div>
      )}
      <div className="pt-clients-filters mb-4 flex flex-wrap items-center gap-3">
        <Select
          className="max-[767px]:!w-full"
          style={{ minWidth: 150 }}
          placeholder="Lọc theo chuyên môn"
          allowClear
          value={filterSpecialization}
          onChange={(v) => setFilterSpecialization(v || undefined)}
          options={specializationOptions}
        />
        <Select
          className="max-[767px]:!w-full"
          style={{ minWidth: 200 }}
          placeholder="Lọc theo mục tiêu"
          allowClear
          mode="multiple"
          value={filterGoals}
          onChange={(v) => setFilterGoals(v || [])}
          options={goalOptions}
        />
      </div>
      <Table className="pt-clients-table"
        dataSource={filteredClients}
        columns={isPt1on1 ? pt1on1ActiveColumns : groupActiveColumns}
        rowKey="_id"
        loading={clientsLoading}
        pagination={{ pageSize: 15 }}
        locale={{ emptyText: <Empty description="Chưa có học viên nào" /> }}
        expandable={{
          expandedRowRender: (record) => {
            if (record.type === 'PT_1_1') {
              return pt1on1Expand(record)
            }
            const schedules = clientSchedules[record._id] || []
            return (
              <div className="p-2">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--gs-text-muted)]">
                    {schedules.length} lịch tập
                  </span>
                  <Space size={8}>
                    <Button
                      size="small"
                      icon={<ReloadOutlined />}
                      onClick={() => fetchClientSchedules(record._id)}
                    >
                      Tải lại
                    </Button>
                    <Button
                      size="small"
                      danger
                      onClick={() => setEndRequestModal({ open: true, client: record })}
                    >
                      Kết thúc phụ trách
                    </Button>
                  </Space>
                </div>
                <Table
                  dataSource={schedules}
                  columns={expandedScheduleColumns(record)}
                  rowKey="_id"
                  loading={schedulesLoading === record._id}
                  pagination={false}
                  locale={{ emptyText: <Empty description="Chưa có lịch tập" /> }}
                />
              </div>
            )
          },
          expandedRowKeys: expandedMemberId ? [expandedMemberId] : [],
          onExpand: handleExpand,
        }}
      />
      {/* Mobile cards */}
      <div className="pt-clients-cards">
        {filteredClients.map((record) => {
          const ce = record.classEnrollment
          const goals = record.goals || []
          const genderIcon = record.gender === 'female' ? '♀' : record.gender === 'male' ? '♂' : ''
          const isExpanded = expandedMemberId === record._id
          const schedules = clientSchedules[record._id] || []
          const days = remainingDays(record.membershipExpiresAt)
          const isPt1on1 = record.type === 'PT_1_1'
          return (
            <div key={record._id} className="pt-client-card">
              <div className="pt-client-header" style={{ cursor: 'pointer' }} onClick={() => handleExpand(expandedMemberId !== record._id, record)}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: record.avatar ? `url(${record.avatar}) center/cover` : 'var(--gs-border)', flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <div className="pt-client-name truncate">{getUserDisplayName(record, 'Thành viên')}</div>
                  <div className="pt-client-code truncate">{record.memberCode ? `${record.memberCode}${genderIcon ? ' • ' + genderIcon : ''}${record.phone ? ' • ' + record.phone : ''}` : record.phone || record.email || ''}</div>
                </div>
                <div className="pt-client-expand-btn" style={{ flexShrink: 0, fontSize: 22, lineHeight: 1, fontWeight: 700, color: isExpanded ? 'var(--theme-accent)' : 'var(--gs-text-muted)', padding: '4px 4px 0 0', alignSelf: 'flex-start' }}>
                  {isExpanded ? '−' : '+'}
                </div>
              </div>
              {isPt1on1 ? (
                <>
                  <div className="pt-client-detail">
                    <span className="pt-label">Lịch book</span>
                    <span className="pt-value">
                      <Tag color={clientBookings[record._id]?.length ? 'blue' : 'purple'} className="m-0">
                        {clientBookings[record._id]?.length ?? record.requestDaysOfWeek?.length ?? 0} buổi
                      </Tag>
                    </span>
                  </div>
                  {record.specialization && (
                    <div className="pt-client-detail">
                      <span className="pt-label">Chuyên môn</span>
                      <span className="pt-value"><Tag color="blue" className="m-0">{record.specialization}</Tag></span>
                    </div>
                  )}
                  {goals.length > 0 && (
                    <div className="pt-client-detail">
                      <span className="pt-label">Mục tiêu</span>
                      <span className="pt-value">{goals.join(', ')}</span>
                    </div>
                  )}
                  <div className="pt-client-detail">
                    <span className="pt-label">Trạng thái</span>
                    <span className="pt-value">
                      {record.membershipStatus === 'active'
                        ? <Tag color="blue" className="m-0">Đang hoạt động</Tag>
                        : <Tag color="red" className="m-0">Đã hết hạn</Tag>}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="pt-client-detail">
                    <span className="pt-label">Lớp</span>
                    <span className="pt-value">{ce ? ce.name : <span className="italic text-[var(--gs-text-muted)]">Chưa xếp lớp</span>}</span>
                  </div>
                  {record.specialization && (
                    <div className="pt-client-detail">
                      <span className="pt-label">Chuyên môn</span>
                      <span className="pt-value"><Tag color="blue" className="m-0">{record.specialization}</Tag></span>
                    </div>
                  )}
                  {goals.length > 0 && (
                    <div className="pt-client-detail">
                      <span className="pt-label">Mục tiêu</span>
                      <span className="pt-value">{goals.join(', ')}</span>
                    </div>
                  )}
                  <div className="pt-client-detail">
                    <span className="pt-label">Gói tập</span>
                    <span className="pt-value">
                      {record.membershipStatus === 'active'
                        ? <>
                            <Tag color="success" className="m-0">🟢 Đang hoạt động</Tag>
                            {days !== null && <div className="mt-1 text-xs text-[var(--gs-text-muted)]">Còn {days} ngày</div>}
                          </>
                        : <Tag color="red" className="m-0">🔴 Đã hết hạn</Tag>}
                    </span>
                  </div>
                </>
              )}
              {!isPt1on1 && (
                <div className="pt-client-detail">
                  <span className="pt-label">Lịch tập</span>
                  <span className="pt-value"><Tag color={(record.scheduleCount ?? 0) > 0 ? 'blue' : 'default'} className="m-0">{record.scheduleCount ?? 0} lịch</Tag></span>
                </div>
              )}
              {!isPt1on1 && (
                <div className="pt-client-detail">
                  <span className="pt-label">Giáo án</span>
                  <span className="pt-value">
                    {record.workout
                      ? <span>{record.workout.name}</span>
                      : <span className="text-[var(--gs-text-muted)]">Chưa có giáo án</span>}
                  </span>
                </div>
              )}
              <div className="pt-client-actions">
                <Button
                  type="primary"
                  size="small"
                  block
                  icon={<PlusOutlined />}
                  onClick={() => navigate(createScheduleUrl(record))}
                >
                  Tạo lịch & Gán giáo án
                </Button>
              </div>
              {isExpanded && (
                <div className="mt-3 border-t border-[var(--gs-border)] pt-3">
                  {isPt1on1 ? (
                    pt1on1Expand(record)
                  ) : (
                    <>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[var(--gs-text-muted)]">{schedules.length} lịch tập</span>
                    <div className="flex gap-2">
                      <Button size="small" icon={<ReloadOutlined />} onClick={() => fetchClientSchedules(record._id)}>Tải lại</Button>
                      <Button size="small" danger onClick={() => setEndRequestModal({ open: true, client: record })}>
                        Kết thúc phụ trách
                      </Button>
                    </div>
                  </div>
                  {schedules.length > 0 ? (
                    <div className="space-y-3">
                      {schedules.map((sched: any) => {
                        const tpl = sched.templateId as any
                        const sessions = sched.sessions || []
                        const done = sessions.filter((s: any) => s.status === 'completed').length
                        const weekInfo = sched.totalWeeks && sched.totalWeeks > 1
                          ? ` - Tuần ${sched.weekIndex || '?'}/${sched.totalWeeks}`
                          : ''
                        const statusColor = sched.status === 'active' ? 'green' : sched.status === 'completed' ? 'blue' : 'default'
                        const statusLabel = sched.status === 'active' ? 'Đang hoạt động' : sched.status === 'completed' ? 'Hoàn thành' : '—'
                        return (
                          <div key={sched._id} className="rounded-lg border border-[var(--gs-border)] p-3 text-sm">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <div className="font-medium text-[var(--gs-text)]">{(tpl?.name || 'Giáo án mẫu') + weekInfo}</div>
                                {tpl?.goal && <div className="text-xs text-[var(--gs-text-muted)]">{tpl.goal}</div>}
                              </div>
                              <Tag color={statusColor} className="m-0 shrink-0">{statusLabel}</Tag>
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-xs text-[var(--gs-text-muted)] mb-2">
                              <div>Số buổi: <span className="font-medium text-[var(--gs-text)]">{sessions.length} buổi</span></div>
                              <div>Tiến độ: <span className="font-medium text-[var(--gs-text)]">{done}/{sessions.length}</span></div>
                            </div>
                            <div className="flex gap-2">
                              <Button size="small" type="primary" ghost
                                onClick={() => navigate(`/pt/clients/${record._id}/progress?assignmentId=${record.assignmentId || ''}&scheduleId=${sched._id}`)}>
                                Xem tiến độ
                              </Button>
                              <Popconfirm title="Xoá lịch tập này?" okText="Xoá" cancelText="Huỷ" okButtonProps={{ danger: true }}
                                onConfirm={() => handleDeleteSchedule(sched)}>
                                <Tooltip title="Xoá lịch tập">
                                  <Button size="small" danger icon={<DeleteOutlined />} />
                                </Tooltip>
                              </Popconfirm>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="py-4 text-center text-sm text-[var(--gs-text-muted)]">Chưa có lịch tập</div>
                  )}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  const pendingTabEl = (
    <div>
      <div className="pt-clients-table member-scroll-x">
        <Table
          dataSource={filteredPending}
          columns={pendingCols}
          rowKey="_id"
          loading={pendingLoading}
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: <Empty description="Không có yêu cầu chờ duyệt" /> }}
        />
      </div>
      <div className="pt-clients-cards">
        {filteredPending.map((record: PendingApproval) => {
          const member = typeof record.memberId === 'object' ? record.memberId as PTAssignmentMember : null
          const cls = typeof record.classId === 'object' ? record.classId : null
          const label = REASON_LABELS[record.reasonType] || record.reasonType
          return (
            <div key={(record as any)._id} className="pt-client-card">
              <div className="pt-client-header">
                <div className="pt-client-name">{getUserDisplayName(member, '—')}</div>
                {member?.memberCode && <div className="pt-client-code truncate">{member.memberCode}</div>}
              </div>
              {!isPt1on1 && <div className="pt-client-detail"><span className="pt-label">Lớp</span><span className="pt-value">{cls?.name || '—'}</span></div>}
              {member?.specialization && <div className="pt-client-detail"><span className="pt-label">Chuyên môn</span><span className="pt-value"><Tag color="blue" className="m-0">{member.specialization}</Tag></span></div>}
              <div className="pt-client-detail"><span className="pt-label">Ngày gửi</span><span className="pt-value">{fmt(record.createdAt)}</span></div>
              <div className="pt-client-detail"><span className="pt-label">Lý do</span><span className="pt-value">{record.reasonType === 'OTHER' && record.reasonDetail ? record.reasonDetail : label}</span></div>
              <div className="pt-client-detail"><span className="pt-label">Trạng thái</span><span className="pt-value"><Tag color="orange" className="m-0" icon={<ClockCircleOutlined />}>Chờ Admin phê duyệt</Tag></span></div>
              <div className="pt-client-actions">
                <Button type="primary" size="small" block>Phê duyệt</Button>
              </div>
            </div>
          )
        })}
        {filteredPending.length === 0 && !pendingLoading && (
          <div className="text-center py-10 text-[var(--gs-text-muted)]">Không có yêu cầu chờ duyệt</div>
        )}
      </div>
    </div>
  )

  const historyTabEl = (
    <div>
      <div className="pt-clients-filters mb-4 flex flex-wrap items-center gap-3">
        <Select
          className="max-[767px]:!w-full"
          allowClear
          placeholder="Loại kết thúc"
          style={{ width: 180 }}
          value={historyType}
          onChange={(v) => setHistoryType(v)}
          options={[
            { value: 'workout_end', label: 'Kết thúc giáo án' },
            { value: 'assignment_end', label: 'Kết thúc phụ trách' },
          ]}
        />
        <DatePicker
          className="max-[767px]:!w-full"
          placeholder="Từ ngày"
          format="DD/MM/YYYY"
          onChange={(d) => setHistoryFromDate(d?.startOf('day').toISOString() || undefined)}
        />
        <DatePicker
          className="max-[767px]:!w-full"
          placeholder="Đến ngày"
          format="DD/MM/YYYY"
          onChange={(d) => setHistoryToDate(d?.endOf('day').toISOString() || undefined)}
        />
        <Input
          className="max-[767px]:!w-full"
          placeholder="Tìm kiếm..."
          prefix={<SearchOutlined />}
          style={{ width: 220 }}
          value={historySearch}
          onChange={(e) => setHistorySearch(e.target.value)}
          onPressEnter={() => fetchHistory(1)}
        />
        <Button type="primary" onClick={() => fetchHistory(1)} className="max-[767px]:w-full max-[767px]:min-h-[44px]">
          Tìm kiếm
        </Button>
      </div>
      <div className="pt-clients-table member-scroll-x">
        <Table
          dataSource={filteredHistory}
          columns={historyCols}
          rowKey={(r) => `${r._type}_${r._id}`}
          loading={historyLoading}
          pagination={{
            pageSize: historyPagination.limit,
            current: historyPagination.page,
            total: historyPagination.total,
            onChange: (p) => fetchHistory(p),
          }}
          locale={{ emptyText: <Empty description="Chưa có dữ liệu" /> }}
        />
      </div>
      <div className="pt-clients-cards">
        {filteredHistory.map((record: HistoryEntry) => {
          const member = typeof record.memberId === 'object' ? record.memberId as PTAssignmentMember : null
          const cls = typeof record.classId === 'object' ? record.classId : null
          const pt = typeof (record as any).ptId === 'object' ? (record as any).ptId : null
          const label = REASON_LABELS[(record as any).reasonType || ''] || (record as any).reasonType || '—'
          const reasonText = (record as any).reasonType === 'OTHER' && (record as any).reasonDetail ? (record as any).reasonDetail : label
          return (
            <div key={`${record._type}_${(record as any)._id}`} className="pt-client-card">
              <div className="pt-client-header">
                <div className="pt-client-name">{getUserDisplayName(member, '—')}</div>
                {member?.memberCode && <div className="pt-client-code truncate">{member.memberCode}</div>}
              </div>
              <div className="pt-client-detail"><span className="pt-label">Loại</span><span className="pt-value">{record._type === 'workout_end' ? <Tag color="blue" className="m-0">Kết thúc giáo án</Tag> : <Tag color="purple" className="m-0">Kết thúc phụ trách</Tag>}</span></div>
              {!isPt1on1 && <div className="pt-client-detail"><span className="pt-label">Lớp</span><span className="pt-value">{cls?.name || '—'}</span></div>}
              {record._type === 'workout_end' ? (
                <div className="pt-client-detail"><span className="pt-label">Ngày kết thúc</span><span className="pt-value">{fmt((record as any).endedAt)}</span></div>
              ) : (
                <>
                  <div className="pt-client-detail"><span className="pt-label">Gửi yêu cầu</span><span className="pt-value">{fmt((record as any).requestedAt)}</span></div>
                  <div className="pt-client-detail"><span className="pt-label">Phê duyệt</span><span className="pt-value">{fmt((record as any).approvedAt)}</span></div>
                </>
              )}
              {record._type !== 'workout_end' && <div className="pt-client-detail"><span className="pt-label">Lý do</span><span className="pt-value">{reasonText}</span></div>}
              <div className="pt-client-detail"><span className="pt-label">PT</span><span className="pt-value">{pt ? getUserDisplayName(pt, '—') : '—'}</span></div>
            </div>
          )
        })}
        {filteredHistory.length === 0 && !historyLoading && (
          <div className="text-center py-10 text-[var(--gs-text-muted)]">Chưa có dữ liệu</div>
        )}
      </div>
    </div>
  )

  const tabContent = activeTab === 'active' ? activeTabEl : activeTab === 'pending' ? pendingTabEl : historyTabEl

  // ============ RENDER ============

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">PT</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">
          Học viên của tôi
        </h1>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">
          {activeTab === 'active' ? `${(isPt1on1 ? pt1on1Count : groupCount)} học viên` :
           activeTab === 'pending' ? `${filteredPending.length} yêu cầu` :
           `${filteredHistory.length} mục`}
        </p>
      </div>

      {/* Main tab: loại dịch vụ (PT 1-1 | PT nhóm) */}
      <div className="pt-clients-tabs mb-2 flex gap-6 border-b border-[var(--gs-border)] max-[767px]:overflow-x-auto max-[767px]:whitespace-nowrap max-[767px]:pb-1 max-[767px]:gap-4">
        <button
          onClick={() => setServiceTab('pt1on1')}
          className={`pb-3 font-semibold transition ${
            serviceTab === 'pt1on1'
              ? 'border-b-2 border-[var(--theme-accent)] text-[var(--theme-accent)]'
              : 'text-[var(--gs-text-muted)] hover:text-[var(--gs-text)]'
          }`}
        >
          PT 1-1 {pt1on1Count > 0 && <span className="ml-1 text-xs">({pt1on1Count})</span>}
        </button>
        <button
          onClick={() => setServiceTab('group')}
          className={`pb-3 font-semibold transition ${
            serviceTab === 'group'
              ? 'border-b-2 border-[var(--theme-accent)] text-[var(--theme-accent)]'
              : 'text-[var(--gs-text-muted)] hover:text-[var(--gs-text)]'
          }`}
        >
          PT nhóm {groupCount > 0 && <span className="ml-1 text-xs">({groupCount})</span>}
        </button>
      </div>

      {/* Status sub-tab */}
      <div className="pt-clients-tabs mb-4 flex gap-4 border-b border-[var(--gs-border)] max-[767px]:overflow-x-auto max-[767px]:whitespace-nowrap max-[767px]:pb-1 max-[767px]:gap-3">
        <button
          onClick={() => setActiveTab('active')}
          className={`pb-3 font-semibold transition ${
            activeTab === 'active'
              ? 'border-b-2 border-[var(--theme-accent)] text-[var(--theme-accent)]'
              : 'text-[var(--gs-text-muted)] hover:text-[var(--gs-text)]'
          }`}
        >
          {activeLabel}
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-3 font-semibold transition ${
            activeTab === 'pending'
              ? 'border-b-2 border-[var(--theme-accent)] text-[var(--theme-accent)]'
              : 'text-[var(--gs-text-muted)] hover:text-[var(--gs-text)]'
          }`}
        >
          Chờ Admin phê duyệt
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 font-semibold transition ${
            activeTab === 'history'
              ? 'border-b-2 border-[var(--theme-accent)] text-[var(--theme-accent)]'
              : 'text-[var(--gs-text-muted)] hover:text-[var(--gs-text)]'
          }`}
        >
          Đã kết thúc
        </button>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
        {tabContent}
      </div>

      <Modal
        title="Kết thúc phụ trách"
        open={endRequestModal.open}
        onCancel={() => {
          setEndRequestModal({ open: false, client: null })
        }}
        okText="Xác nhận kết thúc"
        cancelText="Hủy"
        confirmLoading={submittingEnd}
        onOk={handleEndRequest}
      >
        <div className="space-y-3 text-sm text-[var(--gs-text)]">
          <p className="font-semibold">Kết thúc phụ trách học viên?</p>
          <p>Sau khi xác nhận:</p>
          <ul className="list-disc space-y-1 pl-5 text-[var(--gs-text-muted)]">
            <li>PT sẽ không còn phụ trách hội viên này.</li>
            <li>Hội viên sẽ không còn xuất hiện trong danh sách khách hàng của PT.</li>
            <li>Lịch tập nhóm/PT sẽ kết thúc.</li>
            <li>Giáo án đang gán sẽ được ngừng sử dụng.</li>
            <li>Hội viên có thể đăng ký PT hoặc lớp mới sau đó.</li>
          </ul>
        </div>
      </Modal>

      <Modal
        title="Thêm buổi tập vào giáo án"
        open={addSessionModal.open}
        onCancel={() => setAddSessionModal((p) => ({ ...p, open: false, schedule: null }))}
        okText="Thêm buổi"
        cancelText="Hủy"
        confirmLoading={addSessionModal.submitting}
        onOk={handleAddSession}
        destroyOnClose
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--gs-text-muted)]">
            Buổi mới sẽ tự động gán <b>buổi kế tiếp chưa hoàn thành</b> trong giáo án mẫu
            (dùng khi hội viên mua thêm buổi PT). Nếu giáo án đã hết buổi, buổi mới sẽ trống để PT tự soạn nội dung.
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--gs-text-muted)]">Ngày tập</label>
            <DatePicker
              className="w-full"
              value={addSessionModal.date}
              disabledDate={(d) => d.isBefore(dayjs().startOf('day'))}
              onChange={(d) => setAddSessionModal((p) => ({ ...p, date: d }))}
              format="DD/MM/YYYY"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--gs-text-muted)]">Khung giờ (1 giờ)</label>
            <Select
              className="w-full"
              placeholder="Chọn khung giờ..."
              value={addSessionModal.time || undefined}
              onChange={(v) => setAddSessionModal((p) => ({ ...p, time: v }))}
              showSearch
              options={['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']
                .map((t) => ({ value: t, label: t }))}
            />
          </div>
          {addSessionModal.schedule && (
            <p className="text-xs text-[var(--gs-text-muted)]">
              Giáo án:{' '}
              {(() => {
                const tpl = addSessionModal.schedule?.templateId
                const name = tpl && typeof tpl === 'object' ? (tpl as { name?: string }).name : undefined
                return name || 'Giáo án mẫu'
              })()}
            </p>
          )}
        </div>
      </Modal>

    </DashboardLayout>
  )
}
