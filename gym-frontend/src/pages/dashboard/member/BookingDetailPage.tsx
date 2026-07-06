import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { bookingService } from '../../../services/bookingService'
import { trainerService } from '../../../services/trainerService'
import type { PT } from '../../../types/admin/trainer'

const SLOT_OPTIONS = [
  '06:00-07:00',
  '07:00-08:00',
  '08:00-09:00',
  '09:00-10:00',
  '10:00-11:00',
  '14:00-15:00',
  '15:00-16:00',
  '16:00-17:00',
  '17:00-18:00',
  '18:00-19:00',
]

export default function BookingDetailPage() {
  const { ptId } = useParams()
  const navigate = useNavigate()

  const [pt, setPt] = useState<PT | null>(null)
  const [trainingType, setTrainingType] = useState<'one_to_one' | 'group'>('one_to_one')
  const [date, setDate] = useState('')
  const [slot, setSlot] = useState('')
  const [note, setNote] = useState('')
  const [ptSchedule, setPtSchedule] = useState<Record<string, boolean>>({})
  const [conflictMessage, setConflictMessage] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedSlotAvailable = useMemo(() => {
    if (!slot) return true
    if (ptSchedule[slot] === undefined) return true
    return ptSchedule[slot]
  }, [ptSchedule, slot])

  const unitPrice =
    trainingType === 'one_to_one'
      ? pt?.oneToOnePrice || 0
      : pt?.groupPrice || 0

  const totalPrice = unitPrice

  const today = new Date().toISOString().split('T')[0]

  const maxDateObj = new Date()
  maxDateObj.setDate(maxDateObj.getDate() + 30)
  const maxDate = maxDateObj.toISOString().split('T')[0]

  const loadPT = async () => {
    if (!ptId) return

    try {
      const res = await trainerService.getAvailablePTById(ptId)
      setPt(res.data?.pt || res.data)
    } catch (error) {
      console.error(error)
      setMessage('Không thể tải thông tin PT')
    }
  }

  const loadAvailability = async () => {
    if (!ptId || !date) return

    try {
      const res = await trainerService.getPTAvailability(ptId, date)
      setPtSchedule(res.data?.availability || {})
    } catch (error) {
      console.error(error)
      setPtSchedule({})
    }
  }

  const checkConflict = async () => {
    if (!ptId || !date || !slot) return

    try {
      const res = await bookingService.checkConflicts({
        ptId,
        date,
        slot,
      })

      const hasConflict =
        res.data?.hasConflict ||
        res.data?.conflict ||
        res.data?.data?.hasConflict

      setConflictMessage(hasConflict ? 'Khung giờ này đã có lịch, vui lòng chọn giờ khác' : '')
    } catch (error) {
      console.error(error)
      setConflictMessage('')
    }
  }

  const handleCreateBooking = async () => {
    if (!ptId || !date || !slot) {
      setMessage('Vui lòng chọn ngày và khung giờ')
      return
    }

    if (date < today || date > maxDate) {
      setMessage('Chỉ được đặt lịch từ hôm nay và tối đa 30 ngày tới')
      return
    }

    if (unitPrice <= 0) {
      setMessage('Hình thức tập này chưa được cấu hình giá')
      return
    }

    if (!selectedSlotAvailable) {
      setMessage('Khung giờ này không còn trống')
      return
    }

    if (conflictMessage) {
      setMessage(conflictMessage)
      return
    }

    try {
      setLoading(true)
      setMessage('')

      await bookingService.createBooking({
        ptId: pt?.ptId || ptId,
        date,
        slot,
        note,
        trainingType,
      })

      setMessage('Đặt lịch thành công, chờ PT xác nhận')
      setTimeout(() => navigate('/booking'), 1500)
    } catch (error: any) {
      console.error(error)
      setMessage(error?.response?.data?.message || 'Đặt lịch thất bại')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPT()
  }, [ptId])

  useEffect(() => {
    setSlot('')
    setConflictMessage('')
    loadAvailability()
  }, [ptId, date, trainingType])

  useEffect(() => {
    checkConflict()
  }, [ptId, date, slot])

  return (
    <MemberLayout>
      <div className="member-page space-y-6">
        <button
          type="button"
          onClick={() => navigate('/booking')}
          className="rounded-xl border border-[var(--gs-border)] px-4 py-2 text-sm text-[var(--gs-text)] hover:bg-white/10"
        >
          ← Quay lại danh sách PT
        </button>

        {message && (
          <div className="rounded-2xl border border-[var(--gs-border)] bg-white/5 p-4 text-sm text-[var(--gs-text)]">
            {message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[24px] border border-[var(--gs-border)] bg-white/5 p-6">
            <h1 className="text-2xl font-bold text-[var(--gs-text)]">
              Thông tin PT
            </h1>

            {pt ? (
              <div className="mt-5">
                <div className="flex items-center gap-4">
                  <img
                    src={pt.avatar || '/default-avatar.png'}
                    alt={pt.name || 'PT'}
                    className="h-24 w-24 rounded-2xl object-cover"
                  />

                  <div>
                    <h2 className="text-xl font-bold text-[var(--gs-text)]">
                      {pt.name || pt.email || 'PT'}
                    </h2>
                    <p className="mt-1 text-sm text-yellow-400">
                      ⭐ {pt.rating || 0} / 5
                    </p>
                    <p className="mt-1 text-sm text-[var(--gs-text-muted)]">
                      {pt.experienceYears || 0} năm kinh nghiệm
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-sm font-semibold text-[var(--gs-text)]">
                    Chuyên môn
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pt.specialties?.length ? (
                      pt.specialties.map((item) => (
                        <span
                          key={item}
                          className="rounded-full bg-orange-500/10 px-3 py-1 text-xs text-orange-300"
                        >
                          {item}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-[var(--gs-text-muted)]">
                        Chưa cập nhật
                      </span>
                    )}
                  </div>
                </div>

                <p className="mt-5 text-sm leading-6 text-[var(--gs-text-muted)]">
                  {pt.bio || 'PT chưa cập nhật giới thiệu.'}
                </p>

                <div className="mt-6 rounded-2xl border border-[var(--gs-border)] bg-black/20 p-4">
                  <h3 className="font-semibold text-[var(--gs-text)]">
                    Giá dịch vụ
                  </h3>

                  <div className="mt-3 grid grid-cols-2 gap-3">

                    <div>
                      <p className="text-xs text-[var(--gs-text-muted)]">
                        PT 1-1
                      </p>

                      <p className="mt-1 text-lg font-bold text-orange-400">
                        {(pt.oneToOnePrice || 0).toLocaleString('vi-VN')}đ/buổi
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-[var(--gs-text-muted)]">
                        PT nhóm
                      </p>

                      <p className="mt-1 text-lg font-bold text-orange-400">
                        {(pt.groupPrice || 0).toLocaleString('vi-VN')}đ/người
                      </p>
                    </div>

                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-5 text-sm text-[var(--gs-text-muted)]">
                Đang tải thông tin PT...
              </p>
            )}
          </div>

          <div className="rounded-[24px] border border-[var(--gs-border)] bg-white/5 p-6">
            <h1 className="text-2xl font-bold text-[var(--gs-text)]">
              Đặt lịch tập
            </h1>

            <div className="mt-5 space-y-5">
              <div>
                <label className="mb-2 block text-sm text-[var(--gs-text-muted)]">
                  Hình thức tập
                </label>

                <div className="grid grid-cols-2 gap-3">

                  <button
                    type="button"
                    onClick={() => {
                      setTrainingType('one_to_one')
                      setSlot('')
                      setConflictMessage('')
                    }}
                    className={`rounded-xl border p-4 ${
                      trainingType === 'one_to_one'
                        ? 'border-orange-500 bg-orange-500/20'
                        : 'border-[var(--gs-border)]'
                    }`}
                  >
                    <p className="font-semibold">
                      PT 1-1
                    </p>

                    <p className="mt-1 text-sm">
                      {(pt?.oneToOnePrice || 0).toLocaleString('vi-VN')}đ/buổi
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTrainingType('group')
                      setSlot('')
                      setConflictMessage('')
                    }}
                    className={`rounded-xl border p-4 ${
                      trainingType === 'group'
                        ? 'border-orange-500 bg-orange-500/20'
                        : 'border-[var(--gs-border)]'
                    }`}
                  >
                    <p className="font-semibold">
                      PT nhóm
                    </p>

                    <p className="mt-1 text-sm">
                      {(pt?.groupPrice || 0).toLocaleString('vi-VN')}đ/người
                    </p>
                  </button>

                </div>

                {trainingType === 'group' && (
                  <p className="mt-3 text-xs text-[var(--gs-text-muted)]">
                    Sức chứa nhóm: {pt?.groupCapacity || 5} người
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm text-[var(--gs-text-muted)]">
                  Chọn ngày tập
                </label>

                <input
                  type="date"
                  min={today}
                  max={maxDate}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-[var(--gs-border)] bg-transparent p-3 text-[var(--gs-text)]"
                />
              </div>

              {date && (
                <div>
                  <label className="mb-2 block text-sm text-[var(--gs-text-muted)]">
                    Chọn khung giờ
                  </label>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {SLOT_OPTIONS.map((item) => {
                      const available = ptSchedule[item]
                      const disabled = available === false

                      return (
                        <button
                          key={item}
                          type="button"
                          disabled={disabled}
                          onClick={() => setSlot(item)}
                          className={`rounded-xl border p-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            slot === item
                              ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                              : disabled
                                ? 'border-red-500/30 bg-red-500/10 text-red-300'
                                : 'border-[var(--gs-border)] text-[var(--gs-text-muted)] hover:bg-white/10'
                          }`}
                        >
                          {item}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {conflictMessage && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                  {conflictMessage}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm text-[var(--gs-text-muted)]">
                  Ghi chú / Mục tiêu
                </label>

                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  placeholder="Nhập ghi chú hoặc mục tiêu buổi tập..."
                  className="w-full rounded-xl border border-[var(--gs-border)] bg-transparent p-3 text-[var(--gs-text)] outline-none"
                />
              </div>

              <div className="rounded-xl border border-[var(--gs-border)] bg-black/20 p-5">
                <h3 className="font-semibold text-[var(--gs-text)]">
                  Thông tin đặt lịch
                </h3>

                <div className="mt-4 space-y-3 text-sm">

                  <div className="flex justify-between">
                    <span className="text-[var(--gs-text-muted)]">PT</span>
                    <span className="text-[var(--gs-text)]">
                      {pt?.name || '--'}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-[var(--gs-text-muted)]">
                      Hình thức
                    </span>
                    <span className="text-[var(--gs-text)]">
                      {trainingType === 'one_to_one'
                        ? 'PT 1-1'
                        : 'PT nhóm'}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-[var(--gs-text-muted)]">
                      Ngày
                    </span>

                    <span className="text-[var(--gs-text)]">
                      {date
                        ? new Date(date).toLocaleDateString('vi-VN')
                        : '--'}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-[var(--gs-text-muted)]">
                      Giờ
                    </span>

                    <span className="text-[var(--gs-text)]">
                      {slot || '--'}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-[var(--gs-text-muted)]">
                      Đơn giá
                    </span>

                    <span className="text-[var(--gs-text)]">
                      {unitPrice.toLocaleString('vi-VN')}đ
                    </span>
                  </div>

                  <div className="border-t border-[var(--gs-border)] pt-3">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Tổng thanh toán</span>

                      <span className="text-orange-400">
                        {totalPrice.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateBooking}
                disabled={loading || !!conflictMessage}
                className="w-full rounded-xl bg-orange-600 px-5 py-3 font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Đang xử lý...' : 'Đặt lịch'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </MemberLayout>
  )
}