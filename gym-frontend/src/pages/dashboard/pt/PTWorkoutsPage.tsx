import {
  BarChartOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
  StopOutlined,
  TeamOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import {
  Button,
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
  Form,
} from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import {
  workoutService,
  type LibraryWorkout,
} from '../../../services/workoutService'
import { useAuth } from '../../../hooks/useAuth'
import { SPECIALIZATION_OPTIONS } from '../../../services/trainingGroupService'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  published: { label: 'Đã xuất bản', color: 'green' },
  under_review: { label: 'Đang xem xét', color: 'orange' },
  hidden: { label: 'Đã ẩn', color: 'red' },
  deleted: { label: 'Đã xóa', color: 'default' },
}

const REPORT_REASONS = [
  { value: 'wrong_expertise', label: 'Sai chuyên môn' },
  { value: 'incorrect_content', label: 'Nội dung không đúng kỹ thuật' },
  { value: 'missing_info', label: 'Thiếu thông tin' },
  { value: 'spam', label: 'Spam' },
  { value: 'duplicate', label: 'Trùng lặp' },
  { value: 'other', label: 'Khác' },
]

function ImprovementModal({
  open,
  workout,
  onClose,
  onSubmit,
}: {
  open: boolean
  workout: LibraryWorkout | null
  onClose: () => void
  onSubmit: (values: { title: string; content: string }) => void
}) {
  const [form] = Form.useForm()

  return (
    <Modal
      title="Đề xuất cải tiến"
      open={open}
      onCancel={() => {
        form.resetFields()
        onClose()
      }}
      onOk={async () => {
        const values = await form.validateFields()
        onSubmit(values)
        form.resetFields()
      }}
      okText="Gửi"
    >
      <p className="mb-3 text-sm text-[var(--gs-text-muted)]">
        Góp ý cho giáo án: <strong>{workout?.workoutName || workout?.name}</strong>
      </p>
      <Form form={form} layout="vertical">
        <Form.Item
          label="Tiêu đề"
          name="title"
          rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tiêu đề' }]}
        >
          <Input placeholder="VD: Buổi 4 nên thay Romanian Deadlift" />
        </Form.Item>
        <Form.Item
          label="Nội dung đề xuất"
          name="content"
          rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập nội dung' }]}
        >
          <Input.TextArea rows={4} placeholder="Mô tả chi tiết đề xuất cải tiến..." />
        </Form.Item>
      </Form>
    </Modal>
  )
}

