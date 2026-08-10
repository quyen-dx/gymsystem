import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Empty, Spin, Tag } from 'antd'
import {
  CalendarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  FileAddOutlined,
  LeftOutlined,
  RightOutlined,
  UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { scheduleService } from '../../../services/scheduleService'
import type { ScheduleSession, WorkoutSchedule } from '../../../services/workoutService'
import { useNavigate } from 'react-router-dom'

const DAY_LABEL_MAP_VN = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']

const startOfVnWeek = (d: dayjs.Dayjs) => d.subtract((d.day() + 6) % 7, 'day').startOf('day')

const SESSION_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chưa diễn ra', color: 'default' },
  completed: { label: 'Hoàn thành', color: 'green' },
  skipped: { label: 'PT bỏ qua', color: 'orange' },
  no_show: { label: 'Vắng mặt', color: 'volcano' },
  cancelled: { label: 'Đã hủy', color: 'red' },
}

type FlatItem = {
  schedule: WorkoutSchedule
  session: ScheduleSession
  memberId: string
  memberName: string
  scheduleStatus: string
}

const memberIdOf = (s: WorkoutSchedule) =>
  s.memberId && typeof s.memberId === 'object' ? s.memberId._id : String(s.memberId || '')
const memberNameOf = (s: WorkoutSchedule) => {
  if (!s.memberId) return 'Hội viên'
  if (typeof s.memberId === 'object') {
    return s.memberId.name || s.memberId.fullName || 'Hội viên'
  }
  return 'Hội viên'
}

