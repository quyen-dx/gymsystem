import { useEffect, useState } from 'react'
import { Button, Modal, Select, message } from 'antd'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { trainerScheduleService, type AffectedTrainerSchedule, type TrainerSchedule } from '../../../services/trainerScheduleService'
import { trainerService } from '../../../services/trainerService'
import { getUserDisplayName } from '../../../utils/userDisplay'

type ScheduleEditRow = {
  dayOfWeek: number
  shift: string
  startTime?: string
  endTime?: string
  zoneId?: string
}

const DAY_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
const SHIFT_OPTIONS = [
  { value: 'morning', label: 'Sáng', time: '06:00 - 12:00', tone: 'border-sky-500/50 bg-sky-500/10 text-sky-100' },
  { value: 'afternoon', label: 'Chiều', time: '12:00 - 18:00', tone: 'border-amber-500/50 bg-amber-500/10 text-amber-100' },
  { value: 'evening', label: 'Tối', time: '18:00 - 22:00', tone: 'border-violet-500/60 bg-violet-500/10 text-violet-100' },
]
const SHIFT_LABELS: Record<string, string> = {
  morning: 'Sáng (06:00 - 12:00)',
  afternoon: 'Chiều (12:00 - 18:00)',
  evening: 'Tối (18:00 - 22:00)',
}

const shiftOrder = new Map(SHIFT_OPTIONS.map((item, index) => [item.value, index]))

function sortSchedules<T extends { dayOfWeek: number; shift: string }>(items: T[]) {
  return [...items].sort((a, b) => a.dayOfWeek - b.dayOfWeek || (shiftOrder.get(a.shift) ?? 99) - (shiftOrder.get(b.shift) ?? 99))
}

function showAffectedScheduleWarning(affectedSchedules: AffectedTrainerSchedule[]) {
  Modal.warning({
    title: 'Không thể thay đổi ca làm việc',
    width: 760,
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--gs-text-muted)]">
          Không thể thay đổi ca làm việc vì PT đang có lịch tập trong khoảng thời gian này.
        </p>
        <div className="max-h-[320px] space-y-2 overflow-auto">
          {affectedSchedules.map((item, index) => (
            <div key={`${item.referenceId || index}-${item.time}`} className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3">
              <div className="font-semibold text-[var(--gs-text)]">{item.date} - {item.time}</div>
              <div className="mt-1 grid gap-1 text-xs text-[var(--gs-text-muted)] sm:grid-cols-2">
                <span>Member: {item.member || '-'}</span>
                <span>Loại lịch: {item.type || '-'}</span>
                <span>Trạng thái: {item.status || '-'}</span>
                {item.className && <span>Lớp: {item.className}</span>}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-[var(--gs-text-muted)]">
          Hãy xử lý hoặc đổi lịch các buổi trên trước khi bỏ ca làm việc này.
        </p>
      </div>
    ),
  })
}

