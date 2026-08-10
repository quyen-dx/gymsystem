import {
  CalendarOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  StarFilled,
} from '@ant-design/icons'
import {
  Button,
  Input,
  Modal,
  Rate,
  Select,
  Space,
  Table,
  Tag,
  Tabs,
  TimePicker,
  Tooltip,
  message,
} from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AdminPTPricesPage from './AdminPTPricesPage'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { trainerService } from '../../../services/trainerService'
import { trainerScheduleService, type AffectedTrainerSchedule, type TrainerSchedule } from '../../../services/trainerScheduleService'
import { ptAssignmentEndService } from '../../../services/ptAssignmentEndService'
import { shiftChangeService } from '../../../services/shiftChangeService'
import { workoutService } from '../../../services/workoutService'
import { socketService } from '../../../services/socketService'
import type { PT } from '../../../types/admin/trainer'
import { getUserDisplayName } from '../../../utils/userDisplay'
import type { TrainingClass } from '../../../services/trainingGroupService'

const DAY_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
const SHIFT_LABELS: Record<string, string> = { morning: 'Sáng (06-12)', afternoon: 'Chiều (12-18)', evening: 'Tối (18-22)' }

const SCHEDULE_DAY_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
const SCHEDULE_SHIFT_OPTIONS = [
  { value: 'morning', label: 'Sáng', time: '06:00 - 12:00', tone: 'border-sky-500/50 bg-sky-500/10 text-sky-100' },
  { value: 'afternoon', label: 'Chiều', time: '12:00 - 18:00', tone: 'border-amber-500/50 bg-amber-500/10 text-amber-100' },
  { value: 'evening', label: 'Tối', time: '18:00 - 22:00', tone: 'border-violet-500/60 bg-violet-500/10 text-violet-100' },
]
const SPECIALTY_OPTIONS = [
  'GYM', 'CARDIO', 'STRENGTH TRAINING', 'YOGA', 'BOXING', 'CROSSFIT', 'PILATES', 'ZUMBA',
]
const scheduleShiftOrder = new Map(SCHEDULE_SHIFT_OPTIONS.map((item, index) => [item.value, index]))

