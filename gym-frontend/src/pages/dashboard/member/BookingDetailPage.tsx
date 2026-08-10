import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { message as antdMessage } from 'antd'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { bookingService } from '../../../services/bookingService'
import { membershipService } from '../../../services/membershipService'
import { trainerService } from '../../../services/trainerService'
import type { PT } from '../../../types/admin/trainer'
import { getUserDisplayName } from '../../../utils/userDisplay'

const DAY_OPTIONS = [
  { value: 1, label: 'Thứ 2' },
  { value: 2, label: 'Thứ 3' },
  { value: 3, label: 'Thứ 4' },
  { value: 4, label: 'Thứ 5' },
  { value: 5, label: 'Thứ 6' },
  { value: 6, label: 'Thứ 7' },
  { value: 0, label: 'Chủ nhật' },
]

const TIME_PRESETS = [
  { label: '06:00-08:00', shift: 'morning' as const },
  { label: '08:00-10:00', shift: 'morning' as const },
  { label: '10:00-12:00', shift: 'morning' as const },
  { label: '12:00-14:00', shift: 'afternoon' as const },
  { label: '14:00-16:00', shift: 'afternoon' as const },
  { label: '16:00-18:00', shift: 'afternoon' as const },
  { label: '18:00-20:00', shift: 'evening' as const },
  { label: '20:00-22:00', shift: 'evening' as const },
]

const WEEKS_OPTIONS = [1, 2, 3, 4, 8, 12]

