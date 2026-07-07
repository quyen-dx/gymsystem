import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { message as antdMessage } from 'antd'
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
  const bookingPtId = pt?.ptId || ptId
  const [trainingType, setTrainingType] = useState<'one_to_one' | 'group'>('one_to_one')
  const [date, setDate] = useState('')
  const [slot, setSlot] = useState('')
  const [note, setNote] = useState('')
  const [ptSchedule, setPtSchedule] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<{ date?: string; slot?: string }>({})
  const [conflictMessage, setConflictMessage] = useState('')
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
      antdMessage.error('Không thể tải thông tin PT')
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
    const id = pt?.ptId || ptId

    try {
      const res = await bookingService.checkConflicts({
        ptId: id,
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
    const newErrors: { date?: string; slot?: string } = {}

    if (!date) newErrors.date = 'Vui lòng chọn ngày tập'
    else if (date < today) newErrors.date = 'Ngày tập không thể là quá khứ'
    else if (date > maxDate) newErrors.date = 'Chỉ được đặt lịch tối đa 30 ngày tới'

    if (!slot) newErrors.slot = 'Vui lòng chọn khung giờ'

    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    if (unitPrice <= 0) {
      antdMessage.error('Hình thức tập này chưa được cấu hình giá')
      return
    }

    if (!selectedSlotAvailable) {
      antdMessage.error('Khung giờ này không còn trống')
      return
    }

    if (conflictMessage) {
      antdMessage.error(conflictMessage)
      return
    }

    if (!bookingPtId) {
      antdMessage.error('Không thể xác định thông tin PT')
      return
    }

    try {
      setLoading(true)

      await bookingService.createBooking({
        ptId: bookingPtId,
        date,
        slot,
        note,
        trainingType,
      })

      antdMessage.success('Đặt lịch thành công, chờ PT xác nhận')
      setTimeout(() => navigate('/booking'), 1500)
    } catch (error: any) {
      console.error(error)
      antdMessage.error(error?.response?.data?.message || 'Đặt lịch thất bại')
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
          className="rounded-xl border border-[var(--theme-border)] px-4 py-2 text-sm text-[var(--theme-text)] hover:bg-white/10"
        >
          ← Quay lại danh sách PT
        </button>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[24px] border border-[var(--theme-border)] bg-white/5 p-6">
            <h1 className="text-2xl font-bold text-[var(--theme-text)]">
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
                    <h2 className="text-xl font-bold text-[var(--theme-text)]">
                      {pt.name || pt.email || 'PT'}
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

                <div className="mt-6 rounded-2xl border border-[var(--theme-border)] bg-black/20 p-4">
                  <h3 className="font-semibold text-[var(--theme-text)]">
                    Giá dịch vụ
                  </h3>

                  <div className="mt-3 grid grid-cols-2 gap-3">

                    <div>
                      <p className="text-xs text-[var(--theme-muted)]">
                        PT 1-1
                      </p>

                      <p className="mt-1 text-lg font-bold text-[var(--theme-accent)]">
                        {(pt.oneToOnePrice || 0).toLocaleString('vi-VN')}đ/buổi
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-[var(--theme-muted)]">
                        PT nhóm
                      </p>

                      <p className="mt-1 text-lg font-bold text-[var(--theme-accent)]">
                        {(pt.groupPrice || 0).toLocaleString('vi-VN')}đ/người
                      </p>
                    </div>

                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-5 text-sm text-[var(--theme-muted)]">
                Đang tải thông tin PT...
              </p>
            )}
          </div>

          <div className="rounded-[24px] border border-[var(--theme-border)] bg-white/5 p-6">
            <h1 className="text-2xl font-bold text-[var(--theme-text)]">
              Đặt lịch tập
            </h1>

            <div className="mt-5 space-y-5">
              <div>
                <label className="mb-2 block text-sm text-[var(--theme-muted)]">
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
                        ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)]'
                        : 'border-[var(--theme-border)]'
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
                        ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)]'
                        : 'border-[var(--theme-border)]'
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
                  <p className="mt-3 text-xs text-[var(--theme-muted)]">
                    Sức chứa nhóm: {pt?.groupCapacity || 5} người
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm text-[var(--theme-muted)]">
                  Chọn ngày tập
                </label>

                <input
                  type="date"
                  min={today}
                  max={maxDate}
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value)
                    if (errors.date) setErrors((prev) => ({ ...prev, date: undefined }))
                  }}
                  className={`w-full rounded-xl border bg-transparent p-3 text-[var(--theme-text)] ${
                    errors.date
                      ? 'border-red-500'
                      : 'border-[var(--theme-border)]'
                  }`}
                />
                {errors.date && (
                  <p className="mt-1 text-xs text-red-400">{errors.date}</p>
                )}
              </div>

              {date && (
                <div>
                  <label className="mb-2 block text-sm text-[var(--theme-muted)]">
                    Chọn khung giờ
                  </label>

                  <div className={`grid grid-cols-2 gap-3 md:grid-cols-3 ${errors.slot ? 'rounded-xl border border-red-500 p-3' : ''}`}>
                    {SLOT_OPTIONS.map((item) => {
                      const available = ptSchedule[item]
                      const disabled = available === false

                      return (
                        <button
                          key={item}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            setSlot(item)
                            if (errors.slot) setErrors((prev) => ({ ...prev, slot: undefined }))
                          }}
                          className={`rounded-xl border p-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            slot === item
                              ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)] text-[var(--theme-accent)]'
                              : disabled
                                ? 'border-red-500/30 bg-red-500/10 text-red-300'
                                : 'border-[var(--theme-border)] text-[var(--theme-muted)] hover:bg-white/10'
                          }`}
                        >
                          {item}
                        </button>
                      )
                    })}
                  </div>
                  {errors.slot && (
                    <p className="mt-1 text-xs text-red-400">{errors.slot}</p>
                  )}
                </div>
              )}

              {conflictMessage && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                  {conflictMessage}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm text-[var(--theme-muted)]">
                  Ghi chú / Mục tiêu
                </label>

                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  placeholder="Nhập ghi chú hoặc mục tiêu buổi tập..."
                  className="w-full rounded-xl border border-[var(--theme-border)] bg-transparent p-3 text-[var(--theme-text)] outline-none"
                />
              </div>

              <div className="rounded-xl border border-[var(--theme-border)] bg-black/20 p-5">
                <h3 className="font-semibold text-[var(--theme-text)]">
                  Thông tin đặt lịch
                </h3>

                <div className="mt-4 space-y-3 text-sm">

                  <div className="flex justify-between">
                    <span className="text-[var(--theme-muted)]">PT</span>
                    <span className="text-[var(--theme-text)]">
                      {pt?.name || '--'}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-[var(--theme-muted)]">
                      Hình thức
                    </span>
                    <span className="text-[var(--theme-text)]">
                      {trainingType === 'one_to_one'
                        ? 'PT 1-1'
                        : 'PT nhóm'}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-[var(--theme-muted)]">
                      Ngày
                    </span>

                    <span className="text-[var(--theme-text)]">
                      {date
                        ? new Date(date).toLocaleDateString('vi-VN')
                        : '--'}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-[var(--theme-muted)]">
                      Giờ
                    </span>

                    <span className="text-[var(--theme-text)]">
                      {slot || '--'}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-[var(--theme-muted)]">
                      Đơn giá
                    </span>

                    <span className="text-[var(--theme-text)]">
                      {unitPrice.toLocaleString('vi-VN')}đ
                    </span>
                  </div>

                  <div className="border-t border-[var(--theme-border)] pt-3">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Tổng thanh toán</span>

                      <span className="text-[var(--theme-accent)]">
                        {totalPrice.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateBooking}
                disabled={loading || !!conflictMessage || !date || !slot}
                className="w-full rounded-xl bg-[var(--theme-button-bg)] px-5 py-3 font-semibold text-white transition hover:bg-[var(--theme-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
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