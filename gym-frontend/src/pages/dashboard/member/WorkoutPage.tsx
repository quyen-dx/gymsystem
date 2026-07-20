import { EnvironmentOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Empty, Modal, Select, Spin, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useCallback, useEffect, useMemo, useState } from 'react'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import MembershipRequired from '../../../components/membership/MembershipRequired'
import { useAuth } from '../../../hooks/useAuth'
import { membershipService } from '../../../services/membershipService'
import { scheduleService } from '../../../services/scheduleService'
import { getUserDisplayName } from '../../../utils/userDisplay'
import type { WorkoutSchedule, ScheduleSession } from '../../../services/workoutService'

const badgeForDate = (date: dayjs.Dayjs): { label: string; color: string } => {
  const today = dayjs().startOf('day')
  if (date.isSame(today, 'day')) return { label: 'Hôm nay', color: 'blue' }
  if (date.isAfter(today)) return { label: 'Sắp tới', color: 'default' }
  return { label: 'Đã qua', color: 'default' }
}

const MobileCard = ({ row, onDetail }: { row: ScheduleRow; onDetail: (r: ScheduleRow) => void }) => {
  const badge = badgeForDate(row.date)
  return (
    <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-4 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-[var(--gs-text)]">{row.dayLabel}</span>
        <div className="flex items-center gap-2">
          {row.session.className ? <span className="text-xs text-[var(--gs-text-muted)]">{row.session.className}</span> : <span className="text-xs text-[var(--gs-text-muted)]">PT: {row.ptName}</span>}
          <Tag color={badge.color}>{badge.label}</Tag>
        </div>
      </div>
      <div className="space-y-2 text-xs text-[var(--gs-text-muted)]">
        <div className="flex items-start gap-2">
          <span className="w-20 shrink-0">Ngày</span>
          <span className="text-[var(--gs-text)]">{row.date.format('DD/MM/YYYY')}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="w-20 shrink-0">Thời gian</span>
          <span className="text-[var(--gs-text)]">{row.time} - {row.endTime}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="w-20 shrink-0">Địa điểm</span>
          <span className="text-[var(--gs-text)]">{row.location}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="w-20 shrink-0">PT</span>
          <span className="text-[var(--gs-text)]">{row.ptName}{row.isSwapOverride && <Tag className="ml-1 text-[10px]" color="orange">Đổi ca</Tag>}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="w-20 shrink-0">Buổi tập</span>
          <span className="font-medium text-[var(--gs-text)]">{row.title}</span>
        </div>
      </div>
      <Button type="primary" block size="small" onClick={() => onDetail(row)}>Xem chi tiết</Button>
    </div>
  )
}

const TIME_FILTERS = [
  { value: 'today', label: 'Hôm nay' },
  { value: '7days', label: '7 ngày tới' },
  { value: '30days', label: '30 ngày tới' },
  { value: 'all', label: 'Tất cả' },
]

type TimeFilter = 'today' | '7days' | '30days' | 'all'

const DAY_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

interface ScheduleRow {
  key: string
  stt: number
  date: dayjs.Dayjs
  dayLabel: string
  time: string
  endTime: string
  location: string
  ptName: string
  isSwapOverride: boolean
  title: string
  status: 'pending' | 'completed' | 'skipped'
  scheduleId: string
  session: ScheduleSession
  schedule: WorkoutSchedule
}

function ptDisplayName(schedule: WorkoutSchedule): string {
  const pt = (schedule.assignedBy as any)
  if (!pt) return 'PT của bạn'
  if (typeof pt === 'string') return 'PT'
  return getUserDisplayName(pt, 'PT của bạn')
}

