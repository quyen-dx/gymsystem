import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Modal, Tag, message } from 'antd'
import { CalendarOutlined, CloseCircleOutlined, ExclamationCircleOutlined, MessageOutlined, TeamOutlined, UserOutlined, WalletOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { trainingRequestService, type TrainingRequest } from '../../services/trainingRequestService'
import { bookingService, type Booking } from '../../services/bookingService'
import { getWallet } from '../../services/walletService'
import { getUserDisplayName } from '../../utils/userDisplay'

const DAY_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
const DAY_SHORT_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

const STATUS_META: Record<string, { color: string; label: string }> = {
  pending: { color: 'orange', label: 'Chờ xử lý' },
  message_sent: { color: 'blue', label: 'Chờ phản hồi' },
  waiting_assignment: { color: 'purple', label: 'Chờ phân công' },
  assigned: { color: 'green', label: 'Đã phân công' },
  declined_by_member: { color: 'red', label: 'Đã từ chối' },
  cancelled: { color: 'red', label: 'Đã hủy' },
}

Object.assign(STATUS_META, {
  awaiting_payment: { color: 'gold', label: 'Chờ thanh toán' },
  confirmed: { color: 'green', label: 'Đã xác nhận' },
  payment_expired: { color: 'red', label: 'Hết hạn thanh toán' },
  expired: { color: 'red', label: 'Đã hết hạn xử lý' },
})

const CANCELABLE = ['pending', 'waiting_assignment', 'assigned', 'awaiting_payment']

const STATUS_DESCRIPTIONS: Record<string, string> = {
  pending: 'Admin đã tiếp nhận yêu cầu và đang xem xét.',
  message_sent: 'Admin đã gửi đề xuất. Vui lòng chọn Đồng ý hoặc Từ chối.',
  waiting_assignment: 'Bạn đã đồng ý đề xuất. Admin đang sắp xếp lớp/PT cho bạn. Bạn vẫn có thể hủy yêu cầu trước khi hoàn tất.',
  assigned: 'Đã phân công thành công. Bạn có thể bắt đầu đặt lịch.',
}

function timelineFor(request: TrainingRequest): { steps: string[]; current: number } {
  if (request.type === 'group') {
    return { steps: ['Đã gửi yêu cầu', 'Admin tiếp nhận', 'Đang xử lý', 'Đã xếp lớp'], current: request.status === 'assigned' ? 3 : 0 }
  }
  const steps = ['Đã gửi yêu cầu', 'Admin tiếp nhận', 'Đang xử lý', 'Chờ phản hồi hội viên', 'Chờ phân công', 'Đã phân công PT']
  const idx: Record<string, number> = { pending: 0, message_sent: 3, waiting_assignment: 4, assigned: 5 }
  return { steps, current: idx[request.status] ?? 0 }
}

function specLabel(spec?: string) {
  const map: Record<string, string> = {
    GYM: 'GYM', YOGA: 'Yoga', BOXING: 'Boxing', ZUMBA: 'Zumba', PILATES: 'Pilates',
    CARDIO: 'Cardio', AEROBICS: 'Aerobics', CROSSFIT: 'Crossfit', KICKBOXING: 'Kickboxing',
    DANCE: 'Dance', MUAYTHAI: 'Muay Thái', FUNCTIONAL: 'Functional Training', OTHER: 'Khác',
  }
  return map[spec || ''] || spec || 'GYM'
}

function nameOf(t?: TrainingRequest['preferredTrainerId'] | TrainingRequest['assignedTrainerId']) {
  if (!t) return ''
  if (typeof t === 'string') return ''
  return getUserDisplayName(t, '')
}

function idOf(t?: TrainingRequest['assignedTrainerId']) {
  if (!t) return null
  if (typeof t === 'string') return t
  return t._id || null
}

function classNameOf(c?: TrainingRequest['assignedClassId']) {
  if (!c) return ''
  if (typeof c === 'string') return ''
  return c.name || ''
}

function formatDays(days?: number[]) {
  if (!days?.length) return 'Linh hoạt (Admin sắp xếp)'
  return days
    .map((d) => {
      const label = DAY_LABELS[d]
      const short = DAY_SHORT_LABELS[d]
      if (!label) return ''
      return short ? `${label} (${short})` : label
    })
    .filter(Boolean)
    .join(', ')
}

function formatTimeSlots(slots?: string[]) {
  return slots?.length ? slots.join(', ') : 'Linh hoạt (Admin sắp xếp)'
}

interface Props {
  request: TrainingRequest
  onReload: () => void
}

export default function YourRequestPanel({ request, onReload }: Props) {
  const navigate = useNavigate()
  const [processing, setProcessing] = useState(false)
  const [paymentBookings, setPaymentBookings] = useState<Booking[]>([])
  const isPt1on1 = request.type === 'pt1on1'
  const meta = STATUS_META[request.status] || { color: 'default', label: request.status }
  const timeline = timelineFor(request)
  const assignedPtId = idOf(request.assignedTrainerId)

  useEffect(() => {
    if (request.status !== 'awaiting_payment') {
      setPaymentBookings([])
      return
    }
    bookingService.getMyBookings()
      .then(({ data }) => setPaymentBookings((data.bookings || []).filter((booking: Booking) => String(booking.requestId || '') === String(request._id) && booking.status === 'awaiting_payment')))
      .catch(() => setPaymentBookings([]))
  }, [request._id, request.status])

  const handleCancel = async () => {
    setProcessing(true)
    try {
      await trainingRequestService.cancelMyRequest(request._id)
      message.success('Đã hủy yêu cầu')
      onReload()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Hủy yêu cầu thất bại')
    } finally {
      setProcessing(false)
    }
  }

  const confirmCancel = () => {
    Modal.confirm({
      title: 'Hủy yêu cầu?',
      icon: <ExclamationCircleOutlined />,
      content: 'Bạn có chắc chắn muốn hủy yêu cầu này? Sau khi hủy bạn có thể đăng ký lại.',
      okText: 'Hủy yêu cầu',
      okButtonProps: { danger: true },
      cancelText: 'Giữ lại',
      onOk: handleCancel,
    })
  }

  const handleRespond = async (action: 'accept' | 'reject') => {
    setProcessing(true)
    try {
      await trainingRequestService.respond(request._id, action)
      message.success(
        action === 'accept'
          ? 'Đã đồng ý. Admin sẽ sắp xếp cho bạn.'
          : 'Đã từ chối đề xuất.',
      )
      onReload()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Xử lý thất bại')
    } finally {
      setProcessing(false)
    }
  }

  const handleContact = () => {
    message.info('Tính năng chat với PT đang được phát triển. Vui lòng liên hệ PT qua số điện thoại hoặc email.')
  }

  const goalText = request.goals?.length ? request.goals.join(', ') : '—'
  const payAllPendingBookings = async () => {
    if (!paymentBookings.length) return
    setProcessing(true)
    try {
      const total = paymentBookings.reduce((sum, b) => sum + Number(b.totalAmount || 0), 0)
      const walletRes = await getWallet()
      const balance = Number(walletRes?.data?.data?.balance || 0)
      if (balance < total) {
        const res = await bookingService.payBooking(paymentBookings[0]._id, { useVnpay: true })
        if (res.data?.paymentUrl) {
          window.location.href = res.data.paymentUrl
          return
        }
        message.error('Không thể tạo phiên thanh toán VNPay. Vui lòng thử lại.')
        return
      }
      for (const booking of paymentBookings) {
        await bookingService.payBooking(booking._id)
      }
      message.success('Thanh toán các buổi PT thành công')
      onReload()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Thanh toán chưa hoàn tất')
    } finally {
      setProcessing(false)
    }
  }

  const note = request.note || request.healthNotes || ''
  const sentAt = request.createdAt ? dayjs(request.createdAt).format('DD/MM/YYYY HH:mm') : '—'
  const preferred = nameOf(request.preferredTrainerId)
  const assignedPtName = nameOf(request.assignedTrainerId)
  const assignedClassName = classNameOf(request.assignedClassId)

  const rows: Array<{ label: string; value: string }> = []
  rows.push({ label: 'Chuyên môn', value: specLabel(request.specialization).toUpperCase() })
  rows.push({ label: 'Mục tiêu', value: goalText })
  if (request.daySlots?.length) {
    rows.push({
      label: 'Lịch mong muốn',
      value: request.daySlots
        .map((p) => `${DAY_LABELS[p.day]} (${DAY_SHORT_LABELS[p.day]}) ${p.slot.replace('-', ' - ')}`)
        .join(', '),
    })
  } else {
    rows.push({ label: 'Ngày muốn book', value: formatDays(request.daysOfWeek) })
    rows.push({ label: 'Khung giờ muốn book', value: formatTimeSlots(request.timeSlots) })
  }
  if (isPt1on1) {
    rows.push({ label: 'PT mong muốn', value: preferred || 'Không yêu cầu' })
    rows.push({ label: 'Số điện thoại', value: request.contactPhone || '—' })
    rows.push({ label: 'Email', value: request.contactEmail || '—' })
  } else {
    rows.push({ label: 'Số buổi/tuần', value: request.desiredSessions ? `${request.desiredSessions} buổi` : '—' })
  }
  if (request.status === 'assigned') {
    if (isPt1on1 && assignedPtName) rows.push({ label: 'PT được phân công', value: assignedPtName })
    if (!isPt1on1 && assignedClassName) rows.push({ label: 'Lớp được xếp', value: assignedClassName })
  }
  rows.push({ label: 'Ngày gửi', value: sentAt })
  if (note) rows.push({ label: 'Ghi chú', value: note })

  const showActions = CANCELABLE.includes(request.status) || request.status === 'assigned'

  return (
    <div className="rounded-2xl border border-[var(--theme-border)] bg-[var(--gs-card)] p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--theme-accent-muted)] text-2xl text-[var(--theme-accent)]">
            {isPt1on1 ? <UserOutlined /> : <TeamOutlined />}
          </span>
          <div>
            <h2 className="text-xl font-bold uppercase tracking-wide text-[var(--gs-text)]">
              {isPt1on1 ? 'Yêu cầu PT riêng 1-1' : 'Yêu cầu tập luyện nhóm'}
            </h2>
            <p className="text-sm text-[var(--gs-text-muted)]">
              {isPt1on1 ? 'PT cá nhân sẽ được phân công riêng cho bạn' : 'Bạn sẽ được xếp vào lớp phù hợp'}
            </p>
          </div>
        </div>
        <Tag color={meta.color} className="m-0 !px-3 !py-1 !text-xs font-semibold">{meta.label}</Tag>
      </div>

      {/* Thông tin yêu cầu */}
      <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-4 sm:p-5 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-3">
            <span className="w-32 shrink-0 text-xs font-medium text-[var(--gs-text-muted)]">{row.label}</span>
            <span className="min-w-0 flex-1 break-words text-sm text-[var(--gs-text)]">{row.value}</span>
          </div>
        ))}
      </div>

      {request.status === 'awaiting_payment' && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-[var(--gs-text)]">Thanh toán để xác nhận lịch PT</p>
              <p className="mt-1 text-sm text-[var(--gs-text-muted)]">
                {paymentBookings.length} buổi đang được giữ chỗ, tổng cộng {paymentBookings.reduce((sum, booking) => sum + Number(booking.totalAmount || 0), 0).toLocaleString('vi-VN')}đ.
                {paymentBookings.reduce((sum, booking) => sum + Number(booking.totalAmount || 0), 0) > 0 && ' Nếu số dư ví không đủ, phần còn thiếu sẽ được thanh toán trực tiếp qua VNPay.'}
              </p>
            </div>
            <Button type="primary" icon={<WalletOutlined />} loading={processing} disabled={!paymentBookings.length} onClick={payAllPendingBookings}>
              Thanh toán {paymentBookings.reduce((sum, booking) => sum + Number(booking.totalAmount || 0), 0).toLocaleString('vi-VN')}đ
            </Button>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--gs-text-muted)]">Tiến trình xử lý</p>
        <div className="space-y-0">
          {timeline.steps.map((label, i) => {
            const done = i < timeline.current
            const active = i === timeline.current
            const isLast = i === timeline.steps.length - 1
            return (
              <div key={label} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      done
                        ? 'bg-green-500 text-white'
                        : active
                          ? 'bg-[var(--theme-accent)] text-white'
                          : 'bg-[var(--gs-border)] text-[var(--gs-text-muted)]'
                    }`}
                  >
                    {done ? '✓' : active ? '●' : '○'}
                  </span>
                  {!isLast && <span className={`w-px flex-1 ${done ? 'bg-green-500' : 'bg-[var(--gs-border)]'}`} />}
                </div>
                <div className={`pb-5 text-sm ${active ? 'font-semibold text-[var(--gs-text)]' : done ? 'text-[var(--gs-text)]' : 'text-[var(--gs-text-muted)]'}`}>
                  {label}
                  {active && <span className="ml-1.5 text-xs text-[var(--theme-accent)]">(hiện tại)</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Mô tả trạng thái */}
      <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-accent-muted)]/60 p-4">
        <div className="flex items-start gap-2">
          <ExclamationCircleOutlined className="mt-0.5 text-[var(--theme-accent)]" />
          <p className="text-sm leading-relaxed text-[var(--gs-text)]">
            {STATUS_DESCRIPTIONS[request.status] || 'Yêu cầu của bạn đang được xử lý. Vui lòng chờ phản hồi từ admin.'}
          </p>
        </div>
      </div>

      {/* Đề xuất mới từ Admin */}
      {request.status === 'message_sent' && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Đề xuất mới từ Admin</p>
          <p className="mt-1 whitespace-pre-line text-sm text-amber-800/90 dark:text-amber-200/90">
            {request.lastMessage || 'Admin đã gửi đề xuất cho bạn. Vui lòng xác nhận để chúng tôi tiếp tục xử lý.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="small" danger loading={processing} onClick={() => handleRespond('reject')}>Từ chối</Button>
            <Button size="small" type="primary" loading={processing} onClick={() => handleRespond('accept')}>Đồng ý</Button>
          </div>
        </div>
      )}

      {/* Hành động theo trạng thái */}
      {showActions && (
        <div className="border-t border-[var(--gs-border)] pt-5">
          {CANCELABLE.includes(request.status) ? (
            <Button danger loading={processing} onClick={confirmCancel} icon={<CloseCircleOutlined />}>
              Hủy yêu cầu
            </Button>
          ) : request.status === 'assigned' && isPt1on1 && assignedPtId ? (
            <div className="flex flex-wrap gap-2">
              <Button
                icon={<UserOutlined />}
                onClick={() => navigate(`/booking/${assignedPtId}`)}
                className="min-w-[130px]"
              >
                Xem PT
              </Button>
              <Button
                type="primary"
                icon={<CalendarOutlined />}
                onClick={() => navigate(`/booking/${assignedPtId}`)}
                className="min-w-[130px]"
              >
                Đặt lịch
              </Button>
              <Button
                icon={<MessageOutlined />}
                onClick={handleContact}
                className="min-w-[130px]"
              >
                Nhắn tin
              </Button>
            </div>
          ) : request.status === 'assigned' && !isPt1on1 ? (
            <p className="flex items-start gap-2 text-sm text-[var(--gs-text-muted)]">
              <ExclamationCircleOutlined className="mt-0.5" />
              Bạn đã được xếp vào lớp. Lịch tập chính thức sẽ do Admin sắp xếp.
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
