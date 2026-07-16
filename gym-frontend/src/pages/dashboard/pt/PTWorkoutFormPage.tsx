import {
  CopyOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import {
  Button,
  Divider,
  Form,
  Input,
  Select,
  Space,
  Spin,
  message,
} from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import {
  workoutService,
  type WorkoutPlan,
  type WorkoutPlanPayload,
  type TemplateDay,
} from '../../../services/workoutService'

const GOAL_OPTIONS = [
  { value: 'Tăng cơ', label: 'Tăng cơ' },
  { value: 'Giảm mỡ', label: 'Giảm mỡ' },
  { value: 'Tăng cân', label: 'Tăng cân' },
  { value: 'Tăng sức mạnh', label: 'Tăng sức mạnh' },
  { value: 'Cardio & Sức bền', label: 'Cardio & Sức bền' },
  { value: 'Duy trì vóc dáng', label: 'Duy trì vóc dáng' },
]

type FormValues = {
  workoutName: string
  goal: string
  description?: string
  days: TemplateDay[]
}

const emptyExercise = () => ({ name: '', note: '' })

const emptyDay = (): TemplateDay => ({
  dayOfWeek: 0,
  muscleGroup: '',
  description: '',
  exercises: [emptyExercise()],
})

const normalizeWorkoutDetail = (data: any): WorkoutPlan | null =>
  data?.workout || data?.data || data || null

const sanitizePayload = (values: FormValues): WorkoutPlanPayload => ({
  workoutName: values.workoutName.trim(),
  goal: values.goal,
  durationWeeks: values.days.length,
  description: values.description?.trim() || '',
  estimatedCalories: 0,
  weeks: [],
  days: values.days.map((day) => ({
    dayOfWeek: 0,
    muscleGroup: day.muscleGroup.trim(),
    description: day.description.trim(),
    exercises: day.exercises.map((ex) => ({
      name: ex.name.trim(),
      note: ex.note.trim(),
    })),
  })),
  isTemplate: true,
})

export default function PTWorkoutFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form] = Form.useForm<FormValues>()
  const [saving, setSaving] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(!!id)
  const [initialized, setInitialized] = useState(false)

  const isEdit = !!id

  useEffect(() => {
    if (id) {
      ;(async () => {
        setLoadingDetail(true)
        try {
          const { data } = await workoutService.getWorkoutById(id)
          const detail = normalizeWorkoutDetail(data)
          if (detail) {
            const days: TemplateDay[] = detail.days?.length
              ? detail.days.map((d) => ({
                  dayOfWeek: 0,
                  muscleGroup: d.muscleGroup || '',
                  description: d.description || '',
                  exercises: d.exercises.map((e) => ({ name: e.name, note: e.note })),
                }))
              : detail.weeks?.length
                ? detail.weeks[0].sessions.map((s) => ({
                    dayOfWeek: 0,
                    muscleGroup: s.sessionName || '',
                    description: s.feedback || '',
                    exercises: s.exercises.map((e) => ({ name: e.name, note: `${e.sets}x${e.reps} - nghỉ ${e.restTime}s` })),
                  }))
                : [emptyDay()]
            form.setFieldsValue({
              workoutName: detail.workoutName || detail.name || '',
              goal: detail.goal || '',
              description: detail.description || '',
              days,
            })
          }
        } catch {
          message.error('Không thể tải chi tiết giáo án')
        } finally {
          setLoadingDetail(false)
          setInitialized(true)
        }
      })()
      return
    }

    form.setFieldsValue({
      workoutName: '',
      goal: '',
      description: '',
      days: [emptyDay()],
    })
    setInitialized(true)
  }, [id, form])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      const payload = sanitizePayload(values)
      setSaving(true)
      if (isEdit) {
        await workoutService.updateWorkout(id!, payload)
        message.success('Đã cập nhật giáo án mẫu')
      } else {
        await workoutService.createWorkout(payload)
        message.success('Đã tạo giáo án mẫu')
      }
      navigate('/pt/workouts')
    } catch (error: any) {
      if (error?.errorFields) return
      message.error(error?.response?.data?.message || 'Không thể lưu giáo án')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Bảng điều khiển</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">
          {isEdit ? 'Chỉnh sửa giáo án mẫu' : 'Tạo giáo án mẫu mới'}
        </h1>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
        <Spin spinning={loadingDetail}>
          {initialized && (
            <Form form={form} layout="vertical" className="pt-3">
              <div className="grid gap-4 md:grid-cols-2">
                <Form.Item label="Tên giáo án mẫu" name="workoutName" rules={[{ required: true, whitespace: true, message: 'Tên giáo án là bắt buộc' }]}>
                  <Input placeholder="VD: Giáo án Upper/Lower" />
                </Form.Item>
                <Form.Item label="Mục tiêu" name="goal" rules={[{ required: true, message: 'Mục tiêu là bắt buộc' }]}>
                  <Select options={GOAL_OPTIONS} placeholder="Chọn mục tiêu" />
                </Form.Item>
              </div>

              <Form.Item label="Mô tả tổng quan" name="description">
                <Input.TextArea rows={3} placeholder="Mô tả ngắn gọn về giáo án..." />
              </Form.Item>

              <Divider>Các buổi tập trong giáo án</Divider>

              <Form.List name="days" rules={[{ validator: async (_, value) => { if (!value?.length) throw new Error('Cần ít nhất 1 buổi tập') } }]}>
                {(dayFields, { add: addDay, remove: removeDay }, { errors }) => (
                  <div className="space-y-4">
                    <Form.ErrorList errors={errors} />
                    <Button icon={<PlusOutlined />} onClick={() => addDay(emptyDay())}>
                      Thêm buổi tập
                    </Button>

                    {dayFields.map((dayField, dayIndex) => (
                      <div key={dayField.key} className="rounded-xl border border-[var(--gs-border)] bg-[var(--theme-bg)] p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-[var(--gs-text)]">Buổi {dayIndex + 1}</span>
                            <Form.Item name={[dayField.name, 'muscleGroup']} className="mb-0 min-w-52">
                              <Input placeholder="Tên buổi tập (VD: Upper Body)" />
                            </Form.Item>
                          </div>
                          <Space>
                            <Button icon={<CopyOutlined />} onClick={() => {
                              const days = form.getFieldValue('days')
                              const day = days?.[dayIndex]
                              if (!day) return
                              const updated = [...days]
                              updated.splice(dayIndex + 1, 0, { ...emptyDay(), ...day })
                              form.setFieldValue('days', updated)
                            }} />
                            <Button danger icon={<DeleteOutlined />} disabled={dayFields.length === 1} onClick={() => removeDay(dayField.name)}>
                              Xoá buổi
                            </Button>
                          </Space>
                        </div>

                        <Form.Item name={[dayField.name, 'description']} className="mb-3">
                          <Input placeholder="Nhóm cơ chính (VD: Ngực - Vai - Tay sau)" />
                        </Form.Item>

                        <Form.List name={[dayField.name, 'exercises']}>
                          {(exFields, { add: addExercise, remove: removeExercise }) => (
                            <div className="space-y-2">
                              {exFields.map((exField, exIndex) => (
                                <div key={exField.key} className="grid gap-2 rounded-lg border border-dashed border-[var(--gs-border)] bg-[var(--gs-card)] p-3 md:grid-cols-[1fr_1.5fr_auto]">
                                  <Form.Item name={[exField.name, 'name']} className="mb-0" rules={[{ required: true, whitespace: true, message: 'Tên bài tập là bắt buộc' }]}>
                                    <Input placeholder="Tên bài tập (VD: Bench Press)" />
                                  </Form.Item>
                                  <Form.Item name={[exField.name, 'note']} className="mb-0">
                                    <Input placeholder="Thông số (VD: 4 x 10)" />
                                  </Form.Item>
                                  <Space>
                                    <Button icon={<CopyOutlined />} onClick={() => {
                                      const days = form.getFieldValue('days')
                                      const exercises = days?.[dayIndex]?.exercises
                                      if (!exercises) return
                                      const ex = exercises[exIndex]
                                      const updated = [...exercises]
                                      updated.splice(exIndex + 1, 0, { ...ex })
                                      const newDays = days.map((d: TemplateDay, i: number) =>
                                        i === dayIndex ? { ...d, exercises: updated } : d,
                                      )
                                      form.setFieldValue('days', newDays)
                                    }} />
                                    <Button danger icon={<DeleteOutlined />} disabled={exFields.length === 1} onClick={() => removeExercise(exField.name)} />
                                  </Space>
                                </div>
                              ))}
                              <Button size="small" icon={<PlusOutlined />} onClick={() => addExercise(emptyExercise())}>
                                Thêm bài tập
                              </Button>
                            </div>
                          )}
                        </Form.List>
                      </div>
                    ))}
                  </div>
                )}
              </Form.List>

              <Divider />

              <div className="mt-6 flex items-center justify-end gap-3">
                <Button onClick={() => navigate('/pt/workouts')}>Huỷ</Button>
                <Button type="primary" onClick={handleSubmit} loading={saving}>
                  {isEdit ? 'Lưu' : 'Tạo mẫu'}
                </Button>
              </div>
            </Form>
          )}
        </Spin>
      </div>
    </DashboardLayout>
  )
}