export default function AdminTrainerSchedulesPage() {
  const [trainers, setTrainers] = useState<any[]>([])
  const [selectedTrainer, setSelectedTrainer] = useState<string>('')
  const [schedules, setSchedules] = useState<TrainerSchedule[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editSchedules, setEditSchedules] = useState<ScheduleEditRow[]>([])

  useEffect(() => {
    trainerService.getPTs({ pageSize: 100 }).then((ptRes) => {
      setTrainers(ptRes.data?.pts || [])
    })
  }, [])

  const loadSchedules = async (trainerId: string) => {
    if (!trainerId) {
      setSchedules([])
      return
    }
    setLoading(true)
    try {
      const res = await trainerScheduleService.getTrainerSchedule(trainerId)
      setSchedules(sortSchedules(res.data.schedules || []))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSchedules(selectedTrainer)
  }, [selectedTrainer])

  const handleOpen = () => {
    const existing = schedules.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      shift: s.shift,
      startTime: s.startTime,
      endTime: s.endTime,
      zoneId: (s.zoneId as any)?._id || s.zoneId || undefined,
    }))
    setEditSchedules(sortSchedules(existing))
    setOpen(true)
  }

  const isSelected = (dayOfWeek: number, shift: string) =>
    editSchedules.some((item) => item.dayOfWeek === dayOfWeek && item.shift === shift)

  const toggleShift = (dayOfWeek: number, shift: string) => {
    setEditSchedules((prev) => {
      const exists = prev.some((item) => item.dayOfWeek === dayOfWeek && item.shift === shift)
      if (exists) return sortSchedules(prev.filter((item) => !(item.dayOfWeek === dayOfWeek && item.shift === shift)))
      return sortSchedules([...prev, { dayOfWeek, shift }])
    })
  }

  const selectWeekdayPreset = () => {
    const next: ScheduleEditRow[] = []
    for (let day = 1; day <= 5; day += 1) {
      next.push({ dayOfWeek: day, shift: 'morning' }, { dayOfWeek: day, shift: 'afternoon' })
    }
    setEditSchedules(sortSchedules(next))
  }

  const selectFullWeekPreset = () => {
    const next: ScheduleEditRow[] = []
    for (let day = 0; day <= 6; day += 1) {
      for (const shift of SHIFT_OPTIONS) next.push({ dayOfWeek: day, shift: shift.value })
    }
    setEditSchedules(sortSchedules(next))
  }

  const handleSave = async () => {
    if (!selectedTrainer) return
    try {
      await trainerScheduleService.setSchedule(selectedTrainer, sortSchedules(editSchedules))
      message.success('Đã lưu lịch làm việc')
      setOpen(false)
      loadSchedules(selectedTrainer)
    } catch (err: any) {
      const affectedSchedules = err?.response?.data?.affectedSchedules || []
      if (affectedSchedules.length > 0) {
        showAffectedScheduleWarning(affectedSchedules)
        return
      }
      message.error(err?.response?.data?.message || 'Lưu thất bại')
    }
  }

  const groupedSchedules = schedules.reduce<Record<string, TrainerSchedule[]>>((acc, s) => {
    const day = s.dayOfWeek.toString()
    if (!acc[day]) acc[day] = []
    acc[day].push(s)
    return acc
  }, {})

  const selectedTrainerName = trainers.find((trainer) => trainer._id === selectedTrainer)
  const selectedCount = editSchedules.length

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[var(--gs-text)]">Quản lý lịch PT</h1>
            <p className="mt-1 text-sm text-[var(--gs-text-muted)]">Thiết lập ca làm việc cố định theo tuần cho từng huấn luyện viên.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select
              className="min-w-[250px]"
              placeholder="Chọn PT"
              value={selectedTrainer || undefined}
              onChange={setSelectedTrainer}
              options={trainers.map((trainer: any) => ({ label: getUserDisplayName(trainer, 'PT'), value: trainer._id }))}
            />
            {selectedTrainer && (
              <Button type="primary" onClick={handleOpen}>Cập nhật lịch</Button>
            )}
          </div>
        </div>

        {!selectedTrainer ? (
          <div className="rounded-2xl border border-dashed border-[var(--theme-border)] bg-[var(--gs-card)] p-8 text-center text-sm text-[var(--gs-text-muted)]">
            Chọn một PT để xem và cập nhật lịch làm việc.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {Array.from({ length: 7 }, (_, i) => i).map((day) => {
              const daySchedules = sortSchedules(groupedSchedules[day.toString()] || [])
              return (
                <div key={day} className="rounded-2xl border border-[var(--theme-border)] bg-[var(--gs-card)] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="font-semibold text-[var(--gs-text)]">{DAY_LABELS[day]}</div>
                    <span className="text-xs text-[var(--gs-text-muted)]">{daySchedules.length || 0} ca</span>
                  </div>
                  {daySchedules.length === 0 ? (
                    <span className="text-xs text-[var(--gs-text-muted)]">Nghỉ</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {daySchedules.map((schedule) => (
                        <span key={schedule._id} className="rounded-lg bg-[var(--theme-accent-muted)] px-2.5 py-1 text-xs font-medium text-[var(--theme-accent)]">
                          {SHIFT_LABELS[schedule.shift] || schedule.shift}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <Modal
          title={`Cập nhật lịch làm việc${selectedTrainerName ? ` - ${getUserDisplayName(selectedTrainerName, 'PT')}` : ''}`}
          open={open}
          onOk={handleSave}
          onCancel={() => setOpen(false)}
          okText="Lưu lịch"
          cancelText="Hủy"
          width={920}
          destroyOnClose
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--gs-card)] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-[var(--gs-text-muted)]">Lịch làm việc hằng tuần</p>
              <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-[var(--gs-text)]">PT: {selectedTrainerName ? getUserDisplayName(selectedTrainerName, 'PT') : 'PT'}</div>
                  <p className="mt-1 text-xs text-[var(--gs-text-muted)]">
                    Các ca được chọn sẽ trở thành lịch làm việc mặc định hằng tuần của PT.
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-2 text-right">
                  <div className="text-xs text-[var(--gs-text-muted)]">Tổng số ca</div>
                  <div className="text-xl font-bold text-[var(--theme-accent)]">{selectedCount} ca/tuần</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--gs-text)]">Chọn nhanh ca làm việc</p>
                  <p className="mt-1 text-xs text-[var(--gs-text-muted)]">
                    Lịch này được sử dụng làm căn cứ để Admin phân công lịch PT. PT không được phân công ngoài ca làm việc đã đăng ký.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="small" onClick={selectWeekdayPreset}>T2 - T6, sáng + chiều</Button>
                  <Button size="small" onClick={selectFullWeekPreset}>Chọn tất cả</Button>
                  <Button size="small" danger onClick={() => setEditSchedules([])}>Xóa hết</Button>
                </div>
              </div>
            </div>

            <div className="grid max-h-[58vh] grid-cols-1 gap-3 overflow-auto pr-1 md:grid-cols-2">
              {DAY_LABELS.map((dayLabel, dayOfWeek) => (
                <div key={dayOfWeek} className="rounded-2xl border border-[var(--theme-border)] bg-[var(--gs-card)] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-semibold text-[var(--gs-text)]">{dayLabel}</span>
                    <span className="text-xs text-[var(--gs-text-muted)]">
                      {editSchedules.filter((item) => item.dayOfWeek === dayOfWeek).length} ca
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {SHIFT_OPTIONS.map((shift) => {
                      const active = isSelected(dayOfWeek, shift.value)
                      return (
                        <button
                          key={shift.value}
                          type="button"
                          onClick={() => toggleShift(dayOfWeek, shift.value)}
                          className={`rounded-xl border p-3 text-left transition ${
                            active
                              ? `${shift.tone} shadow-[0_0_0_1px_rgba(139,92,246,0.25)]`
                              : 'border-[var(--theme-border)] bg-[var(--theme-bg)] text-[var(--gs-text-muted)] hover:border-[var(--theme-accent)] hover:text-[var(--gs-text)]'
                          }`}
                        >
                          <span className="block text-sm font-semibold">{shift.label}</span>
                          <span className="mt-1 block text-xs opacity-80">{shift.time}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3">
              <span className="text-sm text-[var(--gs-text-muted)]">Đã chọn <strong className="text-[var(--theme-accent)]">{selectedCount}</strong> ca làm việc</span>
              <span className="text-xs text-[var(--gs-text-muted)]">Sáng 06:00-12:00 • Chiều 12:00-18:00 • Tối 18:00-22:00</span>
            </div>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  )
}
