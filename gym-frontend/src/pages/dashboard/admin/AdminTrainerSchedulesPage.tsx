import { useEffect, useState } from 'react'
import { Table, Button, Select, Modal, TimePicker, message } from 'antd'
import dayjs from 'dayjs'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { trainerScheduleService, type TrainerSchedule } from '../../../services/trainerScheduleService'
import { trainerService } from '../../../services/trainerService'
import { getUserDisplayName } from '../../../utils/userDisplay'

const DAY_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
const SHIFT_LABELS: Record<string, string> = { morning: 'Sáng (06-12)', afternoon: 'Chiều (12-18)', evening: 'Tối (18-22)' }

export default function AdminTrainerSchedulesPage() {
  const [trainers, setTrainers] = useState<any[]>([])
  const [selectedTrainer, setSelectedTrainer] = useState<string>('')
  const [schedules, setSchedules] = useState<TrainerSchedule[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editSchedules, setEditSchedules] = useState<{ dayOfWeek: number; shift: string; startTime?: string; endTime?: string; zoneId?: string }[]>([])

  useEffect(() => {
    trainerService.getPTs({ pageSize: 100 }).then((ptRes) => {
      setTrainers(ptRes.data?.pts || [])
    })
  }, [])

  const loadSchedules = async (trainerId: string) => {
    if (!trainerId) { setSchedules([]); return }
    setLoading(true)
    try {
      const res = await trainerScheduleService.getTrainerSchedule(trainerId)
      setSchedules(res.data.schedules || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadSchedules(selectedTrainer) }, [selectedTrainer])

  const handleOpen = () => {
    const existing = schedules.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      shift: s.shift,
      startTime: s.startTime,
      endTime: s.endTime,
      zoneId: (s.zoneId as any)?._id || s.zoneId || undefined,
    }))
    setEditSchedules(existing.length > 0 ? existing : [{ dayOfWeek: 1, shift: 'morning', startTime: undefined, endTime: undefined, zoneId: undefined }])
    setOpen(true)
  }

  const addRow = () => {
    setEditSchedules((prev) => [...prev, { dayOfWeek: 1, shift: 'morning', startTime: undefined, endTime: undefined, zoneId: undefined }])
  }

  const updateRow = (index: number, field: string, value: any) => {
    setEditSchedules((prev) => {
      const next = [...prev]
      ;(next[index] as any)[field] = value
      return next
    })
  }

  const removeRow = (index: number) => {
    setEditSchedules((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    try {
      const valid = editSchedules.filter((s) => s.dayOfWeek !== undefined && s.shift)
      await trainerScheduleService.setSchedule(selectedTrainer, valid)
      message.success('Đã lưu lịch làm việc')
      setOpen(false)
      loadSchedules(selectedTrainer)
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Lưu thất bại')
    }
  }

  const groupedSchedules = schedules.reduce<Record<string, TrainerSchedule[]>>((acc, s) => {
    const day = s.dayOfWeek.toString()
    if (!acc[day]) acc[day] = []
    acc[day].push(s)
    return acc
  }, {})

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--gs-text)]">Quản lý lịch PT</h1>
          <div className="flex gap-2">
            <Select
              style={{ width: 250 }}
              placeholder="Chọn PT"
              value={selectedTrainer || undefined}
              onChange={setSelectedTrainer}
              options={trainers.map((t: any) => ({ label: getUserDisplayName(t, 'PT'), value: t._id }))}
            />
            {selectedTrainer && (
              <Button type="primary" onClick={handleOpen}>Cập nhật lịch</Button>
            )}
          </div>
        </div>

        {!selectedTrainer ? (
          <p className="text-sm text-[var(--gs-text-muted)]">Chọn một PT để xem lịch</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 7 }, (_, i) => i).map((day) => {
              const daySchedules = groupedSchedules[day.toString()] || []
              return (
                <div key={day} className="rounded-xl border border-[var(--theme-border)] bg-[var(--gs-card)] p-3">
                  <div className="font-semibold text-sm text-[var(--gs-text)] mb-2">{DAY_LABELS[day]}</div>
                  {daySchedules.length === 0 ? (
                    <span className="text-xs text-[var(--gs-text-muted)]">Nghỉ</span>
                  ) : (
                    <div className="space-y-1">
                      {daySchedules.map((s) => (
                        <div key={s._id} className="flex items-center gap-2 text-xs text-[var(--gs-text)]">
                          <Tag color="blue">{SHIFT_LABELS[s.shift] || s.shift}</Tag>
                          {s.startTime && s.endTime && <span>{s.startTime.slice(0, 5)}-{s.endTime.slice(0, 5)}</span>}

                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <Modal
          title="Cập nhật lịch làm việc"
          open={open}
          onOk={handleSave}
          onCancel={() => setOpen(false)}
          okText="Lưu"
          cancelText="Hủy"
          width={700}
          destroyOnClose
        >
          <div className="space-y-3 max-h-[500px] overflow-auto">
            {editSchedules.map((row, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl border border-[var(--theme-border)] p-3">
                <Select
                  style={{ width: 120 }}
                  value={row.dayOfWeek}
                  onChange={(v) => updateRow(i, 'dayOfWeek', v)}
                  options={DAY_LABELS.map((l, idx) => ({ label: l, value: idx }))}
                  size="small"
                />
                <Select
                  style={{ width: 140 }}
                  value={row.shift}
                  onChange={(v) => updateRow(i, 'shift', v)}
                  options={Object.entries(SHIFT_LABELS).map(([value, label]) => ({ label, value }))}
                  size="small"
                />
                <TimePicker
                  value={row.startTime ? dayjs(row.startTime, 'HH:mm') : null}
                  onChange={(v) => updateRow(i, 'startTime', v?.format('HH:mm'))}
                  format="HH:mm"
                  size="small"
                  placeholder="Bắt đầu"
                />
                <TimePicker
                  value={row.endTime ? dayjs(row.endTime, 'HH:mm') : null}
                  onChange={(v) => updateRow(i, 'endTime', v?.format('HH:mm'))}
                  format="HH:mm"
                  size="small"
                  placeholder="Kết thúc"
                />

                {editSchedules.length > 1 && (
                  <Button size="small" danger onClick={() => removeRow(i)}>X</Button>
                )}
              </div>
            ))}
            <Button type="dashed" block onClick={addRow}>+ Thêm ca</Button>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  )
}

function Tag({ children, color }: { children: React.ReactNode; color?: string }) {
  const colorMap: Record<string, string> = { blue: 'bg-blue-500/10 text-blue-600' }
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${colorMap[color || ''] || 'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]'}`}>{children}</span>
}
