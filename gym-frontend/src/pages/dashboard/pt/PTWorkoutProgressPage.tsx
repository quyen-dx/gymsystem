import {
  CheckCircleFilled,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FormOutlined,
} from '@ant-design/icons'
import { Button, Empty, Input, InputNumber, Modal, Select, Spin, Tag, message } from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { ptAssignmentService, type PTAssignment } from '../../../services/ptAssignmentService'
import { scheduleService } from '../../../services/scheduleService'
import type { ScheduleExercise, ScheduleSession, WorkoutSchedule } from '../../../services/workoutService'

const SESSION_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chưa tập', color: 'default' },
  completed: { label: 'Hoàn thành', color: 'green' },
  skipped: { label: 'PT bỏ qua', color: 'orange' },
  no_show: { label: 'Vắng mặt', color: 'volcano' },
  cancelled: { label: 'Hội viên hủy', color: 'red' },
}

const PERFORMANCE_OPTIONS: { value: string; label: string; color: string }[] = [
  { value: 'excellent', label: 'Xuất sắc', color: 'green' },
  { value: 'good', label: 'Tốt', color: 'blue' },
  { value: 'average', label: 'Khá', color: 'cyan' },
  { value: 'below_average', label: 'Trung bình', color: 'gold' },
  { value: 'poor', label: 'Kém', color: 'red' },
]

const performanceLabel = (p?: string) =>
  p ? (PERFORMANCE_OPTIONS.find((o) => o.value === p) || { label: p }).label : null
const performanceColor = (p?: string) =>
  p ? (PERFORMANCE_OPTIONS.find((o) => o.value === p) || { color: 'default' }).color : null

type ResultExerciseForm = {
  name: string
  note: string
  completed: boolean
  setsDone: number | null
  repsDone: number | null
  weightUsed: number | null
  durationMin: number | null
}

type ResultForm = {
  session: ScheduleSession
  exercises: ResultExerciseForm[]
  performance: string
  feedback: string
}

const exerciseResultText = (ex: ScheduleExercise) => {
  const parts: string[] = []
  if (ex.setsDone) parts.push(`${ex.setsDone} hiệp`)
  if (ex.repsDone) parts.push(`${ex.repsDone} lần`)
  if (ex.weightUsed) parts.push(`${ex.weightUsed}kg`)
  if (ex.durationMin) parts.push(`${ex.durationMin} phút`)
  return parts.length > 0 ? parts.join(' × ') : null
}

