import {
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
  Tooltip,
  message,
} from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { trainerService } from '../../../services/trainerService'
import { trainerScheduleService } from '../../../services/trainerScheduleService'
import { ptAssignmentEndService } from '../../../services/ptAssignmentEndService'
import { shiftChangeService } from '../../../services/shiftChangeService'
import { workoutService } from '../../../services/workoutService'
import { socketService } from '../../../services/socketService'
import type { PT } from '../../../types/admin/trainer'
import { getUserDisplayName } from '../../../utils/userDisplay'
import type { TrainingClass } from '../../../services/trainingGroupService'

const DAY_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

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
  const [pts, setPts] = useState<PT[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [specialtyFilter, setSpecialtyFilter] = useState<string | undefined>()

  const [schedulesOpen, setSchedulesOpen] = useState(false)
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
          <button type="button" onClick={() => setSchedulesOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--gs-card)] px-4 py-1.5 text-sm font-medium text-[var(--gs-text)] transition-all hover:bg-[var(--theme-accent)] hover:text-white">
            Xem lịch PT
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

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
        <div className="dashboard-filter-bar">
          <Input.Search placeholder="Tìm kiếm huấn luyện viên..." allowClear onSearch={handleSearch} style={{ maxWidth: 300 }} />
          <Select allowClear placeholder="Lọc theo chuyên môn" style={{ minWidth: 160 }} onChange={handleSpecialtyFilter}
            options={[
              { value: 'YOGA', label: 'YOGA' }, { value: 'GYM', label: 'GYM' },
              { value: 'BOXING', label: 'BOXING' }, { value: 'CROSSFIT', label: 'CROSSFIT' },
              { value: 'PILATES', label: 'PILATES' }, { value: 'ZUMBA', label: 'ZUMBA' },
              { value: 'PERSONAL TRAINING', label: 'PERSONAL TRAINING' },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/admin/trainers/create')}>Thêm huấn luyện viên</Button>
        </div>
        <div className="member-scroll-x">
          <Table dataSource={pts} columns={columns} rowKey="_id" loading={loading}
            pagination={{ total, current: page, pageSize: 15, onChange: (p) => { setPage(p); fetchPTs(p, search, specialtyFilter) } }} />
        </div>
      </div>

      {/* Modal: Lịch PT */}
      <SchedulesModal open={schedulesOpen} onClose={() => setSchedulesOpen(false)} />

    </DashboardLayout>
  )
}

function SchedulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [trainers, setTrainers] = useState<any[]>([])
  const [selectedTrainer, setSelectedTrainer] = useState<string>('')
  const [selectedTrainerName, setSelectedTrainerName] = useState<string>('')
  const [classSchedules, setClassSchedules] = useState<TrainingClass[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    trainerService.getPTs({ pageSize: 100 })
      .then((ptRes) => { setTrainers(ptRes.data?.pts || []) })
  }, [])

  const loadData = async (trainerId: string) => {
    if (!trainerId) { setClassSchedules([]); return }
    setLoading(true)
    try {
      const res = await trainerScheduleService.getTrainerSchedule(trainerId)
      setClassSchedules(res.data.classSchedules || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { loadData(selectedTrainer) }, [selectedTrainer])

  const handleSelectTrainer = (id: string) => {
    setSelectedTrainer(id)
    const t = trainers.find((tr) => tr._id === id)
    setSelectedTrainerName(t ? getUserDisplayName(t, 'PT') : '')
  }

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
      title={`Lịch dạy trong tuần${selectedTrainerName ? ` - ${selectedTrainerName}` : ''}`}
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={1200}
      destroyOnClose
    >
      <div className="mb-4">
        <Select
          style={{ width: 300 }}
          placeholder="Chọn PT"
          value={selectedTrainer || undefined}
          onChange={handleSelectTrainer}
          options={trainers.map((t: any) => ({ label: getUserDisplayName(t, 'PT'), value: t._id }))}
        />
      </div>
      {!selectedTrainer ? (
        <p className="text-sm text-[var(--gs-text-muted)]">Chọn một PT để xem lịch dạy</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 7 }, (_, i) => i).map((day) => {
            const dayClasses = groupedClasses[day.toString()] || []
            return (
              <div key={day} className="rounded-xl border border-[var(--theme-border)] bg-[var(--gs-card)] p-3">
                <div className="font-semibold text-sm text-[var(--gs-text)] mb-2">{DAY_LABELS[day]}</div>
                {dayClasses.length === 0 ? (
                  <span className="text-xs text-[var(--gs-text-muted)]">Nghỉ</span>
                ) : (
                  dayClasses.map((c, idx) => {
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
                  })
                )}
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

