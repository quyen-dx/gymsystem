import {
  CopyOutlined,
  DeleteOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import {
  Button,
  Divider,
  Form,
  Input,
  List,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  message,
} from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import {
  workoutService,
  type TemplateDay,
  type WorkoutPlan,
  type WorkoutPlanPayload,
} from '../../../services/workoutService'
import { SPECIALIZATION_OPTIONS } from '../../../services/trainingGroupService'

type FormValues = {
  workoutName: string
  specializationId: string
  goal: string
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
  specializationId: values.specializationId,
  goal: values.goal,
  durationWeeks: values.days.length,
  description: '',
  estimatedCalories: 0,
  weeks: [],
  days: values.days.map((day) => ({
    dayOfWeek: 0,
    muscleGroup: (day.muscleGroup || '').trim(),
    description: (day.description || '').trim(),
    exercises: (day.exercises || []).map((ex: any) => ({
      name: (ex.name || '').trim(),
      note: (ex.note || '').trim(),
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
  const [goalOptions, setGoalOptions] = useState<{ value: string; label: string }[]>([])
  const [loadingGoals, setLoadingGoals] = useState(false)

  // Copy modal state
  const [copyModalOpen, setCopyModalOpen] = useState(false)
  const [copySearch, setCopySearch] = useState('')
  const [copyTemplates, setCopyTemplates] = useState<WorkoutPlan[]>([])
  const [copyLoading, setCopyLoading] = useState(false)
  const [copyFetching, setCopyFetching] = useState(false)

  const isEdit = !!id

  const loadGoalsForSpecialization = async (specializationId: string) => {
    if (!specializationId) {
      setGoalOptions([])
      return
    }
    setLoadingGoals(true)
    try {
      const { data } = await workoutService.getGoalsBySpecialization(specializationId)
      const goals = data?.goals || []
      setGoalOptions(goals.map((g: string) => ({ value: g, label: g })))
    } catch {
      setGoalOptions([])
    } finally {
      setLoadingGoals(false)
    }
  }

  const selectedSpecialization = Form.useWatch('specializationId', form)

  const openCopyModal = async () => {
    setCopySearch('')
    setCopyModalOpen(true)
    setCopyLoading(true)
    try {
      const { data } = await workoutService.getTemplates({ limit: 200 })
      setCopyTemplates(data || [])
    } catch {
      message.error('Không thể tải danh sách giáo án')
      setCopyTemplates([])
    } finally {
      setCopyLoading(false)
    }
  }

  const handleCopySelect = async (template: WorkoutPlan) => {
    const currentValues = form.getFieldsValue()
    const hasData = currentValues.workoutName?.trim()
      || currentValues.specializationId
      || currentValues.goal
      || currentValues.days?.some(
          (d: TemplateDay) => d.muscleGroup?.trim() || d.exercises?.some((e: any) => e.name?.trim()),
        )

    if (hasData) {
      Modal.confirm({
        title: 'Xác nhận sao chép',
        content: 'Dữ liệu đang nhập sẽ bị thay thế bằng nội dung của giáo án được chọn. Bạn có chắc chắn?',
        okText: 'Sao chép',
        cancelText: 'Huỷ',
        onOk: () => doCopy(template),
      })
      return
    }
    doCopy(template)
  }

  const doCopy = async (template: WorkoutPlan) => {
    setCopyModalOpen(false)
    setCopyFetching(true)
    try {
      const { data } = await workoutService.getWorkoutById(template._id)
      const detail = data?.workout || data?.data || data
      if (!detail) {
        message.error('Không thể lấy dữ liệu giáo án gốc')
        return
      }

      const days: TemplateDay[] = detail.days?.length
        ? detail.days.map((d: any) => ({
            dayOfWeek: 0,
            muscleGroup: d.muscleGroup || '',
            description: d.description || '',
            exercises: (d.exercises || []).map((e: any) => ({ name: e.name || '', note: e.note || '' })),
          }))
        : detail.weeks?.length
          ? detail.weeks[0].sessions.map((s: any) => ({
              dayOfWeek: 0,
              muscleGroup: s.sessionName || '',
              description: s.feedback || '',
              exercises: s.exercises.map((e: any) => ({ name: e.name, note: `${e.sets}x${e.reps} - nghỉ ${e.restTime}s` })),
            }))
          : [emptyDay()]

      // Clear then set specialization to trigger goal options load
      const specId = detail.specializationId || ''
      form.resetFields()
      await loadGoalsForSpecialization(specId)

      form.setFieldsValue({
        workoutName: `${detail.workoutName || detail.name || ''} (Bản sao)`,
        specializationId: specId,
        goal: detail.goal || '',
        days,
      })
    } catch {
      message.error('Không thể tải chi tiết giáo án để sao chép')
    } finally {
      setCopyFetching(false)
    }
  }

  const filteredCopyTemplates = copyTemplates.filter((t) => {
    if (!copySearch) return true
    const q = copySearch.toLowerCase()
    const name = (t.workoutName || t.name || '').toLowerCase()
    const goal = (t.goal || '').toLowerCase()
    return name.includes(q) || goal.includes(q)
  })

  useEffect(() => {
    if (!initialized) return
    loadGoalsForSpecialization(selectedSpecialization || '')
  }, [selectedSpecialization])

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
              specializationId: (detail as any).specializationId || '',
              goal: detail.goal || '',
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
      specializationId: '',
      goal: '',
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
      const msg = error?.response?.data?.error
        ? `${error.response.data.message}: ${error.response.data.error}`
        : error?.response?.data?.message || error?.message || 'Không thể lưu giáo án'
      message.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Bảng điều khiển</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">
            {isEdit ? 'Chỉnh sửa giáo án mẫu' : 'Tạo giáo án mẫu mới'}
          </h1>
          {!isEdit && (
            <Button icon={<CopyOutlined />} onClick={openCopyModal}>
              Sao chép từ giáo án có sẵn
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
        <Spin spinning={loadingDetail || copyFetching}>
          {initialized && (
            <Form form={form} layout="vertical" className="pt-3">
              <div className="grid gap-4 md:grid-cols-2">
                <Form.Item label="Tên giáo án mẫu" name="workoutName" rules={[{ required: true, whitespace: true, message: 'Tên giáo án là bắt buộc' }]}>
                  <Input placeholder="VD: Giáo án Upper/Lower" />
                </Form.Item>
                <Form.Item label="Chuyên môn" name="specializationId" rules={[{ required: true, message: 'Vui lòng chọn chuyên môn cho giáo án' }]}>
                  <Select
                    options={SPECIALIZATION_OPTIONS}
                    placeholder="Chọn chuyên môn"
                    onChange={(val) => {
                      if (val !== selectedSpecialization) {
                        form.setFieldValue('goal', '')
                      }
                    }}
                  />
                </Form.Item>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Form.Item label="Mục tiêu" name="goal" rules={[{ required: true, message: 'Mục tiêu là bắt buộc' }]}>
                  <Select
                    options={goalOptions}
                    placeholder={selectedSpecialization ? 'Chọn mục tiêu' : 'Vui lòng chọn chuyên môn trước'}
                    disabled={!selectedSpecialization}
                    loading={loadingGoals}
                  />
                </Form.Item>
              </div>

              <Divider>Các buổi tập trong giáo án</Divider>

              <Form.List name="days" rules={[{ validator: async (_, value) => { if (!value?.length) throw new Error('Cần ít nhất 1 buổi tập') } }]}>
                {(dayFields, { add: addDay, remove: removeDay }, { errors }) => (
                  <div className="space-y-4">
                    <Form.ErrorList errors={errors} />

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

                    <Button icon={<PlusOutlined />} onClick={() => addDay(emptyDay())} className="mt-4">
                      Thêm buổi tập
                    </Button>
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
      <Modal
        title="Chọn giáo án để sao chép"
        open={copyModalOpen}
        onCancel={() => setCopyModalOpen(false)}
        footer={null}
        width={600}
      >
        <Input
          placeholder="Tìm kiếm theo tên giáo án hoặc mục tiêu..."
          prefix={<SearchOutlined />}
          value={copySearch}
          onChange={(e) => setCopySearch(e.target.value)}
          className="mb-4"
          allowClear
        />
        <Spin spinning={copyLoading}>
          <List
            dataSource={filteredCopyTemplates}
            locale={{ emptyText: 'Không tìm thấy giáo án nào' }}
            renderItem={(item) => {
              const spec = SPECIALIZATION_OPTIONS.find((s) => s.value === item.specializationId)
              const sessions = item.totalSessions || item.days?.length || item.weeks?.length || 0
              return (
                <List.Item
                  className="cursor-pointer rounded-lg px-3 transition-colors hover:bg-[var(--gs-hover)]"
                  onClick={() => handleCopySelect(item)}
                >
                  <List.Item.Meta
                    title={<span className="text-[var(--gs-text)]">{item.workoutName || item.name}</span>}
                    description={
                      <div className="flex flex-wrap items-center gap-2">
                        {spec && <Tag color="blue">{spec.label}</Tag>}
                        {item.goal && <Tag color="purple">{item.goal}</Tag>}
                        {sessions > 0 && <span className="text-xs text-[var(--gs-text-muted)]">{sessions} buổi</span>}
                      </div>
                    }
                  />
                </List.Item>
              )
            }}
          />
        </Spin>
      </Modal>
    </DashboardLayout>
  )
}