function sortScheduleRows<T extends { dayOfWeek: number; shift: string }>(items: T[]) {
  return [...items].sort((a, b) => a.dayOfWeek - b.dayOfWeek || (scheduleShiftOrder.get(a.shift) ?? 99) - (scheduleShiftOrder.get(b.shift) ?? 99))
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

function TagBadge({ children, color }: { children: React.ReactNode; color?: string }) {
  const colorMap: Record<string, string> = {
    orange: 'bg-orange-500/10 text-orange-600',
    green: 'bg-green-500/10 text-green-600',
    red: 'bg-red-500/10 text-red-600',
    blue: 'bg-blue-500/10 text-blue-600',
  }
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${colorMap[color || ''] || 'bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]'}`}>{children}</span>
}

export default function AdminTrainersPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') === 'prices' ? 'prices' : 'trainers'
  const [pts, setPts] = useState<PT[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [specialtyFilter, setSpecialtyFilter] = useState<string | undefined>()

  const [schedulesOpen, setSchedulesOpen] = useState(false)
  const [scheduleModalTrainerId, setScheduleModalTrainerId] = useState<string | null>(null)
  const [pendingEndRequestCount, setPendingEndRequestCount] = useState(0)
  const [pendingWorkoutReportCount, setPendingWorkoutReportCount] = useState(0)
  const [pendingShiftChangeCount, setPendingShiftChangeCount] = useState(0)

  const fetchPTs = useCallback(async (p = page, s = search, sp = specialtyFilter) => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: p, limit: 15 }
      if (s) params.search = s
      if (sp) params.specialty = sp
      const { data } = await trainerService.getPTs(params)
      setPts(data.pts)
      setTotal(data.pagination.total)
    } catch {
      message.error('Không thể tải danh sách huấn luyện viên')
    } finally {
      setLoading(false)
    }
  }, [page, search, specialtyFilter])

  useEffect(() => { fetchPTs() }, [])

  // Socket: listen for pt end request count updates
  useEffect(() => {
    ptAssignmentEndService.getAllRequests({ status: 'pending', limit: 1 })
      .then(res => setPendingEndRequestCount(res.data?.pagination?.total || 0))
      .catch(() => {})
    const handler = (data: { pendingCount: number }) => setPendingEndRequestCount(data.pendingCount)
    socketService.on('pt_end_request:count_updated', handler)
    return () => { socketService.off('pt_end_request:count_updated', handler) }
  }, [])

  // Socket: listen for workout report count updates
  useEffect(() => {
    workoutService.getWorkoutReports({ status: 'pending', limit: 1 })
      .then(res => setPendingWorkoutReportCount(res.data.pagination?.total || 0))
      .catch(() => {})
    const handler = (data: { pendingCount: number }) => setPendingWorkoutReportCount(data.pendingCount)
    socketService.on('workout_report:count_updated', handler)
    return () => { socketService.off('workout_report:count_updated', handler) }
  }, [])

  // Socket: listen for shift change (thay ca) pending count updates
  useEffect(() => {
    socketService.connect()
    const refreshCount = () => {
      Promise.all([
        shiftChangeService.getAll({ status: 'pending', limit: 1 }),
        shiftChangeService.getAll({ status: 'waiting_assignment', limit: 1 }),
      ])
        .then(([a, b]) => setPendingShiftChangeCount((a.data.total || 0) + (b.data.total || 0)))
        .catch(() => {})
    }
    refreshCount()
    const countHandler = (data: { pendingCount: number }) => setPendingShiftChangeCount(data.pendingCount)
    const refreshHandler = () => refreshCount()
    socketService.on('shift_change:count_updated', countHandler)
    socketService.on('shift_change:new_request', refreshHandler)
    socketService.on('shift_change:updated', refreshHandler)
    return () => {
      socketService.off('shift_change:count_updated', countHandler)
      socketService.off('shift_change:new_request', refreshHandler)
      socketService.off('shift_change:updated', refreshHandler)
    }
  }, [])

  const handleSearch = (value: string) => {
    setSearch(value); setPage(1); fetchPTs(1, value, specialtyFilter)
  }

  const handleSpecialtyFilter = (value: string | undefined) => {
    setSpecialtyFilter(value); setPage(1); fetchPTs(1, search, value)
  }

  const columns = [
    {
      title: 'Huấn luyện viên', width: 220,
      render: (_: unknown, record: PT) => (
        <Space>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: record.avatar ? `url(${record.avatar}) center/cover` : 'var(--gs-border)', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--gs-text)' }} onClick={() => navigate(`/admin/trainers/${record._id}`)}>
              {getUserDisplayName(record, 'PT')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--gs-text-muted)' }}>{record.email || record.phone || '—'}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Chuyên môn',
      render: (_: unknown, record: PT) => (
        <Space size={4} wrap>
          {record.specialties?.length > 0
            ? record.specialties.map((s) => <Tag key={s} className="uppercase" style={{ margin: 0 }}>{s}</Tag>)
            : <span style={{ opacity: 0.4 }}>—</span>}
        </Space>
      ),
    },
    {
      title: 'Đánh giá', width: 140,
      render: (_: unknown, record: PT) => (
        <span>
          <Rate disabled value={record.rating} allowHalf style={{ fontSize: 14 }} character={<StarFilled />} />
          <span style={{ marginLeft: 6, fontSize: 13, color: 'var(--gs-text-muted)' }}>{record.rating.toFixed(1)}</span>
        </span>
      ),
    },
    { title: 'Kinh nghiệm', width: 100, align: 'center' as const, render: (_: unknown, record: PT) => <span>{record.experienceYears ? `${record.experienceYears}y` : '—'}</span> },
    { title: 'Lượt đặt', width: 80, align: 'center' as const, render: (_: unknown, record: PT) => <span>{record.bookingCount ?? 0}</span> },
    { title: 'Trạng thái', width: 100, render: (_: unknown, record: PT) => <Tag color={record.isActive ? 'success' : 'error'}>{record.isActive ? 'Hoạt động' : 'Đã khóa'}</Tag> },
    {
      title: 'Thao tác', width: 130,
      render: (_: unknown, record: PT) => (
        <Space size={4}>
          <Tooltip title="Lịch làm việc"><Button size="small" icon={<CalendarOutlined />} onClick={() => { setScheduleModalTrainerId(record._id); setSchedulesOpen(true) }} /></Tooltip>
          <Tooltip title="Xem chi tiết"><Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/admin/trainers/${record._id}`)} /></Tooltip>
          <Tooltip title="Chỉnh sửa"><Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/admin/trainers/${record._id}/edit`)} /></Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Quản lý</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">Quản lý huấn luyện viên</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => navigate('/admin/training-classes')}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--gs-card)] px-4 py-1.5 text-sm font-medium text-[var(--gs-text)] transition-all hover:bg-[var(--theme-accent)] hover:text-white">
            Lớp tập và lịch PT
          </button>
          <button type="button" onClick={() => { setScheduleModalTrainerId(null); setSchedulesOpen(true) }}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--gs-card)] px-4 py-1.5 text-sm font-medium text-[var(--gs-text)] transition-all hover:bg-[var(--theme-accent)] hover:text-white">
            Lịch làm việc PT
          </button>
          <button type="button" onClick={() => navigate('/admin/trainer-end-requests')}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--gs-card)] px-4 py-1.5 text-sm font-medium text-[var(--gs-text)] transition-all hover:bg-[var(--theme-accent)] hover:text-white">
            Yêu cầu kết thúc phụ trách
            {pendingEndRequestCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[#f5222d] text-white text-[10px] font-bold px-1">
                {pendingEndRequestCount > 99 ? '99+' : pendingEndRequestCount}
              </span>
            )}
          </button>
          <button type="button" onClick={() => navigate('/admin/shift-change-requests')}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--gs-card)] px-4 py-1.5 text-sm font-medium text-[var(--gs-text)] transition-all hover:bg-[var(--theme-accent)] hover:text-white">
            Yêu cầu thay ca
            {pendingShiftChangeCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[#f5222d] text-white text-[10px] font-bold px-1">
                {pendingShiftChangeCount > 99 ? '99+' : pendingShiftChangeCount}
              </span>
            )}
          </button>
          <button type="button" onClick={() => navigate('/admin/workout-reports')}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--gs-card)] px-4 py-1.5 text-sm font-medium text-[var(--gs-text)] transition-all hover:bg-[var(--theme-accent)] hover:text-white">
            Báo cáo giáo án
            {pendingWorkoutReportCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[#f5222d] text-white text-[10px] font-bold px-1">
                {pendingWorkoutReportCount > 99 ? '99+' : pendingWorkoutReportCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <Tabs
        className="mb-5"
        activeKey={activeTab}
        onChange={(tab) => setSearchParams(tab === 'prices' ? { tab: 'prices' } : {})}
        items={[
          { key: 'trainers', label: 'Danh sách PT' },
          { key: 'prices', label: 'Giá dịch vụ PT' },
        ]}
      />

      {activeTab === 'trainers' ? <>
      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
        <div className="dashboard-filter-bar">
          <Input.Search placeholder="Tìm kiếm huấn luyện viên..." allowClear onSearch={handleSearch} style={{ maxWidth: 300 }} />
          <Select allowClear placeholder="Lọc theo chuyên môn" style={{ minWidth: 160 }} onChange={handleSpecialtyFilter}
            options={SPECIALTY_OPTIONS.map((item) => ({ value: item, label: item }))}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/admin/trainers/create')}>Thêm huấn luyện viên</Button>
        </div>
        <div className="member-scroll-x">
          <Table dataSource={pts} columns={columns} rowKey="_id" loading={loading}
            pagination={{ total, current: page, pageSize: 15, onChange: (p) => { setPage(p); fetchPTs(p, search, specialtyFilter) } }} />
        </div>
      </div>

      {/* Modal: Lịch làm việc PT */}
      <SchedulesModal
        open={schedulesOpen}
        onClose={() => { setSchedulesOpen(false); setScheduleModalTrainerId(null) }}
        initialTrainerId={scheduleModalTrainerId || undefined}
      />
      </> : <AdminPTPricesPage embedded />}

    </DashboardLayout>
  )
}

interface ScheduleEditRow {
  dayOfWeek: number
  shift: string
  startTime?: string
  endTime?: string
}

function ScheduleEditorModal({
  trainerId,
  trainerName,
  open,
  onClose,
  onSaved,
}: {
  trainerId: string
  trainerName: string
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [rows, setRows] = useState<ScheduleEditRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !trainerId) return
    let cancelled = false
    setLoading(true)
    trainerScheduleService.getTrainerSchedule(trainerId)
      .then((res) => {
        if (cancelled) return
        const existing = (res.data.schedules || []).map((s) => ({
          dayOfWeek: s.dayOfWeek,
          shift: s.shift,
          startTime: s.startTime || undefined,
          endTime: s.endTime || undefined,
        }))
        setRows(sortScheduleRows(existing))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, trainerId])

  const updateRow = (index: number, field: keyof ScheduleEditRow, value: string | undefined) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }

  const isSelected = (dayOfWeek: number, shift: string) =>
    rows.some((item) => item.dayOfWeek === dayOfWeek && item.shift === shift)

  const toggleShift = (dayOfWeek: number, shift: string) => {
    setRows((prev) => {
      const exists = prev.some((item) => item.dayOfWeek === dayOfWeek && item.shift === shift)
      if (exists) return sortScheduleRows(prev.filter((item) => !(item.dayOfWeek === dayOfWeek && item.shift === shift)))
      return sortScheduleRows([...prev, { dayOfWeek, shift }])
    })
  }

  const selectWeekdayPreset = () => {
    const next: ScheduleEditRow[] = []
    for (let day = 1; day <= 5; day += 1) {
      next.push({ dayOfWeek: day, shift: 'morning' }, { dayOfWeek: day, shift: 'afternoon' })
    }
    setRows(sortScheduleRows(next))
  }

  const selectFullWeekPreset = () => {
    const next: ScheduleEditRow[] = []
    for (let day = 0; day <= 6; day += 1) {
      for (const shift of SCHEDULE_SHIFT_OPTIONS) next.push({ dayOfWeek: day, shift: shift.value })
    }
    setRows(sortScheduleRows(next))
  }

  const handleSave = async () => {
    if (!trainerId) return
    const valid = rows.filter((r) => r.dayOfWeek !== undefined && r.shift)
    if (valid.length === 0) {
      message.warning('Thêm ít nhất 1 ca làm việc')
      return
    }
    setSaving(true)
    try {
      await trainerScheduleService.setSchedule(trainerId, sortScheduleRows(rows))
      message.success('Đã lưu lịch làm việc')
      onSaved()
      onClose()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`Cập nhật lịch làm việc - ${trainerName}`}
      open={open}
      onOk={handleSave}
      onCancel={onClose}
      okText="Lưu"
      cancelText="Hủy"
      width={720}
      confirmLoading={saving}
      destroyOnClose
    >
      <p className="mb-3 text-xs text-[var(--gs-text-muted)]">
        Thiết lập ca làm việc cố định theo tuần. PT chỉ được phân công buổi tập nằm trong các ca này.
      </p>
      <div className="space-y-3 max-h-[500px] overflow-auto">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2 rounded-xl border border-[var(--theme-border)] p-3">
            <Select
              style={{ width: 130 }}
              value={row.dayOfWeek}
              onChange={(v) => updateRow(i, 'dayOfWeek', v)}
              options={DAY_LABELS.map((l, idx) => ({ label: l, value: idx }))}
              size="small"
            />
            <Select
              style={{ width: 150 }}
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
            {rows.length > 1 && (
              <Button size="small" danger onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}>X</Button>
            )}
          </div>
        ))}
        <Button type="dashed" block loading={loading} onClick={() => setRows((prev) => [...prev, { dayOfWeek: 1, shift: 'morning', startTime: undefined, endTime: undefined }])}>
          + Thêm ca
        </Button>
      </div>
    </Modal>
  )
}

function ScheduleEditorModalV2({
  trainerId,
  trainerName,
  open,
  onClose,
  onSaved,
}: {
  trainerId: string
  trainerName: string
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [rows, setRows] = useState<ScheduleEditRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !trainerId) return
    let cancelled = false
    setLoading(true)
    trainerScheduleService.getTrainerSchedule(trainerId)
      .then((res) => {
        if (cancelled) return
        const existing = (res.data.schedules || []).map((s) => ({
          dayOfWeek: s.dayOfWeek,
          shift: s.shift,
          startTime: s.startTime || undefined,
          endTime: s.endTime || undefined,
        }))
        setRows(sortScheduleRows(existing))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, trainerId])

  const isSelected = (dayOfWeek: number, shift: string) =>
    rows.some((item) => item.dayOfWeek === dayOfWeek && item.shift === shift)

  const toggleShift = (dayOfWeek: number, shift: string) => {
    setRows((prev) => {
      const exists = prev.some((item) => item.dayOfWeek === dayOfWeek && item.shift === shift)
      if (exists) return sortScheduleRows(prev.filter((item) => !(item.dayOfWeek === dayOfWeek && item.shift === shift)))
      return sortScheduleRows([...prev, { dayOfWeek, shift }])
    })
  }

  const selectWeekdayPreset = () => {
    const next: ScheduleEditRow[] = []
    for (let day = 1; day <= 5; day += 1) {
      next.push({ dayOfWeek: day, shift: 'morning' }, { dayOfWeek: day, shift: 'afternoon' })
    }
    setRows(sortScheduleRows(next))
  }

  const selectFullWeekPreset = () => {
    const next: ScheduleEditRow[] = []
    for (let day = 0; day <= 6; day += 1) {
      for (const shift of SCHEDULE_SHIFT_OPTIONS) next.push({ dayOfWeek: day, shift: shift.value })
    }
    setRows(sortScheduleRows(next))
  }

  const handleSave = async () => {
    if (!trainerId) return
    setSaving(true)
    try {
      await trainerScheduleService.setSchedule(trainerId, sortScheduleRows(rows))
      message.success('Đã lưu lịch làm việc')
      onSaved()
      onClose()
    } catch (err: any) {
      const affectedSchedules = err?.response?.data?.affectedSchedules || []
      if (affectedSchedules.length > 0) {
        showAffectedScheduleWarning(affectedSchedules)
        return
      }
      message.error(err?.response?.data?.message || 'Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`Cập nhật lịch làm việc - ${trainerName}`}
      open={open}
      onOk={handleSave}
      onCancel={onClose}
      okText="Lưu lịch"
      cancelText="Hủy"
      width={920}
      confirmLoading={saving}
      destroyOnClose
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--gs-card)] p-4">
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--gs-text-muted)]">Lịch làm việc hằng tuần</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-[var(--gs-text)]">PT: {trainerName || 'PT'}</div>
              <p className="mt-1 text-xs text-[var(--gs-text-muted)]">
                Các ca được chọn sẽ trở thành lịch làm việc mặc định hằng tuần của PT.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-2 text-right">
              <div className="text-xs text-[var(--gs-text-muted)]">Tổng số ca</div>
              <div className="text-xl font-bold text-[var(--theme-accent)]">{rows.length} ca/tuần</div>
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
              <Button size="small" danger onClick={() => setRows([])}>Xóa hết</Button>
            </div>
          </div>
        </div>

        <div className="grid max-h-[58vh] grid-cols-1 gap-3 overflow-auto pr-1 md:grid-cols-2">
          {SCHEDULE_DAY_LABELS.map((dayLabel, dayOfWeek) => (
            <div key={dayOfWeek} className="rounded-2xl border border-[var(--theme-border)] bg-[var(--gs-card)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-semibold text-[var(--gs-text)]">{dayLabel}</span>
                <span className="text-xs text-[var(--gs-text-muted)]">
                  {rows.filter((item) => item.dayOfWeek === dayOfWeek).length} ca
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {SCHEDULE_SHIFT_OPTIONS.map((shift) => {
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
          <span className="text-sm text-[var(--gs-text-muted)]">Đã chọn <strong className="text-[var(--theme-accent)]">{rows.length}</strong> ca làm việc</span>
          <span className="text-xs text-[var(--gs-text-muted)]">Sáng 06:00-12:00 • Chiều 12:00-18:00 • Tối 18:00-22:00</span>
        </div>

        {loading && <div className="text-xs text-[var(--gs-text-muted)]">Đang tải lịch hiện tại...</div>}
      </div>
    </Modal>
  )
}

function SchedulesModal({
  open,
  onClose,
  initialTrainerId,
}: {
  open: boolean
  onClose: () => void
  initialTrainerId?: string
}) {
  const [trainers, setTrainers] = useState<any[]>([])
  const [selectedTrainer, setSelectedTrainer] = useState<string>(initialTrainerId || '')
  const [selectedTrainerName, setSelectedTrainerName] = useState<string>('')
  const [schedules, setSchedules] = useState<TrainerSchedule[]>([])
  const [classSchedules, setClassSchedules] = useState<TrainingClass[]>([])
  const [loading, setLoading] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)

  useEffect(() => {
    trainerService.getPTs({ pageSize: 100 })
      .then((ptRes) => { setTrainers(ptRes.data?.pts || []) })
  }, [])

  useEffect(() => {
    if (initialTrainerId) setSelectedTrainer(initialTrainerId)
  }, [initialTrainerId])

  useEffect(() => {
    if (!open) { setSelectedTrainer(initialTrainerId || ''); setSelectedTrainerName(''); setSchedules([]); setClassSchedules([]) }
  }, [open])

  const loadData = async (trainerId: string) => {
    if (!trainerId) { setSchedules([]); setClassSchedules([]); return }
    setLoading(true)
    try {
      const res = await trainerScheduleService.getTrainerSchedule(trainerId)
      setSchedules(res.data.schedules || [])
      setClassSchedules(res.data.classSchedules || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { loadData(selectedTrainer) }, [selectedTrainer])

  const handleSelectTrainer = (id: string) => {
    setSelectedTrainer(id)
    const t = trainers.find((tr) => tr._id === id)
    setSelectedTrainerName(t ? getUserDisplayName(t, 'PT') : '')
  }

  const groupedSchedules = schedules.reduce<Record<string, TrainerSchedule[]>>((acc, s) => {
    const key = s.dayOfWeek.toString()
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  const groupedClasses = classSchedules.reduce<Record<string, TrainingClass[]>>((acc, c) => {
    for (const d of c.daysOfWeek) {
      const key = d.toString()
      if (!acc[key]) acc[key] = []
      acc[key].push(c)
    }
    return acc
  }, {})

  return (
    <Modal
      title={`Lịch làm việc${selectedTrainerName ? ` - ${selectedTrainerName}` : ''}`}
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={1200}
      destroyOnClose
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          style={{ width: 300 }}
          placeholder="Chọn PT"
          value={selectedTrainer || undefined}
          onChange={handleSelectTrainer}
          loading={loading}
          options={trainers.map((t: any) => ({ label: getUserDisplayName(t, 'PT'), value: t._id }))}
        />
        {selectedTrainer && (
          <Button type="primary" onClick={() => setEditorOpen(true)}>
            Cập nhật lịch làm việc
          </Button>
        )}
      </div>
      {!selectedTrainer ? (
        <p className="text-sm text-[var(--gs-text-muted)]">Chọn một PT để xem lịch làm việc</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 7 }, (_, i) => i).map((day) => {
            const daySchedules = groupedSchedules[day.toString()] || []
            const dayClasses = groupedClasses[day.toString()] || []
            return (
              <div key={day} className="rounded-xl border border-[var(--theme-border)] bg-[var(--gs-card)] p-3">
                <div className="font-semibold text-sm text-[var(--gs-text)] mb-2">{DAY_LABELS[day]}</div>
                {daySchedules.length === 0 ? (
                  <span className="text-xs text-[var(--gs-text-muted)]">Nghỉ</span>
                ) : (
                  <div className="space-y-1 mb-2">
                    {daySchedules.map((s) => (
                      <div key={s._id} className="flex items-center gap-2 text-xs text-[var(--gs-text)]">
                        <TagBadge color="blue">{SHIFT_LABELS[s.shift] || s.shift}</TagBadge>
                        {s.startTime && s.endTime && <span>{s.startTime.slice(0, 5)}-{s.endTime.slice(0, 5)}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {dayClasses.length > 0 && (
                  <div className="border-t border-[var(--gs-border)] pt-2 space-y-2">
                    {dayClasses.map((c, idx) => {
                      const cls = c as any
                      const floor = cls.floorId as any
                      const zone = cls.zoneId as any
                      const loc = floor?.name
                        ? `${floor.name}${zone?.name ? ` - ${zone.name}` : ''}`
                        : ''
                      const maxCap = zone?.maxCapacity || 0
                      const booked = cls.currentActiveCount || 0
                      const pct = maxCap > 0 ? (booked / maxCap) * 100 : 0
                      let bookColor = 'text-[var(--gs-text-muted)]'
                      let fullTag = null
                      if (maxCap > 0) {
                        if (pct >= 100) { bookColor = 'text-red-600'; fullTag = <span className="ml-1 text-[10px] font-semibold text-red-600">[Đầy]</span> }
                        else if (pct >= 80) { bookColor = 'text-orange-500' }
                      }
                      return (
                        <div key={`class-${idx}`} className="mb-2">
                          <div className="flex items-center gap-2 text-xs text-[var(--gs-text)] whitespace-nowrap">
                            <span className="inline-flex items-center shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]">
                              Lớp
                            </span>
                            <span className="font-medium min-w-0 truncate">{cls.name}</span>
                            <span className="shrink-0">{cls.startTime?.slice(0, 5)}-{cls.endTime?.slice(0, 5)}</span>
                            {loc && <span className="shrink-0 text-[var(--gs-text-muted)]">{loc}</span>}
                          </div>
                          {maxCap > 0 && (
                            <div className={`mt-0.5 text-[11px] ${bookColor}`}>
                              👥 Đã book: {booked} / {maxCap} hội viên{fullTag}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {selectedTrainer && (
        <ScheduleEditorModalV2
          trainerId={selectedTrainer}
          trainerName={selectedTrainerName}
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          onSaved={() => loadData(selectedTrainer)}
        />
      )}
    </Modal>
  )
}

