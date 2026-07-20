import { CheckCircleFilled, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { Button, Empty, Modal, Spin, Tag, message } from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { ptAssignmentService, type PTAssignment } from '../../../services/ptAssignmentService'
import { scheduleService } from '../../../services/scheduleService'
import type { ScheduleSession, WorkoutSchedule } from '../../../services/workoutService'

const SESSION_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chưa tập', color: 'default' },
  completed: { label: 'Hoàn thành', color: 'green' },
  skipped: { label: 'Bỏ qua', color: 'orange' },
}

export default function PTWorkoutProgressPage() {
  const { memberId } = useParams<{ memberId: string }>()
  const [searchParams] = useSearchParams()
  const assignmentId = searchParams.get('assignmentId') || undefined
  const scheduleId = searchParams.get('scheduleId') || undefined
  const navigate = useNavigate()

  const [assignment, setAssignment] = useState<PTAssignment | null>(null)
  const [schedule, setSchedule] = useState<WorkoutSchedule | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<number | null>(null)
  const [ending, setEnding] = useState(false)

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

  const handleCompleteSession = async (dayOrder: number) => {
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
  const allCompleted = sessions.length > 0 && completedCount === sessions.length

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
                return (
                  <div
                    key={session.dayOrder}
                    className={`flex items-center justify-between rounded-xl border p-4 transition ${
                      isCompleted
                        ? 'border-green-200 bg-green-50/50'
                        : isSkipped
                          ? 'border-orange-200 bg-orange-50/50'
                          : 'border-[var(--gs-border)] bg-[var(--theme-bg)]'
                    }`}
                  >
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
                        {session.exercises.length > 0 && (
                          <div className="mt-1 text-xs text-[var(--gs-text-muted)]">
                            {session.exercises.map((ex) => ex.name).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Tag color={st.color}>{st.label}</Tag>
                      {!isCompleted && !isSkipped && (
                        <Button
                          size="small"
                          type="primary"
                          icon={<CheckCircleOutlined />}
                          loading={completing === session.dayOrder}
                          onClick={() => handleCompleteSession(session.dayOrder)}
                        >
                          Hoàn thành
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <Button onClick={() => navigate(-1)}>Quay lại</Button>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
