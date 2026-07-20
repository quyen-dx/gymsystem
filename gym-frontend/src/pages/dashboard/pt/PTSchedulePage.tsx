import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, DatePicker, Empty, Input, List, Tag, message, Modal } from 'antd'
import { CheckCircleFilled, ClockCircleOutlined, LeftOutlined, RightOutlined, SwapOutlined, UserOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { trainerService, type WeekAttendee, type WeekAttendeeMember } from '../../../services/trainerService'
import { shiftSwapService } from '../../../services/shiftSwapService'
import { useTheme } from '../../../context/ThemeProvider'
import type { TrainingClass } from '../../../services/trainingGroupService'

function getFloorName(f: string | { _id: string; name: string } | undefined): string {
  if (!f) return ''
  return typeof f === 'object' ? f.name : ''
}
function getZoneName(z: string | { _id: string; name: string } | undefined): string {
  if (!z) return ''
  return typeof z === 'object' ? z.name : ''
}

const DAY_LABEL_MAP_VN = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']

export default function PTSchedulePage() {
  const { dark } = useTheme()
  const [classes, setClasses] = useState<TrainingClass[]>([])
  const [swapModalOpen, setSwapModalOpen] = useState(false)
  const [swapDate, setSwapDate] = useState<dayjs.Dayjs | null>(null)
  const [swapReason, setSwapReason] = useState('')
  const [swapSubmitting, setSwapSubmitting] = useState(false)
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set())

  const DAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']

  // Week picker: default to Monday of current week
  const [weekStart, setWeekStart] = useState(() => dayjs().startOf('week').add(1, 'day')) // Monday
  const [attendees, setAttendees] = useState<WeekAttendee[]>([])
  const [memberModal, setMemberModal] = useState<{ open: boolean; title: string; members: WeekAttendeeMember[] }>({ open: false, title: '', members: [] })

  const goPrevWeek = () => setWeekStart(prev => prev.subtract(7, 'day'))
  const goNextWeek = () => setWeekStart(prev => prev.add(7, 'day'))
  const goCurrentWeek = () => setWeekStart(dayjs().startOf('week').add(1, 'day'))

  const weekLabel = `${weekStart.format('DD/MM')} - ${weekStart.add(6, 'day').format('DD/MM/YYYY')}`
  const isCurrentWeek = weekStart.isSame(dayjs().startOf('week').add(1, 'day'), 'day')

  const loadClasses = async () => {
    try {
      const res = await trainerService.getPTMyClasses()
      const data = res.data?.classes || []
      setClasses(data)
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => { loadClasses() }, [])

  // Fetch attendees for the selected week
  const loadAttendees = useCallback(async () => {
    try {
      const res = await trainerService.getPTMyWeekAttendees(weekStart.format('YYYY-MM-DD'))
      setAttendees(res.data?.attendees || [])
    } catch {
      // silent
    }
  }, [weekStart])

  useEffect(() => { loadAttendees() }, [loadAttendees])

  // Build lookup: "dayOfWeek_classCode" -> WeekAttendee
  const attendeesMap = useMemo(() => {
    const map = new Map<string, WeekAttendee>()
    for (const a of attendees) {
      map.set(`${a.dayOfWeek}_${a.code}`, a)
    }
    return map
  }, [attendees])

  // Classes that fall on the selected date
  const dateClasses = useMemo(() => {
    if (!swapDate) return []
    const dow = swapDate.day()
    return classes
      .filter(c => c.daysOfWeek.includes(dow))
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
  }, [swapDate, classes])

  const toggleClass = (id: string) => {
    setSelectedClassIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const selectAll = () => setSelectedClassIds(new Set(dateClasses.map(c => c._id)))
  const deselectAll = () => setSelectedClassIds(new Set())

  const selectedCount = selectedClassIds.size
  const hasSelected = selectedCount > 0

  const handleSwapSubmit = async () => {
    if (!swapDate || !hasSelected) { message.warning('Vui lòng chọn ngày và ít nhất 1 ca'); return }
    setSwapSubmitting(true)
    try {
      await shiftSwapService.create({
        targetDate: swapDate.format('YYYY-MM-DD'),
        reason: swapReason,
        classIds: Array.from(selectedClassIds),
      })
      message.success('Đã gửi yêu cầu thay ca')
      setSwapModalOpen(false)
      resetForm()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Gửi yêu cầu thất bại')
    } finally {
      setSwapSubmitting(false)
    }
  }

  const resetForm = () => {
    setSwapDate(null)
    setSwapReason('')
    setSelectedClassIds(new Set())
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="rounded-[28px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-8 max-[640px]:p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">LỊCH PT</p>
          <div className="flex items-center justify-between mt-3">
            <h1 className="text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">Lịch làm việc</h1>
            <Button type="primary" icon={<SwapOutlined />} onClick={() => setSwapModalOpen(true)}>
              Yêu cầu thay ca
            </Button>
          </div>
          <p className="mt-2 text-sm text-[var(--gs-text-muted)]">Quản lý lịch làm việc hàng tuần</p>
        </div>

        <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-6">
          <div className="pt-schedule-header flex items-center justify-between max-[767px]:flex-col max-[767px]:items-start max-[767px]:gap-2 mb-4">
            <h2 className="pt-schedule-title text-lg font-semibold text-[var(--gs-text)] max-[767px]:text-lg">Lịch làm việc tuần</h2>
            <div className="pt-schedule-nav flex items-center gap-2 max-[767px]:w-full max-[767px]:justify-between">
              <Button size="small" icon={<LeftOutlined />} onClick={goPrevWeek} className="max-[767px]:min-h-[36px]" />
              <Button size="small" type={isCurrentWeek ? 'primary' : 'default'} onClick={goCurrentWeek} className="max-[767px]:min-h-[36px]">
                Tuần này
              </Button>
              <span className="pt-schedule-week-label text-sm text-[var(--gs-text-muted)] min-w-[130px] text-center max-[767px]:text-xs">{weekLabel}</span>
              <Button size="small" icon={<RightOutlined />} onClick={goNextWeek} className="max-[767px]:min-h-[36px]" />
            </div>
          </div>
          <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3">
            {DAYS.map((day, idx) => {
              const actualDate = weekStart.add(idx, 'day')
              const dateStr = actualDate.format('DD/MM')
              const dayClasses = classes
                .filter(c => c.daysOfWeek.includes(idx))
                .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
              return (
                <div key={idx} className="flex flex-col sm:flex-row gap-4 p-4 items-start rounded-lg border border-[var(--gs-border)]">
                  <div className="w-40 shrink-0">
                    <p className="text-lg font-bold text-slate-100">{day}</p>
                    <p className="text-xs text-[var(--gs-text-muted)]">{dateStr}</p>
                  </div>
                  <div className="flex-1 w-full">
                    {dayClasses.length === 0 ? (
                      <div className="border border-dashed border-zinc-800 rounded-lg p-4 text-center text-zinc-500 text-sm">🏝️ Không có lịch</div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {dayClasses.map((c, i) => {
                          const attendee = attendeesMap.get(`${idx}_${c.code || ''}`)
                          const count = attendee?.count ?? 0
                          return (
                            <div key={c._id}>
                              {i > 0 && <div className="border-t border-zinc-800 pt-4 mb-0" />}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <p className="font-bold text-green-500">{c.startTime || '--:--'} - {c.endTime || '--:--'}</p>
                                  <div
                                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors ${
                                      count > 0
                                        ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                                        : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                    }`}
                                    onClick={() => {
                                      if (count > 0 && attendee) {
                                        setMemberModal({ open: true, title: `[${c.code}] ${c.name} • ${day} ${dateStr} • ${c.startTime}-${c.endTime}`, members: attendee.members })
                                      }
                                    }}
                                  >
                                    <UserOutlined />
                                    <span>{count > 0 ? `${count} hội viên` : '0 hội viên'}</span>
                                  </div>
                                </div>
                                <p className="font-medium text-[var(--gs-text)]">[{c.code || '???'}] {c.name}</p>
                                <div className="flex items-center gap-2">
                                  <span className="inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                    style={{ background: dark ? 'rgba(182,70,47,0.2)' : 'rgba(182,70,47,0.12)', color: dark ? 'rgb(235,130,100)' : 'rgb(150,55,35)' }}>
                                    {c.specialization || 'GYM'}
                                  </span>
                                </div>
                                <p className="text-xs text-[var(--gs-text-muted)]">📍 {[getFloorName(c.floorId), getZoneName(c.zoneId)].filter(Boolean).join(' - ')}</p>
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
        </div>
      </div>

      <Modal
        title="Yêu cầu thay ca"
        open={swapModalOpen}
        onCancel={() => { setSwapModalOpen(false); resetForm() }}
        onOk={handleSwapSubmit}
        confirmLoading={swapSubmitting}
        okText="Gửi yêu cầu"
        okButtonProps={{ disabled: !swapDate || !hasSelected }}
        width={560}
      >
        <div className="space-y-4 pt-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--gs-text)]">Ngày cần thay ca</label>
            <DatePicker className="w-full" value={swapDate} onChange={(val) => { setSwapDate(val); setSelectedClassIds(new Set()) }}
              disabledDate={(d) => d.isBefore(dayjs(), 'day')} placeholder="Chọn ngày" />
          </div>

          {swapDate && dateClasses.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-[var(--gs-text)]">
                  Chọn ca cần đổi — {DAY_LABEL_MAP_VN[swapDate.day()]}, {swapDate.format('DD/MM/YYYY')}
                </label>
                <div className="flex gap-1">
                  <Button size="small" type="link" onClick={selectAll}>Chọn tất cả</Button>
                  <Button size="small" type="link" onClick={deselectAll}>Bỏ chọn</Button>
                </div>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {dateClasses.map(c => {
                  const loc = [getFloorName(c.floorId), getZoneName(c.zoneId)].filter(Boolean).join(' - ')
                  return (
                    <label key={c._id}
                      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        selectedClassIds.has(c._id)
                          ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)]'
                          : 'border-[var(--gs-border)] hover:border-[var(--theme-accent)]'
                      }`}
                    >
                      <Checkbox checked={selectedClassIds.has(c._id)} onChange={() => toggleClass(c._id)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--gs-text)]">
                            {c.startTime || '--:--'} - {c.endTime || '--:--'}
                          </span>
                          <Tag className="m-0 text-[11px]" color="blue">[{c.code || '???'}] {c.name}</Tag>
                        </div>
                        {loc && <p className="mt-0.5 text-xs text-[var(--gs-text-muted)]">📍 {loc}</p>}
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {swapDate && dateClasses.length === 0 && (
            <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card-soft)] px-3 py-2">
              <p className="text-xs text-[var(--gs-text-muted)]">Không có ca dạy nào vào ngày này.</p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--gs-text)]">Lý do <span className="text-[var(--gs-text-muted)] font-normal">(không bắt buộc)</span></label>
            <Input.TextArea rows={2} value={swapReason} onChange={e => setSwapReason(e.target.value)} placeholder="VD: Có việc cá nhân, sức khỏe..." />
          </div>

          {hasSelected && swapDate && (
            <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card-soft)] px-3 py-2">
              <p className="text-xs text-[var(--gs-text-muted)]">
                Hệ thống sẽ gửi yêu cầu đổi{' '}
                <strong className="text-[var(--gs-text)]">{selectedCount} ca</strong>{' '}
                ({dateClasses.filter(c => selectedClassIds.has(c._id)).map(c => `${c.startTime}-${c.endTime}, [${c.code}] ${c.name}`).join('; ')})
                {' '}vào {DAY_LABEL_MAP_VN[swapDate.day()]}, {swapDate.format('DD/MM/YYYY')} lên admin duyệt.
              </p>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        title={memberModal.title}
        open={memberModal.open}
        onCancel={() => setMemberModal(prev => ({ ...prev, open: false }))}
        footer={null}
        width={400}
      >
        {memberModal.members.length > 0 ? (
          <List
            dataSource={memberModal.members}
            renderItem={(m) => {
              const checkedIn = m.checkedIn
              const checkedInAt = m.checkedInAt
              return (
                <List.Item>
                  <div className="flex items-center gap-2 w-full">
                    <UserOutlined className="text-[var(--gs-text-muted)]" />
                    <span className="text-sm text-[var(--gs-text)]">{m.name}</span>
                    {m.memberCode && (
                      <span className="text-xs text-[var(--gs-text-muted)]">({m.memberCode})</span>
                    )}
                    <div className="ml-auto flex-shrink-0">
                      {checkedIn !== undefined ? (
                        checkedIn ? (
                          <Tag icon={<CheckCircleFilled />} color="success" className="m-0">
                            Đã check-in {checkedInAt ? ` ${new Date(checkedInAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : ''}
                          </Tag>
                        ) : (
                          <Tag icon={<ClockCircleOutlined />} color="default" className="m-0">
                            Chưa check-in
                          </Tag>
                        )
                      ) : (
                        <Tag color="default" className="m-0 text-[var(--gs-text-muted)]">-</Tag>
                      )}
                    </div>
                  </div>
                </List.Item>
              )
            }}
          />
        ) : (
          <Empty description="Không có hội viên" />
        )}
      </Modal>
      </div>
    </DashboardLayout>
  )
}
