import {
  CheckCircleFilled,
  ClockCircleOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import {
  Button,
  Empty,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { useAuth } from '../../../hooks/useAuth'
import { ptAssignmentService, type PTAssignment, type PTAssignmentMember } from '../../../services/ptAssignmentService'
import { scheduleService } from '../../../services/scheduleService'
import { workoutService, type WorkoutSchedule } from '../../../services/workoutService'
import { getUserDisplayName } from '../../../utils/userDisplay'

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
  workout?: { _id: string; name: string; goal?: string } | null
  scheduleCount?: number
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
    workout,
    scheduleCount: assignment.scheduleCount ?? 0,
    cancelledAt: assignment.cancelledAt,
    cancelReason: assignment.cancelReason,
  }
}

export default function PTClientsPage() {
  useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active')

  const [clients, setClients] = useState<ClientInfo[]>([])
  const [historyClients, setHistoryClients] = useState<ClientInfo[]>([])
  const [historyPagination, setHistoryPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 })
  const [loading, setLoading] = useState(false)
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null)
  const [clientSchedules, setClientSchedules] = useState<Record<string, WorkoutSchedule[]>>({})
  const [schedulesLoading, setSchedulesLoading] = useState<string | null>(null)

  const fetchClients = useCallback(async () => {
    setLoading(true)
    try {
      const res = await ptAssignmentService.getPTClients()
      const assignments = res.data?.assignments || []
      const members = assignments.map(extractClient).filter(Boolean) as ClientInfo[]
      setClients(members)
    } catch {
      message.error('Không thể tải danh sách khách hàng')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchHistory = useCallback(async (page = 1) => {
    try {
      const res = await ptAssignmentService.getPTHistory({ page, limit: 20 })
      const { items, pagination } = res.data
      const members = items.map(extractClient).filter(Boolean) as ClientInfo[]
      setHistoryClients(members)
      setHistoryPagination(pagination)
    } catch {
      message.error('Không thể tải lịch sử khách hàng')
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'active') {
      fetchClients()
    } else {
      fetchHistory()
    }
  }, [activeTab, fetchClients, fetchHistory])

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
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể xoá lịch tập')
    }
  }

  const expandedScheduleColumns = [
    {
      title: 'Giáo án',
      render: (_: unknown, record: WorkoutSchedule) => {
        const tpl = record.templateId as any
        return (
          <div>
            <div className="font-medium text-[var(--gs-text)]">{tpl?.name || 'Giáo án mẫu'}</div>
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
      width: 80,
      render: (_: unknown, record: WorkoutSchedule) => (
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
      ),
    },
  ]

  const columns = [
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

  const historyColumns = [
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
              {record.phone || record.email || '—'}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Ngày kết thúc',
      width: 130,
      render: (_: unknown, record: ClientInfo) => (
        <span className="text-sm text-[var(--gs-text-muted)]">
          {record.cancelledAt ? new Date(record.cancelledAt).toLocaleDateString('vi-VN') : '—'}
        </span>
      ),
    },
    {
      title: 'Lý do',
      render: (_: unknown, record: ClientInfo) => (
        <span className="text-sm text-[var(--gs-text-muted)]">
          {record.cancelReason || '—'}
        </span>
      ),
    },
  ]

  const activeTabEl = activeTab === 'active' ? (
    <div className="member-scroll-x">
      <Table
        dataSource={clients}
        columns={columns}
        rowKey="_id"
        loading={loading}
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
                    <Button
                      size="small"
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => navigate(`/pt/clients/${record._id}/create-schedule`)}
                    >
                      Tạo lịch tập
                    </Button>
                  </Space>
                </div>
                <Table
                  dataSource={schedules}
                  columns={expandedScheduleColumns}
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
    </div>
  ) : (
    <div className="member-scroll-x">
      <Table
        dataSource={historyClients}
        columns={historyColumns}
        rowKey="_id"
        loading={loading}
        pagination={{
          pageSize: historyPagination.limit,
          current: historyPagination.page,
          total: historyPagination.total,
          onChange: (p) => fetchHistory(p),
        }}
        locale={{ emptyText: <Empty description="Chưa có học viên đã kết thúc" /> }}
      />
    </div>
  )

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">PT</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">
          Học viên của tôi
        </h1>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">
          {activeTab === 'active' ? `${clients.length} học viên` : `${historyPagination.total} học viên`}
        </p>
      </div>

      <div className="mb-4 flex gap-4 border-b border-[var(--gs-border)]">
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
        {activeTabEl}
      </div>

    </DashboardLayout>
  )
}
