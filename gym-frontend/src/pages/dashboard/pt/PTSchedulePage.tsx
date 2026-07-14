import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BellOutlined, RightOutlined } from '@ant-design/icons'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { bookingService } from '../../../services/bookingService'
import { useTheme } from '../../../context/ThemeProvider'
import { getUserDisplayName } from '../../../utils/userDisplay'

interface PTBooking {
  _id: string
  memberId: {
    _id: string
    name?: string
    fullName?: string
    displayName?: string
    email?: string
    avatar?: string
  }
  date: string
  slot: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  note?: string
}

interface PTScheduleData {
  dayOfWeek: number
  shift: string
}

const statusLabels: Record<string, string> = {
  pending: 'Chờ',
  confirmed: 'Xác nhận',
  completed: 'Hoàn thành',
  cancelled: 'Hủy',
}

export default function PTSchedulePage() {
  const navigate = useNavigate()
  const { dark } = useTheme()
  const [bookings, setBookings] = useState<PTBooking[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [schedules, setSchedules] = useState<PTScheduleData[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  const DAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']
  const SHIFTS = [
    { value: 'morning', label: '6h - 12h' },
    { value: 'afternoon', label: '12h - 18h' },
    { value: 'evening', label: '18h - 22h' },
  ]

  const loadBookings = async () => {
    try {
      setLoading(true)
      const res = await bookingService.getPTBookings({ filter: 'week' })
      let data = res.data?.data || res.data || []
      if (!Array.isArray(data)) data = []

      const filtered = data.filter((b: PTBooking) =>
        new Date(b.date).toDateString() === new Date(selectedDate).toDateString()
      )

      setBookings(filtered.sort((a: PTBooking, b: PTBooking) => a.slot.localeCompare(b.slot)))
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const loadPendingCount = async () => {
    try {
      const res = await bookingService.getPTBookings({ status: 'pending', from: 'today' })
      let data = res.data?.data || res.data || []
      if (!Array.isArray(data)) data = []
      setPendingCount(data.length)
    } catch (error) {
      console.error(error)
    }
  }

  const loadSchedule = async () => {
    try {
      setSchedules([
        { dayOfWeek: 1, shift: 'morning' },
        { dayOfWeek: 1, shift: 'afternoon' },
        { dayOfWeek: 3, shift: 'afternoon' },
        { dayOfWeek: 5, shift: 'evening' },
      ])
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    loadPendingCount()
  }, [])

  useEffect(() => {
    loadBookings()
  }, [selectedDate])

  useEffect(() => {
    loadSchedule()
  }, [])

  const selectedDateObj = new Date(selectedDate)
  const dayOfWeek = selectedDateObj.getDay()
  const daySchedules = schedules.filter(s => s.dayOfWeek === dayOfWeek)

  const confirmedCount = bookings.filter(b => b.status === 'confirmed').length
  const pendingDayCount = bookings.filter(b => b.status === 'pending').length
  const completedCount = bookings.filter(b => b.status === 'completed').length

  const formatDate = (d: string) => new Date(d).toLocaleDateString('vi-VN')

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-[28px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-8 max-[640px]:p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">
            'LỊCH PT'
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">
            Lịch làm việc
          </h1>
          <p className="mt-2 text-sm text-[var(--gs-text-muted)]">
            Quản lý lịch làm việc hàng tuần và xem các buổi tập được đặt lịch
          </p>
        </div>

        {/* Pending summary card */}
        <div
          className="flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-colors hover:bg-[var(--theme-accent-muted)]"
          style={{
            borderColor: 'color-mix(in srgb, var(--theme-accent) 35%, var(--gs-border))',
            background: 'color-mix(in srgb, var(--theme-accent) 12%, var(--gs-card))',
          }}
          onClick={() => navigate('/pt/schedule/pending')}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'color-mix(in srgb, var(--theme-accent) 20%, transparent)' }}>
              <BellOutlined style={{ color: 'var(--theme-accent)', fontSize: 18 }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[var(--gs-text)]">Lịch chờ xác nhận</span>
                {pendingCount > 0 && (
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white"
                    style={{ background: 'var(--theme-accent)' }}>
                    {pendingCount}
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--gs-text-muted)]">
                {pendingCount > 0
                  ? `Có ${pendingCount} lịch cần phản hồi trước buổi tập`
                  : 'Không có lịch chờ xác nhận'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-sm font-medium text-[var(--gs-text-muted)]">
            Xem tất cả
            <RightOutlined style={{ fontSize: 12 }} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-6">
            <h2 className="text-lg font-semibold text-[var(--gs-text)]">
              Lịch làm việc hàng tuần
            </h2>

            <div className="mt-4 space-y-3">
              {DAYS.map((day, idx) => (
                <div key={idx} className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card)] p-3">
                  <p className="font-semibold text-[var(--gs-text)]">{day}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {schedules
                      .filter(s => s.dayOfWeek === idx)
                      .map((s, i) => (
                        <span key={i} className="rounded-full px-3 py-1 text-xs"
                          style={{
                            background: 'var(--theme-accent-muted)',
                            color: 'var(--theme-accent)',
                          }}>
                          {SHIFTS.find(sh => sh.value === s.shift)?.label}
                        </span>
                      ))}
                    {schedules.filter(s => s.dayOfWeek === idx).length === 0 && (
                      <span className="text-xs text-[var(--gs-text-muted)]">Không làm việc</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--gs-text)]">
                Khách đặt lịch tập - {formatDate(selectedDate)}
              </h2>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  background: 'var(--gs-input-bg)',
                  color: 'var(--gs-text)',
                  border: '1px solid var(--gs-border)',
                }}
                className="rounded-lg px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--theme-accent)]"
              />
            </div>

            <div className="mb-4 grid grid-cols-3 gap-3">
              <div className="rounded-lg p-3 text-center" style={{ background: 'color-mix(in srgb, var(--theme-accent) 12%, var(--gs-card))' }}>
                <p className="text-xs" style={{ color: 'var(--gs-text-muted)' }}>Chờ</p>
                <p className="text-lg font-bold" style={{ color: 'var(--theme-accent)' }}>{pendingDayCount}</p>
              </div>
              <div className="rounded-lg p-3 text-center"
                style={{ background: dark ? 'rgba(34,197,94,0.10)' : 'rgba(34,197,94,0.08)' }}>
                <p className="text-xs" style={{ color: 'var(--gs-text-muted)' }}>Đã xác nhận</p>
                <p className="text-lg font-bold" style={{ color: dark ? 'rgb(74,222,128)' : 'rgb(22,163,74)' }}>{confirmedCount}</p>
              </div>
              <div className="rounded-lg p-3 text-center"
                style={{ background: dark ? 'rgba(59,130,246,0.10)' : 'rgba(59,130,246,0.08)' }}>
                <p className="text-xs" style={{ color: 'var(--gs-text-muted)' }}>Hoàn thành</p>
                <p className="text-lg font-bold" style={{ color: dark ? 'rgb(96,165,250)' : 'rgb(37,99,235)' }}>{completedCount}</p>
              </div>
            </div>

            {daySchedules.length > 0 && (
              <div className="mb-4 rounded-lg border p-3 text-sm"
                style={{
                  borderColor: 'color-mix(in srgb, var(--theme-accent) 40%, var(--gs-border))',
                  background: 'color-mix(in srgb, var(--theme-accent) 12%, var(--gs-card))',
                  color: 'var(--theme-accent)',
                }}>
                ✓ Bạn làm việc vào ngày này: {daySchedules.map(s => SHIFTS.find(sh => sh.value === s.shift)?.label).join(', ')}
              </div>
            )}

            {daySchedules.length === 0 && (
              <div className="mb-4 rounded-lg border border-dashed border-[var(--gs-border)] bg-[var(--gs-card)] p-3 text-sm text-[var(--gs-text-muted)]">
                ⚠️ Bạn không có lịch làm việc vào ngày này
              </div>
            )}

            {loading && (
              <p className="text-center text-[var(--gs-text-muted)]">Đang tải...</p>
            )}

            {!loading && bookings.length === 0 && (
              <p className="text-center text-[var(--gs-text-muted)]">
                Không có booking nào cho ngày này
              </p>
            )}

            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {bookings.map((booking) => (
                <div
                  key={booking._id}
                  className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card)] p-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-[var(--gs-text)]">
                        {booking.slot}
                      </p>
                      <p className="text-sm text-[var(--gs-text-muted)]">
                        {getUserDisplayName(booking.memberId, booking.memberId?.email || 'Thành viên')}
                      </p>
                      {booking.note && (
                        <p className="text-xs text-[var(--gs-text-muted)]">
                          {booking.note}
                        </p>
                      )}
                    </div>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 600,
                      background: booking.status === 'pending'
                        ? 'color-mix(in srgb, var(--theme-accent) 20%, transparent)'
                        : booking.status === 'confirmed'
                          ? (dark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.12)')
                          : booking.status === 'completed'
                            ? (dark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.12)')
                            : (dark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.12)'),
                      color: booking.status === 'pending'
                        ? 'var(--theme-accent)'
                        : booking.status === 'confirmed'
                          ? (dark ? 'rgb(74,222,128)' : 'rgb(22,163,74)')
                          : booking.status === 'completed'
                            ? (dark ? 'rgb(96,165,250)' : 'rgb(37,99,235)')
                            : (dark ? 'rgb(248,113,113)' : 'rgb(220,38,38)'),
                    }}>
                      {statusLabels[booking.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
