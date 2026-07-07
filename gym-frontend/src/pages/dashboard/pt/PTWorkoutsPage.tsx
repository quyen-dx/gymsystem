import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import {
  Button,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { useAuth } from '../../../hooks/useAuth'
import { memberService } from '../../../services/memberService'
import { trainerService } from '../../../services/trainerService'
import {
  workoutService,
  type WorkoutPlan,
  type WorkoutPlanPayload,
  type WorkoutSession,
  type WorkoutWeek,
} from '../../../services/workoutService'
import { getUserDisplayName } from '../../../utils/userDisplay'

type Option = {
  value: string
  label: string
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

const normalizeWorkoutDetail = (data: any): WorkoutPlan | null =>
  data?.workout || data?.data || data || null

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

export default function PTWorkoutsPage() {
  const { user } = useAuth()
  const [form] = Form.useForm<WorkoutFormValues>()
  const [workouts, setWorkouts] = useState<WorkoutPlan[]>([])
  const [memberOptions, setMemberOptions] = useState<Option[]>([])
  const [ptOptions, setPtOptions] = useState<Option[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingWorkout, setEditingWorkout] = useState<WorkoutPlan | null>(null)

  const currentUserOption = useMemo(() => {
    if (!user?._id) return null
    return {
      value: user._id,
      label: getUserDisplayName(user, user.email || 'PT'),
    }
  }, [user])

  const loadWorkouts = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await workoutService.getWorkouts()
      setWorkouts(normalizeWorkoutList(data))
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể tải danh sách giáo án')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadOptions = useCallback(async () => {
    try {
      const [membersRes, ptsRes] = await Promise.all([
        memberService.getMembers({ limit: 100 }),
        trainerService.getAvailablePTs({ limit: 100 }).catch(() => trainerService.getPTs({ limit: 100 })),
      ])

      const members = membersRes.data?.members || []
      const pts = ptsRes.data?.pts || []
      setMemberOptions(members.map((member) => ({
        value: member._id,
        label: getUserDisplayName(member, member.email || member.phone || 'Thành viên'),
      })))

      const nextPtOptions = pts.map((pt) => ({
        value: pt._id,
        label: getUserDisplayName(pt, pt.email || pt.phone || 'PT'),
      }))

      if (currentUserOption && !nextPtOptions.some((option) => option.value === currentUserOption.value)) {
        nextPtOptions.unshift(currentUserOption)
      }
      setPtOptions(nextPtOptions)
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể tải danh sách thành viên/PT')
      if (currentUserOption) setPtOptions([currentUserOption])
    }
  }, [currentUserOption])

  useEffect(() => {
    loadWorkouts()
    loadOptions()
  }, [loadOptions, loadWorkouts])

  const openCreate = () => {
    setEditingWorkout(null)
    form.setFieldsValue({
      workoutName: '',
      goal: '',
      durationWeeks: 4,
      startDate: undefined as unknown as string,
      endDate: undefined as unknown as string,
      description: '',
      member: undefined as unknown as string,
      personalTrainer: currentUserOption?.value || undefined as unknown as string,
      estimatedCalories: 0,
      weeks: [emptyWeek(1)],
    })
    setModalOpen(true)
  }

  const openEdit = async (workout: WorkoutPlan) => {
    setEditingWorkout(workout)
    setModalOpen(true)
    setDetailLoading(true)
    try {
      const { data } = await workoutService.getWorkoutById(workout._id)
      const detail = normalizeWorkoutDetail(data) || workout
      form.setFieldsValue(normalizeWorkoutForForm(detail))
      setEditingWorkout(detail)
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể tải chi tiết giáo án')
      form.setFieldsValue(normalizeWorkoutForForm(workout))
    } finally {
      setDetailLoading(false)
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
      loadWorkouts()
    } catch (error: any) {
      if (error?.errorFields) return
      message.error(error?.response?.data?.message || 'Không thể lưu giáo án')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await workoutService.deleteWorkout(id)
      message.success('Đã xoá giáo án')
      loadWorkouts()
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể xoá giáo án')
    }
  }

  const columns = [
    {
      title: 'Workout',
      render: (_: unknown, record: WorkoutPlan) => (
        <div>
          <div className="font-semibold text-[var(--gs-text)]">{record.workoutName}</div>
          <div className="text-xs text-[var(--gs-text-muted)]">{record.goal || 'Chưa có mục tiêu'}</div>
        </div>
      ),
    },
    {
      title: 'Member',
      render: (_: unknown, record: WorkoutPlan) => (
        <span>{typeof record.member === 'string' ? record.member : getUserDisplayName(record.member, record.member?.email || 'Thành viên')}</span>
      ),
    },
    {
      title: 'PT',
      render: (_: unknown, record: WorkoutPlan) => (
        <span>{typeof record.personalTrainer === 'string' ? record.personalTrainer : getUserDisplayName(record.personalTrainer, record.personalTrainer?.email || 'PT')}</span>
      ),
    },
    {
      title: 'Duration',
      width: 110,
      render: (_: unknown, record: WorkoutPlan) => <Tag>{record.durationWeeks || record.weeks?.length || 0} weeks</Tag>,
    },
    {
      title: 'Dates',
      width: 180,
      render: (_: unknown, record: WorkoutPlan) => (
        <span className="text-xs text-[var(--gs-text-muted)]">
          {record.startDate ? dayjs(record.startDate).format('DD/MM/YYYY') : '-'}
          {record.startDate && record.endDate ? ' - ' : ''}
          {record.endDate ? dayjs(record.endDate).format('DD/MM/YYYY') : ''}
        </span>
      ),
    },
    {
      title: 'Calories',
      width: 110,
      render: (_: unknown, record: WorkoutPlan) => <span>{Number(record.estimatedCalories || 0).toLocaleString('vi-VN')}</span>,
    },
    {
      title: 'Structure',
      width: 150,
      render: (_: unknown, record: WorkoutPlan) => {
        const sessions = record.weeks?.reduce((sum, week) => sum + (week.sessions?.length || 0), 0) || 0
        const exercises = record.weeks?.reduce(
          (sum, week) => sum + (week.sessions?.reduce((sessionSum, session) => sessionSum + (session.exercises?.length || 0), 0) || 0),
          0,
        ) || 0
        return <span>{record.weeks?.length || 0}w / {sessions}s / {exercises}ex</span>
      },
    },
    {
      title: 'Actions',
      width: 110,
      render: (_: unknown, record: WorkoutPlan) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Popconfirm
            title="Xoá giáo án này?"
            okText="Xoá"
            cancelText="Huỷ"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(record._id)}
          >
            <Tooltip title="Delete">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Dashboard</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">Workout Plans</h1>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">Create and manage member workout plans by week, session, and exercise.</p>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
        <div className="dashboard-filter-bar">
          <Button icon={<ReloadOutlined />} onClick={loadWorkouts} loading={loading}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Add Workout
          </Button>
        </div>

        <div className="member-scroll-x">
          <Table
            dataSource={workouts}
            columns={columns}
            rowKey="_id"
            loading={loading}
            locale={{ emptyText: <Empty description="No workout plans yet" /> }}
            pagination={{ pageSize: 10 }}
          />
        </div>
      </div>

      <Modal
        title={editingWorkout ? 'Edit Workout Plan' : 'Create Workout Plan'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSubmit}
        confirmLoading={saving}
        width={1100}
        okText={editingWorkout ? 'Save' : 'Create'}
        destroyOnHidden
      >
        <Spin spinning={detailLoading}>
          <Form form={form} layout="vertical" className="pt-3">
            <div className="grid gap-4 md:grid-cols-2">
              <Form.Item
                label="Workout Name"
                name="workoutName"
                rules={[{ required: true, whitespace: true, message: 'Workout name is required' }]}
              >
                <Input placeholder="Strength foundation" />
              </Form.Item>
              <Form.Item
                label="Goal"
                name="goal"
                rules={[{ required: true, whitespace: true, message: 'Goal is required' }]}
              >
                <Input placeholder="Build muscle, lose fat..." />
              </Form.Item>
              <Form.Item
                label="Duration (weeks)"
                name="durationWeeks"
                rules={[{ required: true, message: 'Duration is required' }]}
              >
                <InputNumber min={1} max={52} className="w-full" />
              </Form.Item>
              <Form.Item
                label="Estimated Calories"
                name="estimatedCalories"
                rules={[{ required: true, message: 'Estimated calories is required' }]}
              >
                <InputNumber min={0} className="w-full" />
              </Form.Item>
              <Form.Item label="Start Date" name="startDate">
                <DatePicker className="w-full" />
              </Form.Item>
              <Form.Item label="End Date" name="endDate">
                <DatePicker className="w-full" />
              </Form.Item>
              <Form.Item
                label="Member"
                name="member"
                rules={[{ required: true, message: 'Member is required' }]}
              >
                <Select showSearch optionFilterProp="label" placeholder="Select member" options={memberOptions} />
              </Form.Item>
              <Form.Item
                label="Personal Trainer"
                name="personalTrainer"
                rules={[{ required: true, message: 'Personal trainer is required' }]}
              >
                <Select showSearch optionFilterProp="label" placeholder="Select PT" options={ptOptions} />
              </Form.Item>
            </div>

            <Form.Item label="Description" name="description">
              <Input.TextArea rows={3} placeholder="Plan description, goals, notes..." />
            </Form.Item>

            <Form.List name="weeks" rules={[{ validator: async (_, value) => {
              if (!value?.length) throw new Error('At least one week is required')
            } }]}>
              {(weekFields, { add: addWeek, remove: removeWeek }, { errors }) => (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-[var(--gs-text)]">Weeks</h2>
                    <Button icon={<PlusOutlined />} onClick={() => addWeek(emptyWeek(weekFields.length + 1))}>
                      Add Week
                    </Button>
                  </div>
                  <Form.ErrorList errors={errors} />

                  {weekFields.map((weekField, weekIndex) => (
                    <div key={weekField.key} className="rounded-xl border border-[var(--gs-border)] bg-[var(--theme-bg)] p-4">
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <Form.Item
                          label="Week Number"
                          name={[weekField.name, 'weekNumber']}
                          rules={[{ required: true, message: 'Week number is required' }]}
                          className="mb-0 min-w-40"
                        >
                          <InputNumber min={1} className="w-full" />
                        </Form.Item>
                        <Button danger icon={<DeleteOutlined />} disabled={weekFields.length === 1} onClick={() => removeWeek(weekField.name)}>
                          Remove Week
                        </Button>
                      </div>

                      <Form.List name={[weekField.name, 'sessions']}>
                        {(sessionFields, { add: addSession, remove: removeSession }) => (
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <h3 className="font-semibold text-[var(--gs-text)]">Sessions</h3>
                              <Button size="small" icon={<PlusOutlined />} onClick={() => addSession(emptySession())}>
                                Add Session
                              </Button>
                            </div>

                            {sessionFields.map((sessionField) => (
                              <div key={sessionField.key} className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card)] p-4">
                                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                                  <Form.Item
                                    label="Session Name"
                                    name={[sessionField.name, 'sessionName']}
                                    rules={[{ required: true, whitespace: true, message: 'Session name is required' }]}
                                  >
                                    <Input placeholder={`Week ${weekIndex + 1} - Push day`} />
                                  </Form.Item>
                                  <Form.Item label="Feedback" name={[sessionField.name, 'feedback']}>
                                    <Input placeholder="Feedback or notes" />
                                  </Form.Item>
                                  <Button
                                    danger
                                    icon={<DeleteOutlined />}
                                    disabled={sessionFields.length === 1}
                                    onClick={() => removeSession(sessionField.name)}
                                    className="mt-[30px]"
                                  >
                                    Remove
                                  </Button>
                                </div>

                                <Form.List name={[sessionField.name, 'exercises']}>
                                  {(exerciseFields, { add: addExercise, remove: removeExercise }) => (
                                    <div className="space-y-3">
                                      <div className="flex flex-wrap items-center justify-between gap-3">
                                        <h4 className="font-medium text-[var(--gs-text)]">Exercises</h4>
                                        <Button size="small" icon={<PlusOutlined />} onClick={() => addExercise(emptyExercise())}>
                                          Add Exercise
                                        </Button>
                                      </div>

                                      {exerciseFields.map((exerciseField) => (
                                        <div key={exerciseField.key} className="grid gap-3 rounded-lg border border-dashed border-[var(--gs-border)] p-3 md:grid-cols-[1.5fr_0.7fr_0.7fr_1fr_1.5fr_auto]">
                                          <Form.Item
                                            label="Name"
                                            name={[exerciseField.name, 'name']}
                                            rules={[{ required: true, whitespace: true, message: 'Exercise name is required' }]}
                                          >
                                            <Input placeholder="Bench press" />
                                          </Form.Item>
                                          <Form.Item
                                            label="Sets"
                                            name={[exerciseField.name, 'sets']}
                                            rules={[{ required: true, message: 'Sets required' }]}
                                          >
                                            <InputNumber min={1} className="w-full" />
                                          </Form.Item>
                                          <Form.Item
                                            label="Reps"
                                            name={[exerciseField.name, 'reps']}
                                            rules={[{ required: true, message: 'Reps required' }]}
                                          >
                                            <InputNumber min={1} className="w-full" />
                                          </Form.Item>
                                          <Form.Item
                                            label="Rest Time"
                                            name={[exerciseField.name, 'restTime']}
                                            rules={[{ required: true, whitespace: true, message: 'Rest time required' }]}
                                          >
                                            <Input placeholder="60s" />
                                          </Form.Item>
                                          <Form.Item label="Technique Note" name={[exerciseField.name, 'techniqueNote']}>
                                            <Input placeholder="Keep core tight" />
                                          </Form.Item>
                                          <Button
                                            danger
                                            icon={<DeleteOutlined />}
                                            disabled={exerciseFields.length === 1}
                                            onClick={() => removeExercise(exerciseField.name)}
                                            className="mt-[30px]"
                                          />
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
                    </div>
                  ))}
                </div>
              )}
            </Form.List>
          </Form>
        </Spin>
      </Modal>
    </DashboardLayout>
  )
}
