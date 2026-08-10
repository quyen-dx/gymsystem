import {
  BarChartOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  GlobalOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import {
  Button,
  Empty,
  Input,
  Popconfirm,
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
import { SPECIALIZATION_OPTIONS } from '../../../services/trainingGroupService'
import {
  workoutService,
  type LibraryQuery,
  type LibraryWorkout,
  type WorkoutPlanPayload,
} from '../../../services/workoutService'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  published: { label: 'Đã xuất bản', color: 'green' },
  under_review: { label: 'Đang xem xét', color: 'orange' },
  hidden: { label: 'Đã ẩn', color: 'red' },
  deleted: { label: 'Đã xóa', color: 'default' },
}

export default function PTMyWorkoutsPage() {
  const navigate = useNavigate()

  const [workouts, setWorkouts] = useState<LibraryWorkout[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [search, setSearch] = useState('')

  const loadWorkouts = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params: LibraryQuery = { page, limit: 20, mine: 'true' }
      if (search) params.search = search
      const { data } = await workoutService.getSharedTemplates(params)
      setWorkouts(data.workouts || [])
      setPagination(data.pagination)
    } catch (error: unknown) {
      const e = error as { response?: { data?: { message?: string } } }
      message.error(e?.response?.data?.message || 'Không thể tải giáo án của bạn')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { loadWorkouts() }, [loadWorkouts])

  const handleDelete = async (id: string) => {
    try {
      await workoutService.deleteWorkout(id)
      message.success('Đã xóa giáo án')
      loadWorkouts()
    } catch (error: unknown) {
      const e = error as { response?: { data?: { message?: string } } }
      message.error(e?.response?.data?.message || 'Không thể xóa giáo án')
    }
  }

  const handleToggleVisibility = async (record: LibraryWorkout) => {
    const next = record.visibility === 'private' ? 'public' : 'private'
    try {
      await workoutService.updateWorkout(record._id, { visibility: next } as WorkoutPlanPayload)
      message.success(
        next === 'public'
          ? 'Đã công khai — giáo án xuất hiện ở Thư viện giáo án'
          : 'Đã chuyển về Chỉ mình tôi — giáo án bị ẩn khỏi Thư viện',
      )
      loadWorkouts()
    } catch (error: unknown) {
      const e = error as { response?: { data?: { message?: string } } }
      message.error(e?.response?.data?.message || 'Không thể đổi chế độ hiển thị')
    }
  }

  const columns = [
    {
      title: 'Tên giáo án',
      width: 220,
      render: (_: unknown, record: LibraryWorkout) => (
        <div>
          <div className="font-semibold text-[var(--gs-text)]">{record.workoutName || record.name}</div>
          <div className="text-xs text-[var(--gs-text-muted)]">{record.description?.slice(0, 60)}{(record.description?.length || 0) > 60 ? '...' : ''}</div>
        </div>
      ),
    },
    {
      title: 'Chuyên môn',
      width: 130,
      render: (_: unknown, record: LibraryWorkout) => {
        const spec = SPECIALIZATION_OPTIONS.find((s) => s.value === record.specializationId)
        return (
          <Tag color="blue">{spec?.label || record.specializationId || '-'}</Tag>
        )
      },
    },
    {
      title: 'Mục tiêu',
      width: 130,
      render: (_: unknown, record: LibraryWorkout) => (
        <Tag color="purple">{record.goal || '-'}</Tag>
      ),
    },
    {
      title: 'Số buổi',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, record: LibraryWorkout) => (
        <span>{record.totalSessions || record.days?.length || record.weeks?.length || 0}</span>
      ),
    },
    {
      title: 'Hiển thị',
      width: 140,
      render: (_: unknown, record: LibraryWorkout) => (
        record.visibility === 'private'
          ? <Tag icon={<LockOutlined />} color="default">Chỉ mình tôi</Tag>
          : <Tag icon={<GlobalOutlined />} color="green">Công khai</Tag>
      ),
    },
    {
      title: 'Ngày tạo',
      width: 110,
      render: (_: unknown, record: LibraryWorkout) => (
        <span className="text-xs text-[var(--gs-text-muted)]">
          {record.createdAt ? dayjs(record.createdAt).format('DD/MM/YYYY') : '-'}
        </span>
      ),
    },
    {
      title: 'Trạng thái',
      width: 120,
      render: (_: unknown, record: LibraryWorkout) => {
        const st = STATUS_MAP[record.templateStatus] || { label: record.templateStatus, color: 'default' }
        return <Tag color={st.color}>{st.label}</Tag>
      },
    },
    {
      title: 'Thao tác',
      width: 260,
      render: (_: unknown, record: LibraryWorkout) => {
        const actions: React.ReactNode[] = []

        actions.push(
          <Tooltip key="view" title="Xem chi tiết">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/pt/workouts/view/${record._id}`)}
            />
          </Tooltip>,
        )

        actions.push(
          <Tooltip key="assign" title="Gán cho hội viên">
            <Button
              size="small"
              icon={<TeamOutlined />}
              onClick={() => navigate(`/pt/clients?assignWorkout=${record._id}`)}
            />
          </Tooltip>,
        )

        actions.push(
          <Tooltip key="visibility" title={record.visibility === 'private' ? 'Công khai giáo án' : 'Chuyển về chỉ mình tôi'}>
            <Popconfirm
              title={record.visibility === 'private' ? 'Công khai giáo án này cho mọi PT?' : 'Chuyển giáo án về chế độ chỉ mình tôi?'}
              onConfirm={() => handleToggleVisibility(record)}
              okText="Xác nhận"
              cancelText="Hủy"
            >
              <Button size="small" icon={record.visibility === 'private' ? <GlobalOutlined /> : <LockOutlined />} />
            </Popconfirm>
          </Tooltip>,
        )

        actions.push(
          <Tooltip key="edit" title="Chỉnh sửa">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/pt/workouts/edit/${record._id}`)}
            />
          </Tooltip>,
        )

        actions.push(
          <Tooltip key="stats" title="Thống kê sử dụng">
            <Button
              size="small"
              icon={<BarChartOutlined />}
              onClick={() => navigate(`/pt/workouts/view/${record._id}`)}
            />
          </Tooltip>,
        )

        if (record.templateStatus !== 'deleted') {
          actions.push(
            <Tooltip key="delete" title="Xóa">
              <Popconfirm
                title="Xóa giáo án này?"
                okText="Xóa"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
                onConfirm={() => handleDelete(record._id)}
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Tooltip>,
          )
        }

        return <Space size={4}>{actions}</Space>
      },
    },
  ]

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Bảng điều khiển</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">Giáo án của tôi</h1>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">
          Toàn bộ giáo án bạn đã tạo. Giáo án ở chế độ Công khai sẽ xuất hiện ở Thư viện giáo án cho mọi PT.
        </p>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
        <div className="pt-workouts-filters mb-4 flex flex-wrap items-center gap-3">
          <Input
            placeholder="Tìm kiếm theo tên giáo án..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={() => loadWorkouts()}
            className="max-[767px]:!w-full"
            style={{ width: 280 }}
            allowClear
          />

          <Button icon={<ReloadOutlined />} onClick={() => loadWorkouts()} loading={loading} className="max-[767px]:w-full max-[767px]:min-h-[44px] max-[767px]:text-[15px]">
            Tải lại
          </Button>

          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/pt/workouts/create')} className="max-[767px]:w-full max-[767px]:min-h-[44px] max-[767px]:text-[15px]">
            Tạo giáo án mới
          </Button>
        </div>

        <div className="member-scroll-x">
          <Table className="pt-workouts-table"
            dataSource={workouts}
            columns={columns}
            rowKey="_id"
            loading={loading}
            locale={{ emptyText: <Empty description="Bạn chưa tạo giáo án nào" /> }}
            pagination={{
              current: pagination.page,
              pageSize: pagination.limit,
              total: pagination.total,
              showSizeChanger: false,
              onChange: (page) => loadWorkouts(page),
            }}
            scroll={{ x: 1300 }}
          />
        </div>
        {/* Mobile cards */}
        <div className="pt-workouts-cards">
          {workouts.map((record) => {
            const spec = SPECIALIZATION_OPTIONS.find((s) => s.value === record.specializationId)
            const st = STATUS_MAP[record.templateStatus] || { label: record.templateStatus, color: 'default' }
            return (
              <div key={record._id} className="pt-workout-card">
                <div className="pt-workout-header">
                  <div className="pt-workout-name">{record.workoutName || record.name}</div>
                  {record.description && <div className="text-xs text-[var(--gs-text-muted)] mt-1">{record.description?.slice(0, 80)}{(record.description?.length || 0) > 80 ? '...' : ''}</div>}
                </div>
                <div className="pt-workout-meta">
                  <Tag color="blue" className="m-0 text-[11px]">{spec?.label || record.specializationId || '-'}</Tag>
                  <Tag color="purple" className="m-0 text-[11px]">{record.goal || '-'}</Tag>
                  <Tag color={st.color} className="m-0 text-[11px]">{st.label}</Tag>
                  <Tag color={record.visibility === 'private' ? 'default' : 'green'} className="m-0 text-[11px]">
                    {record.visibility === 'private' ? '🔒 Chỉ mình tôi' : '🌐 Công khai'}
                  </Tag>
                </div>
                <div className="pt-workout-detail">
                  <span className="pt-label">Số buổi</span>
                  <span className="pt-value">{record.totalSessions || record.days?.length || record.weeks?.length || 0}</span>
                </div>
                <div className="pt-workout-detail">
                  <span className="pt-label">Ngày tạo</span>
                  <span className="pt-value">{record.createdAt ? dayjs(record.createdAt).format('DD/MM/YYYY') : '-'}</span>
                </div>
                <div className="pt-workout-actions">
                  <Button size="small" onClick={() => navigate(`/pt/workouts/view/${record._id}`)}>Xem</Button>
                  <Button size="small" onClick={() => navigate(`/pt/clients?assignWorkout=${record._id}`)}>Sử dụng</Button>
                  <Button size="small" onClick={() => navigate(`/pt/workouts/edit/${record._id}`)}>Sửa</Button>
                  <Button size="small" onClick={() => handleToggleVisibility(record)}>
                    {record.visibility === 'private' ? 'Công khai' : 'Chỉ mình tôi'}
                  </Button>
                  <Button size="small" onClick={() => navigate(`/pt/workouts/view/${record._id}`)}>Thống kê</Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </DashboardLayout>
  )
}