export default function PTWorkoutProgressPage() {
  const [searchParams] = useSearchParams()
  const assignmentId = searchParams.get('assignmentId') || undefined
  const scheduleId = searchParams.get('scheduleId') || undefined
  const navigate = useNavigate()

  const [assignment, setAssignment] = useState<PTAssignment | null>(null)
  const [schedule, setSchedule] = useState<WorkoutSchedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<number | null>(null)
  const [resultForm, setResultForm] = useState<ResultForm | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadProgress = useCallback(async () => {
    const id = assignmentId || scheduleId
    if (!id) return
    setLoading(true)
    setSchedule(null)
    setAssignment(null)
    try {
      const { data } = await ptAssignmentService.getWorkoutProgress(id, scheduleId)
      setAssignment(data.assignment)
      setSchedule(data.schedule)
    } catch {
      message.error('Không thể tải tiến độ giáo án')
    } finally {
      setLoading(false)
    }
  }, [assignmentId, scheduleId])

  useEffect(() => {
    loadProgress()
  }, [loadProgress])

  const handleQuickComplete = async (dayOrder: number) => {
    if (!schedule) return
    setCompleting(dayOrder)
    try {
      await scheduleService.updateSessionStatus(schedule._id, dayOrder, { status: 'completed' })
      message.success(`Buổi ${dayOrder} đã hoàn thành`)
      loadProgress()
    } catch {
      message.error('Không thể cập nhật trạng thái buổi tập')
    } finally {
      setCompleting(null)
    }
  }

  const openResultForm = (session: ScheduleSession) => {
    setResultForm({
      session,
      exercises: session.exercises.map((ex) => ({
        name: ex.name,
        note: ex.note || '',
        completed: !!ex.completed,
        setsDone: ex.setsDone || null,
        repsDone: ex.repsDone || null,
        weightUsed: ex.weightUsed || null,
        durationMin: ex.durationMin || null,
      })),
      performance: session.performance || '',
      feedback: session.feedback || '',
    })
  }

  const updateExercise = (index: number, patch: Partial<ResultExerciseForm>) => {
    setResultForm((prev) => {
      if (!prev) return prev
      const exercises = prev.exercises.map((ex, i) => (i === index ? { ...ex, ...patch } : ex))
      return { ...prev, exercises }
    })
  }

  const handleSubmitResult = async () => {
    if (!schedule || !resultForm) return
    const { session, exercises, performance, feedback } = resultForm
    setSubmitting(true)
    try {
      await scheduleService.updateSessionStatus(schedule._id, session.dayOrder, {
        status: session.status === 'completed' ? undefined : 'completed',
        performance: performance || undefined,
        feedback: feedback || undefined,
        exercises: exercises.map((ex) => ({
          name: ex.name,
          completed: ex.completed,
          note: ex.note,
          setsDone: ex.setsDone || 0,
          repsDone: ex.repsDone || 0,
          weightUsed: ex.weightUsed || 0,
          durationMin: ex.durationMin || 0,
        })),
      })
      message.success(session.status === 'completed' ? 'Đã cập nhật kết quả buổi tập' : 'Đã ghi nhận kết quả và hoàn thành buổi tập')
      setResultForm(null)
      loadProgress()
    } catch {
      message.error('Không thể ghi nhận kết quả buổi tập')
    } finally {
      setSubmitting(false)
    }
  }

  const workoutName =
    schedule?.templateId && typeof schedule.templateId === 'object'
      ? schedule.templateId.name || schedule.templateId.goal || 'Giáo án'
      : assignment?.workoutId && typeof assignment.workoutId === 'object'
        ? assignment.workoutId.name || 'Giáo án'
        : 'Giáo án'

  const weekTitle = schedule?.totalWeeks && schedule.totalWeeks > 1
    ? ` - Tuần ${schedule.weekIndex || '?'}/${schedule.totalWeeks}`
    : ''

  const sessions: ScheduleSession[] = schedule?.sessions || []
  const completedCount = sessions.filter((s) => s.status === 'completed').length
  const totalVolume = sessions.reduce(
    (sum, s) => sum + s.exercises.reduce((sub, ex) => sub + (ex.setsDone || 0) * (ex.repsDone || 0) * (ex.weightUsed || 0), 0),
    0,
  )

  return (
    <DashboardLayout>
      <div className="mb-6">
        <Button onClick={() => navigate(-1)}>
          ← Quay lại
        </Button>
      </div>

      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))] p-6">
        <h1 className="text-3xl font-semibold text-[var(--gs-text)]">Tiến độ giáo án{weekTitle}</h1>
        <p className="mt-1 text-sm text-[var(--gs-text-muted)]">
          {workoutName} • {completedCount}/{sessions.length} buổi
          {totalVolume > 0 ? ` • Tổng khối lượng: ${totalVolume.toLocaleString('vi-VN')} kg` : ''}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spin size="large" /></div>
      ) : !schedule ? (
        <Empty description="Không có giáo án đang thực hiện" />
      ) : (
        <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[var(--gs-text)]">{workoutName}{weekTitle}</h2>
            <Tag color="blue">{completedCount}/{sessions.length} buổi</Tag>
          </div>

          <div className="space-y-3">
            {sessions
              .sort((a, b) => a.dayOrder - b.dayOrder)
              .map((session) => {
                const st = SESSION_STATUS[session.status] || SESSION_STATUS.pending
                const isCompleted = session.status === 'completed'
                const isSkipped = session.status === 'skipped'
                const isClosed = ['skipped', 'no_show', 'cancelled'].includes(session.status)
                const perf = performanceLabel(session.performance)
                return (
                  <div
                    key={session.dayOrder}
                    className={`rounded-xl border p-4 transition ${
                      isCompleted
                        ? 'border-green-200 bg-green-50/50'
                        : isSkipped
                          ? 'border-orange-200 bg-orange-50/50'
                          : 'border-[var(--gs-border)] bg-[var(--theme-bg)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`text-2xl ${isCompleted ? 'text-green-500' : 'text-[var(--gs-text-muted)]'}`}>
                          {isCompleted ? <CheckCircleFilled /> : <ClockCircleOutlined />}
                        </div>
                        <div>
                          <div className="font-medium text-[var(--gs-text)]">
                            Buổi {session.dayOrder} {session.muscleGroup ? `- ${session.muscleGroup}` : ''}
                          </div>
                          <div className="text-xs text-[var(--gs-text-muted)]">
                            {session.date ? dayjs(session.date).format('DD/MM/YYYY') : ''}
                            {session.time ? ` • ${session.time}` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Tag color={st.color}>{st.label}</Tag>
                        {isCompleted && perf && (
                          <Tag color={performanceColor(session.performance)}>{perf}</Tag>
                        )}
                        {!isClosed && (
                          <Button
                            size="small"
                            type={isCompleted ? 'default' : 'primary'}
                            icon={<FormOutlined />}
                            onClick={() => openResultForm(session)}
                          >
                            {isCompleted ? 'Sửa kết quả' : 'Ghi kết quả'}
                          </Button>
                        )}
                        {!isCompleted && !isClosed && (
                          <Button
                            size="small"
                            icon={<CheckCircleOutlined />}
                            loading={completing === session.dayOrder}
                            onClick={() => handleQuickComplete(session.dayOrder)}
                          >
                            Hoàn thành nhanh
                          </Button>
                        )}
                      </div>
                    </div>

                    {session.exercises.length > 0 && (
                      <div className="mt-3 space-y-1 border-t border-[var(--gs-border)] pt-3">
                        {session.exercises.map((ex) => {
                          const result = exerciseResultText(ex)
                          return (
                            <div key={ex.name} className="flex items-center justify-between text-sm">
                              <span className={ex.completed ? 'text-[var(--gs-text)]' : 'text-[var(--gs-text-muted)]'}>
                                {ex.completed ? <CheckCircleOutlined className="mr-1 text-green-500" /> : null}
                                {ex.name}
                              </span>
                              {result && <Tag color="green">{result}</Tag>}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {session.feedback && (
                      <div className="mt-2 rounded-lg bg-[var(--theme-bg)] p-2 text-xs text-[var(--gs-text-muted)]">
                        Nhận xét PT: {session.feedback}
                      </div>
                    )}
                  </div>
                )
              })}
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <Button onClick={() => navigate(-1)}>Quay lại</Button>
          </div>
        </div>
      )}

      <Modal
        title={resultForm
          ? `Ghi nhận kết quả - Buổi ${resultForm.session.dayOrder} ${resultForm.session.muscleGroup ? `(${resultForm.session.muscleGroup})` : ''}`
          : ''}
        open={!!resultForm}
        onCancel={() => setResultForm(null)}
        onOk={handleSubmitResult}
        okText={resultForm?.session.status === 'completed' ? 'Lưu kết quả' : 'Lưu và hoàn thành buổi'}
        confirmLoading={submitting}
        width={720}
      >
        {resultForm && (
          <div className="space-y-4">
            <div className="text-xs text-[var(--gs-text-muted)]">
              {dayjs(resultForm.session.date).format('DD/MM/YYYY')}
              {resultForm.session.time ? ` • ${resultForm.session.time}` : ''}
            </div>

            <div className="space-y-3">
              {resultForm.exercises.map((ex, i) => (
                <div key={ex.name} className="rounded-xl border border-[var(--gs-border)] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2 font-medium text-[var(--gs-text)]">
                      <input
                        type="checkbox"
                        checked={ex.completed}
                        onChange={(e) => updateExercise(i, { completed: e.target.checked })}
                        className="h-4 w-4 accent-[var(--gs-primary)]"
                      />
                      {ex.name}
                    </span>
                    <Input
                      placeholder="Ghi chú bài tập"
                      size="small"
                      style={{ width: 220 }}
                      value={ex.note}
                      onChange={(e) => updateExercise(i, { note: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <div className="mb-1 text-xs text-[var(--gs-text-muted)]">Số hiệp</div>
                      <InputNumber
                        size="small"
                        min={0}
                        className="w-full"
                        placeholder="VD: 3"
                        value={ex.setsDone}
                        onChange={(v) => updateExercise(i, { setsDone: v })}
                      />
                    </div>
                    <div>
                      <div className="mb-1 text-xs text-[var(--gs-text-muted)]">Số lần</div>
                      <InputNumber
                        size="small"
                        min={0}
                        className="w-full"
                        placeholder="VD: 12"
                        value={ex.repsDone}
                        onChange={(v) => updateExercise(i, { repsDone: v })}
                      />
                    </div>
                    <div>
                      <div className="mb-1 text-xs text-[var(--gs-text-muted)]">Tạ (kg)</div>
                      <InputNumber
                        size="small"
                        min={0}
                        className="w-full"
                        placeholder="VD: 40"
                        value={ex.weightUsed}
                        onChange={(v) => updateExercise(i, { weightUsed: v })}
                      />
                    </div>
                    <div>
                      <div className="mb-1 text-xs text-[var(--gs-text-muted)]">Thời lượng (phút)</div>
                      <InputNumber
                        size="small"
                        min={0}
                        className="w-full"
                        placeholder="VD: 5"
                        value={ex.durationMin}
                        onChange={(v) => updateExercise(i, { durationMin: v })}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <div className="mb-1 text-sm text-[var(--gs-text-muted)]">Đánh giá buổi tập</div>
                <Select
                  className="w-full"
                  placeholder="Chọn mức độ hoàn thành"
                  value={resultForm.performance || undefined}
                  onChange={(v) => setResultForm({ ...resultForm, performance: v })}
                  options={PERFORMANCE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                />
              </div>
              <div>
                <div className="mb-1 text-sm text-[var(--gs-text-muted)]">Nhận xét / góp ý của PT</div>
                <Input.TextArea
                  rows={3}
                  placeholder="Ghi nhận nhận xét cho buổi tập này..."
                  value={resultForm.feedback}
                  onChange={(e) => setResultForm({ ...resultForm, feedback: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  )
}
