import {
  EditOutlined,
  EyeOutlined,
  LockOutlined,
  MailOutlined,
  PlusOutlined,
  UnlockOutlined,
  UserOutlined,
  PhoneOutlined,
} from '@ant-design/icons'
import {
  Badge,
  Button,
  Dropdown,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
  Avatar,
  Empty,
} from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import api from '../../../services/api'
import { trainingRequestService, type TrainingRequest } from '../../../services/trainingRequestService'
import { trainerService } from '../../../services/trainerService'
import { socketService } from '../../../services/socketService'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { memberService } from '../../../services/memberService'
import type { MemberListItem } from '../../../types/admin/member'
import type { PT } from '../../../types/admin/trainer'
import { getUserDisplayName } from '../../../utils/userDisplay'
import MemberFormModal from './MemberFormModal'
import MemberRegisterPlanModal from './MemberRegisterPlanModal'
import MemberRenewPlanModal from './MemberRenewPlanModal'

interface PlanOption {
  _id: string
  nameVi: string
}

const SPEC_LABELS: Record<string, string> = {
  GYM: 'GYM',
  YOGA: 'Yoga',
  BOXING: 'Boxing',
  ZUMBA: 'Zumba',
  PILATES: 'Pilates',
  CARDIO: 'Cardio',
  AEROBICS: 'Aerobics',
  CROSSFIT: 'Crossfit',
  KICKBOXING: 'Kickboxing',
  DANCE: 'Dance',
  MUAYTHAI: 'Muay Thái',
  FUNCTIONAL: 'Functional Training',
  OTHER: 'Khác',
}

const PT_1ON1_TABS = [
  { key: 'pending', label: 'Chờ xử lý' },
  { key: 'assigned', label: 'Đã phân công' },
  { key: 'cancelled', label: 'Đã hủy' },
  { key: '', label: 'Tất cả' },
]

const STATUS_COLORS: Record<string, string> = {
  pending: 'orange',
  assigned: 'green',
  cancelled: 'red',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xử lý',
  assigned: 'Đã phân công',
  cancelled: 'Đã hủy',
}

