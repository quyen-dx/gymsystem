import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { bookingService } from '../../../services/bookingService'
import type { Booking } from '../../../services/bookingService'
import { trainerService } from '../../../services/trainerService'
import type { PT } from '../../../types/admin/trainer'

const SLOTS = [
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

export default function BookingPage() {
  const { t } = useTranslation()

  const [pts, setPts] = useState<PT[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [waitlist, setWaitlist] = useState<string[]>([])

  const [ptId, setPtId] = useState('')
  const [date, setDate] = useState('')
  const [slot, setSlot] = useState('')
  const [note, setNote] = useState('')
  
  // Recurring booking
  const [isRecurring, setIsRecurring] = useState(false)
  const [weeks, setWeeks] = useState(1)

  // PT schedule
  const [ptSchedule, setPtSchedule] = useState<Record<string, boolean>>({})
  const [showSchedule, setShowSchedule] = useState(false)

  // Review
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [conflictMessage, setConflictMessage] = useState('')
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create')

  const selectedPT = useMemo(
    () => pts.find((pt) => pt._id === ptId),
    [pts, ptId],
  )

  const loadPTs = async () => {
    try {
      const res = await trainerService.getAvailablePTs()
      setPts(res.data.pts || [])
    } catch (error) {
      console.error(error)
      setMessage(t('booking.error_load_pts'))
    }
  }

  const loadMyBookings = async () => {
    try {
      const res = await bookingService.getMyBookings()
      const data = res.data?.data || res.data || []
      setBookings(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error(error)
    }
  }

  const loadPTSchedule = async (ptUserId: string) => {
    if (!date) return
    try {
      const res = await trainerService.getPTAvailability(ptUserId, date)
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

      if (hasConflict) {
        setConflictMessage(t('booking.error_conflict'))
      } else {
        setConflictMessage('')
      }
    } catch (error) {
      console.error(error)
      setConflictMessage('')
    }
  }

  const handleCreateBooking = async () => {
    if (!ptId || !date || !slot) {
      setMessage(t('booking.error_required_fields'))
      return
    }

    if (conflictMessage) {
      setMessage(t('booking.error_conflict'))
      return
    }

    try {
      setLoading(true)
      setMessage('')

      if (isRecurring && weeks > 1) {
        await bookingService.createRecurringBooking({
          ptId,
          date,
          slot,
          note,
          weeks,
        })
        setMessage(t('booking.success_recurring', { weeks }))
      } else {
        await bookingService.createBooking({
          ptId,
          date,
          slot,
          note,
        })
        setMessage(t('booking.success_booking'))
      }

      setSlot('')
      setNote('')
      setIsRecurring(false)
      setWeeks(1)
      await loadMyBookings()
    } catch (error: any) {
      console.error(error)
      setMessage(
        error?.response?.data?.message || t('booking.error_booking'),
      )
    } finally {
      setLoading(false)
    }
  }

  const handleCancelBooking = async (id: string) => {
    const reason = window.prompt(t('booking.cancel_reason_prompt'))

    if (!reason) return

    try {
      await bookingService.cancelBooking(id, reason)
      setMessage(t('booking.success_cancel'))
      await loadMyBookings()
    } catch (error: any) {
      console.error(error)
      setMessage(
        error?.response?.data?.message || t('booking.error_cancel'),
      )
    }
  }

  const handleJoinWaitlist = async (slotId: string) => {
    try {
      await bookingService.joinWaitlist(slotId)
      setMessage(t('booking.success_waitlist'))
      setWaitlist([...waitlist, slotId])
    } catch (error: any) {
      console.error(error)
      setMessage(error?.response?.data?.message || t('booking.error_waitlist'))
    }
  }

  const handleReviewBooking = async (id: string) => {
    if (rating < 1 || rating > 5) {
      setMessage(t('booking.error_review_rating'))
      return
    }

    try {
      setLoading(true)
      await bookingService.reviewPT(id, rating, comment)
      setMessage(t('booking.success_review'))
      setReviewingId(null)
      setRating(5)
      setComment('')
      await loadMyBookings()
    } catch (error: any) {
      console.error(error)
      setMessage(error?.response?.data?.message || t('booking.error_review'))
    } finally {
      setLoading(false)
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return t('booking.status_pending')
      case 'confirmed':
        return t('booking.status_confirmed')
      case 'cancelled':
        return t('booking.status_cancelled')
      case 'completed':
        return t('booking.status_completed')
      default:
        return status
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

  useEffect(() => {
    loadPTs()
    loadMyBookings()
  }, [])

  useEffect(() => {
    checkConflict()
  }, [ptId, date, slot])

  useEffect(() => {
    if (ptId && date) {
      loadPTSchedule(ptId)
    }
  }, [ptId, date])

  return (
    <MemberLayout>
      <div className="member-page space-y-6">

        {message && (
          <div className="rounded-2xl border border-[var(--gs-border)] bg-white/5 p-4 text-sm text-[var(--gs-text)]">
            {message}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 border-b border-[var(--gs-border)]">
          <button
            onClick={() => setActiveTab('create')}
            className={`pb-3 font-semibold transition ${
              activeTab === 'create'
                ? 'border-b-2 border-orange-500 text-orange-500'
                : 'text-[var(--gs-text-muted)] hover:text-[var(--gs-text)]'
            }`}
          >
            {t('booking.new_booking')}
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`pb-3 font-semibold transition ${
              activeTab === 'list'
                ? 'border-b-2 border-orange-500 text-orange-500'
                : 'text-[var(--gs-text-muted)] hover:text-[var(--gs-text)]'
            }`}
          >
            {t('booking.my_schedule', { count: bookings.length })}
          </button>
        </div>

        {activeTab === 'create' && (
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[24px] border border-[var(--gs-border)] bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-[var(--gs-text)]">
                {t('booking.create_title')}
              </h2>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-sm text-[var(--gs-text-muted)]">
                    {t('booking.select_pt')}
                  </label>

                  <select
                    value={ptId}
                    onChange={(e) => setPtId(e.target.value)}
                    className="w-full rounded-xl border border-[var(--gs-border)] bg-transparent p-3 text-[var(--gs-text)]"
                  >
                    <option className="bg-white text-black" value="">
                      {t('booking.select_pt_placeholder')}
                    </option>

                    {pts.map((pt) => (
                      <option className="bg-white text-black" key={pt._id} value={pt._id}>
                        {pt.name || pt.email || 'PT'} {pt.rating && `(${pt.rating}⭐)`}
                      </option>
                    ))}
                  </select>
                </div>

                {ptId && (
                  <button
                    type="button"
                    onClick={() => setShowSchedule(!showSchedule)}
                    className="text-sm text-orange-400 hover:underline"
                  >
                    {showSchedule
                      ? t('booking.hide_schedule')
                      : t('booking.show_schedule')}{' '}
                    {t('booking.pt_work_schedule')}
                  </button>
                )}

                {showSchedule && (
                  <div className="rounded-xl border border-[var(--gs-border)] bg-black/20 p-4 text-sm">
                    <p className="mb-2 font-semibold text-[var(--gs-text)]">
                      {t('booking.pt_work_schedule')}
                    </p>
                    <div className="mt-3 grid grid-cols-4 gap-3">
                      {Object.entries(ptSchedule).slice(0, 20).map(([slot, available]) => (
                        <div
                          key={slot}
                          className={`rounded-xl border p-3 text-center ${
                            available
                              ? 'border-green-500/30 bg-green-500/10'
                              : 'border-red-500/30 bg-red-500/10'
                          }`}
                        >
                          <div className="font-medium text-[var(--gs-text)]">
                            {slot}
                          </div>

                          <div
                            className={`mt-2 text-xs font-semibold ${
                              available
                                ? 'text-green-300'
                                : 'text-red-300'
                            }`}
                          >
                            {available ? t('booking.available') : t('booking.unavailable')}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-5 gap-2">
                      {Object.entries(ptSchedule).slice(0, 20).map(([slot, available]) => (
                        <div
                          key={slot}
                          className={`rounded px-2 py-1 text-center text-xs ${
                            available
                              ? 'bg-green-500/20 text-green-300'
                              : 'bg-red-500/20 text-red-300'
                          }`}
                        >
                          {slot}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm text-[var(--gs-text-muted)]">
                    {t('booking.training_date')}
                  </label>

                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-[var(--gs-border)] bg-transparent p-3 text-[var(--gs-text)]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-[var(--gs-text-muted)]">
                    {t('booking.time_slot')}
                  </label>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {SLOTS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setSlot(item)}
                        className={`rounded-xl border p-3 text-sm transition ${
                          slot === item
                            ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                            : 'border-[var(--gs-border)] text-[var(--gs-text-muted)] hover:bg-white/10'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                {conflictMessage && (
                  <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                    {conflictMessage}
                    <button
                      type="button"
                      onClick={() => handleJoinWaitlist(`${ptId}_${date}_${slot}`)}
                      className="mt-2 block text-orange-400 hover:underline"
                    >
                      {t('booking.join_waitlist')}
                    </button>
                  </div>
                )}

                <div className="rounded-xl border border-[var(--gs-border)] bg-black/20 p-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm text-[var(--gs-text)]">{t('booking.recurring_weekly')}</span>
                  </label>

                  {isRecurring && (
                    <div className="mt-3">
                      <label className="mb-2 block text-sm text-[var(--gs-text-muted)]">
                        {t('booking.weeks_count', { count: weeks })}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="12"
                        value={weeks}
                        onChange={(e) => setWeeks(Number(e.target.value))}
                        className="w-full"
                      />
                      <p className="mt-2 text-xs text-[var(--gs-text-muted)]">
                        {t('booking.book_weeks', { weeks })}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm text-[var(--gs-text-muted)]">
                    {t('booking.note_goal')}
                  </label>

                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={4}
                    placeholder={t('booking.note_placeholder')}
                    className="w-full rounded-xl border border-[var(--gs-border)] bg-transparent p-3 text-[var(--gs-text)] outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleCreateBooking}
                  disabled={loading || !!conflictMessage}
                  className="w-full rounded-xl bg-orange-600 px-5 py-3 font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading
                    ? t('booking.booking_loading')
                    : isRecurring
                    ? t('booking.booking_weeks', { weeks })
                    : t('booking.booking')}
                </button>
              </div>
            </div>

            <div className="rounded-[24px] border border-[var(--gs-border)] bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-[var(--gs-text)]">
                {t('booking.selected_info')}
              </h2>

              <div className="mt-5 space-y-3 text-sm text-[var(--gs-text-muted)]">
                <p>
                  PT:{' '}
                  <span className="text-[var(--gs-text)]">
                    {selectedPT
                      ? selectedPT.name || selectedPT.email || 'PT'
                      : t('booking.not_selected')}
                  </span>
                </p>

                {selectedPT && (
                  <>
                    <p>
                      {t('booking.pt_rating_label')}{' '}
                      <span className="text-yellow-400">
                        {selectedPT.rating || 0} ⭐
                      </span>
                    </p>
                    <p>
                      {t('booking.experience_label')}{' '}
                      <span className="text-[var(--gs-text)]">
                        {selectedPT.experienceYears || 0} năm
                      </span>
                    </p>
                    {selectedPT.specialties && selectedPT.specialties.length > 0 && (
                      <p>
                        {t('booking.specialties_label')}{' '}
                        <span className="text-[var(--gs-text)]">
                          {selectedPT.specialties.join(', ')}
                        </span>
                      </p>
                    )}
                  </>
                )}

                <p>
                  {t('booking.date_label')}{' '}
                  <span className="text-[var(--gs-text)]">
                    {date ? new Date(date).toLocaleDateString('vi-VN') : t('booking.not_selected')}
                  </span>
                </p>

                <p>
                  {t('booking.time_label')}{' '}
                  <span className="text-[var(--gs-text)]">
                    {slot || t('booking.not_selected')}
                  </span>
                </p>

                <p>
                  {t('booking.status_after_booking')}{' '}
                  <span className="text-yellow-300">{t('booking.pending_confirmation')}</span>
                </p>

                {isRecurring && (
                  <p>
                    {t('booking.recurring_label')}{' '}
                    <span className="text-orange-300">
                      {t('booking.weeks_weekly', { weeks })}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'list' && (
          <div className="rounded-[24px] border border-[var(--gs-border)] bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-[var(--gs-text)]">
              {t('booking.my_schedule_title')}
            </h2>

            <div className="mt-5 space-y-4">
              {bookings.length === 0 && (
                <p className="text-sm text-[var(--gs-text-muted)]">
                  {t('booking.no_bookings')}
                </p>
              )}

              {bookings.map((booking) => (
                <div
                  key={booking._id}
                  className="rounded-2xl border border-[var(--gs-border)] bg-black/10 p-4"
                >
                  {reviewingId === booking._id ? (
                    // Review form
                    <div className="space-y-3">
                      <h3 className="font-semibold text-[var(--gs-text)]">
                        {t('booking.review_session')}
                      </h3>

                      <div>
                        <label className="mb-2 block text-sm text-[var(--gs-text-muted)]">
                          {t('booking.rating_label')}
                        </label>
                        <div className="flex gap-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => setRating(star)}
                              className={`text-2xl transition ${
                                star <= rating ? 'text-yellow-400' : 'text-gray-500'
                              }`}
                            >
                              ⭐
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm text-[var(--gs-text-muted)]">
                          {t('booking.comment_label')}
                        </label>
                        <textarea
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          rows={3}
                          placeholder={t('booking.comment_placeholder')}
                          className="w-full rounded-xl border border-[var(--gs-border)] bg-transparent p-3 text-[var(--gs-text)] outline-none"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleReviewBooking(booking._id)}
                          disabled={loading}
                          className="flex-1 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
                        >
                          {loading ? t('booking.booking_loading') : t('booking.submit_review')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewingId(null)}
                          className="flex-1 rounded-xl border border-[var(--gs-border)] px-4 py-2 text-sm text-[var(--gs-text-muted)] hover:bg-white/5"
                        >
                          {t('booking.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Booking display
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-semibold text-[var(--gs-text)]">
                            PT:{' '}
                            {booking.ptId?.name ||
                              booking.ptId?.email ||
                              'PT'}
                          </p>

                          <p className="mt-1 text-sm text-[var(--gs-text-muted)]">
                            {t('booking.date_label')} {new Date(booking.date).toLocaleDateString('vi-VN')}
                          </p>

                          <p className="text-sm text-[var(--gs-text-muted)]">
                            {t('booking.time_label')} {booking.slot}
                          </p>

                          {booking.note && (
                            <p className="text-sm text-[var(--gs-text-muted)]">
                              {t('booking.note_label')} {booking.note}
                            </p>
                          )}

                          {booking.isViolation && (
                            <p className="mt-1 text-xs text-red-300">
                              {t('booking.violation_warning')}
                            </p>
                          )}
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
                        {booking.status === 'completed' && (
                          <button
                            type="button"
                            onClick={() => setReviewingId(booking._id)}
                            className="rounded-xl border border-orange-500/40 px-4 py-2 text-sm text-orange-300 hover:bg-orange-500/10"
                          >
                            {t('booking.rate')}
                          </button>
                        )}

                        {booking.status !== 'cancelled' &&
                          booking.status !== 'completed' && (
                            <button
                              type="button"
                              onClick={() => handleCancelBooking(booking._id)}
                              className="rounded-xl border border-red-500/40 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10"
                            >
                              {t('booking.cancel_booking')}
                            </button>
                          )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MemberLayout>
  )
}