export default function PTSessionTeachingPage() {
  const navigate = useNavigate()
  const [weekStart, setWeekStart] = useState(() => startOfVnWeek(dayjs()))
  const [schedules, setSchedules] = useState<WorkoutSchedule[]>([])
  const [loading, setLoading] = useState(true)

  const goPrevWeek = () => setWeekStart((prev) => prev.subtract(7, 'day'))
  const goNextWeek = () => setWeekStart((prev) => prev.add(7, 'day'))
  const goCurrentWeek = () => setWeekStart(startOfVnWeek(dayjs()))
  const weekLabel = `${weekStart.format('DD/MM')} - ${weekStart.add(6, 'day').format('DD/MM/YYYY')}`
  const isCurrentWeek = weekStart.isSame(startOfVnWeek(dayjs()), 'day')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await scheduleService.getMyTeachingSchedules()
      setSchedules(res.data?.schedules || [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const items: FlatItem[] = useMemo(() => {
    const out: FlatItem[] = []
    for (const s of schedules) {
      for (const session of s.sessions || []) {
        out.push({
          schedule: s,
          session,
          memberId: memberIdOf(s),
          memberName: memberNameOf(s),
          scheduleStatus: s.status,
        })
      }
    }
    return out.sort((a, b) => {
      const da = new Date(a.session.date).getTime()
      const db = new Date(b.session.date).getTime()
      if (da !== db) return da - db
      return (a.session.time || '').localeCompare(b.session.time || '')
    })
  }, [schedules])

  const dayItems = (idx: number) => {
    const date = weekStart.add(idx, 'day')
    const key = date.format('YYYY-MM-DD')
    return items.filter((it) => dayjs(it.session.date).format('YYYY-MM-DD') === key)
  }

  const isPlanAssigned = (it: FlatItem) => (it.session.exercises?.length || 0) > 0
  const isTerminal = (it: FlatItem) =>
    ['completed', 'skipped', 'no_show', 'cancelled'].includes(it.session.status)

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="rounded-[28px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-8 max-[640px]:p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">LỊCH DẠY PT 1-1</p>
          <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">Lịch dạy 1-1</h1>
          <p className="mt-2 text-sm text-[var(--gs-text-muted)]">
            Từng buổi tập của hội viên — gán / chỉnh giáo án cho từng buổi riêng
          </p>
        </div>

        <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-6">
          <div className="flex items-center justify-between max-[767px]:flex-col max-[767px]:items-start max-[767px]:gap-2 mb-4">
            <h2 className="text-lg font-semibold text-[var(--gs-text)]">Tuần</h2>
            <div className="flex items-center gap-2">
              <Button size="small" icon={<LeftOutlined />} onClick={goPrevWeek} />
              <Button size="small" type={isCurrentWeek ? 'primary' : 'default'} onClick={goCurrentWeek}>
                Tuần này
              </Button>
              <span className="text-sm text-[var(--gs-text-muted)] min-w-[130px] text-center">{weekLabel}</span>
              <Button size="small" icon={<RightOutlined />} onClick={goNextWeek} />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Spin /></div>
          ) : items.length === 0 ? (
            <Empty description="Chưa có buổi PT 1-1 nào — hãy tạo lịch & gán giáo án từ trang Khách hàng" />
          ) : (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 7 }, (_, idx) => idx).map((idx) => {
                const date = weekStart.add(idx, 'day')
                const rows = dayItems(idx)
                return (
                  <div key={idx} className="flex flex-col sm:flex-row gap-4 p-4 items-start rounded-lg border border-[var(--gs-border)]">
                    <div className="w-40 shrink-0">
                      <p className="text-lg font-bold text-[var(--gs-text)]">{DAY_LABEL_MAP_VN[date.day()]}</p>
                      <p className="text-xs text-[var(--gs-text-muted)]">{date.format('DD/MM')}</p>
                    </div>
                    <div className="flex-1 w-full">
                      {rows.length === 0 ? (
                        <div className="border border-dashed border-[var(--gs-border)] rounded-lg p-4 text-center text-[var(--gs-text-muted)] text-sm">
                          Không có buổi tập
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          {rows.map((it) => {
                            const st = SESSION_STATUS[it.session.status] || SESSION_STATUS.pending
                            const assigned = isPlanAssigned(it)
                            const terminal = isTerminal(it)
                            return (
                              <div key={`${it.schedule._id}_${it.session.dayOrder}`}
                                className={`rounded-xl border p-4 ${terminal ? 'opacity-70' : ''} ${assigned ? 'border-green-500/40 bg-green-500/5' : 'border-amber-500/40 bg-amber-500/5'}`}>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <ClockCircleOutlined className="text-[var(--gs-text-muted)]" />
                                    <span className="font-bold text-[var(--gs-text)]">
                                      {it.session.time}{it.session.endTime ? ` - ${it.session.endTime}` : ''}
                                    </span>
                                    <span className="text-xs text-[var(--gs-text-muted)]">
                                      {it.session.muscleGroup || it.session.title || `Buổi ${it.session.dayOrder}`}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Tag color={st.color} className="m-0">{st.label}</Tag>
                                    {assigned ? (
                                      <Tag icon={<CheckCircleFilled />} color="success" className="m-0">Đã gán giáo án</Tag>
                                    ) : (
                                      <Tag color="gold" className="m-0">Chưa gán giáo án</Tag>
                                    )}
                                  </div>
                                </div>
                                <div className="mt-1.5 flex items-center gap-1 text-sm text-[var(--gs-text)]">
                                  <UserOutlined />
                                  <span>{it.memberName}</span>
                                  {it.session.className && (
                                    <Tag className="m-0 ml-1 text-[11px]" color="blue">
                                      Nhóm: {it.session.className}{it.session.classCode ? ` (${it.session.classCode})` : ''}
                                    </Tag>
                                  )}
                                </div>
                                {assigned && it.session.exercises.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {it.session.exercises.slice(0, 5).map((ex) => (
                                      <span key={ex.name} className="rounded bg-[var(--gs-card-soft)] px-2 py-0.5 text-xs text-[var(--gs-text-muted)]">
                                        {ex.name}
                                      </span>
                                    ))}
                                    {it.session.exercises.length > 5 && (
                                      <span className="px-2 py-0.5 text-xs text-[var(--gs-text-muted)]">+{it.session.exercises.length - 5} bài</span>
                                    )}
                                  </div>
                                )}
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {!terminal ? (
                                    <Button
                                      size="small"
                                      type={assigned ? 'default' : 'primary'}
                                      icon={<FileAddOutlined />}
                                      onClick={() => navigate(`/pt/schedules/${it.schedule._id}/session/${it.session.dayOrder}/plan`)}
                                    >
                                      {assigned ? 'Sửa giáo án' : 'Gán bài tập'}
                                    </Button>
                                  ) : null}
                                  <Button
                                    size="small"
                                    icon={<CalendarOutlined />}
                                    onClick={() => navigate(`/pt/clients/${it.memberId}/progress?scheduleId=${it.schedule._id}`)}
                                  >
                                    Chi tiết
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
