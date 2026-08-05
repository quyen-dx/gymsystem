import { ArrowLeftOutlined, EditOutlined, TeamOutlined } from '@ant-design/icons'
import { Button, Descriptions, Empty, Spin, Tag, message } from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { workoutService, type LibraryWorkout } from '../../../services/workoutService'
import { useAuth } from '../../../hooks/useAuth'
import { getUserDisplayName } from '../../../utils/userDisplay'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  published: { label: 'Đã xuất bản', color: 'green' },
  under_review: { label: 'Đang xem xét', color: 'orange' },
  hidden: { label: 'Đã ẩn', color: 'red' },
  deleted: { label: 'Đã xóa', color: 'default' },
}

const getName = (v: unknown): string => {
  if (!v) return '-'
  if (typeof v === 'string') return v
  return getUserDisplayName(v as any, '-')
}

export default function PTWorkoutViewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [workout, setWorkout] = useState<LibraryWorkout | null>(null)
  const [loading, setLoading] = useState(true)
  const [assignments, setAssignments] = useState<any[]>([])

  const userId = user?._id

  const loadWorkout = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const { data } = await workoutService.getWorkoutById(id)
      const w = (data?.workout || data?.data || data) as LibraryWorkout
      setWorkout(w)

      const assignRes = await workoutService.getWorkoutAssignments(id)
      setAssignments(assignRes.data?.assignments || [])
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể tải chi tiết giáo án')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadWorkout()
  }, [loadWorkout])

  const isOwner = () => {
    if (!workout) return false
    const ptId = typeof workout.ptId === 'string' ? workout.ptId : workout.ptId?._id
    return String(ptId) === String(userId)
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Spin size="large" />
        </div>
      </DashboardLayout>
    )
  }

  if (!workout) {
    return (
      <DashboardLayout>
        <Empty description="Không tìm thấy giáo án" className="py-20" />
      </DashboardLayout>
    )
  }

  const st = STATUS_MAP[workout.templateStatus] || { label: workout.templateStatus, color: 'default' }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/pt/workouts')}>
          Quay lại thư viện
        </Button>
      </div>

      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-[var(--gs-text)] max-[767px]:text-xl">
              {workout.workoutName || workout.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {workout.specializationId && <Tag color="blue">{workout.specializationId}</Tag>}
              <Tag color="purple">{workout.goal}</Tag>
              <Tag color={st.color}>{st.label}</Tag>
              <span className="text-xs text-[var(--gs-text-muted)]">
                Phiên bản {workout.version || 1}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {(isOwner() || user?.role === 'admin' || user?.role === 'super_admin') && (
              <Button
                icon={<EditOutlined />}
                onClick={() => navigate(`/pt/workouts/edit/${workout._id}`)}
              >
                Chỉnh sửa
              </Button>
            )}
            <Button
              icon={<TeamOutlined />}
              type="primary"
              onClick={() => navigate(`/pt/clients?assignWorkout=${workout._id}`)}
            >
              Gán cho hội viên
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-[20px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6">
          <h2 className="mb-4 text-lg font-semibold text-[var(--gs-text)]">Thông tin giáo án</h2>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Tên giáo án">{workout.workoutName || workout.name}</Descriptions.Item>
            <Descriptions.Item label="Chuyên môn">{workout.specializationId || '-'}</Descriptions.Item>
            <Descriptions.Item label="Mục tiêu">{workout.goal}</Descriptions.Item>
            <Descriptions.Item label="PT tạo">{getName(workout.ptId)}</Descriptions.Item>
            <Descriptions.Item label="Ngày tạo">
              {workout.createdAt ? dayjs(workout.createdAt).format('DD/MM/YYYY HH:mm') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Phiên bản">{workout.version || 1}</Descriptions.Item>
            <Descriptions.Item label="Số buổi">{workout.totalSessions || workout.days?.length || workout.weeks?.length || 0}</Descriptions.Item>
            <Descriptions.Item label="Số hội viên đang sử dụng">{workout.assignmentCount || assignments.length || 0}</Descriptions.Item>
            <Descriptions.Item label="Cập nhật cuối">
              {workout.updatedAt ? dayjs(workout.updatedAt).format('DD/MM/YYYY HH:mm') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Tag color={st.color}>{st.label}</Tag>
            </Descriptions.Item>
            {workout.description && (
              <Descriptions.Item label="Mô tả">{workout.description}</Descriptions.Item>
            )}
          </Descriptions>
        </div>

        <div className="rounded-[20px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6">
          <h2 className="mb-4 text-lg font-semibold text-[var(--gs-text)]">Danh sách bài tập</h2>
          {workout.weeks && workout.weeks.length > 0 ? (
            <div className="space-y-4">
              {workout.weeks.map((week) => (
                <div key={week.weekNumber} className="rounded-lg border border-[var(--gs-border)] p-3">
                  <h3 className="mb-2 font-medium text-[var(--gs-text)]">Tuần {week.weekNumber}</h3>
                  {week.sessions.map((session, si) => (
                    <div key={si} className="mb-3 rounded bg-[var(--theme-bg)] p-3">
                      <h4 className="mb-1 font-medium text-[var(--gs-text)]">{session.sessionName || `Buổi ${si + 1}`}</h4>
                      <div className="space-y-1">
                        {session.exercises.map((ex, ei) => (
                          <div key={ei} className="flex flex-wrap items-center gap-2 text-sm text-[var(--gs-text-muted)]">
                            <span className="font-medium text-[var(--gs-text)]">{ex.name}</span>
                            <span>{ex.sets} x {ex.reps}</span>
                            <span>Nghỉ: {ex.restTime}</span>
                            {ex.techniqueNote && <Tag className="text-xs">{ex.techniqueNote}</Tag>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : workout.days && workout.days.length > 0 ? (
            <div className="space-y-4">
              {workout.days.map((day, di) => (
                <div key={di} className="rounded-lg border border-[var(--gs-border)] p-3">
                  <h3 className="mb-2 font-medium text-[var(--gs-text)]">
                    Ngày {day.dayOfWeek || di + 1} {day.muscleGroup && `- ${day.muscleGroup}`}
                  </h3>
                  {day.description && <p className="mb-2 text-sm text-[var(--gs-text-muted)]">{day.description}</p>}
                  <div className="space-y-1">
                    {day.exercises.map((ex, ei) => (
                      <div key={ei} className="text-sm text-[var(--gs-text-muted)]">
                        <span className="font-medium text-[var(--gs-text)]">{ex.name}</span>
                        {ex.note && <span className="ml-2 text-xs">({ex.note})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty description="Chưa có bài tập" />
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
