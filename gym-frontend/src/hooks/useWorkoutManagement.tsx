import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Tag,
  Tooltip,
  message,
} from 'antd'
import dayjs from 'dayjs'
import { useCallback, useState } from 'react'

import { workoutService } from '../services/workoutService'
import type {
  WorkoutPlan,
  WorkoutPlanPayload,
  WorkoutSession,
  WorkoutWeek,
} from '../services/workoutService'

export type WorkoutFormValues = Omit<WorkoutPlanPayload, 'weeks'> & {
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

interface ClientInfo {
  _id: string
}

export function useWorkoutManagement(
  user: { _id?: string } | null,
  onWorkoutChanged?: () => void,
) {
  const [form] = Form.useForm<WorkoutFormValues>()
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null)
  const [clientWorkouts, setClientWorkouts] = useState<
    Record<string, WorkoutPlan[]>
  >({})
  const [workoutsLoading, setWorkoutsLoading] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingWorkout, setEditingWorkout] = useState<WorkoutPlan | null>(null)
  const [saving, setSaving] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

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

  const handleExpand = useCallback(
    (expanded: boolean, record: ClientInfo) => {
      if (expanded) {
        setExpandedMemberId(record._id)
        if (!clientWorkouts[record._id]) {
          fetchClientWorkouts(record._id)
        }
      } else {
        setExpandedMemberId(null)
      }
    },
    [clientWorkouts, fetchClientWorkouts],
  )

  const openCreate = useCallback(
    (memberId: string) => {
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
    },
    [form, user],
  )

  const openEdit = useCallback(
    async (workout: WorkoutPlan) => {
      setEditingWorkout(workout)
      setModalOpen(true)
      setDetailLoading(true)
      try {
const { data } = await workoutService.getWorkoutById(workout._id)
      const detail = (data?.workout || data?.data || data) as WorkoutPlan | undefined
      if (!detail) throw new Error('No workout data')
      form.setFieldsValue(normalizeWorkoutForForm(detail))
      setEditingWorkout(detail)
      } catch {
        message.error('Không thể tải chi tiết giáo án')
        form.setFieldsValue(normalizeWorkoutForForm(workout))
      } finally {
        setDetailLoading(false)
      }
    },
    [form],
  )

  const closeModal = useCallback(() => {
    setModalOpen(false)
    setEditingWorkout(null)
    form.resetFields()
  }, [form])

  const handleSubmit = useCallback(async () => {
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
      onWorkoutChanged?.()
      if (expandedMemberId) fetchClientWorkouts(expandedMemberId)
    } catch (error: any) {
      if (error?.errorFields) return
      message.error(error?.response?.data?.message || 'Không thể lưu giáo án')
    } finally {
      setSaving(false)
    }
  }, [form, editingWorkout, closeModal, onWorkoutChanged, expandedMemberId, fetchClientWorkouts])

  const handleDelete = useCallback(
    async (workout: WorkoutPlan, memberId: string) => {
      try {
        await workoutService.deleteWorkout(workout._id)
        message.success('Đã xoá giáo án')
        onWorkoutChanged?.()
        fetchClientWorkouts(memberId)
      } catch (error: any) {
        message.error(error?.response?.data?.message || 'Không thể xoá giáo án')
      }
    },
    [onWorkoutChanged, fetchClientWorkouts],
  )

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

  const renderWorkoutModal = () => (
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
  )

  return {
    form,
    expandedMemberId,
    clientWorkouts,
    workoutsLoading,
    modalOpen,
    editingWorkout,
    saving,
    detailLoading,
    fetchClientWorkouts,
    handleExpand,
    openCreate,
    openEdit,
    closeModal,
    handleSubmit,
    handleDelete,
    expandedWorkoutColumns,
    renderWorkoutModal,
  }
}