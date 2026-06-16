import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { bookingService } from '../../../services/bookingService'

interface PTBooking {
  _id: string
  memberId: {
    _id: string
    name?: string
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

export default function PTSchedulePage() {
  const { t } = useTranslation()
  const [bookings, setBookings] = useState<PTBooking[]>([])
  const [schedules, setSchedules] = useState<PTScheduleData[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [message, setMessage] = useState('')

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
      setMessage('Không thể tải lịch booking')
    } finally {
      setLoading(false)
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
    loadBookings()
  }, [selectedDate])

  useEffect(() => {
    loadSchedule()
  }, [])

  const selectedDateObj = new Date(selectedDate)
  const dayOfWeek = selectedDateObj.getDay()
  const daySchedules = schedules.filter(s => s.dayOfWeek === dayOfWeek)

  const confirmedCount = bookings.filter(b => b.status === 'confirmed').length
  const pendingCount = bookings.filter(b => b.status === 'pending').length
  const completedCount = bookings.filter(b => b.status === 'completed').length

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))] p-8 max-[640px]:p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">
            {t('pt.schedule.overline') || 'PT Schedule'}
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">
            {t('pt.schedule.title') || 'Lịch làm việc & Bookings'}
          </h1>
          <p className="mt-2 text-sm text-[var(--gs-text-muted)]">
            Quản lý lịch làm việc hàng tuần và xem các buổi tập được đặt lịch
          </p>
        </div>

        {message && (
          <div className="rounded-2xl border border-[var(--gs-border)] bg-white/5 p-4 text-sm text-[var(--gs-text)]">
            {message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-xl border border-[var(--gs-border)] bg-white/5 p-6">
            <h2 className="text-lg font-semibold text-[var(--gs-text)]">
              Lịch làm việc hàng tuần
            </h2>

            <div className="mt-4 space-y-3">
              {DAYS.map((day, idx) => (
                <div key={idx} className="rounded-lg border border-[var(--gs-border)] bg-black/20 p-3">
                  <p className="font-semibold text-[var(--gs-text)]">{day}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {schedules
                      .filter(s => s.dayOfWeek === idx)
                      .map((s, i) => (
                        <span key={i} className="rounded-full bg-orange-500/20 px-3 py-1 text-xs text-orange-300">
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

          <div className="rounded-xl border border-[var(--gs-border)] bg-white/5 p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-[var(--gs-text)]">
                Khách đặt lịch tập - {new Date(selectedDate).toLocaleDateString('vi-VN')}
              </h2>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-lg border border-[var(--gs-border)] bg-transparent px-3 py-2 text-sm text-[var(--gs-text)]"
              />
            </div>

            <div className="mb-4 grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-blue-500/10 p-3 text-center">
                <p className="text-xs text-[var(--gs-text-muted)]">Pending</p>
                <p className="text-lg font-bold text-blue-300">{pendingCount}</p>
              </div>
              <div className="rounded-lg bg-green-500/10 p-3 text-center">
                <p className="text-xs text-[var(--gs-text-muted)]">Confirmed</p>
                <p className="text-lg font-bold text-green-300">{confirmedCount}</p>
              </div>
              <div className="rounded-lg bg-orange-500/10 p-3 text-center">
                <p className="text-xs text-[var(--gs-text-muted)]">Completed</p>
                <p className="text-lg font-bold text-orange-300">{completedCount}</p>
              </div>
            </div>

            {daySchedules.length > 0 && (
              <div className="mb-4 rounded-lg border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300">
                ✓ Bạn làm việc vào ngày này: {daySchedules.map(s => SHIFTS.find(sh => sh.value === s.shift)?.label).join(', ')}
              </div>
            )}

            {daySchedules.length === 0 && (
              <div className="mb-4 rounded-lg border border-gray-500/40 bg-gray-500/10 p-3 text-sm text-gray-300">
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
                  className="rounded-lg border border-[var(--gs-border)] bg-black/20 p-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-[var(--gs-text)]">
                        {booking.slot}
                      </p>
                      <p className="text-sm text-[var(--gs-text-muted)]">
                        {booking.memberId?.name || booking.memberId?.email || 'Thành viên'}
                      </p>
                      {booking.note && (
                        <p className="text-xs text-[var(--gs-text-muted)]">
                          {booking.note}
                        </p>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        booking.status === 'pending'
                          ? 'bg-yellow-500/10 text-yellow-300'
                          : booking.status === 'confirmed'
                            ? 'bg-green-500/10 text-green-300'
                            : booking.status === 'completed'
                              ? 'bg-blue-500/10 text-blue-300'
                              : 'bg-red-500/10 text-red-300'
                      }`}
                    >
                      {booking.status === 'pending' && 'Chờ'}
                      {booking.status === 'confirmed' && 'Xác nhận'}
                      {booking.status === 'completed' && 'Hoàn thành'}
                      {booking.status === 'cancelled' && 'Hủy'}
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
