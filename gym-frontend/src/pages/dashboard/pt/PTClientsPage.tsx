import {
  CheckCircleFilled,
  ClockCircleOutlined,
  DeleteOutlined,
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
  Radio,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { useAuth } from '../../../hooks/useAuth'
import { socketService } from '../../../services/socketService'
import {
  ptAssignmentService,
  enrollmentService,
  type EnrollmentPreviewClass,
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
  membershipStatus?: 'active' | 'pending_initial_activation' | null
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
    name: member.name || member.fullName || '',
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
    cancelledAt: assignment.cancelledAt,
    cancelReason: assignment.cancelReason,
  }
}

const FORMAT_DATE = 'DD/MM/YYYY HH:mm'

function fmt(d: string | undefined | null): string {
  if (!d) return '—'
  return dayjs(d).format(FORMAT_DATE)
}

export default function PTClientsPage() {
  useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'active' | 'pending' | 'history'>('active')

  // Tab 1: Active clients
  const [clients, setClients] = useState<ClientInfo[]>([])
  const [clientsLoading, setClientsLoading] = useState(false)
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null)
  const [clientSchedules, setClientSchedules] = useState<Record<string, WorkoutSchedule[]>>({})
  const [schedulesLoading, setSchedulesLoading] = useState<string | null>(null)
  const [filterClass, setFilterClass] = useState<string | undefined>(undefined)
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
  const [endReason, setEndReason] = useState<string>('MEMBER_COMPLETED')
  const [endDetail, setEndDetail] = useState('')
  const [submittingEnd, setSubmittingEnd] = useState(false)

  // Class enrollment modal (transfer / leave)
  const [classModal, setClassModal] = useState<{
    open: boolean
    client: ClientInfo | null
    mode: 'transfer' | 'leave' | null
  }>({ open: false, client: null, mode: null })
  const [enrollmentPreview, setEnrollmentPreview] = useState<{
    currentEnrollment: {
      enrollmentId: string
      classId: string
      code?: string
      name?: string
      joinedAt?: string
    } | null
    availableClasses: EnrollmentPreviewClass[]
  } | null>(null)
  const [enrollmentLoading, setEnrollmentLoading] = useState(false)
  const [selectedTargetClass, setSelectedTargetClass] = useState<string | null>(null)
  const [classActionReason, setClassActionReason] = useState('')
  const [submittingClassAction, setSubmittingClassAction] = useState(false)

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
    socketService.connect()
    socketService.on('pt_end_request:status_changed', handler)
    return () => { socketService.off('pt_end_request:status_changed', handler) }
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

  const handleExpand = (expanded: boolean, record: ClientInfo) => {
    if (expanded) {
      setExpandedMemberId(record._id)
      if (!clientSchedules[record._id]) {
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

  // ============ END REQUEST ============

  const handleEndRequest = async () => {
    if (!endRequestModal.client) return

    if (endReason === 'OTHER' && !endDetail.trim()) {
      message.error('Vui lòng nhập lý do.')
      return
    }

    setSubmittingEnd(true)
    try {
      const client = endRequestModal.client
      const classId = client.classId && typeof client.classId === 'object'
        ? (client.classId as { _id: string })._id
        : client.classId
      await ptAssignmentEndService.create({
        memberId: client._id,
        reasonType: endReason,
        reasonDetail: endReason === 'OTHER' ? endDetail.trim() : undefined,
        assignmentId: client.assignmentId,
        classId,
      })
      message.success('Đã gửi yêu cầu kết thúc phụ trách')
      setEndRequestModal({ open: false, client: null })
      setEndReason('MEMBER_COMPLETED')
      setEndDetail('')
      // Remove member from active list immediately
      if (endRequestModal.client) {
        setClients((prev) => prev.filter((c) => c._id !== endRequestModal.client!._id))
        if (expandedMemberId === endRequestModal.client._id) {
          setExpandedMemberId(null)
        }
      }
      fetchPending()
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể gửi yêu cầu')
    } finally {
      setSubmittingEnd(false)
    }
  }

  // ============ COLUMNS ============

  const hasActiveSchedule = useCallback((client: ClientInfo) => {
    const schedules = clientSchedules[client._id] || []
    return schedules.some((s) => s.status === 'active')
  }, [clientSchedules])

  const handleEndAllWorkouts = useCallback(async (client: ClientInfo) => {
    const schedules = clientSchedules[client._id] || []
    const activeSchedules = schedules.filter((s) => s.status === 'active')
    if (activeSchedules.length === 0) return

    if (!client.assignmentId) {
      message.error('Không tìm thấy assignmentId — không thể kết thúc giáo án')
      return
    }

    // Step 1: dry-check with backend to get authoritative preview of incomplete sessions
    let dryCheck: {
      allComplete: boolean
      totalSessions: number
      totalCompletedSessions: number
      totalIncomplete: number
      perSchedule: Array<{
        scheduleId: string
        weekLabel: string
        totalSessions: number
        completedSessions: number
        incompleteSessions: number
      }>
    } | null = null

    try {
      const { data } = await ptAssignmentService.endWorkout(client.assignmentId, undefined, client._id)
      if (!data?.dryCheck) {
        // Backend performed the end directly (unexpected in dry-check mode) — just refresh
        message.success(data?.message || 'Đã kết thúc toàn bộ giáo án')
        if (expandedMemberId) fetchClientSchedules(expandedMemberId)
        fetchClients()
        return
      }
      dryCheck = {
        allComplete: !!data.allComplete,
        totalSessions: data.preview?.totalSessions ?? 0,
        totalCompletedSessions: data.preview?.totalCompletedSessions ?? 0,
        totalIncomplete: data.preview?.totalIncomplete ?? 0,
        perSchedule: data.preview?.perSchedule ?? [],
      }
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Không thể kiểm tra trạng thái giáo án')
      return
    }

    // Step 2: show modal with detailed preview from backend, then call confirm=true
    const detailLines = dryCheck.perSchedule
      .map((w) => w.incompleteSessions > 0
        ? `${w.weekLabel}: còn thiếu ${w.incompleteSessions} buổi (đã hoàn thành ${w.completedSessions}/${w.totalSessions})`
        : `${w.weekLabel}: đã hoàn thành ${w.completedSessions}/${w.totalSessions} buổi`)
      .join('\n')

    const content = dryCheck.allComplete
      ? 'Tất cả buổi tập đã hoàn thành. Bạn có chắc muốn kết thúc TOÀN BỘ giáo án? Hành động này không thể hoàn tác.'
      : `${detailLines}\n\nTổng cộng còn ${dryCheck.totalIncomplete} buổi chưa hoàn thành.\n\nNếu tiếp tục, các buổi chưa hoàn thành sẽ bị đánh dấu là đã kết thúc vĩnh viễn. Hành động này không thể hoàn tác.`

    Modal.confirm({
      title: dryCheck.allComplete ? 'Kết thúc toàn bộ giáo án?' : 'Vẫn kết thúc giáo án (cảnh báo)?',
      content: <pre className="whitespace-pre-wrap text-sm text-[var(--gs-text)]">{content}</pre>,
      okText: dryCheck.allComplete ? 'Kết thúc' : 'Vẫn kết thúc giáo án',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const { data: result } = await ptAssignmentService.endWorkout(
            client.assignmentId!,
            undefined,
            client._id,
            true, // confirm=true → actually perform the end
          )
          message.success(result?.message || 'Đã kết thúc toàn bộ giáo án')
          if (expandedMemberId) fetchClientSchedules(expandedMemberId)
          fetchClients()
        } catch (err: any) {
          message.error(err?.response?.data?.message || 'Không thể kết thúc giáo án')
        }
      },
    })
  }, [clientSchedules, expandedMemberId, fetchClientSchedules, fetchClients])

  // ============ CLASS ENROLLMENT: Transfer / Leave ============

  const openClassModal = useCallback(async (client: ClientInfo, mode: 'transfer' | 'leave') => {
    setClassModal({ open: true, client, mode })
    setEnrollmentPreview(null)
    setSelectedTargetClass(null)
    setClassActionReason('')
    setEnrollmentLoading(true)
    try {
      const { data } = await enrollmentService.getPreview(client._id)
      setEnrollmentPreview(data)
      // Preselect first non-full class that is not current
      if (mode === 'transfer') {
        const first = data.availableClasses.find(c => !c.isFull && !c.isCurrent)
        if (first) setSelectedTargetClass(first._id)
      }
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Không thể tải thông tin lớp')
      setClassModal({ open: false, client: null, mode: null })
    } finally {
      setEnrollmentLoading(false)
    }
  }, [])

  const submitClassAction = useCallback(async () => {
    const { client, mode } = classModal
    if (!client || !mode) return

    if (mode === 'transfer' && !selectedTargetClass) {
      message.warning('Vui lòng chọn lớp đích')
      return
    }

    setSubmittingClassAction(true)
    try {
      if (mode === 'transfer') {
        const { data } = await enrollmentService.transferClass({
          memberId: client._id,
          toClassId: selectedTargetClass!,
          reason: classActionReason || undefined,
        })
        message.success(data.message)
      } else {
        const { data } = await enrollmentService.leaveClass({
          memberId: client._id,
          reason: classActionReason || undefined,
        })
        message.success(data.message)
      }
      setClassModal({ open: false, client: null, mode: null })
      // Refresh schedules for this member so the class label updates if expanded
      if (expandedMemberId) fetchClientSchedules(expandedMemberId)
      fetchClients()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Không thể thực hiện thao tác')
    } finally {
      setSubmittingClassAction(false)
    }
  }, [classModal, selectedTargetClass, classActionReason, expandedMemberId, fetchClientSchedules, fetchClients])

  const closeClassModal = useCallback(() => {
    setClassModal({ open: false, client: null, mode: null })
    setEnrollmentPreview(null)
    setSelectedTargetClass(null)
    setClassActionReason('')
  }, [])

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
      width: 200,
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

  const activeColumns = [
    {
      title: 'Khách hàng',
      width: 280,
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
      title: 'Mục tiêu',
      width: 160,
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
      title: 'Gói tập',
      width: 130,
      render: (_: unknown, record: ClientInfo) => (
        record.membershipStatus === 'pending_initial_activation'
          ? <Tag color="orange">🟡 Chờ kích hoạt</Tag>
          : record.membershipStatus === 'active'
            ? <Tag color="green">🟢 Đang hoạt động</Tag>
            : <span className="text-xs text-[var(--gs-text-muted)]">—</span>
      ),
    },
    {
      title: 'Lịch tập',
      width: 120,
      align: 'center' as const,
      render: (_: unknown, record: ClientInfo) => (
        <Tag color={(record.scheduleCount ?? 0) > 0 ? 'blue' : 'default'}>
          {record.scheduleCount ?? 0} lịch
        </Tag>
      ),
    },
    {
      title: 'Giáo án hiện tại',
      width: 200,
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
      title: 'Thao tác',
      width: 220,
      render: (_: unknown, record: ClientInfo) => (
        <Button
          size="small"
          icon={<PlusOutlined />}
          type="primary"
          onClick={() => navigate(`/pt/clients/${record._id}/create-schedule?assignmentId=${record.assignmentId || ''}`)}
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

  const endRequestReasons = [
    { value: 'MEMBER_COMPLETED', label: 'Hội viên hoàn thành khóa học' },
    { value: 'MEMBER_REQUEST_CHANGE_PT', label: 'Hội viên yêu cầu đổi PT' },
    { value: 'MEMBER_QUIT', label: 'Hội viên xin nghỉ tập' },
    { value: 'PT_NO_LONGER_TEACHES', label: 'PT không còn phụ trách lớp' },
    { value: 'OTHER', label: 'Khác' },
  ]

  // ============ RENDER TABS ============

  // Derive filter options from clients
  const classOptions = Array.from(new Map(
    clients.map(c => {
      const ce = c.classEnrollment
      return ce ? [ce._id, { value: ce._id, label: ce.name }] as const : null
    }).filter(Boolean) as Array<readonly [string, { value: string; label: string }]>
  ).values()).sort((a, b) => a.label.localeCompare(b.label))

  const specializationOptions = Array.from(new Set(
    clients.map(c => c.specialization).filter(Boolean)
  )).sort().map(s => ({ value: s, label: s }))

  const goalOptions = Array.from(new Set(
    clients.flatMap(c => c.goals || [])
  )).sort().map(g => ({ value: g, label: g }))

  const filteredClients = clients.filter(c => {
    if (filterClass) {
      const ce = c.classEnrollment
      if (!ce || ce._id !== filterClass) return false
    }
    if (filterSpecialization) {
      if (c.specialization !== filterSpecialization) return false
    }
    if (filterGoals.length > 0) {
      const cGoals = c.goals || []
      if (!filterGoals.some(g => cGoals.includes(g))) return false
    }
    return true
  })

  const activeTabEl = (
    <div className="member-scroll-x">
      <div className="pt-clients-filters mb-4 flex flex-wrap items-center gap-3">
        <Select
          className="max-[767px]:!w-full"
          style={{ minWidth: 200 }}
          placeholder="Lọc theo lớp"
          allowClear
          value={filterClass}
          onChange={(v) => setFilterClass(v || undefined)}
          options={classOptions}
        />
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
        columns={activeColumns}
        rowKey="_id"
        loading={clientsLoading}
        pagination={{ pageSize: 15 }}
        locale={{ emptyText: <Empty description="Chưa có học viên nào" /> }}
        expandable={{
          expandedRowRender: (record) => {
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
                    {hasActiveSchedule(record) && (
                      <Button
                        size="small"
                        danger
                        onClick={() => handleEndAllWorkouts(record)}
                      >
                        Kết thúc toàn bộ lịch tập
                      </Button>
                    )}
                    <Button
                      size="small"
                      onClick={() => openClassModal(record, 'transfer')}
                    >
                      Chuyển lớp
                    </Button>
                    <Button
                      size="small"
                      onClick={() => openClassModal(record, 'leave')}
                    >
                      Rời lớp
                    </Button>
                    <Button
                      size="small"
                      danger
                      onClick={() => {
                        setEndRequestModal({ open: true, client: record })
                        setEndReason('MEMBER_COMPLETED')
                        setEndDetail('')
                      }}
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
                  {record.membershipStatus === 'pending_initial_activation'
                    ? <Tag color="orange" className="m-0">🟡 Chờ kích hoạt</Tag>
                    : record.membershipStatus === 'active'
                      ? <Tag color="green" className="m-0">🟢 Đang hoạt động</Tag>
                      : <span className="text-[var(--gs-text-muted)]">—</span>}
                </span>
              </div>
              <div className="pt-client-detail">
                <span className="pt-label">Lịch tập</span>
                <span className="pt-value"><Tag color={(record.scheduleCount ?? 0) > 0 ? 'blue' : 'default'} className="m-0">{record.scheduleCount ?? 0} lịch</Tag></span>
              </div>
              <div className="pt-client-detail">
                <span className="pt-label">Giáo án</span>
                <span className="pt-value">
                  {record.workout
                    ? <span>{record.workout.name}</span>
                    : <span className="text-[var(--gs-text-muted)]">Chưa có giáo án</span>}
                </span>
              </div>
              <div className="pt-client-actions">
                <Button
                  type="primary"
                  size="small"
                  block
                  icon={<PlusOutlined />}
                  onClick={() => navigate(`/pt/clients/${record._id}/create-schedule?assignmentId=${record.assignmentId || ''}`)}
                >
                  Tạo lịch & Gán giáo án
                </Button>
              </div>
              {isExpanded && (
                <div className="mt-3 border-t border-[var(--gs-border)] pt-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[var(--gs-text-muted)]">{schedules.length} lịch tập</span>
                    <div className="flex flex-wrap gap-2">
                      <Button size="small" icon={<ReloadOutlined />} onClick={() => fetchClientSchedules(record._id)}>Tải lại</Button>
                      {hasActiveSchedule(record) && (
                        <Button size="small" danger onClick={() => handleEndAllWorkouts(record)}>Kết thúc toàn bộ lịch tập</Button>
                      )}
                      {ce && <Button size="small" onClick={() => openClassModal(record, 'transfer')}>Chuyển lớp</Button>}
                      {ce && <Button size="small" onClick={() => openClassModal(record, 'leave')}>Rời lớp</Button>}
                      <Button size="small" danger onClick={() => { setEndRequestModal({ open: true, client: record }); setEndReason('MEMBER_COMPLETED'); setEndDetail('') }}>
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
          dataSource={pendingItems}
          columns={pendingColumns}
          rowKey="_id"
          loading={pendingLoading}
          pagination={{ pageSize: 20 }}
          locale={{ emptyText: <Empty description="Không có yêu cầu chờ duyệt" /> }}
        />
      </div>
      <div className="pt-clients-cards">
        {pendingItems.map((record: PendingApproval) => {
          const member = typeof record.memberId === 'object' ? record.memberId as PTAssignmentMember : null
          const cls = typeof record.classId === 'object' ? record.classId : null
          const label = REASON_LABELS[record.reasonType] || record.reasonType
          return (
            <div key={(record as any)._id} className="pt-client-card">
              <div className="pt-client-header">
                <div className="pt-client-name">{getUserDisplayName(member, '—')}</div>
                {member?.memberCode && <div className="pt-client-code truncate">{member.memberCode}</div>}
              </div>
              <div className="pt-client-detail"><span className="pt-label">Lớp</span><span className="pt-value">{cls?.name || '—'}</span></div>
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
        {pendingItems.length === 0 && !pendingLoading && (
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
          dataSource={historyItems}
          columns={historyColumns}
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
        {historyItems.map((record: HistoryEntry) => {
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
              <div className="pt-client-detail"><span className="pt-label">Lớp</span><span className="pt-value">{cls?.name || '—'}</span></div>
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
        {historyItems.length === 0 && !historyLoading && (
          <div className="text-center py-10 text-[var(--gs-text-muted)]">Chưa có dữ liệu</div>
        )}
      </div>
    </div>
  )

  const tabContent = activeTab === 'active' || activeTab === 'pending_first' ? activeTabEl : activeTab === 'pending' ? pendingTabEl : historyTabEl

  // ============ RENDER ============

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">PT</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">
          Học viên của tôi
        </h1>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">
          {activeTab === 'active' ? `${clients.length} học viên` :
           activeTab === 'pending' ? `${pendingItems.length} yêu cầu` :
           `${historyPagination.total} mục`}
        </p>
      </div>

      <div className="pt-clients-tabs mb-4 flex gap-4 border-b border-[var(--gs-border)] max-[767px]:overflow-x-auto max-[767px]:whitespace-nowrap max-[767px]:pb-1 max-[767px]:gap-3">
        <button
          onClick={() => setActiveTab('active')}
          className={`pb-3 font-semibold transition ${
            activeTab === 'active'
              ? 'border-b-2 border-[var(--theme-accent)] text-[var(--theme-accent)]'
              : 'text-[var(--gs-text-muted)] hover:text-[var(--gs-text)]'
          }`}
        >
          Đang hướng dẫn
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
          setEndReason('MEMBER_COMPLETED')
          setEndDetail('')
        }}
        okText="Gửi yêu cầu"
        cancelText="Hủy"
        confirmLoading={submittingEnd}
        onOk={handleEndRequest}
      >
        <p className="mb-4 text-sm text-[var(--gs-text-muted)]">
          Bạn có chắc muốn kết thúc việc phụ trách hội viên này?
        </p>
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-[var(--gs-text)]">Lý do</label>
          <Radio.Group value={endReason} onChange={(e) => setEndReason(e.target.value)}>
            <Space direction="vertical">
              {endRequestReasons.map((r) => (
                <Radio key={r.value} value={r.value}>{r.label}</Radio>
              ))}
            </Space>
          </Radio.Group>
        </div>
        {endReason === 'OTHER' && (
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-[var(--gs-text)]">
              Lý do khác <span className="text-red-500">*</span>
            </label>
            <Input.TextArea
              rows={3}
              value={endDetail}
              onChange={(e) => setEndDetail(e.target.value)}
              placeholder="Vui lòng nhập lý do..."
            />
          </div>
        )}
      </Modal>

      {/* ============ CHUYỂN LỚP / RỜI LỚP MODAL ============ */}
      <Modal
        open={classModal.open}
        title={classModal.mode === 'transfer' ? 'Chuyển lớp cho hội viên' : 'Rời khỏi lớp hiện tại'}
        okText={classModal.mode === 'transfer' ? 'Chuyển lớp' : 'Rời lớp'}
        cancelText="Hủy"
        confirmLoading={submittingClassAction}
        onOk={submitClassAction}
        onCancel={closeClassModal}
        okButtonProps={classModal.mode === 'leave' ? { danger: true } : undefined}
      >
        {enrollmentLoading ? (
          <p className="text-sm text-[var(--gs-text-muted)]">Đang tải dữ liệu lớp...</p>
        ) : (
          <>
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-[var(--gs-text)]">Hội viên</label>
              <p className="text-sm text-[var(--gs-text)]">
                {classModal.client?.fullName || classModal.client?.name}
                {classModal.client?.memberCode ? ` (${classModal.client.memberCode})` : ''}
              </p>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-[var(--gs-text)]">Lớp hiện tại</label>
              {enrollmentPreview?.currentEnrollment ? (
                <p className="text-sm text-[var(--gs-text)]">
                  [{enrollmentPreview.currentEnrollment.code}] {enrollmentPreview.currentEnrollment.name}
                </p>
              ) : (
                <p className="text-sm text-[var(--gs-text-muted)] italic">Không có lớp active</p>
              )}
            </div>

            {classModal.mode === 'transfer' && (
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-[var(--gs-text)]">
                  Chọn lớp đích <span className="text-red-500">*</span>
                </label>
                <Select
                  style={{ width: '100%' }}
                  placeholder="Chọn lớp..."
                  value={selectedTargetClass || undefined}
                  onChange={(v) => setSelectedTargetClass(v)}
                  options={(enrollmentPreview?.availableClasses || []).map((c) => ({
                    value: c._id,
                    label: `[${c.code}] ${c.name}${c.isCurrent ? ' (lớp hiện tại)' : c.isFull ? ' (đã đầy)' : ''} — ${c.current}/${c.max}`,
                    disabled: c.isFull || c.isCurrent,
                  }))}
                />
              </div>
            )}

            <div className="mb-2">
              <label className="mb-1 block text-sm font-medium text-[var(--gs-text)]">
                Lý do (tùy chọn)
              </label>
              <Input.TextArea
                rows={3}
                value={classActionReason}
                onChange={(e) => setClassActionReason(e.target.value)}
                placeholder="Ghi chú/lý do chuyển hoặc rời lớp..."
              />
            </div>

            {classModal.mode === 'leave' && (
              <p className="mt-3 text-xs text-amber-600">
                Lưu ý: Rời lớp KHÔNG kết thúc phụ trách. PT vẫn tiếp tục hướng dẫn hội viên này; chỉ gán enrollment lớp sẽ bị đóng.
              </p>
            )}
            {classModal.mode === 'transfer' && (
              <p className="mt-3 text-xs text-[var(--gs-text-muted)]">
                Việc chuyển lớp sẽ tự đóng enrollment ở lớp cũ và tạo enrollment active ở lớp mới. Sức chứa lớp mới sẽ được kiểm tra.
              </p>
            )}
          </>
        )}
      </Modal>

    </DashboardLayout>
  )
}