function toMinutes(t: string): number {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

interface ScheduleWindow {
  dayOfWeek: number
  start: string
  end: string
}

// Member KHÔNG thấy ca làm việc — chỉ thấy khung giờ tập (slot) nằm trong lịch làm việc của PT
function getDayWindows(schedules: { dayOfWeek: number; shift: string; startTime?: string; endTime?: string }[]): Map<number, ScheduleWindow[]> {
  const SHIFT_FALLBACK: Record<string, [string, string]> = {
    morning: ['06:00', '12:00'],
    afternoon: ['12:00', '18:00'],
    evening: ['18:00', '22:00'],
  }
  const map = new Map<number, ScheduleWindow[]>()
  for (const s of schedules) {
    const [start, end] = SHIFT_FALLBACK[s.shift] || ['', '']
    const window = {
      dayOfWeek: s.dayOfWeek,
      start: s.startTime || start,
      end: s.endTime || end,
    }
    if (!map.has(s.dayOfWeek)) map.set(s.dayOfWeek, [])
    map.get(s.dayOfWeek)!.push(window)
  }
  return map
}

function presetFitsWindow(presetStart: string, presetEnd: string, window: ScheduleWindow): boolean {
  return toMinutes(presetStart) >= toMinutes(window.start) && toMinutes(presetEnd) <= toMinutes(window.end)
}

function slotsOverlap(a: string, b: string): boolean {
  const parse = (s: string) => {
    const [start, end] = String(s || '').split('-')
    return [toMinutes(start), toMinutes(end)]
  }
  const [as, ae] = parse(a)
  const [bs, be] = parse(b)
  if (!ae || !be) return true
  return as < be && bs < ae
}

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function nextDatesForDay(dayOfWeek: number, weeks: number): Date[] {
  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const currentDay = today.getDay()
  let diff = dayOfWeek - currentDay
  if (diff < 0) diff += 7
  const dates: Date[] = []
  for (let w = 0; w < weeks; w++) {
    const target = new Date(today)
    target.setDate(today.getDate() + diff + w * 7)
    dates.push(target)
  }
  return dates
}

function isSlotBusyForDay(pt: PT, day: number, slot: string, weeks: number): boolean {
  const busy = pt.busyBookings || []
  if (!busy.length) return false
  const keys = new Set(nextDatesForDay(day, weeks).map(toLocalDateKey))
  return busy.some((b) => {
    try {
      return keys.has(toLocalDateKey(new Date(b.date))) && slotsOverlap(slot, b.slot)
    } catch {
      return false
    }
  })
}

export default function BookingDetailPage() {
  const { ptId } = useParams()
  const navigate = useNavigate()

  const [pt, setPt] = useState<PT | null>(null)
  // Mỗi ngày chọn 1 khung giờ riêng { day -> slot }
  const [daySlots, setDaySlots] = useState<Record<number, string>>({})
  const [weeks, setWeeks] = useState(1)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  const [membershipInfo, setMembershipInfo] = useState<{
    planName: string
    remainingSessions: number
  } | null>(null)

  const dayWindows = useMemo(() => {
    if (!pt?.schedules) return new Map<number, ScheduleWindow[]>()
    return getDayWindows(pt.schedules)
  }, [pt?.schedules])

  const workingDays = useMemo(() => new Set(dayWindows.keys()), [dayWindows])

  const selectedDays = Object.keys(daySlots).map(Number).sort((a, b) => a - b)

  // 1 cặp (ngày, khung giờ) cụ thể có khả dụng không
  const slotEnabledForDay = (day: number, slot: string): boolean => {
    const [start, end] = slot.split('-')
    const windows = dayWindows.get(day)
    const fitsSchedule = !windows || windows.some((w) => presetFitsWindow(start, end, w))
    if (!fitsSchedule) return false
    return !isSlotBusyForDay(pt, day, slot, weeks)
  }

  const slotDisabledReasonForDay = (day: number, slot: string): string | null => {
    if (!pt) return null
    const [start, end] = slot.split('-')
    const windows = dayWindows.get(day)
    const fitsSchedule = !windows || windows.some((w) => presetFitsWindow(start, end, w))
    if (!fitsSchedule) return 'Không nằm trong lịch làm việc của PT'
    if (isSlotBusyForDay(pt, day, slot, weeks)) return 'PT đã có lịch bận vào ngày này'
    return null
  }

  // Khi đổi PT/số tuần → bỏ các cặp ngày/giờ không còn khả dụng
  useEffect(() => {
    setDaySlots((prev) => {
      let changed = false
      const next: Record<number, string> = {}
      for (const [dayStr, slot] of Object.entries(prev)) {
        const day = Number(dayStr)
        if (!slotEnabledForDay(day, slot)) changed = true
        else next[day] = slot
      }
      return changed ? next : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pt, weeks, dayWindows])

  const loadPT = async () => {
    if (!ptId) return
    try {
      const res = await trainerService.getAvailablePTById(ptId)
      setPt(res.data?.pt || res.data)
    } catch {
      antdMessage.error('Không thể tải thông tin PT')
    }
  }

  const loadMembership = async () => {
    try {
      const res = await membershipService.getMyMembership()
      const m = res.data.membership
      if (m) {
        const name = m.planNameVi || m.plan?.nameVi || 'Gói PT'
        setMembershipInfo({
          planName: name,
          remainingSessions: m.remainingSessions ?? m.remainingDays ?? 0,
        })
      }
    } catch {
      // not critical
    }
  }

  const handleDayToggle = (day: number) => {
    if (!workingDays.has(day)) return
    setDaySlots((prev) => {
      if (prev[day]) {
        const next = { ...prev }
        delete next[day]
        return next
      }
      return prev
    })
  }

  const toggleDaySlot = (day: number, slot: string) => {
    if (!slotEnabledForDay(day, slot)) {
      antdMessage.warning(slotDisabledReasonForDay(day, slot) || 'Khung giờ này không khả dụng cho ngày đã chọn.')
      return
    }
    setDaySlots((prev) => {
      if (prev[day] === slot) {
        const next = { ...prev }
        delete next[day]
        return next
      }
      return { ...prev, [day]: slot }
    })
  }

  const handleCreateBooking = async () => {
    if (!ptId) return

    if (selectedDays.length === 0) {
      antdMessage.error('Vui lòng chọn ít nhất 1 thứ trong tuần')
      return
    }
    if (!Object.values(daySlots).some(Boolean)) {
      antdMessage.error('Vui lòng chọn khung giờ cho các ngày đã chọn')
      return
    }

    try {
      setLoading(true)
      const res = await bookingService.scheduleWeekly({
        ptId,
        daySlots: selectedDays.map((day) => ({ day, slot: daySlots[day] })),
        weeks,
        note,
      })

      const created = res.data.createdCount || 0
      const errors = res.data.errors || []
      let msg = `Gửi yêu cầu đăng ký lịch tập thành công (${created} buổi trong ${weeks} tuần)`
      if (errors.length > 0) msg += `. ${errors.length} buổi bị trùng lịch`
      antdMessage.success(msg)
      setTimeout(() => navigate('/booking'), 1500)
    } catch (error: any) {
      antdMessage.error(error?.response?.data?.message || 'Đăng ký lịch thất bại')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPT()
    loadMembership()
  }, [ptId])

  return (
    <MemberLayout>
      <div className="member-page space-y-6">
        <button
          type="button"
          onClick={() => navigate('/booking')}
          className="rounded-xl border border-[var(--theme-border)] px-4 py-2 text-sm text-[var(--theme-text)] hover:bg-white/10"
        >
          ← Quay lại danh sách PT
        </button>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Left column — PT info */}
          <div className="rounded-[24px] border border-[var(--theme-border)] bg-white/5 p-6">
            <h1 className="text-2xl font-bold text-[var(--theme-text)]">
              Thông tin PT
            </h1>

            {pt ? (
              <div className="mt-5">
                <div className="flex items-center gap-4">
                  <img
                    src={pt.avatar || '/default-avatar.png'}
                    alt={getUserDisplayName(pt, 'PT')}
                    className="h-24 w-24 rounded-2xl object-cover"
                  />
                  <div>
                    <h2 className="text-xl font-bold text-[var(--theme-text)]">
                      {getUserDisplayName(pt, 'PT')}
                    </h2>
                    <p className="mt-1 text-sm text-yellow-400">
                      ⭐ {pt.rating || 0} / 5
                    </p>
                    <p className="mt-1 text-sm text-[var(--theme-muted)]">
                      {pt.experienceYears || 0} năm kinh nghiệm
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-sm font-semibold text-[var(--theme-text)]">
                    Chuyên môn
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pt.specialties?.length ? (
                      pt.specialties.map((item) => (
                        <span
                          key={item}
                          className="rounded-full bg-[var(--theme-accent-muted)] px-3 py-1 text-xs text-[var(--theme-accent)]"
                        >
                          {item}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-[var(--theme-muted)]">
                        Chưa cập nhật
                      </span>
                    )}
                  </div>
                </div>

                <p className="mt-5 text-sm leading-6 text-[var(--theme-muted)]">
                  {pt.bio || 'PT chưa cập nhật giới thiệu.'}
                </p>

                <div className="mt-6 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-accent-muted)]/20 p-4">
                  <h3 className="font-semibold text-[var(--theme-text)]">
                    Gói PT hiện tại của bạn
                  </h3>
                  <p className="mt-2 text-sm text-[var(--theme-muted)]">
                    {membershipInfo ? (
                      <>
                        <span className="font-medium text-[var(--theme-text)]">{membershipInfo.planName}</span>
                        {' — Còn lại: '}
                        <span className="font-bold text-[var(--theme-accent)]">{membershipInfo.remainingSessions} buổi</span>
                      </>
                    ) : (
                      'Đang tải thông tin gói tập...'
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-5 text-sm text-[var(--theme-muted)]">
                Đang tải thông tin PT...
              </p>
            )}
          </div>

          {/* Right column — Booking form */}
          <div className="rounded-[24px] border border-[var(--theme-border)] bg-white/5 p-6">
            <h1 className="text-2xl font-bold text-[var(--theme-text)]">
              Đăng ký lịch tập tuần
            </h1>

            <div className="mt-5 space-y-5">
              {/* Days of week */}
              <div>
                <label className="mb-2 block text-sm text-[var(--theme-muted)]">
                  Chọn thứ trong tuần — sau đó chọn khung giờ cho từng ngày
                </label>
                <div className="flex flex-wrap gap-3">
                  {DAY_OPTIONS.map((day) => {
                    const isWorking = workingDays.has(day.value)
                    const isSelected = selectedDays.includes(day.value)
                    return (
                      <button
                        key={day.value}
                        type="button"
                        disabled={!isWorking}
                        onClick={() => handleDayToggle(day.value)}
                        className={`rounded-xl border px-4 py-2 text-sm transition ${
                          !isWorking
                            ? 'cursor-not-allowed border-gray-700 bg-gray-800/50 text-gray-500 line-through'
                            : isSelected
                              ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)] text-[var(--theme-accent)]'
                              : 'border-[var(--theme-border)] text-[var(--theme-muted)] hover:bg-white/10'
                        }`}
                      >
                        {day.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Per-day time slot */}
              {selectedDays.length > 0 && (
                <div>
                  <label className="mb-2 block text-sm text-[var(--theme-muted)]">
                    Khung giờ cho từng ngày đã chọn <span className="text-xs">(chọn 1 khung giờ mỗi ngày)</span>
                  </label>
                  <div className="space-y-4">
                    {selectedDays.map((day) => {
                      const dayLabel = DAY_OPTIONS.find((x) => x.value === day)?.label || `Ngày ${day}`
                      return (
                        <div key={day} className="rounded-xl border border-[var(--theme-border)] bg-white/[0.03] p-3">
                          <p className="mb-2 text-xs font-semibold text-[var(--theme-accent)]">{dayLabel}</p>
                          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                            {TIME_PRESETS.map((t) => {
                              const disabled = !slotEnabledForDay(day, t.label)
                              const selected = daySlots[day] === t.label
                              const reason = disabled ? slotDisabledReasonForDay(day, t.label) : null
                              return (
                                <button
                                  key={t.label}
                                  type="button"
                                  disabled={disabled}
                                  title={reason || undefined}
                                  onClick={() => toggleDaySlot(day, t.label)}
                                  className={`rounded-lg border px-2 py-2 text-xs transition ${
                                    disabled
                                      ? 'cursor-not-allowed border-gray-700 bg-gray-800/50 text-gray-500 line-through'
                                      : selected
                                        ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)] text-[var(--theme-accent)]'
                                        : 'border-[var(--theme-border)] text-[var(--theme-muted)] hover:bg-white/10'
                                  }`}
                                >
                                  {t.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {selectedDays.length > 0 && (
                    <p className="mt-2 text-xs text-[var(--theme-muted)]">
                      Lịch đã chọn: {selectedDays.map((day) => `${DAY_OPTIONS.find((x) => x.value === day)?.label || day} ${daySlots[day] || '—'}`).join(', ')}
                    </p>
                  )}
                  {pt && (pt.busyBookings?.length || 0) > 0 && (
                    <p className="mt-2 text-xs text-[var(--theme-muted)]">
                      PT này có một số khung giờ đã được đặt trong thời gian bạn chọn — các khung đó đã bị khóa.
                    </p>
                  )}
                </div>
              )}

              {/* Weeks */}
              <div>
                <label className="mb-2 block text-sm text-[var(--theme-muted)]">
                  Thời lượng đăng ký (lặp lại hàng tuần)
                </label>
                <div className="flex flex-wrap gap-2">
                  {WEEKS_OPTIONS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setWeeks(w)}
                      className={`rounded-xl border px-4 py-2 text-sm transition ${
                        weeks === w
                          ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)] text-[var(--theme-accent)]'
                          : 'border-[var(--theme-border)] text-[var(--theme-muted)] hover:bg-white/10'
                      }`}
                    >
                      {w} tuần
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-[var(--theme-muted)]">
                  VD: chọn T2, T3 + 3 tuần → tạo lịch lặp lại T2, T3 mỗi tuần trong 3 tuần (6 buổi).
                </p>
              </div>

              {/* Note */}
              <div>
                <label className="mb-2 block text-sm text-[var(--theme-muted)]">
                  Ghi chú / Mục tiêu
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  placeholder="Nhập ghi chú hoặc mục tiêu tập luyện..."
                  className="w-full rounded-xl border border-[var(--theme-border)] bg-transparent p-3 text-[var(--theme-text)] outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleCreateBooking}
                disabled={loading || selectedDays.length === 0 || !Object.values(daySlots).some(Boolean)}
                className="w-full rounded-xl bg-[var(--theme-button-bg)] px-5 py-3 font-semibold text-white transition hover:bg-[var(--theme-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Đang xử lý...' : 'Xác nhận đăng ký lịch tập'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </MemberLayout>
  )
}