export default function AdminMembersPage() {
  const navigate = useNavigate()
  const [members, setMembers] = useState<MemberListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<string | undefined>()
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [remainingFilter, setRemainingFilter] = useState<string | undefined>()

  const [plans, setPlans] = useState<PlanOption[]>([])
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [formModalMember, setFormModalMember] = useState<MemberListItem | null>(null)
  const [registerModalOpen, setRegisterModalOpen] = useState(false)
  const [registerMemberId, setRegisterMemberId] = useState('')
  const [registerMemberName, setRegisterMemberName] = useState('')
  const [renewModalOpen, setRenewModalOpen] = useState(false)
  const [renewMemberId, setRenewMemberId] = useState('')
  const [renewMemberName, setRenewMemberName] = useState('')
  const [renewEndDate, setRenewEndDate] = useState('')
  const [renewStartDate, setRenewStartDate] = useState('')
  const [renewPlanName, setRenewPlanName] = useState('')
  const [renewCurrentPlanId, setRenewCurrentPlanId] = useState('')
  const [pendingTrainingCount, setPendingTrainingCount] = useState(0)
  const [pendingPt1on1Count, setPendingPt1on1Count] = useState(0)

  // Group training request modal
  const [modalOpen, setModalOpen] = useState(false)
  const [reqFilter, setReqFilter] = useState<string>('pending')
  const [reqLoading, setReqLoading] = useState(false)
  const [requests, setRequests] = useState<TrainingRequest[]>([])
  const [msgModal, setMsgModal] = useState<{ open: boolean; request: TrainingRequest | null; text: string; sending: boolean }>({ open: false, request: null, text: '', sending: false })

  // PT 1-1 request modal
  const [pt1on1ModalOpen, setPt1on1ModalOpen] = useState(false)
  const [pt1on1Tab, setPt1on1Tab] = useState('pending')
  const [pt1on1Loading, setPt1on1Loading] = useState(false)
  const [pt1on1Requests, setPt1on1Requests] = useState<TrainingRequest[]>([])

  // Assign PT modal
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [assignRequest, setAssignRequest] = useState<TrainingRequest | null>(null)
  const [assignSearch, setAssignSearch] = useState('')
  const [assignTrainers, setAssignTrainers] = useState<PT[]>([])
  const [assignLoading, setAssignLoading] = useState(false)
  const [selectedTrainerId, setSelectedTrainerId] = useState<string | null>(null)
  const [assignSubmitting, setAssignSubmitting] = useState(false)

  // Pending badge polling for group
  const loadPendingGroupCount = useCallback(async () => {
    try {
      const res = await trainingRequestService.getAllRequests({ type: 'group', status: 'pending', page: 1, limit: 1 })
      setPendingTrainingCount(res.data.pagination?.total || 0)
    } catch {}
  }, [])

  // Pending badge polling for PT 1-1
  const loadPendingPt1on1Count = useCallback(async () => {
    try {
      const res = await trainingRequestService.getAllRequests({ type: 'pt1on1', status: 'pending', page: 1, limit: 1 })
      setPendingPt1on1Count(res.data.pagination?.total || 0)
    } catch {}
  }, [])

  useEffect(() => {
    loadPendingGroupCount()
    loadPendingPt1on1Count()
    const interval = setInterval(() => {
      loadPendingGroupCount()
      loadPendingPt1on1Count()
    }, 30000)
    return () => clearInterval(interval)
  }, [loadPendingGroupCount, loadPendingPt1on1Count])

  const pt1on1ModalRef = useRef(pt1on1ModalOpen)
  pt1on1ModalRef.current = pt1on1ModalOpen

  useEffect(() => {
    socketService.connect()
    const handler = (data?: { request?: TrainingRequest }) => {
      loadPendingPt1on1Count()
      if (pt1on1ModalRef.current && data?.request) {
        setPt1on1Requests((prev) => {
          const exists = prev.some((r) => r._id === data.request._id)
          if (exists) return prev.map((r) => r._id === data.request._id ? { ...r, ...data.request } : r)
          return [data.request, ...prev]
        })
      }
    }
    socketService.on('pt1on1:new_request', handler)
    socketService.on('pt1on1:status_changed', handler)
    return () => {
      socketService.off('pt1on1:new_request', handler)
      socketService.off('pt1on1:status_changed', handler)
    }
  }, [loadPendingPt1on1Count])

  const loadGroupRequests = async () => {
    setReqLoading(true)
    try {
      const reqRes = await trainingRequestService.getAllRequests({ type: 'group', status: reqFilter })
      setRequests(reqRes.data.requests || [])
    } finally {
      setReqLoading(false)
    }
  }

  const loadPt1on1Requests = async () => {
    setPt1on1Loading(true)
    try {
      const reqRes = await trainingRequestService.getAllRequests({ type: 'pt1on1', status: pt1on1Tab || undefined })
      setPt1on1Requests(reqRes.data.requests || [])
    } finally {
      setPt1on1Loading(false)
    }
  }

  useEffect(() => { if (modalOpen) loadGroupRequests() }, [modalOpen, reqFilter])
  useEffect(() => { if (pt1on1ModalOpen) loadPt1on1Requests() }, [pt1on1ModalOpen, pt1on1Tab])

  useEffect(() => {
    api.get<{ plans: PlanOption[] }>('/plans', { params: { limit: 100 } }).then(({ data }) => {
      setPlans(data.plans || [])
    }).catch(() => {})
  }, [])

  const fetchMembers = useCallback(async (p = page, s = search, plan = planFilter, status = statusFilter, remaining = remainingFilter) => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: p, limit: 15 }
      if (s) params.search = s
      if (plan) params.planId = plan
      if (status) params.status = status
      if (remaining) params.remainingDays = remaining
      const { data } = await memberService.getMembers(params)
      setMembers(data.members)
      setTotal(data.pagination.total)
    } catch {
      message.error('Không thể tải danh sách thành viên')
    } finally {
      setLoading(false)
    }
  }, [page, search, planFilter, statusFilter, remainingFilter])

  useEffect(() => {
    fetchMembers()
  }, [])

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
    fetchMembers(1, value, planFilter, statusFilter, remainingFilter)
  }

  const handlePlanFilter = (value: string | undefined) => {
    setPlanFilter(value)
    setPage(1)
    fetchMembers(1, search, value, statusFilter, remainingFilter)
  }

  const handleStatusFilter = (value: string | undefined) => {
    setStatusFilter(value)
    setPage(1)
    fetchMembers(1, search, planFilter, value, remainingFilter)
  }

  const handleRemainingFilter = (value: string | undefined) => {
    setRemainingFilter(value)
    setPage(1)
    fetchMembers(1, search, planFilter, statusFilter, value)
  }

  const openAdd = () => {
    setFormModalMember(null)
    setFormModalOpen(true)
  }

  const openEdit = (member: MemberListItem) => {
    setFormModalMember(member)
    setFormModalOpen(true)
  }

  const onFormSuccess = () => {
    setFormModalOpen(false)
    setFormModalMember(null)
    fetchMembers()
  }

  const toggleStatus = async (member: MemberListItem) => {
    try {
      await memberService.toggleMemberStatus(member._id)
      message.success('Cập nhật trạng thái thành công')
      fetchMembers()
    } catch {
      message.error('Thao tác thất bại')
    }
  }

  const openRegisterPlan = (member: MemberListItem) => {
    setRegisterMemberId(member._id)
    setRegisterMemberName(getUserDisplayName(member, member.memberCode))
    setRegisterModalOpen(true)
  }

  const openRenewPlan = (member: MemberListItem) => {
    setRenewMemberId(member._id)
    setRenewMemberName(getUserDisplayName(member, member.memberCode))
    setRenewEndDate(member.activeMembership?.endDate || '')
    setRenewStartDate(member.activeMembership?.startDate || '')
    setRenewPlanName(member.activeMembership?.planId?.nameVi || '')
    setRenewCurrentPlanId(member.activeMembership?.planId?._id || '')
    setRenewModalOpen(true)
  }

  const openAssignTrainer = (r: TrainingRequest) => {
    setAssignRequest(r)
    setAssignSearch('')
    setSelectedTrainerId(null)
    loadAssignTrainers()
    setAssignModalOpen(true)
  }

  const loadAssignTrainers = async () => {
    setAssignLoading(true)
    try {
      const res = await trainerService.getPTs({ isActive: true, limit: 100 })
      setAssignTrainers(res.data.pts || [])
    } catch {
      message.error('Không thể tải danh sách PT')
    } finally {
      setAssignLoading(false)
    }
  }

  const handleAssignTrainer = async () => {
    if (!selectedTrainerId || !assignRequest) return
    setAssignSubmitting(true)
    try {
      await trainingRequestService.assignTrainer(assignRequest._id, selectedTrainerId)
      message.success('Đã phân công PT thành công')
      setAssignModalOpen(false)
      setAssignRequest(null)
      loadPt1on1Requests()
      loadPendingPt1on1Count()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Phân công thất bại')
    } finally {
      setAssignSubmitting(false)
    }
  }

  const handleCancelPt1on1 = async (r: TrainingRequest) => {
    try {
      await trainingRequestService.cancelByAdmin(r._id, 'Admin hủy yêu cầu')
      message.success('Đã hủy yêu cầu')
      loadPt1on1Requests()
      loadPendingPt1on1Count()
    } catch {
      message.error('Hủy yêu cầu thất bại')
    }
  }

  const columns = [
    {
      title: 'Thành viên',
      width: 250,
      render: (_: unknown, record: MemberListItem) => (
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
            <div style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--gs-text)' }}
              onClick={() => navigate(`/admin/members/${record._id}`)}>
              {getUserDisplayName(record, 'Thành viên')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--gs-text-muted)' }}>
              {record.memberCode ? `${record.memberCode} • ` : ''}{record.phone || record.email || '—'}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Gói tập',
      render: (_: unknown, record: MemberListItem) => {
        if (!record.activeMembership) {
          return <Tag style={{ opacity: 0.5 }}>Chưa có gói</Tag>
        }
        const plan = record.activeMembership.planId
        return (
          <Space size={4}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: plan?.color || '#3B82F6', flexShrink: 0 }} />
            <span>{plan?.nameVi || '—'}</span>
          </Space>
        )
      },
    },
    {
      title: 'Ngày còn lại',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, record: MemberListItem) => {
        if (record.remainingDays <= 0) return <Tag color="error">0</Tag>
        if (record.remainingDays <= 7) return <Badge count={record.remainingDays} size="small" offset={[4, 0]}><Tag color="red">{record.remainingDays}d</Tag></Badge>
        return <span>{record.remainingDays}d</span>
      },
    },
    {
      title: 'Check-in',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, record: MemberListItem) => (
        <span>{record.checkinCount || <span style={{ opacity: 0.4 }}>0</span>}</span>
      ),
    },
    {
      title: 'Trạng thái',
      width: 100,
      render: (_: unknown, record: MemberListItem) => (
        <Tag color={record.isActive ? 'success' : 'error'}>
          {record.isActive ? 'Hoạt động' : 'Đã khóa'}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      width: 200,
      render: (_: unknown, record: MemberListItem) => (
        <Space size={4}>
          <Tooltip title="Chi tiết">
            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/admin/members/${record._id}`)} />
          </Tooltip>
          <Tooltip title="Chỉnh sửa">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Tooltip title={record.isActive ? 'Khóa' : 'Mở khóa'}>
            <Button size="small" icon={record.isActive ? <LockOutlined /> : <UnlockOutlined />} onClick={() => toggleStatus(record)} />
          </Tooltip>
          <Dropdown
            menu={{
              items: [
                { key: 'register', label: 'Đăng ký gói tập', onClick: () => openRegisterPlan(record), disabled: !!record.activeMembership },
                { key: 'renew', label: 'Gia hạn gói tập', onClick: () => openRenewPlan(record), disabled: !record.activeMembership },
              ],
            }}
            trigger={['click']}
          >
            <Button size="small">Gói tập</Button>
          </Dropdown>
        </Space>
      ),
    },
  ]

  const pt1on1Columns = [
    {
      title: 'Hội viên',
      width: 250,
      render: (_: any, r: TrainingRequest) => {
        const m = typeof r.memberId === 'object' ? r.memberId : null
        return (
          <div className="flex items-center gap-2">
            {m?.avatar ? (
              <img src={m.avatar} className="h-9 w-9 rounded-full object-cover shrink-0" />
            ) : (
              <div className="h-9 w-9 rounded-full bg-[var(--gs-border)] flex items-center justify-center shrink-0">
                <UserOutlined style={{ color: 'var(--gs-text-muted)', fontSize: 16 }} />
              </div>
            )}
            <div>
              <div className="font-medium text-[var(--gs-text)] text-sm leading-tight">{m ? getUserDisplayName(m) : '—'}</div>
              <div className="text-[11px] text-[var(--gs-text-muted)]">
                {m?.memberCode || ''}{m?.phone ? ` • ${m.phone}` : ''}
              </div>
            </div>
          </div>
        )
      },
    },
    {
      title: 'Chuyên môn & Mục tiêu',
      width: 220,
      render: (_: any, r: TrainingRequest) => (
        <div>
          <Tag color="blue" className="m-0 text-xs font-semibold">{SPEC_LABELS[r.specialization || 'GYM'] || r.specialization}</Tag>
          {r.goals?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {r.goals.map((g, i) => <Tag key={i} className="m-0 text-xs" color="purple">{g}</Tag>)}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Liên hệ',
      width: 200,
      render: (_: any, r: TrainingRequest) => (
        <div className="text-xs space-y-0.5">
          <div className="flex items-center gap-1">
            <PhoneOutlined style={{ fontSize: 11, color: 'var(--gs-text-muted)' }} />
            <span>{r.contactPhone || '—'}</span>
          </div>
          <div className="flex items-center gap-1">
            <MailOutlined style={{ fontSize: 11, color: 'var(--gs-text-muted)' }} />
            <span className="truncate block max-w-[140px]">{r.contactEmail || '—'}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'PT mong muốn',
      width: 150,
      render: (_: any, r: TrainingRequest) => {
        if (r.preferredTrainerId) {
          const name = typeof r.preferredTrainerId === 'object'
            ? (r.preferredTrainerId.fullName || r.preferredTrainerId.name)
            : null
          return name ? <span className="text-sm">{name}</span> : <Tag className="m-0">Có yêu cầu</Tag>
        }
        return <span className="text-xs text-[var(--gs-text-muted)]">Không yêu cầu</span>
      },
    },
    {
      title: 'Ghi chú',
      width: 160,
      render: (_: any, r: TrainingRequest) => (
        <div className="text-xs text-[var(--gs-text)] truncate max-w-[160px]" title={r.note}>
          {r.note || <span className="text-[var(--gs-text-muted)]">—</span>}
        </div>
      ),
    },
    {
      title: 'Ngày gửi',
      width: 100,
      render: (_: any, r: TrainingRequest) => {
        const d = new Date(r.createdAt)
        return <span className="text-xs text-[var(--gs-text-muted)]">{d.toLocaleDateString('vi-VN')}</span>
      },
    },
    {
      title: 'Trạng thái',
      width: 110,
      render: (_: any, r: TrainingRequest) => (
        <Tag color={STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status] || r.status}</Tag>
      ),
    },
    {
      title: 'Thao tác',
      width: 220,
      render: (_: any, r: TrainingRequest) => {
        if (r.status !== 'pending') {
          return <span className="text-xs text-[var(--gs-text-muted)]">Đã xử lý</span>
        }
        return (
          <Space size={4}>
            <Button type="primary" size="small" icon={<UserOutlined />}
              onClick={() => openAssignTrainer(r)}>
              Phân công PT
            </Button>
            <Button size="small" danger onClick={() => handleCancelPt1on1(r)}>
              Hủy yêu cầu
            </Button>
          </Space>
        )
      },
    },
  ]

  const filteredAssignTrainers = assignTrainers.filter((t) => {
    if (!assignSearch) return true
    const q = assignSearch.toLowerCase()
    return (t.fullName || t.name || '').toLowerCase().includes(q)
      || (t.email || '').toLowerCase().includes(q)
      || (t.specialties || []).some((s) => s.toLowerCase().includes(q))
  })

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Quản lý</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">Quản lý thành viên</h1>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--gs-card)] px-4 py-1.5 text-sm font-medium text-[var(--gs-text)] transition-all hover:bg-[var(--theme-accent)] hover:text-white"
          >
            <span>Yêu cầu tập nhóm</span>
            {pendingTrainingCount > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#f5222d] px-1.5 text-xs font-bold text-white">
                {pendingTrainingCount > 99 ? '99+' : pendingTrainingCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => { setPt1on1ModalOpen(true); loadPt1on1Requests() }}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--gs-card)] px-4 py-1.5 text-sm font-medium text-[var(--gs-text)] transition-all hover:bg-[var(--theme-accent)] hover:text-white"
          >
            <span>Yêu cầu PT 1-1</span>
            {pendingPt1on1Count > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#f5222d] px-1.5 text-xs font-bold text-white">
                {pendingPt1on1Count > 99 ? '99+' : pendingPt1on1Count}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
        <div className="dashboard-filter-bar">
          <Input.Search
            placeholder="Tìm kiếm thành viên..."
            allowClear
            onSearch={handleSearch}
            style={{ maxWidth: 300 }}
          />
          <Select
            allowClear
            showSearch
            placeholder="Lọc theo gói tập"
            style={{ minWidth: 160 }}
            onChange={handlePlanFilter}
            optionFilterProp="label"
            options={plans.map((p) => ({ value: p._id, label: `${p.nameVi}` }))}
          />
          <Select
            allowClear
            placeholder="Lọc theo trạng thái"
            style={{ minWidth: 130 }}
            onChange={handleStatusFilter}
            options={[
              { value: 'active', label: 'Đang hoạt động' },
              { value: 'locked', label: 'Đã khóa' },
            ]}
          />
          <Select
            allowClear
            placeholder="Lọc theo ngày còn lại"
            style={{ minWidth: 140 }}
            onChange={handleRemainingFilter}
            options={[
              { value: '0', label: 'Đã hết hạn' },
              { value: '1-7', label: 'Sắp hết hạn (1-7 ngày)' },
              { value: '8-30', label: '8-30 ngày' },
              { value: '30+', label: 'Trên 30 ngày' },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            Thêm thành viên
          </Button>
        </div>

        <div className="member-scroll-x">
          <Table
            dataSource={members}
            columns={columns}
            rowKey="_id"
            loading={loading}
            pagination={{
              total,
              current: page,
              pageSize: 15,
              onChange: (p) => {
                setPage(p)
                fetchMembers(p, search, planFilter, statusFilter, remainingFilter)
              },
            }}
          />
        </div>
      </div>

      <MemberFormModal
        open={formModalOpen}
        member={formModalMember}
        onClose={() => { setFormModalOpen(false); setFormModalMember(null) }}
        onSuccess={onFormSuccess}
      />

      <MemberRegisterPlanModal
        open={registerModalOpen}
        memberId={registerMemberId}
        memberName={registerMemberName}
        onClose={() => setRegisterModalOpen(false)}
        onSuccess={() => { setRegisterModalOpen(false); fetchMembers() }}
      />

      <MemberRenewPlanModal
        open={renewModalOpen}
        memberId={renewMemberId}
        memberName={renewMemberName}
        currentEndDate={renewEndDate}
        currentStartDate={renewStartDate}
        currentPlanName={renewPlanName}
        currentPlanId={renewCurrentPlanId}
        onClose={() => setRenewModalOpen(false)}
        onSuccess={() => { setRenewModalOpen(false); fetchMembers() }}
      />

      {/* Group Training Request Modal (unchanged) */}
      <Modal title="Yêu cầu tập luyện" open={modalOpen} onCancel={() => setModalOpen(false)}
        width={1100} centered footer={null} destroyOnClose
        styles={{ body: { paddingTop: 8, maxHeight: '75vh', overflowY: 'auto' } }}
        className="!w-[min(95vw,1500px)] max-sm:!w-[98vw]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            {['pending', 'matched', 'cancelled', ''].map((s) => (
              <Button key={s} type={reqFilter === s ? 'primary' : 'default'} size="small" onClick={() => setReqFilter(s)}>
                {s === '' ? 'Tất cả' : s === 'pending' ? 'Chờ' : s === 'matched' ? 'Đã ghép' : 'Đã hủy'}
              </Button>
            ))}
          </div>
        </div>

        <Table
          dataSource={requests}
          rowKey="_id"
          loading={reqLoading}
          pagination={false}
          locale={{ emptyText: 'Không có yêu cầu nào' }}
          scroll={{ x: 1400 }}
          columns={[
            {
              title: 'Hội viên',
              dataIndex: 'memberId',
              width: 220,
              className: '!whitespace-nowrap',
              render: (m: any) => (
                <div className="flex items-center gap-2">
                  {m?.avatar && <img src={m.avatar} className="h-8 w-8 rounded-full object-cover shrink-0" />}
                  <span className="font-medium text-[var(--gs-text)] truncate">{getUserDisplayName(m)}</span>
                </div>
              ),
            },
            {
              title: 'Chuyên môn & Mục tiêu',
              dataIndex: 'goals',
              width: 240,
              className: '!whitespace-nowrap',
              render: (_: any, r: TrainingRequest) => {
                const specName = SPEC_LABELS[r.specialization || 'GYM'] || r.specialization || 'GYM'
                return (
                  <div>
                    <div className="text-sm font-semibold text-[var(--gs-text)] uppercase">{specName}</div>
                    {r.goals?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {r.goals.map((g, i) => (
                          <Tag key={i} className="m-0 text-xs" color="purple">{g}</Tag>
                        ))}
                      </div>
                    )}
                  </div>
                )
              },
            },
            {
              title: 'Lịch',
              key: 'schedule',
              width: 280,
              className: '!whitespace-nowrap',
              render: (_: any, r: TrainingRequest) => (
                <div className="text-xs text-[var(--gs-text)] space-y-1">
                  <div><span className="text-[var(--gs-text-muted)]">Số buổi:</span> {r.desiredSessions} buổi/tuần</div>
                  <div><span className="text-[var(--gs-text-muted)]">Ngày:</span> {r.daysOfWeek?.length > 0 ? r.daysOfWeek.map((d) => ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d]).join(', ') : 'Linh hoạt'}</div>
                  <div><span className="text-[var(--gs-text-muted)]">Giờ:</span> {r.timeSlots?.length > 0 ? r.timeSlots.join(', ') : 'Linh hoạt'}</div>
                </div>
              ),
            },
            {
              title: 'Gói tập',
              key: 'membership',
              width: 260,
              className: '!whitespace-nowrap',
              render: (_: any, r: TrainingRequest) => {
                const info = r.membershipInfo
                if (!info) return <span className="text-xs text-[var(--gs-text-muted)]">Không có gói</span>
                const isExpired = !info.isPending && info.totalRemainingDays <= 0
                return (
                  <div className="text-xs space-y-1">
                    <div className="font-semibold text-[var(--gs-text)]">{info.planName}</div>
                    <div className="flex flex-wrap gap-1">
                      {info.isPending ? (
                        <Tag color="orange">Chờ kích hoạt</Tag>
                      ) : isExpired ? (
                        <Tag color="red">Đã hết hạn</Tag>
                      ) : (
                        <Tag color="green">Đang hoạt động</Tag>
                      )}
                    </div>
                    {info.isPending ? null : isExpired ? null : (
                      <div className="text-[var(--gs-text-muted)]">
                        {info.pendingRenewalsCount > 0 ? (
                          <span className="flex flex-wrap gap-1 items-center">
                            <span>Còn {info.totalRemainingDays} ngày</span>
                            <Tag color="purple">Có gia hạn</Tag>
                          </span>
                        ) : (
                          <span>Còn {info.totalRemainingDays} ngày</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              },
            },
            {
              title: 'Trạng thái',
              dataIndex: 'status',
              width: 120,
              className: '!whitespace-nowrap',
              render: (s: string) => {
                const map: Record<string, [string, string]> = {
                  pending: ['orange', 'Chờ'],
                  assigned: ['green', 'Đã xếp lớp'],
                  cancelled: ['red', 'Hủy'],
                }
                return <Tag color={map[s]?.[0] || 'default'}>{map[s]?.[1] || s}</Tag>
              },
            },
            {
              title: 'Thao tác',
              key: 'action',
              width: 320,
              className: '!whitespace-nowrap',
              render: (_: any, r: TrainingRequest) => {
                if (r.status !== 'pending') {
                  return <span className="text-xs text-[var(--gs-text-muted)]">Đã xử lý</span>
                }
                const info = r.membershipInfo
                const canFindClass = info && (info.isPending || info.totalRemainingDays >= 30)
                const isExpired = info && !info.isPending && info.totalRemainingDays <= 0
                return (
                  <div className="flex gap-1.5">
                    {isExpired ? (
                      <Button size="small" onClick={() => {
                        const defaultMsg = `Gói tập của bạn đã hết hạn. Bạn vui lòng gia hạn gói tập để Admin có thể sắp xếp lịch học phù hợp.`
                        setMsgModal({ open: true, request: r, text: defaultMsg })
                      }}>
                        Yêu cầu gia hạn
                      </Button>
                    ) : !canFindClass ? (
                      <Button size="small" onClick={() => {
                        const defaultMsg = `Gói tập của bạn chỉ còn ${info?.totalRemainingDays || 0} ngày nên chưa đủ điều kiện tham gia chương trình PT.\n\nBạn vui lòng gia hạn gói tập để Admin có thể sắp xếp lịch học phù hợp.`
                        setMsgModal({ open: true, request: r, text: defaultMsg })
                      }}>
                        Yêu cầu gia hạn
                      </Button>
                    ) : (
                      <Button type="primary" size="small" onClick={() => navigate(`/admin/member-requests/match?requestId=${r._id}`)}>
                        Tìm lớp phù hợp
                      </Button>
                    )}
                    <Button size="small" icon={<MailOutlined />} onClick={() => {
                        const defaultMsg = `Chúng tôi đã nhận được yêu cầu tập luyện của bạn. Chúng tôi sẽ sớm liên hệ để sắp xếp lịch tập phù hợp.`
                        setMsgModal({ open: true, request: r, text: defaultMsg })
                      }}>
                      Gửi tin nhắn
                    </Button>
                  </div>
                )
              },
            },
          ]}
        />
      </Modal>

      {/* Message Sending Modal */}
      <Modal
        title="Gửi tin nhắn cho hội viên"
        open={msgModal.open}
        onCancel={() => setMsgModal({ open: false, request: null })}
        footer={null}
        width={600}
        centered
        destroyOnClose
      >
        {msgModal.request && (() => {
          const r = msgModal.request
          const info = r.membershipInfo
          const memberName = typeof r.memberId === 'object' ? r.memberId.fullName || r.memberId.name : ''

          const handleSend = async () => {
            setMsgModal((prev) => ({ ...prev, sending: true }))
            try {
              const memberId = typeof r.memberId === 'object' ? r.memberId._id : r.memberId
              await api.post('/notifications/send', {
                receiverId: memberId,
                receiverRole: 'member',
                title: 'Phản hồi yêu cầu tập luyện',
                content: msgModal.text,
                redirectUrl: '/my-membership',
              })
              message.success('Đã gửi tin nhắn thành công')
              setMsgModal({ open: false, request: null, text: '', sending: false })
            } catch {
              message.error('Gửi tin nhắn thất bại')
              setMsgModal((prev) => ({ ...prev, sending: false }))
            }
          }

          return (
            <div className="py-2">
              <p className="m-0 text-sm text-[var(--gs-text)]">
                Gửi tới: <strong>{memberName || 'Hội viên'}</strong>
              </p>
              {info && (
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  <Tag>{info.planName}</Tag>
                  {info.isPending ? (
                    <Tag color="orange">Chờ kích hoạt</Tag>
                  ) : info.totalRemainingDays <= 0 ? (
                    <Tag color="red">Đã hết hạn</Tag>
                  ) : (
                    <>
                      <Tag color="green">Đang hoạt động</Tag>
                      <span className="text-xs text-[var(--gs-text-muted)]">Còn {info.totalRemainingDays} ngày</span>
                      {info.pendingRenewalsCount > 0 && <Tag color="purple">Có gia hạn</Tag>}
                    </>
                  )}
                </div>
              )}
              <textarea
                className="mt-4 w-full rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-4 text-sm text-[var(--gs-text)] outline-none transition-colors focus:border-[var(--theme-accent)]"
                rows={8}
                value={msgModal.text}
                onChange={(e) => setMsgModal((prev) => ({ ...prev, text: e.target.value }))}
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button onClick={() => setMsgModal({ open: false, request: null, text: '', sending: false })}>Hủy</Button>
                <Button type="primary" loading={msgModal.sending} onClick={handleSend}>Gửi tin nhắn</Button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* PT 1-1 Request Modal */}
      <Modal title="Yêu cầu PT 1-1" open={pt1on1ModalOpen} onCancel={() => setPt1on1ModalOpen(false)}
        width={1300} centered footer={null} destroyOnClose
        styles={{ body: { paddingTop: 8, maxHeight: '75vh', overflowY: 'auto' } }}
        className="!w-[min(95vw,1500px)] max-sm:!w-[98vw]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            {PT_1ON1_TABS.map((t) => (
              <Button key={t.key} type={pt1on1Tab === t.key ? 'primary' : 'default'} size="small" onClick={() => setPt1on1Tab(t.key)}>
                {t.label}
              </Button>
            ))}
          </div>
        </div>

        <Table
          dataSource={pt1on1Requests}
          rowKey="_id"
          loading={pt1on1Loading}
          pagination={false}
          locale={{ emptyText: 'Không có yêu cầu PT 1-1 nào' }}
          scroll={{ x: 1400 }}
          columns={pt1on1Columns}
        />
      </Modal>

      {/* Assign PT Modal */}
      <Modal title="Phân công PT" open={assignModalOpen} onCancel={() => { setAssignModalOpen(false); setAssignRequest(null) }}
        width={600} centered footer={null} destroyOnClose>
        <div className="py-2 space-y-4">
          {assignRequest && (() => {
            const m = typeof assignRequest.memberId === 'object' ? assignRequest.memberId : null
            return (
              <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-4 text-sm space-y-1">
                <div className="font-semibold text-[var(--gs-text)]">
                  {m ? getUserDisplayName(m) : '—'}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Tag color="blue">{SPEC_LABELS[assignRequest.specialization || 'GYM']}</Tag>
                  {assignRequest.goals?.map((g, i) => <Tag key={i} color="purple">{g}</Tag>)}
                </div>
                <div className="text-xs text-[var(--gs-text-muted)]">
                  <PhoneOutlined className="mr-1" />{assignRequest.contactPhone || '—'}
                </div>
              </div>
            )
          })()}

          <Input.Search
            placeholder="Tìm kiếm PT theo tên, email, chuyên môn..."
            value={assignSearch}
            onChange={(e) => setAssignSearch(e.target.value)}
            allowClear
          />

          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {assignLoading ? (
              <div className="text-center py-8 text-sm text-[var(--gs-text-muted)]">Đang tải...</div>
            ) : filteredAssignTrainers.length === 0 ? (
              <Empty description="Không tìm thấy PT" />
            ) : (
              filteredAssignTrainers.map((t) => (
                <div
                  key={t._id}
                  onClick={() => setSelectedTrainerId(t._id)}
                  className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                    selectedTrainerId === t._id
                      ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)]'
                      : 'border-[var(--gs-border)] hover:border-[var(--theme-accent)]'
                  }`}
                >
                  <Avatar src={t.avatar} size={40} className="shrink-0">
                    {(t.fullName || t.name || 'PT').charAt(0)}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-[var(--gs-text)]">{t.fullName || t.name}</div>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {t.specialties?.map((s, i) => (
                        <Tag key={i} className="m-0 text-xs">{s}</Tag>
                      ))}
                    </div>
                    <div className="text-xs text-[var(--gs-text-muted)] mt-0.5">
                      {t.totalStudents || 0} hội viên đang phụ trách
                    </div>
                  </div>
                  {selectedTrainerId === t._id && (
                    <div className="h-5 w-5 rounded-full bg-[var(--theme-accent)] flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => { setAssignModalOpen(false); setAssignRequest(null) }}>Hủy</Button>
            <Button type="primary" loading={assignSubmitting} disabled={!selectedTrainerId} onClick={handleAssignTrainer}>
              Xác nhận phân công
            </Button>
          </div>
        </div>
      </Modal>

    </DashboardLayout>
  )
}