export default function WorkoutPage() {
  const { user } = useAuth()
  const [membershipLoading, setMembershipLoading] = useState(true)
  const [canView, setCanView] = useState(false)
  const [planName, setPlanName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [schedules, setSchedules] = useState<WorkoutSchedule[]>([])
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today')
  const [detailSession, setDetailSession] = useState<ScheduleSession | null>(null)
  const [detailPtName, setDetailPtName] = useState<string>('')

  useEffect(() => {
    ;(async () => {
      if (!user?._id) return
      try {
        const res = await membershipService.getMyMembership()
        const membership = res.data.membership
        const cycle = res.data.cycle
        const statusOk = membership?.status === 'active' || membership?.status === 'pending_cancel'
        const pendingOk = cycle?.status === 'pending_initial_activation'
        const notExpired = statusOk ? Number(membership?.remainingDays || 0) > 0 : true
        const allowed = (statusOk || pendingOk) && notExpired
        setCanView(allowed)
        if (membership) {
          const name = membership.planNameVi || membership.plan?.nameVi || null
          setPlanName(name)
        }
      } catch {
        setCanView(false)
      } finally {
        setMembershipLoading(false)
      }
    })()
  }, [user?._id])

  const loadSchedules = useCallback(async () => {
    setLoading(true)
    try {
      const res = await scheduleService.getMySchedules()
      setSchedules(res.data.schedules || [])
    } catch {
      setSchedules([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?._id && canView) loadSchedules()
  }, [user?._id, canView, loadSchedules])

  const now = dayjs().startOf('day')

  const rows: ScheduleRow[] = useMemo(() => {
    const result: ScheduleRow[] = []

    for (const s of schedules) {
      if (s.status !== 'active') continue
      for (const session of s.sessions || []) {
        const d = dayjs(session.date)
        const overridePt = (session as any)._overridePtId
        result.push({
          key: `${s._id}-${session.dayOrder}`,
          stt: 0,
          date: d,
          dayLabel: DAY_LABELS[d.day()],
          time: session.time || '—',
          endTime: session.endTime || '—',
          location: session._overrideLocation || session.location || session.className || '—',
          ptName: (session as any)._isSwapOverride && overridePt
            ? getUserDisplayName(overridePt, 'PT thay thế')
            : ptDisplayName(s),
          isSwapOverride: !!(session as any)._isSwapOverride,
          title: session.title || session.muscleGroup || 'Buổi tập',
          status: session.status,
          scheduleId: s._id,
          session,
          schedule: s,
        })
      }
    }

    const filtered = result.filter((r) => r.date.isAfter(now.subtract(1, 'day')))

    filtered.sort((a, b) => a.date.unix() - b.date.unix())

    return filtered.map((r, idx) => ({ ...r, stt: idx + 1 }))
  }, [schedules, now])

  const filteredRows = useMemo(() => {
    switch (timeFilter) {
      case 'today':
        return rows.filter((r) => r.date.isSame(now, 'day'))
      case '7days':
        return rows.filter((r) => r.date.isBefore(now.add(7, 'day')))
      case '30days':
        return rows.filter((r) => r.date.isBefore(now.add(30, 'day')))
      case 'all':
      default:
        return rows
    }
  }, [rows, timeFilter, now])

  const noSessionToday = timeFilter === 'today' && filteredRows.length === 0 && rows.length > 0

  const openDetail = (row: ScheduleRow) => {
    setDetailSession(row.session)
    setDetailPtName(row.ptName)
  }

  const columns: ColumnsType<ScheduleRow> = [
    { title: 'STT', width: 52, align: 'center', render: (_, r) => <span className="font-medium text-[var(--gs-text)]">{r.stt}</span> },
    { title: 'Ngày', width: 90, render: (_, r) => <span className="text-[var(--gs-text)]">{r.date.format('DD/MM')}</span> },
    { title: 'Thứ', width: 80, render: (_, r) => <span className="text-[var(--gs-text)]">{r.dayLabel}</span> },
    { title: 'Giờ bắt đầu', width: 90, render: (_, r) => <span className="text-[var(--gs-text-muted)]">{r.time}</span> },
    { title: 'Giờ kết thúc', width: 90, render: (_, r) => <span className="text-[var(--gs-text-muted)]">{r.endTime}</span> },
    {
      title: 'Địa điểm', width: 120, ellipsis: true,
      render: (_, r) =>
        r.location !== '—'
          ? <span className="flex items-center gap-1 text-xs text-[var(--gs-text)]"><EnvironmentOutlined className="text-[var(--theme)]" />{r.location}</span>
          : <span className="text-[var(--gs-text-muted)]">—</span>,
    },
    { title: 'PT phụ trách', width: 140, ellipsis: true, 
      render: (_, r) => (
        <span className="text-[var(--gs-text)]">
          {r.ptName}
          {r.isSwapOverride && <Tag className="ml-1 text-[10px] leading-none" color="orange" style={{ fontSize: 10, lineHeight: '16px' }}>Đổi ca</Tag>}
        </span>
      ),
    },
    { title: 'Buổi tập', width: 140, render: (_, r) => <span className="font-medium text-[var(--gs-text)]">{r.title}</span> },
    {
      title: 'Chi tiết', width: 80, align: 'center',
      render: (_, r) => <Button type="link" size="small" onClick={() => openDetail(r)}>Xem</Button>,
    },
  ]

  return (
    <MemberLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        {membershipLoading ? (
          <div className="text-sm text-[var(--gs-text-muted)]">Đang kiểm tra thông tin gói tập...</div>
        ) : !canView ? (
          <MembershipRequired planName={planName} featureLabel="xem lịch tập" />
        ) : (
          <>
            <div className="mb-5 flex items-start justify-between max-[767px]:flex-col max-[767px]:gap-3">
              <div>
                <h1 className="text-xl font-bold text-[var(--gs-text)] max-[767px]:text-lg">Lịch tập của tôi</h1>
                <p className="mt-0.5 text-sm text-[var(--gs-text-muted)]">Thời khóa biểu tập luyện</p>
              </div>
              <div className="flex items-center gap-3 max-[767px]:w-full max-[767px]:flex-col max-[767px]:gap-2">
                <Select value={timeFilter} onChange={setTimeFilter} options={TIME_FILTERS} className="max-[767px]:!w-full" style={{ width: 150 }} size="middle" />
                <Button icon={<ReloadOutlined />} onClick={loadSchedules} loading={loading} className="max-[767px]:w-full max-[767px]:min-h-[44px]">Tải lại</Button>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center"><Spin size="large" /></div>
            ) : rows.length === 0 ? (
              <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-[var(--gs-border)] bg-[var(--gs-card)] p-8">
                <Empty description="Bạn chưa có lịch tập. Hãy liên hệ PT để được tạo lịch nhé!" />
              </div>
            ) : (
              <>
              <div className="workout-table-desktop rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)]">
                <Table
                  dataSource={filteredRows}
                  columns={columns}
                  pagination={false}
                  rowKey="key"
                  size="middle"
                  locale={{
                    emptyText: noSessionToday ? (
                      <div className="py-6 text-center">
                        <p className="text-sm text-[var(--gs-text-muted)]">
                          Hôm nay bạn không có lịch tập.
                        </p>
                        {rows.length > 0 && (
                          <Button
                            type="link"
                            size="small"
                            className="mt-1"
                            onClick={() => setTimeFilter('7days')}
                          >
                            Xem buổi gần nhất →
                          </Button>
                        )}
                      </div>
                    ) : (
                      'Không có buổi tập nào'
                    ),
                  }}
                  scroll={{ x: 700 }}
                />
                  <div className="border-t border-[var(--gs-border)] px-4 py-2.5 text-sm text-[var(--gs-text-muted)]">
                    Đang xem 1-{filteredRows.length} / {rows.length} buổi
                  </div>
                </div>
              <div className="workout-cards-mobile space-y-3">
                {filteredRows.length > 0 ? (
                  filteredRows.map((row) => (
                    <MobileCard key={row.key} row={row} onDetail={openDetail} />
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-[var(--gs-border)] bg-[var(--gs-card)] p-8 text-center">
                    <p className="text-sm text-[var(--gs-text-muted)]">Không có buổi tập nào</p>
                  </div>
                )}
              </div>
              </>
            )}
          </>
        )}
      </div>

      <Modal
        title={null}
        open={!!detailSession}
        onCancel={() => setDetailSession(null)}
        footer={null}
        width={560}
        destroyOnClose
      >
        {detailSession && (
          <div className="space-y-5">
            {/* Header: date, time, location, PT */}
            <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-4">
              <h3 className="text-lg font-bold text-[var(--gs-text)]">
                {detailSession.title || detailSession.muscleGroup || 'Buổi tập'}
              </h3>
              <div className="mt-3 space-y-1.5 text-sm">
                {detailSession.date && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[var(--gs-text-soft)] w-24 shrink-0">Ngày</span>
                    <span className="text-[var(--gs-text)]">{dayjs(detailSession.date).format('DD/MM/YYYY')} — {DAY_LABELS[dayjs(detailSession.date).day()]}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--gs-text-soft)] w-24 shrink-0">Giờ tập</span>
                  <span className="text-[var(--gs-text)]">
                    {detailSession.time || '—'}{detailSession.endTime ? ` → ${detailSession.endTime}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--gs-text-soft)] w-24 shrink-0">Địa điểm</span>
                  <span className="flex items-center gap-1 text-[var(--gs-text)]">
                    <EnvironmentOutlined className="text-[var(--theme)]" />
                    {detailSession.location || detailSession.className || '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--gs-text-soft)] w-24 shrink-0">PT phụ trách</span>
                  <span className="text-[var(--gs-text)]">{detailPtName || '—'}</span>
                </div>
              </div>
              {detailSession.feedback && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card-soft)] px-3 py-2">
                  <span className="text-xs font-medium text-[var(--gs-text-soft)] w-24 shrink-0 pt-0.5">Ghi chú</span>
                  <span className="text-sm italic text-[var(--gs-text-muted)]">{detailSession.feedback}</span>
                </div>
              )}
            </div>

            {/* Exercise list — read only */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-[var(--gs-text)]">Danh sách bài tập</h4>
              {(!detailSession.exercises || detailSession.exercises.length === 0) ? (
                <p className="text-sm italic text-[var(--gs-text-muted)]">Chưa có bài tập nào</p>
              ) : (
                detailSession.exercises.map((ex: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] px-4 py-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--theme-accent)]/10 text-xs font-bold text-[var(--theme)]">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-[var(--gs-text)]">{ex.name}</span>
                      {ex.note && <span className="ml-2 text-xs text-[var(--gs-text-muted)]">{ex.note}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>

            {detailSession.feedback && (
              <div className="flex items-start gap-2 rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card-soft)] px-3 py-2">
                <span className="text-xs font-medium text-[var(--gs-text-soft)] w-24 shrink-0 pt-0.5">Ghi chú PT</span>
                <span className="text-sm italic text-[var(--gs-text-muted)]">{detailSession.feedback}</span>
              </div>
            )}
          </div>
        )}
      </Modal>
    </MemberLayout>
  )
}
