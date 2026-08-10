import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  DownOutlined,
  PlusOutlined,
  UpOutlined,
} from '@ant-design/icons'
import { Button, Empty, Input, message, Select, Spin, Tag } from 'antd'
import dayjs from 'dayjs'
import { useNavigate, useParams } from 'react-router-dom'

import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { scheduleService } from '../../../services/scheduleService'
import {
  workoutService,
  type ScheduleSession,
  type TemplateDay,
  type WorkoutSchedule,
} from '../../../services/workoutService'

const DAY_LABEL_MAP_VN = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']

type ExerciseRow = { name: string; note: string }

const isTemplateDay = (t: TemplateDay) =>
  t && typeof t === 'object' && Array.isArray(t.exercises) && t.exercises.length > 0

export default function PTSessionPlanPage() {
  const { scheduleId = '', dayOrder = '' } = useParams()
  const navigate = useNavigate()

  const [schedule, setSchedule] = useState<WorkoutSchedule | null>(null)
  const [session, setSession] = useState<ScheduleSession | null>(null)
  const [loading, setLoading] = useState(true)

  const [templates, setTemplates] = useState<Array<{ _id: string; workoutName: string; goal: string; days?: TemplateDay[] }>>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined)
  const [templateDays, setTemplateDays] = useState<TemplateDay[]>([])

  const [title, setTitle] = useState('')
  const [muscleGroup, setMuscleGroup] = useState('')
  const [exercises, setExercises] = useState<ExerciseRow[]>([])
  const [saving, setSaving] = useState(false)

  const memberName = useMemo(() => {
    if (!schedule?.memberId) return 'Hội viên'
    if (typeof schedule.memberId === 'object') {
      return schedule.memberId.name || schedule.memberId.fullName || 'Hội viên'
    }
    return 'Hội viên'
  }, [schedule])

  const isPending = session?.status === 'pending'

  useEffect(() => {
    (async () => {
      try {
        const res = await scheduleService.getScheduleById(scheduleId)
        const sched = res.data?.schedule
        setSchedule(sched || null)
        const s = sched?.sessions?.find((x) => x.dayOrder === Number(dayOrder)) || null
        setSession(s || null)
        if (s) {
          setTitle(s.title || '')
          setMuscleGroup(s.muscleGroup || '')
          setExercises((s.exercises || []).map((ex) => ({ name: ex.name, note: ex.note || '' })))
        }
      } catch (err: unknown) {
        message.error(
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Không thể tải thông tin buổi tập',
        )
      } finally {
        setLoading(false)
      }
    })()
  }, [scheduleId, dayOrder])

  useEffect(() => {
    workoutService.getSharedTemplates({ limit: 50 })
      .then((res) => setTemplates(res.data?.workouts || []))
      .catch(() => { /* silent */ })
  }, [])

  const selectedTemplate = templates.find((t) => t._id === selectedTemplateId)

  useEffect(() => {
    if (selectedTemplate) {
      setTemplateDays((selectedTemplate.days || []).filter(isTemplateDay))
    } else {
      setTemplateDays([])
    }
  }, [selectedTemplate])

  const applyTemplateDay = (d: TemplateDay) => {
    setTitle(selectedTemplate?.workoutName || title)
    setMuscleGroup(d.muscleGroup || muscleGroup)
    setExercises(d.exercises.map((ex) => ({ name: ex.name, note: ex.note || '' })))
    message.success(`Đã áp dụng "${d.muscleGroup || 'Buổi tập'}" — bạn có thể chỉnh thêm cho phù hợp hội viên`)
  }

  const updateRow = (i: number, patch: Partial<ExerciseRow>) => {
    setExercises((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }
  const removeRow = (i: number) => setExercises((prev) => prev.filter((_, idx) => idx !== i))
  const moveRow = (i: number, dir: -1 | 1) => {
    setExercises((prev) => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }
  const addRow = () => setExercises((prev) => [...prev, { name: '', note: '' }])

  const handleSave = async () => {
    const clean = exercises
      .map((ex) => ({ name: ex.name.trim(), note: ex.note.trim() }))
      .filter((ex) => ex.name.length > 0)
    if (clean.length === 0) {
      message.warning('Giáo án của buổi phải có ít nhất 1 bài tập')
      return
    }
    setSaving(true)
    try {
      await scheduleService.updateSessionPlan(scheduleId, Number(dayOrder), {
        title: title.trim() || undefined,
        muscleGroup: muscleGroup.trim() || undefined,
        exercises: clean,
      })
      message.success('Đã lưu giáo án buổi tập')
      navigate('/pt/teaching')
    } catch (err: unknown) {
      message.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Không thể lưu giáo án',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="mb-4">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/pt/teaching')}>Quay lại</Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spin size="large" /></div>
        ) : !schedule || !session ? (
          <Empty description="Không tìm thấy buổi tập" />
        ) : (
          <div className="space-y-6">
            <div className="rounded-[28px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">THÔNG TIN BUỔI TẬP</p>
              <h1 className="mt-2 text-2xl font-semibold text-[var(--gs-text)]">
                {DAY_LABEL_MAP_VN[dayjs(session.date).day()]}, {dayjs(session.date).format('DD/MM/YYYY')}
              </h1>
              <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <p className="text-[var(--gs-text)]"><span className="text-[var(--gs-text-muted)]">Hội viên:</span> {memberName}</p>
                <p className="text-[var(--gs-text)]">
                  <span className="text-[var(--gs-text-muted)]">Thời gian:</span> {session.time}{session.endTime ? ` - ${session.endTime}` : ''}
                </p>
                <p className="text-[var(--gs-text)]">
                  <span className="text-[var(--gs-text-muted)]">Trạng thái:</span> {session.status}
                </p>
                <p className="text-[var(--gs-text)]">
                  <span className="text-[var(--gs-text-muted)]">Giáo án gốc:</span>{' '}
                  {schedule.templateId && typeof schedule.templateId === 'object'
                    ? schedule.templateId.name || schedule.templateId.goal || '—'
                    : '—'}
                </p>
              </div>
              {!isPending && (
                <div className="mt-4 rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-xs text-orange-400">
                  Buổi này đã diễn ra hoặc bị hủy ({session.status}) — không thể thay đổi giáo án.
                </div>
              )}
            </div>

            <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6">
              <h2 className="text-lg font-semibold text-[var(--gs-text)]">Chọn giáo án mẫu từ thư viện</h2>
              <p className="mt-1 text-xs text-[var(--gs-text-muted)]">
                Chọn giáo án mẫu → áp dụng 1 buổi trong mẫu → chỉnh lại cho phù hợp hội viên. Giáo án gốc trong thư viện không bị thay đổi.
              </p>
              <div className="mt-3">
                <Select
                  className="w-full"
                  placeholder="Chọn giáo án mẫu..."
                  value={selectedTemplateId}
                  onChange={(v) => setSelectedTemplateId(v)}
                  showSearch
                  optionFilterProp="label"
                  options={templates.map((t) => ({
                    value: t._id,
                    label: `${t.workoutName} (${(t.days || []).filter(isTemplateDay).length} buổi${t.goal ? ` — ${t.goal}` : ''})`,
                  }))}
                />
              </div>
              {templateDays.length > 0 && (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {templateDays.map((d, i) => (
                    <div key={`${d.dayOfWeek}_${i}`} className="rounded-xl border border-[var(--gs-border)] p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-[var(--gs-text)]">{d.muscleGroup || `Buổi ${i + 1}`}</span>
                        <Button size="small" type="primary" onClick={() => applyTemplateDay(d)}>Áp dụng</Button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {d.exercises.slice(0, 6).map((ex) => (
                          <span key={ex.name} className="rounded bg-[var(--gs-card-soft)] px-2 py-0.5 text-xs text-[var(--gs-text-muted)]">{ex.name}</span>
                        ))}
                        {d.exercises.length > 6 && (
                          <span className="px-2 py-0.5 text-xs text-[var(--gs-text-muted)]">+{d.exercises.length - 6} bài</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--gs-text)]">Giáo án buổi này</h2>
                <Tag color={exercises.length > 0 ? 'green' : 'gold'}>
                  {exercises.length > 0 ? `${exercises.length} bài tập` : 'Chưa có bài tập'}
                </Tag>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--gs-text-muted)]">Tiêu đề buổi</label>
                  <Input size="small" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Upper Body A" disabled={!isPending} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--gs-text-muted)]">Nhóm cơ</label>
                  <Input size="small" value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value)} placeholder="VD: Ngực - Vai - Tay sau" disabled={!isPending} />
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {exercises.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <Button size="small" type="text" icon={<UpOutlined />} disabled={i === 0 || !isPending} onClick={() => moveRow(i, -1)} />
                      <Button size="small" type="text" icon={<DownOutlined />} disabled={i === exercises.length - 1 || !isPending} onClick={() => moveRow(i, 1)} />
                    </div>
                    <Input
                      size="small"
                      placeholder="Tên bài tập (VD: Bench Press)"
                      value={row.name}
                      onChange={(e) => updateRow(i, { name: e.target.value })}
                      disabled={!isPending}
                      className="flex-1"
                    />
                    <Input
                      size="small"
                      placeholder="Ghi chú (VD: 3 hiệp x 10 lần, tạ 40kg)"
                      value={row.note}
                      onChange={(e) => updateRow(i, { note: e.target.value })}
                      disabled={!isPending}
                      className="flex-1"
                    />
                    <Button size="small" danger icon={<DeleteOutlined />} disabled={!isPending} onClick={() => removeRow(i)} />
                  </div>
                ))}
                {exercises.length === 0 && (
                  <div className="rounded-lg border border-dashed border-[var(--gs-border)] p-4 text-center text-sm text-[var(--gs-text-muted)]">
                    Chưa có bài tập — chọn giáo án mẫu ở trên rồi bấm "Áp dụng", hoặc thêm bài tập trực tiếp.
                  </div>
                )}
                {isPending && (
                  <Button size="small" icon={<PlusOutlined />} onClick={addRow}>Thêm bài tập</Button>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button onClick={() => navigate('/pt/teaching')}>Hủy</Button>
                <Button type="primary" loading={saving} disabled={!isPending} onClick={handleSave}>
                  Lưu giáo án buổi
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
