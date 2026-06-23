import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { message, Popconfirm } from 'antd'
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, ClockCircleOutlined, UserOutlined, FileTextOutlined, IdcardOutlined } from '@ant-design/icons'
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
    memberCode?: string
  }
  date: string
  slot: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  note?: string
}

export default function PTSchedulePendingPage() {
  const navigate = useNavigate()
  const { dark } = useTheme()
  const [bookings, setBookings] = useState<PTBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [rejectAllLoading, setRejectAllLoading] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()

  const loadPending = async () => {
    try {
      setLoading(true)
      const res = await bookingService.getPTBookings({ status: 'pending', from: 'today' })
      let data = res.data?.data || res.data || []
      if (!Array.isArray(data)) data = []

      setBookings(
        data.sort(
          (a: PTBooking, b: PTBooking) =>
            a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot)
        )
      )
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async (id: string) => {
    try {
      await bookingService.confirmBooking(id)
      messageApi.success('Đã xác nhận lịch tập')
      setBookings((prev) => prev.filter((b) => b._id !== id))
    } catch (err: any) {
      messageApi.error(err.response?.data?.message || 'Xác nhận thất bại')
    }
  }

  const handleReject = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn từ chối lịch tập này?')) return
    try {
      await bookingService.rejectBooking(id, 'PT từ chối lịch')
      messageApi.success('Đã từ chối lịch tập')
      setBookings((prev) => prev.filter((b) => b._id !== id))
    } catch (err: any) {
      messageApi.error(err.response?.data?.message || 'Từ chối thất bại')
    }
  }

  const handleRejectAll = async () => {
    setRejectAllLoading(true)
    try {
      await bookingService.rejectAllPendingBookings()
      messageApi.success('Đã từ chối tất cả lịch chờ xác nhận')
      setBookings([])
    } catch (err: any) {
      messageApi.error(err.response?.data?.message || 'Từ chối thất bại')
    } finally {
      setRejectAllLoading(false)
    }
  }

  useEffect(() => {
    loadPending()
  }, [])

  const formatDate = (d: string) => new Date(d).toLocaleDateString('vi-VN')

  return (
    <DashboardLayout>
      {contextHolder}
      <div className="space-y-6">
        <div className="rounded-[28px] border border-[var(--gs-border)] p-8 max-[640px]:p-5"
          style={{
            background: dark
              ? 'linear-gradient(135deg, rgba(182,70,47,0.14), rgba(0,0,0,0.15))'
              : 'linear-gradient(135deg, rgba(182,70,47,0.14), rgba(255,255,255,0.40))',
          }}>
          <button
            type="button"
            onClick={() => navigate('/pt/schedule')}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--gs-text-muted)] transition-colors hover:text-[var(--gs-text)]"
          >
            <ArrowLeftOutlined />
            Quay lại lịch tập
          </button>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">
            PT Schedule
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">
            Lịch chờ xác nhận
          </h1>
          <p className="mt-2 text-sm text-[var(--gs-text-muted)]">
            Các lịch tập đang chờ bạn xác nhận hoặc từ chối
          </p>
          {bookings.length > 0 && (
            <div className="mt-5 flex items-center justify-between gap-4">
              <p className="text-sm text-[var(--gs-text-muted)]">
                Có <strong className="text-[var(--gs-text)]">{bookings.length}</strong> lịch đang chờ xử lý
              </p>
              <Popconfirm
                title="Từ chối tất cả"
                description="Bạn có chắc muốn từ chối tất cả lịch đang chờ xác nhận không?"
                onConfirm={handleRejectAll}
                okText="Từ chối tất cả"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
              >
                <button
                  type="button"
                  disabled={rejectAllLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
                  style={{
                    border: dark ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(239,68,68,0.3)',
                    background: dark ? 'rgba(239,68,68,0.10)' : 'rgba(239,68,68,0.06)',
                    color: dark ? 'rgb(248,113,113)' : 'rgb(220,38,38)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = dark ? 'rgba(239,68,68,0.20)' : 'rgba(239,68,68,0.12)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = dark ? 'rgba(239,68,68,0.10)' : 'rgba(239,68,68,0.06)'
                  }}
                >
                  <CloseOutlined />
                  {rejectAllLoading ? 'Đang xử lý...' : 'Từ chối tất cả'}
                </button>
              </Popconfirm>
            </div>
          )}
        </div>

        {loading && (
          <p className="text-center text-sm text-[var(--gs-text-muted)]">Đang tải...</p>
        )}

        {!loading && bookings.length === 0 && (
          <div className="rounded-xl border border-dashed border-[var(--gs-border)] py-16 text-center"
            style={{ background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
            <p className="text-base text-[var(--gs-text-muted)]">Không có lịch chờ xác nhận</p>
            <button
              type="button"
              onClick={() => navigate('/pt/schedule')}
              className="mt-4 text-sm font-medium text-[var(--gs-text)] underline underline-offset-2 transition-colors hover:text-[var(--gs-text-muted)]"
            >
              Quay lại lịch tập
            </button>
          </div>
        )}

        {!loading && bookings.length > 0 && (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <div
                key={booking._id}
                className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <UserOutlined style={{ color: 'var(--gs-text-muted)', fontSize: 14 }} />
                      <span className="font-semibold text-[var(--gs-text)]">
                        {getUserDisplayName(booking.memberId, booking.memberId?.email || 'Thành viên')}
                      </span>
                      {booking.memberId?.memberCode && (
                        <span className="text-sm text-[var(--gs-text-muted)]">
                          <IdcardOutlined style={{ marginRight: 4 }} />
                          {booking.memberId.memberCode}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[var(--gs-text-muted)]">
                      <ClockCircleOutlined style={{ fontSize: 12 }} />
                      <span>{formatDate(booking.date)}</span>
                      <span>•</span>
                      <span>{booking.slot}</span>
                    </div>
                    {booking.note && (
                      <div className="flex items-start gap-2 text-sm text-[var(--gs-text-muted)]">
                        <FileTextOutlined style={{ fontSize: 12, marginTop: 3 }} />
                        <span>{booking.note}</span>
                      </div>
                    )}
                    <span className="inline-block rounded-full px-3 py-0.5 text-xs font-semibold"
                      style={{
                        background: dark ? 'rgba(234,179,8,0.15)' : 'rgba(234,179,8,0.12)',
                        color: dark ? 'rgb(253,224,71)' : 'rgb(161,98,7)',
                      }}>
                      Chờ xác nhận
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => handleConfirm(booking._id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
                    >
                      <CheckOutlined />
                      Xác nhận
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(booking._id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
                    >
                      <CloseOutlined />
                      Từ chối
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
