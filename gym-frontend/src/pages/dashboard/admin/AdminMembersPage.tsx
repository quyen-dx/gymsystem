import {
  EditOutlined,
  EyeOutlined,
  LockOutlined,
  PlusOutlined,
  UnlockOutlined,
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
} from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import api from '../../../services/api'
import { trainingRequestService, type TrainingRequest } from '../../../services/trainingRequestService'
import { trainerService } from '../../../services/trainerService'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { memberService } from '../../../services/memberService'
import type { MemberListItem } from '../../../types/admin/member'
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

  const [modalOpen, setModalOpen] = useState(false)
  const [reqFilter, setReqFilter] = useState<string>('pending')
  const [reqLoading, setReqLoading] = useState(false)
  const [requests, setRequests] = useState<TrainingRequest[]>([])

  const loadRequests = async () => {
    setReqLoading(true)
    try {
      const reqRes = await trainingRequestService.getAllRequests({ status: reqFilter })
      setRequests(reqRes.data.requests || [])
    } finally {
      setReqLoading(false)
    }
  }

  useEffect(() => { if (modalOpen) loadRequests() }, [modalOpen, reqFilter])
  useEffect(() => {
    api.get<{ plans: PlanOption[] }>('/plans', { params: { limit: 100 } }).then(({ data }) => {
      setPlans(data.plans || [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await trainingRequestService.getAllRequests({ status: 'pending', page: 1, limit: 1 })
        setPendingTrainingCount(res.data.pagination?.total || 0)
      } catch {}
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
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

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Quản lý</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">Quản lý thành viên</h1>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--gs-card)] px-4 py-1.5 text-sm font-medium text-[var(--gs-text)] transition-all hover:bg-[var(--theme-accent)] hover:text-white"
        >
          <span>Yêu cầu tập luyện</span>
          {pendingTrainingCount > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#f5222d] px-1.5 text-xs font-bold text-white">
              {pendingTrainingCount > 99 ? '99+' : pendingTrainingCount}
            </span>
          )}
        </button>
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

      <Modal title="Yêu cầu tập luyện" open={modalOpen} onCancel={() => setModalOpen(false)}
        width={1100} centered footer={null} destroyOnClose
        styles={{ body: { paddingTop: 8 } }}>
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
          columns={[
            {
              title: 'Hội viên',
              dataIndex: 'memberId',
              width: 200,
              render: (m: any) => (
                <div className="flex items-center gap-2">
                  {m?.avatar && <img src={m.avatar} className="h-8 w-8 rounded-full object-cover" />}
                  <span className="font-medium text-[var(--gs-text)]">{getUserDisplayName(m)}</span>
                </div>
              ),
            },
            {
              title: 'Chuyên môn & Mục tiêu',
              dataIndex: 'goals',
              width: 260,
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
              render: (_: any, r: TrainingRequest) => (
                <div className="text-xs text-[var(--gs-text)] space-y-1">
                  <div><span className="text-[var(--gs-text-muted)]">Số buổi:</span> {r.desiredSessions} buổi/tuần</div>
                  <div><span className="text-[var(--gs-text-muted)]">Ngày:</span> {r.daysOfWeek?.length > 0 ? r.daysOfWeek.map((d) => ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d]).join(', ') : 'Linh hoạt'}</div>
                  <div><span className="text-[var(--gs-text-muted)]">Giờ:</span> {r.timeSlots?.length > 0 ? r.timeSlots.join(', ') : 'Linh hoạt'}</div>
                </div>
              ),
            },
            {
              title: 'Trạng thái',
              dataIndex: 'status',
              width: 100,
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
              title: 'Xếp vào lớp',
              key: 'action',
              width: 180,
              render: (_: any, r: TrainingRequest) => {
                if (r.status !== 'pending') {
                  return <span className="text-xs text-[var(--gs-text-muted)]">Đã xử lý</span>
                }
                return (
                  <Button type="primary" size="small" onClick={() => navigate(`/admin/member-requests/match?requestId=${r._id}`)}>
                    Tìm lớp phù hợp
                  </Button>
                )
              },
            },
          ]}
        />
      </Modal>
    </DashboardLayout>
  )
}
