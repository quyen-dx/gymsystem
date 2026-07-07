import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { bookingService } from '../../../services/bookingService'
import type { Booking } from '../../../services/bookingService'
import { membershipService } from '../../../services/membershipService'
import { trainerService } from '../../../services/trainerService'
import type { PT } from '../../../types/admin/trainer'

export default function BookingPage() {
  const navigate = useNavigate()

  const [pts, setPts] = useState<PT[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])

  const [search, setSearch] = useState('')
  const [specialtyFilter, setSpecialtyFilter] = useState('')
  const [minExperience, setMinExperience] = useState('')
  const [detailPT, setDetailPT] = useState<PT | null>(null)

  // Review
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')

  const [loading, setLoading] = useState(false)
  const [membershipLoading, setMembershipLoading] = useState(true)
  const [canBook, setCanBook] = useState(false)
  const [planName, setPlanName] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create')
  const [expandedSpecs, setExpandedSpecs] = useState<string | null>(null)

  const specialtyOptions = useMemo(() => {
    return Array.from(
      new Set(
        pts.flatMap((pt) => pt.specialties || []).filter(Boolean),
      ),
    )
  }, [pts])

  const filteredPTs = useMemo(() => {
    return pts.filter((pt) => {
      const keyword = search.trim().toLowerCase()

      const matchSearch =
        !keyword ||
        pt.name?.toLowerCase().includes(keyword) ||
        pt.email?.toLowerCase().includes(keyword) ||
        pt.specialties?.some((s) => s.toLowerCase().includes(keyword))

      const matchSpecialty =
        !specialtyFilter ||
        pt.specialties?.some((s) =>
          s.toLowerCase().includes(specialtyFilter.toLowerCase()),
        )

      const matchExperience =
        !minExperience ||
        Number(pt.experienceYears || 0) >= Number(minExperience)

      return matchSearch && matchSpecialty && matchExperience
    })
  }, [pts, search, specialtyFilter, minExperience])

  const loadPTs = async () => {
    try {
      const res = await trainerService.getAvailablePTs()
      setPts(res.data.pts || [])
    } catch (error) {
      console.error(error)
      setMessage('Không thể tải danh sách PT')
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

  const handleCancelBooking = async (id: string) => {
    const reason = window.prompt('Nhập lý do hủy:')

    if (!reason) return

    try {
      await bookingService.cancelBooking(id, reason)
      setMessage('Hủy lịch thành công')
      await loadMyBookings()
    } catch (error: any) {
      console.error(error)
      setMessage(
        error?.response?.data?.message || 'Hủy lịch thất bại',
      )
    }
  }

  const handleReviewBooking = async (id: string) => {
    if (rating < 1 || rating > 5) {
      setMessage('Vui lòng chọn đánh giá từ 1-5 sao')
      return
    }

    try {
      setLoading(true)
      await bookingService.reviewPT(id, rating, comment)
      setMessage('Đánh giá thành công')
      setReviewingId(null)
      setRating(5)
      setComment('')
      await loadMyBookings()
    } catch (error: any) {
      console.error(error)
      setMessage(error?.response?.data?.message || 'Đánh giá thất bại')
    } finally {
      setLoading(false)
    }
  }

  const handlePayBooking = async (id: string) => {
    try {
      setLoading(true)

      await bookingService.payBooking(id)

      setMessage('Thanh toán thành công')

      await loadMyBookings()
    } catch (error: any) {
      console.error(error)

      setMessage(
        error?.response?.data?.message ||
        'Thanh toán thất bại',
      )
    } finally {
      setLoading(false)
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Chờ xác nhận'
      case 'awaiting_payment':
        return 'Chờ thanh toán'
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-300'
      case 'awaiting_payment':
        return 'bg-[var(--theme-accent-muted)] text-[var(--theme-accent)]'
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
    setMembershipLoading(true)
    membershipService.getMyMembership()
      .then((res) => {
        const membership = res.data.membership
        const allowed = membership?.status === 'active' && Number(membership.remainingDays || 0) > 0

        if (allowed) {
          const features = membership.plan?.featuresVi || membership.plan?.featuresEn || []
          const hasPT = features.some((f: string) => /huấn luyện viên|personal training/i.test(f))
          setPlanName(membership.planNameVi || membership.planNameEn || null)

          if (hasPT) {
            setCanBook(true)
            loadPTs()
            loadMyBookings()
          } else {
            setCanBook(false)
          }
        } else {
          setPlanName(null)
          setCanBook(false)
        }
      })
      .catch(() => {
        setCanBook(false)
        setPlanName(null)
        setMessage('Không thể tải thông tin gói tập')
      })
      .finally(() => setMembershipLoading(false))
  }, [])

  // Refresh PT list khi tab được focus lại
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && canBook) {
        loadPTs()
        loadMyBookings()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [canBook])

  const handleRefresh = () => {
    if (canBook) {
      loadPTs()
      loadMyBookings()
    } else {
      setMembershipLoading(true)
      membershipService.getMyMembership()
        .then((res) => {
          const membership = res.data.membership
          const allowed = membership?.status === 'active' && Number(membership.remainingDays || 0) > 0
          if (allowed) {
            const features = membership.plan?.featuresVi || membership.plan?.featuresEn || []
            const hasPT = features.some((f: string) => /huấn luyện viên|personal training/i.test(f))
            setPlanName(membership.planNameVi || membership.planNameEn || null)
            setCanBook(hasPT)
            if (hasPT) {
              loadPTs()
              loadMyBookings()
            }
          } else {
            setPlanName(null)
            setCanBook(false)
          }
        })
        .catch(() => {
          setCanBook(false)
          setPlanName(null)
        })
        .finally(() => setMembershipLoading(false))
    }
  }

  return (
    <MemberLayout>
      <div className="member-page space-y-6">
        {membershipLoading && (
          <div className="rounded-[24px] border border-[var(--theme-border)] bg-white/5 p-6 text-sm text-[var(--theme-muted)]">
            Đang kiểm tra thông tin gói tập...
          </div>
        )}

        {!membershipLoading && !canBook && (
          <div className="mx-auto max-w-2xl rounded-[24px] border border-[var(--theme-border)] bg-white/5 p-8 text-center">
            {planName ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--theme-accent)]">
                  GÓI TẬP KHÔNG PHÙ HỢP
                </p>
                <h1 className="mt-3 text-2xl font-bold text-[var(--theme-text)]">
                  Gói &ldquo;{planName}&rdquo; không bao gồm huấn luyện viên
                </h1>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--theme-muted)]">
                  Vui lòng chọn gói tập có quyền lợi huấn luyện viên để đặt lịch với PT
                </p>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => navigate('/plans')}
                    className="rounded-xl bg-[var(--theme-button-bg)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--theme-accent-hover)]"
                  >
                    Xem gói tập
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--theme-accent)]">
                  CẦN GÓI TẬP
                </p>
                <h1 className="mt-3 text-2xl font-bold text-[var(--theme-text)]">
                  Bạn cần có gói tập để đặt lịch
                </h1>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--theme-muted)]">
                  Vui lòng chọn gói tập phù hợp để sử dụng dịch vụ đặt lịch với PT
                </p>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => navigate('/plans')}
                    className="rounded-xl bg-[var(--theme-button-bg)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--theme-accent-hover)]"
                  >
                    Xem gói tập
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/my-membership')}
                    className="rounded-xl border border-[var(--theme-border)] px-5 py-3 text-sm font-semibold text-[var(--theme-text)] transition hover:bg-white/10"
                  >
                    Gói của tôi
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {!membershipLoading && canBook && (
          <>

        {message && (
          <div className="rounded-2xl border border-[var(--theme-border)] bg-white/5 p-4 text-sm text-[var(--theme-text)]">
            {message}
          </div>
        )}

        <div className="grid gap-3 rounded-[24px] border border-[var(--theme-border)] bg-white/5 p-5 md:grid-cols-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm PT theo tên, email, chuyên môn..."
            className="rounded-xl border border-[var(--theme-border)] bg-transparent p-3 text-[var(--theme-text)] outline-none"
          />

          <select
            value={specialtyFilter}
            onChange={(e) => setSpecialtyFilter(e.target.value)}
            className="rounded-xl border border-[var(--theme-border)] bg-transparent p-3 text-[var(--theme-text)]"
          >
            <option className="bg-white text-black" value="">
              Tất cả chuyên môn
            </option>

            {specialtyOptions.map((specialty) => (
              <option className="bg-white text-black" key={specialty} value={specialty}>
                {specialty}
              </option>
            ))}
          </select>

          <select
            value={minExperience}
            onChange={(e) => setMinExperience(e.target.value)}
            className="rounded-xl border border-[var(--theme-border)] bg-transparent p-3 text-[var(--theme-text)]"
          >
            <option className="bg-white text-black" value="">
              Tất cả kinh nghiệm
            </option>
            <option className="bg-white text-black" value="1">
              Từ 1 năm trở lên
            </option>
            <option className="bg-white text-black" value="3">
              Từ 3 năm trở lên
            </option>
            <option className="bg-white text-black" value="5">
              Từ 5 năm trở lên
            </option>
          </select>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-[var(--theme-border)]">
          <button
            onClick={() => setActiveTab('create')}
            className={`pb-3 font-semibold transition ${
              activeTab === 'create'
                ? 'border-b-2 border-[var(--theme-accent)] text-[var(--theme-accent)]'
                : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]'
            }`}
          >
            Đặt lịch mới
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`pb-3 font-semibold transition ${
              activeTab === 'list'
                ? 'border-b-2 border-[var(--theme-accent)] text-[var(--theme-accent)]'
                : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]'
            }`}
          >
            {`Lịch của tôi (${bookings.length})`}
          </button>
        </div>

        {activeTab === 'create' && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-[var(--theme-text)]">
                  Chọn huấn luyện viên PT
                </h2>
                <p className="mt-2 text-sm text-[var(--theme-muted)]">
                  Xem thông tin PT, chuyên môn, đánh giá và đặt lịch tập phù hợp với mục tiêu của bạn.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                className="shrink-0 rounded-xl border border-[var(--theme-border)] px-4 py-2 text-sm text-[var(--theme-text)] hover:bg-white/10"
              >
                Làm mới
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredPTs.map((pt) => (
                <div
                  key={pt._id}
                  className="rounded-[24px] border border-[var(--theme-border)] bg-white/5 p-5 transition hover:-translate-y-1 hover:bg-white/10"
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={pt.avatar || '/default-avatar.png'}
                      alt={pt.name || 'PT'}
                      className="h-20 w-20 rounded-2xl object-cover"
                    />

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-lg font-bold text-[var(--theme-text)]">
                        {pt.name || pt.email || 'PT'}
                      </h3>

                      <p className="mt-1 text-sm text-yellow-400">
                        ⭐ {pt.rating || 0} / 5
                      </p>

                      <p className="mt-1 text-xs text-[var(--theme-muted)]">
                        {pt.experienceYears || 0} năm kinh nghiệm
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--theme-muted)]">
                      Chuyên môn
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {pt.specialties && pt.specialties.length > 0 ? (
                        <>
                          {(expandedSpecs === pt._id ? pt.specialties : pt.specialties.slice(0, 4)).map((item) => (
                            <span
                              key={item}
                              className="rounded-full bg-[var(--theme-accent-muted)] px-3 py-1 text-xs text-[var(--theme-accent)]"
                            >
                              {item}
                            </span>
                          ))}
                          {pt.specialties.length > 4 && (
                            <button
                              onClick={() => setExpandedSpecs(expandedSpecs === pt._id ? null : pt._id)}
                              className="rounded-full border border-dashed border-[var(--theme-accent-border)] px-3 py-1 text-xs text-[var(--theme-accent)] hover:bg-[var(--theme-accent-muted)]"
                            >
                              {expandedSpecs === pt._id ? 'Thu gọn' : `+${pt.specialties.length - 4}`}
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="text-sm text-[var(--theme-muted)]">
                          Chưa cập nhật
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-[var(--theme-border)] bg-black/20 p-3">
                      <p className="text-xs text-[var(--theme-muted)]">1-1</p>
                      <p className="mt-1 font-semibold text-[var(--theme-accent)]">
                        {(pt.oneToOnePrice || 0).toLocaleString('vi-VN')}đ/buổi
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[var(--theme-border)] bg-black/20 p-3">
                      <p className="text-xs text-[var(--theme-muted)]">Nhóm</p>
                      <p className="mt-1 font-semibold text-[var(--theme-accent)]">
                        {(pt.groupPrice || 0).toLocaleString('vi-VN')}đ/người
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setDetailPT(pt)}
                      className="flex-1 rounded-xl border border-[var(--theme-border)] px-4 py-2 text-sm font-semibold text-[var(--theme-text)] transition hover:bg-white/10"
                    >
                      Xem chi tiết
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate(`/booking/${pt._id}`)}
                      className="flex-1 rounded-xl bg-[var(--theme-button-bg)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--theme-accent-hover)]"
                    >
                      Đặt lịch
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {detailPT && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                <div className="w-full max-w-2xl rounded-[24px] border border-[var(--theme-border)] bg-[var(--theme-bg)] p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <img
                        src={detailPT.avatar || '/default-avatar.png'}
                        alt={detailPT.name || 'PT'}
                        className="h-20 w-20 rounded-2xl object-cover"
                      />

                      <div>
                        <h3 className="text-xl font-bold text-[var(--theme-text)]">
                          {detailPT.name || detailPT.email || 'PT'}
                        </h3>
                        <p className="mt-1 text-sm text-yellow-400">
                          ⭐ {detailPT.rating || 0} / 5
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDetailPT(null)}
                      className="rounded-xl border border-[var(--theme-border)] px-3 py-2 text-sm text-[var(--theme-muted)] hover:bg-white/10"
                    >
                      Đóng
                    </button>
                  </div>

                  <div className="mt-5 space-y-4 text-sm">
                    <p className="text-[var(--theme-muted)]">
                      Kinh nghiệm:{' '}
                      <span className="text-[var(--theme-text)]">
                        {detailPT.experienceYears || 0} năm
                      </span>
                    </p>

                    <p className="text-[var(--theme-muted)]">
                      Chuyên môn:{' '}
                      <span className="text-[var(--theme-text)]">
                        {detailPT.specialties?.length
                          ? detailPT.specialties.join(', ')
                          : 'Chưa cập nhật'}
                      </span>
                    </p>

                    <div className="rounded-2xl border border-[var(--theme-border)] bg-black/20 p-4">
                      <p className="mb-3 font-semibold text-[var(--theme-text)]">Giá dịch vụ</p>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-[var(--theme-muted)]">PT 1-1</p>
                          <p className="mt-1 font-semibold text-[var(--theme-accent)]">
                            {(detailPT.oneToOnePrice || 0).toLocaleString('vi-VN')}đ/buổi
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-[var(--theme-muted)]">PT nhóm</p>
                          <p className="mt-1 font-semibold text-[var(--theme-accent)]">
                            {(detailPT.groupPrice || 0).toLocaleString('vi-VN')}đ/người
                          </p>
                        </div>
                      </div>

                      <p className="mt-3 text-xs text-[var(--theme-muted)]">
                        Sức chứa nhóm: {detailPT.groupCapacity || 5} người
                      </p>
                    </div>

                    <p className="leading-6 text-[var(--theme-muted)]">
                      {detailPT.bio || 'PT chưa cập nhật giới thiệu.'}
                    </p>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setDetailPT(null)}
                      className="flex-1 rounded-xl border border-[var(--theme-border)] px-4 py-3 text-sm font-semibold text-[var(--theme-text)] hover:bg-white/10"
                    >
                      Đóng
                    </button>

                    <button
                      onClick={() => navigate(`/booking/${detailPT._id}`)}
                      className="flex-1 rounded-xl bg-[var(--theme-button-bg)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--theme-accent-hover)]"
                    >
                      Đặt lịch
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'list' && (
          <div className="rounded-[24px] border border-[var(--theme-border)] bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-[var(--theme-text)]">
              Lịch của tôi
            </h2>

            <div className="mt-5 space-y-4">
              {bookings.length === 0 && (
                <p className="text-sm text-[var(--theme-muted)]">
                  Chưa có lịch đặt nào
                </p>
              )}

              {bookings.map((booking) => (
                <div
                  key={booking._id}
                  className="rounded-2xl border border-[var(--theme-border)] bg-black/10 p-4"
                >
                  {reviewingId === booking._id ? (
                    // Review form
                    <div className="space-y-3">
                      <h3 className="font-semibold text-[var(--theme-text)]">
                        Đánh giá buổi tập
                      </h3>

                      <div>
                        <label className="mb-2 block text-sm text-[var(--theme-muted)]">
                          Đánh giá:
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
                        <label className="mb-2 block text-sm text-[var(--theme-muted)]">
                          Nhận xét:
                        </label>
                        <textarea
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          rows={3}
                          placeholder="Nhập nhận xét của bạn..."
                          className="w-full rounded-xl border border-[var(--theme-border)] bg-transparent p-3 text-[var(--theme-text)] outline-none"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleReviewBooking(booking._id)}
                          disabled={loading}
                          className="flex-1 rounded-xl bg-[var(--theme-button-bg)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--theme-accent-hover)] disabled:opacity-60"
                        >
                          {loading ? 'Đang xử lý...' : 'Gửi đánh giá'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewingId(null)}
                          className="flex-1 rounded-xl border border-[var(--theme-border)] px-4 py-2 text-sm text-[var(--theme-muted)] hover:bg-white/5"
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
                          <p className="font-semibold text-[var(--theme-text)]">
                            PT:{' '}
                            {booking.ptId?.name ||
                              booking.ptId?.email ||
                              'PT'}
                          </p>

                          <p className="mt-1 text-sm text-[var(--theme-muted)]">
                            {'Ngày: ' + new Date(booking.date).toLocaleDateString('vi-VN')}
                          </p>

                          <p className="text-sm text-[var(--theme-muted)]">
                            {'Giờ: ' + booking.slot}
                          </p>

                          <p className="text-sm text-[var(--theme-muted)]">
                            Hình thức:{' '}
                            {booking.trainingType === 'group'
                              ? 'PT nhóm'
                              : 'PT 1-1'}
                          </p>

                          <p className="text-sm text-[var(--theme-muted)]">
                            Chi phí:{' '}
                            {booking.totalAmount?.toLocaleString('vi-VN')}đ
                          </p>

                          {booking.note && (
                            <p className="text-sm text-[var(--theme-muted)]">
                              {'Ghi chú: ' + booking.note}
                            </p>
                          )}

                          {booking.isViolation && (
                            <p className="mt-1 text-xs text-red-300">
                              ⚠ Đã vi phạm - vui lòng liên hệ staff
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

                          {booking.status === 'awaiting_payment' && (
                            <p className="max-w-[220px] text-xs text-[var(--theme-accent)]">
                              PT đã xác nhận lịch. Vui lòng thanh toán để hoàn tất đặt lịch.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--theme-border)] pt-3">
                        {booking.status === 'completed' && (
                          <button
                            type="button"
                            onClick={() => setReviewingId(booking._id)}
                            className="rounded-xl border border-[var(--theme-accent-border)] px-4 py-2 text-sm text-[var(--theme-accent)] hover:bg-[var(--theme-accent-muted)]"
                          >
                            Đánh giá
                          </button>
                        )}

                        {booking.status === 'awaiting_payment' && (
                          <button
                            type="button"
                            onClick={() => handlePayBooking(booking._id)}
                            className="rounded-xl bg-[var(--theme-button-bg)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--theme-accent-hover)]"
                          >
                            Thanh toán
                          </button>
                        )}

                        {booking.status !== 'cancelled' &&
                          booking.status !== 'completed' && (
                            <button
                              type="button"
                              onClick={() => handleCancelBooking(booking._id)}
                              className="rounded-xl border border-red-500/40 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10"
                            >
                              Hủy lịch
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
          </>
        )}
      </div>
    </MemberLayout>
  )
}
