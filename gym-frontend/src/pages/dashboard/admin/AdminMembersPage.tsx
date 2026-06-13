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
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import api from '../../../services/api'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { memberService } from '../../../services/memberService'
import type { HealthScore, MemberListItem } from '../../../types/admin/member'
import MemberFormModal from './MemberFormModal'
import MemberRegisterPlanModal from './MemberRegisterPlanModal'
import MemberRenewPlanModal from './MemberRenewPlanModal'

interface PlanOption {
  _id: string
  nameVi: string
  nameEn: string
}

export default function AdminMembersPage() {
  const { t } = useTranslation()
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
  const [healthScores, setHealthScores] = useState<Record<string, HealthScore>>({})

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

      data.members.forEach((m: MemberListItem) => {
        if (!healthScores[m._id]) {
          memberService.getMemberHealthScore(m._id)
            .then(res => setHealthScores(prev => ({ ...prev, [m._id]: res.data.healthScore })))
            .catch(() => {})
        }
      })
    } catch {
      message.error(t('admin.members.messages.fetch_failed'))
    } finally {
      setLoading(false)
    }
  }, [page, search, planFilter, statusFilter, remainingFilter, t])

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
      message.success(t('admin.members.toggle_success'))
      fetchMembers()
    } catch {
      message.error(t('admin.members.messages.action_failed'))
    }
  }

  const openRegisterPlan = (member: MemberListItem) => {
    setRegisterMemberId(member._id)
    setRegisterMemberName(member.name)
    setRegisterModalOpen(true)
  }

  const openRenewPlan = (member: MemberListItem) => {
    setRenewMemberId(member._id)
    setRenewMemberName(member.name)
    setRenewEndDate(member.activeMembership?.endDate || '')
    setRenewModalOpen(true)
  }

  const getHealthColor = (score: number) => {
    if (score >= 80) return '#10B981'
    if (score >= 50) return '#F59E0B'
    return '#EF4444'
  }

  const sparklineData = Array.from({ length: 30 }, (_, i) => ({
    day: i,
    value: Math.floor(Math.random() * 3),
  }))

  const columns = [
    {
      title: t('admin.members.columns.member'),
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
              {record.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--gs-text-muted)' }}>
              {record.phone || record.email || '—'}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: t('admin.members.columns.plan'),
      render: (_: unknown, record: MemberListItem) => {
        if (!record.activeMembership) {
          return <Tag style={{ opacity: 0.5 }}>{t('admin.members.no_plan')}</Tag>
        }
        const plan = record.activeMembership.planId
        return (
          <Space size={4}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: plan?.color || '#3B82F6', flexShrink: 0 }} />
            <span>{plan?.nameVi || plan?.nameEn || '—'}</span>
          </Space>
        )
      },
    },
    {
      title: t('admin.members.columns.remaining_days'),
      width: 90,
      align: 'center' as const,
      render: (_: unknown, record: MemberListItem) => {
        if (record.remainingDays <= 0) return <Tag color="error">0</Tag>
        if (record.remainingDays <= 7) return <Badge count={record.remainingDays} size="small" offset={[4, 0]}><Tag color="red">{record.remainingDays}d</Tag></Badge>
        return <span>{record.remainingDays}d</span>
      },
    },
    {
      title: 'Sức khỏe',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, record: MemberListItem) => {
        const hs = healthScores[record._id]
        if (!hs) return <span style={{ opacity: 0.3 }}>—</span>
        return (
          <Tooltip title={`${hs.levelText} (${hs.overall}/100)`}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: getHealthColor(hs.overall),
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              margin: '0 auto',
              cursor: 'pointer',
            }}>
              {hs.overall}
            </div>
          </Tooltip>
        )
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
      title: 'Xu hướng',
      width: 100,
      render: () => (
        <div style={{ width: 80, height: 30 }}>
          <ResponsiveContainer>
            <LineChart data={sparklineData}>
              <Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ),
    },
    {
      title: t('admin.members.columns.status'),
      width: 100,
      render: (_: unknown, record: MemberListItem) => (
        <Tag color={record.isActive ? 'success' : 'error'}>
          {record.isActive ? t('admin.members.status.active') : t('admin.members.status.locked')}
        </Tag>
      ),
    },
    {
      title: t('admin.members.columns.actions'),
      width: 200,
      render: (_: unknown, record: MemberListItem) => (
        <Space size={4}>
          <Tooltip title={t('admin.members.detail.title')}>
            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/admin/members/${record._id}`)} />
          </Tooltip>
          <Tooltip title={t('admin.members.edit')}>
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Tooltip title={record.isActive ? 'Khóa' : 'Mở khóa'}>
            <Button size="small" icon={record.isActive ? <LockOutlined /> : <UnlockOutlined />} onClick={() => toggleStatus(record)} />
          </Tooltip>
          <Dropdown
            menu={{
              items: [
                { key: 'register', label: 'Đăng ký gói tập', onClick: () => openRegisterPlan(record) },
                { key: 'renew', label: 'Gia hạn gói', onClick: () => openRenewPlan(record), disabled: !record.activeMembership },
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
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">{t('admin.members.module')}</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">{t('admin.members.title')}</h1>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
        <div className="dashboard-filter-bar">
          <Input.Search
            placeholder={t('admin.members.search_placeholder')}
            allowClear
            onSearch={handleSearch}
            style={{ maxWidth: 300 }}
          />
          <Select
            allowClear
            showSearch
            placeholder={t('admin.members.filter_plan')}
            style={{ minWidth: 160 }}
            onChange={handlePlanFilter}
            optionFilterProp="label"
            options={plans.map((p) => ({ value: p._id, label: `${p.nameVi || p.nameEn}` }))}
          />
          <Select
            allowClear
            placeholder={t('admin.members.filter_status')}
            style={{ minWidth: 130 }}
            onChange={handleStatusFilter}
            options={[
              { value: 'active', label: t('admin.members.filter_status_active') },
              { value: 'locked', label: t('admin.members.filter_status_locked') },
            ]}
          />
          <Select
            allowClear
            placeholder="Số ngày còn lại"
            style={{ minWidth: 140 }}
            onChange={handleRemainingFilter}
            options={[
              { value: '0', label: 'Hết hạn' },
              { value: '1-7', label: 'Sắp hết hạn (1-7 ngày)' },
              { value: '8-30', label: 'Trong tháng (8-30 ngày)' },
              { value: '30+', label: 'Trên 30 ngày' },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            {t('admin.members.add')}
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
        onClose={() => setRenewModalOpen(false)}
        onSuccess={() => { setRenewModalOpen(false); fetchMembers() }}
      />
    </DashboardLayout>
  )
}
