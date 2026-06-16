import { useEffect, useState } from 'react'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { useTranslation } from 'react-i18next'
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
  cancelReason?: string
  rejectReason?: string
  rating?: number
  reviewComment?: string
}

export default function PTBookingsPage() {
  const { t } = useTranslation()
  const [bookings, setBookings] = useState<PTBooking[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState<'all' | 'today' | 'week'>('all')
  const [memberFilter, setMemberFilter] = useState('')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const loadBookings = async () => {
    try {
      setLoading(true)
      const params: Record<string, unknown> = {}
      if (filter === 'today') params.filter = 'today'
      if (filter === 'week') params.filter = 'week'
      
      const res = await bookingService.getPTBookings(params)
      let data = res.data?.data || res.data || []
      
      if (!Array.isArray(data)) data = []
      
      // Filter by member if memberFilter is set
      if (memberFilter) {
        data = data.filter((b: PTBooking) =>
          b.memberId?.name?.toLowerCase().includes(memberFilter.toLowerCase()) ||
          b.memberId?.email?.toLowerCase().includes(memberFilter.toLowerCase())
        )
      }
      
      setBookings(data)
    } catch (error) {
      console.error(error)
      setMessage('Không thể tải lịch booking')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async (id: string) => {
    try {
      await bookingService.confirmBooking(id)
      setMessage('Xác nhận lịch thành công')
      await loadBookings()
    } catch (error: any) {
      console.error(error)
      setMessage(error?.response?.data?.message || 'Xác nhận thất bại')
    }
  }

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) {
      setMessage('Vui lòng nhập lý do từ chối')
      return
    }

    try {
      await bookingService.rejectBooking(id, rejectReason)
      setMessage('Từ chối lịch thành công')
      setRejectingId(null)
      setRejectReason('')
      await loadBookings()
    } catch (error: any) {
      console.error(error)
      setMessage(error?.response?.data?.message || 'Từ chối thất bại')
    }
  }

  const handleComplete = async (id: string) => {
    try {
      await bookingService.completeBooking(id)
      setMessage('Đánh dấu hoàn thành thành công')
      await loadBookings()
    } catch (error: any) {
      console.error(error)
      setMessage(error?.response?.data?.message || 'Hoàn thành thất bại')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-300'
      case 'confirmed':
        return 'bg-green-500/10 text-green-300'
      case 'cancelled':
        return 'bg-red-500/10 text-red-300'
      case 'completed':
        return 'bg-blue-500/10 text-blue-300'
      default:
        return 'bg-white/10 text-white'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Chờ xác nhận'
      case 'confirmed':
        return 'Đã xác nhận'
      case 'cancelled':
        return 'Đã hủy'
      case 'completed':
        return 'Hoàn thành'
      default:
        return status
    }
  }

  useEffect(() => {
    loadBookings()
  }, [filter])

  useEffect(() => {
    const timer = setTimeout(loadBookings, 500)
    return () => clearTimeout(timer)
  }, [memberFilter])

  const pendingCount = bookings.filter(b => b.status === 'pending').length
  const confirmedCount = bookings.filter(b => b.status === 'confirmed').length
  const completedCount = bookings.filter(b => b.status === 'completed').length

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))] p-8 max-[640px]:p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">
            {t('pt_dashboard.overline') || 'PT Dashboard'}
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">
            {t('pt_dashboard.bookings_title') || 'Quản lý Lịch Booking'}
          </h1>
          <p className="mt-2 text-sm text-[var(--gs-text-muted)]">
            Xem và quản lý các lịch tập của thành viên
          </p>
        </div>

        {message && (
          <div className="rounded-2xl border border-[var(--gs-border)] bg-white/5 p-4 text-sm text-[var(--gs-text)]">
            {message}
          </div>
        )}

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-[var(--gs-border)] bg-white/5 p-4">
            <p className="text-sm text-[var(--gs-text-muted)]">Chờ xác nhận</p>
            <p className="mt-1 text-2xl font-bold text-yellow-400">{pendingCount}</p>
          </div>
          <div className="rounded-xl border border-[var(--gs-border)] bg-white/5 p-4">
            <p className="text-sm text-[var(--gs-text-muted)]">Đã xác nhận</p>
            <p className="mt-1 text-2xl font-bold text-green-400">{confirmedCount}</p>
          </div>
          <div className="rounded-xl border border-[var(--gs-border)] bg-white/5 p-4">
            <p className="text-sm text-[var(--gs-text-muted)]">Đã hoàn thành</p>
            <p className="mt-1 text-2xl font-bold text-blue-400">{completedCount}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-xl border border-[var(--gs-border)] bg-white/5 p-4">
          <div className="flex flex-wrap gap-4 max-[640px]:flex-col">
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm transition ${
                  filter === 'all'
                    ? 'bg-orange-600 text-white'
                    : 'border border-[var(--gs-border)] text-[var(--gs-text-muted)] hover:bg-white/5'
                }`}
              >
                Tất cả
              </button>
              <button
                onClick={() => setFilter('today')}
                className={`px-4 py-2 rounded-lg text-sm transition ${
                  filter === 'today'
                    ? 'bg-orange-600 text-white'
                    : 'border border-[var(--gs-border)] text-[var(--gs-text-muted)] hover:bg-white/5'
                }`}
              >
                Hôm nay
              </button>
              <button
                onClick={() => setFilter('week')}
                className={`px-4 py-2 rounded-lg text-sm transition ${
                  filter === 'week'
                    ? 'bg-orange-600 text-white'
                    : 'border border-[var(--gs-border)] text-[var(--gs-text-muted)] hover:bg-white/5'
                }`}
              >
                Tuần này
              </button>
            </div>

            <input
              type="text"
              placeholder="Tìm kiếm thành viên..."
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              className="flex-1 rounded-lg border border-[var(--gs-border)] bg-transparent px-3 py-2 text-sm text-[var(--gs-text)] outline-none max-[640px]:min-w-full"
            />
          </div>
        </div>

        {/* Bookings List */}
        <div className="rounded-xl border border-[var(--gs-border)] bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-[var(--gs-text)]">
            Lịch Booking
          </h2>

          {loading && (
            <p className="mt-4 text-center text-[var(--gs-text-muted)]">Đang tải...</p>
          )}

          {!loading && bookings.length === 0 && (
            <p className="mt-4 text-center text-[var(--gs-text-muted)]">
              Không có lịch booking nào
            </p>
          )}

          <div className="mt-4 space-y-3 max-h-[600px] overflow-y-auto">
            {bookings.map((booking) => (
              <div
                key={booking._id}
                className="rounded-lg border border-[var(--gs-border)] bg-black/20 p-4"
              >
                {rejectingId === booking._id ? (
                  // Reject form
                  <div className="space-y-3">
                    <h3 className="font-semibold text-[var(--gs-text)]">
                      Nhập lý do từ chối:
                    </h3>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                      placeholder="Ví dụ: Lịch trùng với buổi tập khác..."
                      className="w-full rounded-lg border border-[var(--gs-border)] bg-transparent p-3 text-[var(--gs-text)] outline-none text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReject(booking._id)}
                        className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                      >
                        Xác nhận từ chối
                      </button>
                      <button
                        onClick={() => {
                          setRejectingId(null)
                          setRejectReason('')
                        }}
                        className="flex-1 rounded-lg border border-[var(--gs-border)] px-3 py-2 text-sm text-[var(--gs-text-muted)] hover:bg-white/5"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  // Booking display
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          {booking.memberId?.avatar && (
                            <img
                              src={booking.memberId.avatar}
                              alt=""
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          )}
                          <div>
                            <p className="font-semibold text-[var(--gs-text)]">
                              {booking.memberId?.name || booking.memberId?.email || 'Thành viên'}
                            </p>
                            <p className="text-xs text-[var(--gs-text-muted)]">
                              {booking.memberId?.email}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 space-y-1 text-sm text-[var(--gs-text-muted)]">
                          <p>
                            Ngày:{' '}
                            <span className="text-[var(--gs-text)]">
                              {new Date(booking.date).toLocaleDateString('vi-VN')}
                            </span>
                          </p>
                          <p>
                            Giờ:{' '}
                            <span className="text-[var(--gs-text)]">
                              {booking.slot}
                            </span>
                          </p>

                          {booking.note && (
                            <p>
                              Ghi chú:{' '}
                              <span className="text-[var(--gs-text)]">
                                {booking.note}
                              </span>
                            </p>
                          )}

                          {booking.rating && (
                            <p>
                              Đánh giá:{' '}
                              <span className="text-yellow-400">
                                {booking.rating} ⭐
                              </span>
                              {booking.reviewComment && ` - ${booking.reviewComment}`}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <p
                          className={`mb-3 inline-block rounded-full px-3 py-1 text-sm font-semibold ${getStatusColor(
                            booking.status,
                          )}`}
                        >
                          {getStatusText(booking.status)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--gs-border)] pt-3">
                      {booking.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleConfirm(booking._id)}
                            className="rounded-lg border border-green-500/40 px-3 py-2 text-sm text-green-300 hover:bg-green-500/10"
                          >
                            Xác nhận
                          </button>
                          <button
                            onClick={() => setRejectingId(booking._id)}
                            className="rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10"
                          >
                            Từ chối
                          </button>
                        </>
                      )}

                      {booking.status === 'confirmed' && (
                        <button
                          onClick={() => handleComplete(booking._id)}
                          className="rounded-lg border border-blue-500/40 px-3 py-2 text-sm text-blue-300 hover:bg-blue-500/10"
                        >
                          Hoàn thành
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
