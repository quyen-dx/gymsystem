import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import {
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { useAuth } from '../../../hooks/useAuth'
import { memberService } from '../../../services/memberService'
import { workoutService } from '../../../services/workoutService'
import type {
  WorkoutPlan,
  WorkoutPlanPayload,
  WorkoutSession,
  WorkoutWeek,
} from '../../../services/workoutService'
import { getUserDisplayName } from '../../../utils/userDisplay'

interface ClientInfo {
  _id: string
  name: string
  fullName?: string
  email?: string
  phone?: string
  memberCode?: string
  avatar?: string
  workoutCount: number
}

type WorkoutFormValues = Omit<WorkoutPlanPayload, 'weeks'> & {
  weeks: WorkoutWeek[]
  startDate?: string
  endDate?: string
  description?: string
}

const emptyExercise = () => ({
  name: '',
  sets: 3,
  reps: 10,
  restTime: '60s',
  techniqueNote: '',
})

const emptySession = (): WorkoutSession => ({
  sessionName: '',
  feedback: '',
  exercises: [emptyExercise()],
})

const emptyWeek = (weekNumber: number): WorkoutWeek => ({
  weekNumber,
  sessions: [emptySession()],
})

const getId = (value: WorkoutPlan['member'] | WorkoutPlan['personalTrainer']) =>
  typeof value === 'string' ? value : value?._id

const normalizeWorkoutList = (data: any): WorkoutPlan[] => {
  const list = data?.workouts || data?.data || data
  return Array.isArray(list) ? list : []
}

const normalizeWorkoutForForm = (workout: WorkoutPlan): WorkoutFormValues => ({
  workoutName: workout.workoutName || '',
  goal: workout.goal || '',
  durationWeeks: Number(workout.durationWeeks || workout.weeks?.length || 1),
  startDate: workout.startDate || undefined,
  endDate: workout.endDate || undefined,
  description: workout.description || '',
  member: getId(workout.member) || '',
  personalTrainer: getId(workout.personalTrainer) || '',
  estimatedCalories: Number(workout.estimatedCalories || 0),
  weeks: (workout.weeks?.length ? workout.weeks : [emptyWeek(1)]).map((week, weekIndex) => ({
    weekNumber: Number(week.weekNumber || weekIndex + 1),
    sessions: (week.sessions?.length ? week.sessions : [emptySession()]).map((session) => ({
      sessionName: session.sessionName || '',
      feedback: session.feedback || '',
      exercises: (session.exercises?.length ? session.exercises : [emptyExercise()]).map((exercise) => ({
        name: exercise.name || '',
        sets: Number(exercise.sets || 1),
        reps: Number(exercise.reps || 1),
        restTime: exercise.restTime || '',
        techniqueNote: exercise.techniqueNote || '',
      })),
    })),
  })),
})

const sanitizePayload = (values: WorkoutFormValues): WorkoutPlanPayload => ({
  workoutName: values.workoutName.trim(),
  goal: values.goal.trim(),
  durationWeeks: Number(values.durationWeeks),
  startDate: values.startDate ? dayjs(values.startDate).toISOString() : undefined,
  endDate: values.endDate ? dayjs(values.endDate).toISOString() : undefined,
  description: values.description?.trim() || '',
  member: values.member,
  personalTrainer: values.personalTrainer,
  estimatedCalories: Number(values.estimatedCalories || 0),
  weeks: values.weeks.map((week, weekIndex) => ({
    weekNumber: Number(week.weekNumber || weekIndex + 1),
    sessions: week.sessions.map((session) => ({
      sessionName: session.sessionName.trim(),
      feedback: session.feedback?.trim() || '',
      exercises: session.exercises.map((exercise) => ({
        name: exercise.name.trim(),
        sets: Number(exercise.sets),
        reps: Number(exercise.reps),
        restTime: exercise.restTime.trim(),
        techniqueNote: exercise.techniqueNote?.trim() || '',
      })),
    })),
  })),
})

interface ProgressData {
  week: string
  completed: number
  calories: number
  feedbacks: string[]
}

const buildProgressData = (workouts: WorkoutPlan[]): ProgressData[] => {
  if (!workouts.length) return []
  const weekMap = new Map<number, ProgressData>()
  for (const plan of workouts) {
    for (const week of plan.weeks || []) {
      const wn = week.weekNumber
      if (!weekMap.has(wn)) weekMap.set(wn, { week: `Tuần ${wn}`, completed: 0, calories: 0, feedbacks: [] })
      const entry = weekMap.get(wn)!
      entry.completed += week.sessions?.length || 0
      entry.calories += Number(plan.estimatedCalories || 0) / Math.max(plan.weeks?.length || 1, 1)
      for (const s of week.sessions || []) {
        if (s.feedback?.trim()) entry.feedbacks.push(s.feedback.trim())
      }
    }
  }
  return Array.from(weekMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([, data]) => data)
}

export default function PTClientsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form] = Form.useForm<WorkoutFormValues>()
  const [clients, setClients] = useState<ClientInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null)
  const [clientWorkouts, setClientWorkouts] = useState<
    Record<string, WorkoutPlan[]>
  >({})
  const [workoutsLoading, setWorkoutsLoading] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingWorkout, setEditingWorkout] = useState<WorkoutPlan | null>(null)
  const [saving, setSaving] = useState(false)
  const [feedbackInputs, setFeedbackInputs] = useState<Record<string, string>>({})
  const [feedbackSaving, setFeedbackSaving] = useState<string | null>(null)

  const handleFeedbackSave = async (workoutId: string, memberId: string, note: string) => {
    if (!note.trim()) return
    setFeedbackSaving(workoutId)
    try {
      await workoutService.createSessionFeedback({
        workoutId,
        memberId,
        date: new Date().toISOString(),
        note: note.trim(),
      })
      message.success('Đã lưu ghi chú')
      setFeedbackInputs((prev) => ({ ...prev, [workoutId]: '' }))
      if (expandedMemberId) fetchClientWorkouts(expandedMemberId)
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể lưu ghi chú')
    } finally {
      setFeedbackSaving(null)
    }
  }

  const fetchClients = useCallback(async () => {
    setLoading(true)
    try {
      const res = await memberService.getMembers()
      const members = res.data?.members || []
      const mapped: ClientInfo[] = members.map((m) => ({
        _id: m._id,
        name: m.name || m.fullName || '',
        fullName: m.fullName,
        email: m.email ?? undefined,
        phone: m.phone ?? undefined,
        memberCode: m.memberCode,
        avatar: m.avatar,
        workoutCount: 0,
      }))
      setClients(mapped)
    } catch {
      message.error('Không thể tải danh sách khách hàng')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const fetchClientWorkouts = useCallback(async (memberId: string) => {
    setWorkoutsLoading(memberId)
    try {
      const res = await workoutService.getWorkouts({ memberId })
      const raw = res.data
      const workouts = normalizeWorkoutList(raw)
      setClientWorkouts((prev) => ({ ...prev, [memberId]: workouts }))
    } catch {
      message.error('Không thể tải giáo án của khách hàng')
    } finally {
      setWorkoutsLoading(null)
    }
  }, [])

  const handleExpand = (expanded: boolean, record: ClientInfo) => {
    if (expanded) {
      setExpandedMemberId(record._id)
      if (!clientWorkouts[record._id]) {
        fetchClientWorkouts(record._id)
      }
    } else {
      setExpandedMemberId(null)
    }
  }

  const openCreate = (memberId: string) => {
    setEditingWorkout(null)
    form.setFieldsValue({
      workoutName: '',
      goal: '',
      durationWeeks: 4,
      startDate: undefined as unknown as string,
      endDate: undefined as unknown as string,
      description: '',
      member: memberId,
      personalTrainer: user?._id || '',
      estimatedCalories: 0,
      weeks: [emptyWeek(1)],
    })
    setModalOpen(true)
  }

  const openEdit = async (workout: WorkoutPlan) => {
    setEditingWorkout(workout)
    setModalOpen(true)
    try {
      const { data } = await workoutService.getWorkoutById(workout._id)
      const detail = (data?.workout || data?.data || data) as WorkoutPlan | undefined
      if (!detail) throw new Error('No workout data')
      form.setFieldsValue(normalizeWorkoutForForm(detail))
      setEditingWorkout(detail)
    } catch {
      message.error('Không thể tải chi tiết giáo án')
      form.setFieldsValue(normalizeWorkoutForForm(workout))
    }
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingWorkout(null)
    form.resetFields()
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const payload = sanitizePayload(values)
      setSaving(true)
      if (editingWorkout) {
        await workoutService.updateWorkout(editingWorkout._id, payload)
        message.success('Đã cập nhật giáo án')
      } else {
        await workoutService.createWorkout(payload)
        message.success('Đã tạo giáo án')
      }
      closeModal()
      fetchClients()
      if (expandedMemberId) fetchClientWorkouts(expandedMemberId)
    } catch (error: any) {
      if (error?.errorFields) return
      message.error(error?.response?.data?.message || 'Không thể lưu giáo án')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (workout: WorkoutPlan, memberId: string) => {
    try {
      await workoutService.deleteWorkout(workout._id)
      message.success('Đã xoá giáo án')
      fetchClients()
      fetchClientWorkouts(memberId)
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể xoá giáo án')
    }
  }

  const expandedWorkoutColumns = [
    {
      title: 'Tên giáo án',
      render: (_: unknown, record: WorkoutPlan) => (
        <div>
          <div className="font-medium text-[var(--gs-text)]">
            {record.workoutName}
          </div>
          <div className="text-xs text-[var(--gs-text-muted)]">
            {record.goal || ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Thời gian',
      width: 180,
      render: (_: unknown, record: WorkoutPlan) => (
        <span className="text-xs text-[var(--gs-text-muted)]">
          {record.startDate
            ? dayjs(record.startDate).format('DD/MM/YYYY')
            : '-'}
          {record.startDate && record.endDate ? ' → ' : ''}
          {record.endDate
            ? dayjs(record.endDate).format('DD/MM/YYYY')
            : ''}
        </span>
      ),
    },
    {
      title: 'Số tuần',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, record: WorkoutPlan) => (
        <Tag>{record.durationWeeks || record.weeks?.length || 0} tuần</Tag>
      ),
    },
    {
      title: 'Calories',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, record: WorkoutPlan) => (
        <span>
          {Number(record.estimatedCalories || 0).toLocaleString('vi-VN')}
        </span>
      ),
    },
    {
      title: 'Ghi chú',
      width: 280,
      render: (_: unknown, record: WorkoutPlan) => (
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Input.TextArea
            rows={2}
            placeholder="Nhập ghi chú buổi tập..."
            value={feedbackInputs[record._id] || ''}
            onChange={(e) =>
              setFeedbackInputs((prev) => ({
                ...prev,
                [record._id]: e.target.value,
              }))
            }
          />
          <Button
            size="small"
            type="primary"
            icon={<SaveOutlined />}
            loading={feedbackSaving === record._id}
            disabled={!feedbackInputs[record._id]?.trim()}
            onClick={() =>
              handleFeedbackSave(
                record._id,
                expandedMemberId || '',
                feedbackInputs[record._id] || '',
              )
            }
          >
            Lưu
          </Button>
        </Space>
      ),
    },
    {
      title: 'Thao tác',
      width: 130,
      render: (_: unknown, record: WorkoutPlan) => (
        <Space size={4}>
          <Tooltip title="Chỉnh sửa">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Xoá giáo án này?"
            okText="Xoá"
            cancelText="Huỷ"
            okButtonProps={{ danger: true }}
            onConfirm={() =>
              handleDelete(record, expandedMemberId || '')
            }
          >
            <Tooltip title="Xoá">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
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
              style={{
                fontWeight: 600,
                cursor: 'pointer',
                color: 'var(--gs-text)',
              }}
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
      title: 'Giáo án',
      width: 120,
      align: 'center' as const,
      render: (_: unknown, record: ClientInfo) => (
        <Tag color={record.workoutCount > 0 ? 'blue' : 'default'}>
          {record.workoutCount} giáo án
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      width: 200,
      render: (_: unknown, record: ClientInfo) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<PlusOutlined />}
            type="primary"
            onClick={() => openCreate(record._id)}
          >
            Tạo giáo án
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">PT</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">
          Khách hàng của tôi
        </h1>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">
          {clients.length} khách hàng đang được phân công giáo án
        </p>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
        <div className="member-scroll-x">
          <Table
            dataSource={clients}
            columns={columns}
            rowKey="_id"
            loading={loading}
            pagination={{ pageSize: 15 }}
            expandable={{
              expandedRowRender: (record) => {
                const workouts = clientWorkouts[record._id] || []
                return (
                  <div className="p-2">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-[var(--gs-text-muted)]">
                        {workouts.length} giáo án
                      </span>
                      <Space size={8}>
                        <Button
                          size="small"
                          icon={<ReloadOutlined />}
                          onClick={() => fetchClientWorkouts(record._id)}
                        >
                          Tải lại
                        </Button>
                        <Button
                          size="small"
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => openCreate(record._id)}
                        >
                          Thêm giáo án
                        </Button>
                      </Space>
                    </div>
                    <Table
                      dataSource={workouts}
                      columns={expandedWorkoutColumns}
                      rowKey="_id"
                      loading={workoutsLoading === record._id}
                      pagination={false}
                      locale={{
                        emptyText: (
                          <Empty description="Chưa có giáo án nào" />
                        ),
                      }}
                      size="small"
                    />
                    <Card
                      className="mt-4"
                      size="small"
                      title={
                        <span className="text-sm font-semibold text-[var(--gs-text)]">
                          Biểu đồ tiến trình
                        </span>
                      }
                    >
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={buildProgressData(workouts)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--gs-border)" />
                          <XAxis dataKey="week" tick={{ fontSize: 12, fill: 'var(--gs-text-muted)' }} />
                          <YAxis yAxisId="left" tick={{ fontSize: 12, fill: 'var(--gs-text-muted)' }} />
                          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: 'var(--gs-text-muted)' }} />
                          <RechartsTooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null
                              const data = payload[0].payload as ProgressData
                              return (
                                <div
                                  style={{
                                    background: 'var(--gs-card)',
                                    border: '1px solid var(--gs-border)',
                                    borderRadius: 8,
                                    padding: '8px 12px',
                                    fontSize: 13,
                                    maxWidth: 260,
                                  }}
                                >
                                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{data.week}</div>
                                  <div style={{ color: '#b6462f' }}>Buổi đã tập: {data.completed}</div>
                                  <div style={{ color: '#1890ff' }}>Calories: {data.calories.toFixed(0)}</div>
                                  {data.feedbacks.length > 0 && (
                                    <div style={{ marginTop: 6, borderTop: '1px solid var(--gs-border)', paddingTop: 6 }}>
                                      <div style={{ fontWeight: 500, marginBottom: 2, fontSize: 12, color: 'var(--gs-text-muted)' }}>Ghi chú:</div>
                                      {data.feedbacks.map((fb, i) => (
                                        <div key={i} style={{ fontSize: 12, color: 'var(--gs-text)', marginBottom: 2, lineHeight: 1.4 }}>
                                          • {fb}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            }}
                          />
                          <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="completed"
                            stroke="#b6462f"
                            strokeWidth={2}
                            dot={{ r: 3, fill: '#b6462f' }}
                            name="Buổi đã tập"
                          />
                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="calories"
                            stroke="#1890ff"
                            strokeWidth={2}
                            dot={{ r: 3, fill: '#1890ff' }}
                            name="Calories"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </Card>
                  </div>
                )
              },
              expandedRowKeys: expandedMemberId ? [expandedMemberId] : [],
              onExpand: handleExpand,
            }}
          />
        </div>
      </div>

      <Modal
        title={
          editingWorkout ? 'Chỉnh sửa giáo án' : 'Tạo giáo án mới'
        }
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSubmit}
        confirmLoading={saving}
        width={1100}
        okText={editingWorkout ? 'Lưu' : 'Tạo'}
        destroyOnClose
      >
        <div className="pt-3">
          <Form form={form} layout="vertical" initialValues={{ estimatedCalories: 0 }}>
            <div className="grid gap-4 md:grid-cols-2">
              <Form.Item
                label="Tên giáo án"
                name="workoutName"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: 'Tên giáo án là bắt buộc',
                  },
                ]}
              >
                <Input placeholder="VD: Strength foundation" />
              </Form.Item>
              <Form.Item
                label="Mục tiêu"
                name="goal"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: 'Mục tiêu là bắt buộc',
                  },
                ]}
              >
                <Input placeholder="VD: Build muscle, lose fat..." />
              </Form.Item>
              <Form.Item
                label="Thời lượng (tuần)"
                name="durationWeeks"
                rules={[
                  { required: true, message: 'Thời lượng là bắt buộc' },
                ]}
              >
                <InputNumber min={1} max={52} className="w-full" />
              </Form.Item>
              <Form.Item
                label="Calories dự kiến"
                name="estimatedCalories"
                rules={[
                  {
                    required: true,
                    message: 'Calories dự kiến là bắt buộc',
                  },
                ]}
              >
                <InputNumber min={0} className="w-full" />
              </Form.Item>
              <Form.Item label="Ngày bắt đầu" name="startDate">
                <DatePicker className="w-full" />
              </Form.Item>
              <Form.Item label="Ngày kết thúc" name="endDate">
                <DatePicker className="w-full" />
              </Form.Item>
            </div>

            <Form.Item label="Mô tả" name="description">
              <Input.TextArea
                rows={3}
                placeholder="Mô tả giáo án, mục tiêu, ghi chú..."
              />
            </Form.Item>

            <Form.List
              name="weeks"
              rules={[
                {
                  validator: async (_, value) => {
                    if (!value?.length)
                      throw new Error('Cần ít nhất 1 tuần tập')
                  },
                },
              ]}
            >
              {(
                weekFields,
                { add: addWeek, remove: removeWeek },
                { errors },
              ) => (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-[var(--gs-text)]">
                      Các tuần tập
                    </h2>
                    <Button
                      icon={<PlusOutlined />}
                      onClick={() =>
                        addWeek(emptyWeek(weekFields.length + 1))
                      }
                    >
                      Thêm tuần
                    </Button>
                  </div>
                  <Form.ErrorList errors={errors} />

                  {weekFields.map((weekField, weekIndex) => (
                    <div
                      key={weekField.key}
                      className="rounded-xl border border-[var(--gs-border)] bg-[var(--theme-bg)] p-4"
                    >
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <Form.Item
                          label="Tuần số"
                          name={[weekField.name, 'weekNumber']}
                          rules={[
                            {
                              required: true,
                              message: 'Số tuần là bắt buộc',
                            },
                          ]}
                          className="mb-0 min-w-40"
                        >
                          <InputNumber min={1} className="w-full" />
                        </Form.Item>
                        <Button
                          danger
                          icon={<DeleteOutlined />}
                          disabled={weekFields.length === 1}
                          onClick={() => removeWeek(weekField.name)}
                        >
                          Xoá tuần
                        </Button>
                      </div>

                      <Form.List
                        name={[weekField.name, 'sessions']}
                      >
                        {(
                          sessionFields,
                          {
                            add: addSession,
                            remove: removeSession,
                          },
                        ) => (
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <h3 className="font-semibold text-[var(--gs-text)]">
                                Buổi tập
                              </h3>
                              <Button
                                size="small"
                                icon={<PlusOutlined />}
                                onClick={() => addSession(emptySession())}
                              >
                                Thêm buổi
                              </Button>
                            </div>

                            {sessionFields.map((sessionField) => (
                              <div
                                key={sessionField.key}
                                className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card)] p-4"
                              >
                                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                                  <Form.Item
                                    label="Tên buổi"
                                    name={[sessionField.name, 'sessionName']}
                                    rules={[
                                      {
                                        required: true,
                                        whitespace: true,
                                        message: 'Tên buổi là bắt buộc',
                                      },
                                    ]}
                                  >
                                    <Input
                                      placeholder={`Tuần ${weekIndex + 1} - Buổi A`}
                                    />
                                  </Form.Item>
                                  <Form.Item
                                    label="Ghi chú"
                                    name={[sessionField.name, 'feedback']}
                                  >
                                    <Input placeholder="Ghi chú buổi tập" />
                                  </Form.Item>
                                  <Button
                                    danger
                                    icon={<DeleteOutlined />}
                                    disabled={sessionFields.length === 1}
                                    onClick={() =>
                                      removeSession(sessionField.name)
                                    }
                                    className="mt-[30px]"
                                  >
                                    Xoá
                                  </Button>
                                </div>

                                <Form.List
                                  name={[sessionField.name, 'exercises']}
                                >
                                  {(
                                    exerciseFields,
                                    {
                                      add: addExercise,
                                      remove: removeExercise,
                                    },
                                  ) => (
                                    <div className="space-y-3">
                                      <div className="flex flex-wrap items-center justify-between gap-3">
                                        <h4 className="font-medium text-[var(--gs-text)]">
                                          Bài tập
                                        </h4>
                                        <Button
                                          size="small"
                                          icon={<PlusOutlined />}
                                          onClick={() =>
                                            addExercise(emptyExercise())
                                          }
                                        >
                                          Thêm bài tập
                                        </Button>
                                      </div>

                                      {exerciseFields.map(
                                        (exerciseField) => (
                                          <div
                                            key={exerciseField.key}
                                            className="grid gap-3 rounded-lg border border-dashed border-[var(--gs-border)] p-3 md:grid-cols-[1.5fr_0.7fr_0.7fr_1fr_1.5fr_auto]"
                                          >
                                            <Form.Item
                                              label="Tên bài tập"
                                              name={[
                                                exerciseField.name,
                                                'name',
                                              ]}
                                              rules={[
                                                {
                                                  required: true,
                                                  whitespace: true,
                                                  message:
                                                    'Tên bài tập là bắt buộc',
                                                },
                                              ]}
                                            >
                                              <Input placeholder="Bench press" />
                                            </Form.Item>
                                            <Form.Item
                                              label="Số hiệp"
                                              name={[
                                                exerciseField.name,
                                                'sets',
                                              ]}
                                              rules={[
                                                {
                                                  required: true,
                                                  message:
                                                    'Số hiệp là bắt buộc',
                                                },
                                              ]}
                                            >
                                              <InputNumber
                                                min={1}
                                                className="w-full"
                                              />
                                            </Form.Item>
                                            <Form.Item
                                              label="Số lần"
                                              name={[
                                                exerciseField.name,
                                                'reps',
                                              ]}
                                              rules={[
                                                {
                                                  required: true,
                                                  message:
                                                    'Số lần là bắt buộc',
                                                },
                                              ]}
                                            >
                                              <InputNumber
                                                min={1}
                                                className="w-full"
                                              />
                                            </Form.Item>
                                            <Form.Item
                                              label="Nghỉ"
                                              name={[
                                                exerciseField.name,
                                                'restTime',
                                              ]}
                                              rules={[
                                                {
                                                  required: true,
                                                  whitespace: true,
                                                  message:
                                                    'Thời gian nghỉ là bắt buộc',
                                                },
                                              ]}
                                            >
                                              <Input placeholder="60s" />
                                            </Form.Item>
                                            <Form.Item
                                              label="Kỹ thuật"
                                              name={[
                                                exerciseField.name,
                                                'techniqueNote',
                                              ]}
                                            >
                                              <Input placeholder="Giữ core chặt" />
                                            </Form.Item>
                                            <Button
                                              danger
                                              icon={<DeleteOutlined />}
                                              disabled={
                                                exerciseFields.length === 1
                                              }
                                              onClick={() =>
                                                removeExercise(
                                                  exerciseField.name,
                                                )
                                              }
                                              className="mt-[30px]"
                                            />
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  )}
                                </Form.List>
                              </div>
                            ))}
                          </div>
                        )}
                      </Form.List>
                    </div>
                  ))}
                </div>
              )}
            </Form.List>
          </Form>
        </div>
      </Modal>
    </DashboardLayout>
  )
}