function ReportModal({
  open,
  workout,
  onClose,
  onSubmit,
}: {
  open: boolean
  workout: LibraryWorkout | null
  onClose: () => void
  onSubmit: (values: { reason: string; detail: string }) => void
}) {
  const [form] = Form.useForm()

  return (
    <Modal
      title="Báo cáo vi phạm"
      open={open}
      onCancel={() => {
        form.resetFields()
        onClose()
      }}
      onOk={async () => {
        const values = await form.validateFields()
        onSubmit(values)
        form.resetFields()
      }}
      okText="Gửi"
    >
      <p className="mb-3 text-sm text-[var(--gs-text-muted)]">
        Báo cáo giáo án: <strong>{workout?.workoutName || workout?.name}</strong>
      </p>
      <Form form={form} layout="vertical">
        <Form.Item
          label="Lý do"
          name="reason"
          rules={[{ required: true, message: 'Vui lòng chọn lý do' }]}
        >
          <Radio.Group>
            <Space direction="vertical">
              {REPORT_REASONS.map((r) => (
                <Radio key={r.value} value={r.value}>
                  {r.label}
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        </Form.Item>
        <Form.Item label="Chi tiết" name="detail">
          <Input.TextArea rows={3} placeholder="Mô tả chi tiết vi phạm (không bắt buộc)..." />
        </Form.Item>
      </Form>
    </Modal>
  )
}

function AssignModal({
  open,
  workout,
  onClose,
  onSelectMember,
}: {
  open: boolean
  workout: LibraryWorkout | null
  onClose: () => void
  onSelectMember: (memberId: string) => void
}) {
  return (
    <Modal
      title={`Gán giáo án cho hội viên`}
      open={open}
      onCancel={onClose}
      footer={null}
    >
      <p className="mb-3 text-sm text-[var(--gs-text-muted)]">
        Chọn hội viên để gán giáo án <strong>{workout?.workoutName || workout?.name}</strong>.
        Vui lòng vào mục Khách hàng để chọn hội viên và gán giáo án.
      </p>
    </Modal>
  )
}

const getName = (v: unknown): string => {
  if (!v) return '-'
  if (typeof v === 'string') return v
  return (v as any).fullName || (v as any).name || '-'
}

export default function PTWorkoutsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const userId = user?._id

  const [workouts, setWorkouts] = useState<LibraryWorkout[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 })

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<{
    specializationId?: string
    goal?: string
    trainerId?: string
    mine?: string
    sortBy?: string
  }>({})

  const [specializations, setSpecializations] = useState<string[]>([])
  const [filteredGoals, setFilteredGoals] = useState<string[]>([])
  const [trainers, setTrainers] = useState<{ _id: string; name: string; fullName?: string }[]>([])

  const [improvementModal, setImprovementModal] = useState<{ open: boolean; workout: LibraryWorkout | null }>({ open: false, workout: null })
  const [reportModal, setReportModal] = useState<{ open: boolean; workout: LibraryWorkout | null }>({ open: false, workout: null })
  const [assignModal, setAssignModal] = useState<{ open: boolean; workout: LibraryWorkout | null }>({ open: false, workout: null })

  const [saving, setSaving] = useState(false)

  const loadWorkouts = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params: any = { page, limit: 20 }
      if (search) params.search = search
      if (filters.specializationId) params.specializationId = filters.specializationId
      if (filters.goal) params.goal = filters.goal
      if (filters.trainerId) params.trainerId = filters.trainerId
      if (filters.mine) params.mine = filters.mine
      if (filters.sortBy) params.sortBy = filters.sortBy

      const { data } = await workoutService.getSharedTemplates(params)
      setWorkouts(data.workouts || [])
      setPagination(data.pagination)
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể tải thư viện giáo án')
    } finally {
      setLoading(false)
    }
  }, [search, filters])

  const loadFilterOptions = useCallback(async () => {
    try {
      const [specRes, trainerRes] = await Promise.all([
        workoutService.getSpecializations(),
        workoutService.getTrainersWithWorkouts(),
      ])
      setSpecializations(specRes.data?.specializations || [])
      const allTrainers = trainerRes.data?.trainers || []
      setTrainers(allTrainers.filter((t) => String(t._id) !== String(userId)))
    } catch {}
  }, [userId])

  useEffect(() => {
    loadWorkouts()
    loadFilterOptions()
  }, [loadWorkouts, loadFilterOptions])

  useEffect(() => {
    if (!filters.specializationId) {
      workoutService.getGoals()
        .then(({ data }) => setFilteredGoals(data?.goals || []))
        .catch(() => setFilteredGoals([]))
      return
    }
    workoutService.getGoalsBySpecializationFilter(filters.specializationId)
      .then(({ data }) => setFilteredGoals(data?.goals || []))
      .catch(() => setFilteredGoals([]))
  }, [filters.specializationId])

  const isOwner = (workout: LibraryWorkout) => {
    const ptId = typeof workout.ptId === 'string' ? workout.ptId : workout.ptId?._id
    return String(ptId) === String(userId)
  }

  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin'

  const handleDelete = async (id: string) => {
    try {
      await workoutService.deleteWorkout(id)
      message.success('Đã xóa giáo án')
      loadWorkouts()
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể xóa giáo án')
    }
  }

  const handleHide = async (id: string) => {
    try {
      await workoutService.hideWorkout(id, 'Admin ẩn giáo án')
      message.success('Đã ẩn giáo án')
      loadWorkouts()
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể ẩn giáo án')
    }
  }

  const handleRestore = async (id: string) => {
    try {
      await workoutService.restoreWorkout(id)
      message.success('Đã khôi phục giáo án')
      loadWorkouts()
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể khôi phục giáo án')
    }
  }

  const handleImprovement = async (values: { title: string; content: string }) => {
    if (!improvementModal.workout) return
    setSaving(true)
    try {
      await workoutService.submitImprovement({
        workoutTemplateId: improvementModal.workout._id,
        title: values.title,
        content: values.content,
      })
      message.success('Đã gửi đề xuất cải tiến')
      setImprovementModal({ open: false, workout: null })
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể gửi đề xuất')
    } finally {
      setSaving(false)
    }
  }

  const handleReport = async (values: { reason: string; detail: string }) => {
    if (!reportModal.workout) return
    setSaving(true)
    try {
      await workoutService.reportWorkout({
        workoutTemplateId: reportModal.workout._id,
        reason: values.reason,
        detail: values.detail,
      })
      message.success('Đã gửi báo cáo vi phạm')
      setReportModal({ open: false, workout: null })
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể gửi báo cáo')
    } finally {
      setSaving(false)
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
      title: 'PT tạo',
      width: 130,
      render: (_: unknown, record: LibraryWorkout) => {
        const ptName = getName(record.ptId)
        return (
          <span>
            {ptName}
            {isOwner(record) && <Tag color="gold" className="ml-1" style={{ fontSize: 10 }}>Tôi</Tag>}
          </span>
        )
      },
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
      width: 240,
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

        if (isAdmin) {
          if (record.templateStatus === 'published' || record.templateStatus === 'under_review') {
            actions.push(
              <Tooltip key="hide" title="Ẩn">
                <Popconfirm
                  title="Ẩn giáo án này?"
                  onConfirm={() => handleHide(record._id)}
                  okText="Ẩn"
                  cancelText="Hủy"
                >
                  <Button size="small" icon={<StopOutlined />} danger />
                </Popconfirm>
              </Tooltip>,
            )
          }
          if (record.templateStatus === 'hidden') {
            actions.push(
              <Tooltip key="restore" title="Khôi phục">
                <Popconfirm
                  title="Khôi phục giáo án này?"
                  onConfirm={() => handleRestore(record._id)}
                  okText="Khôi phục"
                  cancelText="Hủy"
                >
                  <Button size="small" icon={<UndoOutlined />} />
                </Popconfirm>
              </Tooltip>,
            )
          }
        }

        if (isOwner(record)) {
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
        } else {
          actions.push(
            <Tooltip key="improve" title="Đề xuất cải tiến">
              <Button
                size="small"
                icon={<SendOutlined />}
                onClick={() => setImprovementModal({ open: true, workout: record })}
              />
            </Tooltip>,
          )
          actions.push(
            <Tooltip key="report" title="Báo cáo vi phạm">
              <Button
                size="small"
                icon={<ExclamationCircleOutlined />}
                danger
                onClick={() => setReportModal({ open: true, workout: record })}
              />
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
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">Thư viện giáo án</h1>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">
          Tìm kiếm, xem và sử dụng giáo án dùng chung trong toàn hệ thống.
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

          <Select
            placeholder="Chuyên môn"
            value={filters.specializationId || undefined}
            onChange={(v) => setFilters((f) => ({ ...f, specializationId: v, goal: undefined }))}
            allowClear
            className="max-[767px]:!w-full"
            style={{ width: 160 }}
            options={specializations.map((s) => ({ value: s, label: s }))}
          />

          <Select
            placeholder="Mục tiêu"
            value={filters.goal || undefined}
            onChange={(v) => setFilters((f) => ({ ...f, goal: v }))}
            allowClear
            className="max-[767px]:!w-full"
            style={{ width: 160 }}
            options={filteredGoals.map((g) => ({ value: g, label: g }))}
          />

          <Select
            placeholder="Người tạo"
            value={
              filters.mine === 'true'
                ? '__mine__'
                : filters.trainerId || undefined
            }
            onChange={(v) => {
              if (v === '__mine__') {
                setFilters((f) => ({ ...f, trainerId: undefined, mine: 'true' }))
              } else if (!v) {
                setFilters((f) => ({ ...f, trainerId: undefined, mine: undefined }))
              } else {
                setFilters((f) => ({ ...f, trainerId: v, mine: undefined }))
              }
            }}
            allowClear
            className="max-[767px]:!w-full"
            style={{ width: 200 }}
            options={[
              { value: '__mine__', label: 'Giáo án của tôi' },
              ...trainers.map((t) => ({
                value: t._id,
                label: t.fullName || t.name || t._id,
              })),
            ]}
          />

          <Select
            placeholder="Sắp xếp"
            value={filters.sortBy || undefined}
            onChange={(v) => setFilters((f) => ({ ...f, sortBy: v }))}
            allowClear
            className="max-[767px]:!w-full"
            style={{ width: 200 }}
            options={[
              { value: 'most_used', label: 'Được sử dụng nhiều nhất' },
              { value: 'newest', label: 'Mới nhất' },
            ]}
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
            locale={{ emptyText: <Empty description="Chưa có giáo án nào trong thư viện" /> }}
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
            const ptName = getName(record.ptId)
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
                </div>
                <div className="pt-workout-detail">
                  <span className="pt-label">Số buổi</span>
                  <span className="pt-value">{record.totalSessions || record.days?.length || record.weeks?.length || 0}</span>
                </div>
                <div className="pt-workout-detail">
                  <span className="pt-label">PT tạo</span>
                  <span className="pt-value">{ptName}{isOwner(record) ? ' (Tôi)' : ''}</span>
                </div>
                <div className="pt-workout-detail">
                  <span className="pt-label">Ngày tạo</span>
                  <span className="pt-value">{record.createdAt ? dayjs(record.createdAt).format('DD/MM/YYYY') : '-'}</span>
                </div>
                <div className="pt-workout-actions">
                  <Button size="small" onClick={() => navigate(`/pt/workouts/view/${record._id}`)}>Xem</Button>
                  <Button size="small" onClick={() => navigate(`/pt/clients?assignWorkout=${record._id}`)}>Sử dụng</Button>
                  {isOwner(record) && <Button size="small" onClick={() => navigate(`/pt/workouts/edit/${record._id}`)}>Sửa</Button>}
                  <Button size="small" onClick={() => navigate(`/pt/workouts/progress/${record._id}`)}>Thống kê</Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <ImprovementModal
        open={improvementModal.open}
        workout={improvementModal.workout}
        onClose={() => setImprovementModal({ open: false, workout: null })}
        onSubmit={handleImprovement}
      />

      <ReportModal
        open={reportModal.open}
        workout={reportModal.workout}
        onClose={() => setReportModal({ open: false, workout: null })}
        onSubmit={handleReport}
      />

      <AssignModal
        open={assignModal.open}
        workout={assignModal.workout}
        onClose={() => setAssignModal({ open: false, workout: null })}
        onSelectMember={(memberId) => {
          console.log('Selected member:', memberId)
          setAssignModal({ open: false, workout: null })
        }}
      />
    </DashboardLayout>
  )
}
