import { ArrowUpOutlined, CheckCircleFilled, CloseCircleOutlined, CreditCardOutlined, DownOutlined, ExclamationCircleFilled, ExclamationCircleOutlined, HistoryOutlined, InfoCircleOutlined, MailOutlined, SwapOutlined, WalletOutlined } from '@ant-design/icons'
import { Button, Card, Descriptions, Empty, List, Modal, Radio, Spin, Table, Tabs, Tag, Tooltip, message } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import PolicyConsentCard from '../../../components/wallet/PolicyConsentCard'
import api from '../../../services/api'
import { useWallet } from '../../../context/WalletProvider'
import { acceptMultiplePolicyConsent } from '../../../utils/policyConsent'
import { membershipService, type CancellationRequest, type MembershipPeriod, type MembershipRenewal, type MyMembership, type MyMembershipCycle, type PendingCancelRequest, type RefundInfo } from '../../../services/membershipService'
import type { PlanFeature } from '../../../services/planFeatureService'
import MembershipBenefits from '../../../components/membership/MembershipBenefits'

const formatMoney = (value?: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`
const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString('vi-VN') : '-'

function InfoCell({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`flex flex-col gap-0.5 bg-[var(--gs-card)] px-4 py-3.5 ${wide ? 'sm:col-span-2 lg:col-span-1' : ''}`}>
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--gs-text-soft)]">{label}</span>
      <span className="text-sm font-semibold text-[var(--gs-text)] break-all">{value}</span>
    </div>
  )
}

export default function MyMembershipPage() {
  const { wallet, refreshWallet } = useWallet()
  const statusMeta: Record<string, { color: string; label: string }> = {
    active: { color: 'success', label: 'Đang hoạt động' },
    expiring_soon: { color: 'success', label: 'Đang hoạt động' },
    expires_today: { color: 'success', label: 'Đang hoạt động' },
    expired: { color: 'error', label: 'Đã hết hạn' },
    cancelled: { color: 'default', label: 'Đã hủy' },
    refunded: { color: 'default', label: 'Đã hoàn tiền' },
    cancel_requested: { color: 'warning', label: 'Đang chờ phê duyệt hủy' },
  }
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [membership, setMembership] = useState<MyMembership | null>(null)
  const [cycle, setCycle] = useState<MyMembershipCycle | null>(null)
  const [refundInfo, setRefundInfo] = useState<RefundInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingCancel, setPendingCancel] = useState<CancellationRequest | null>(null)
  const [, setLastCancelRequest] = useState<CancellationRequest | null>(null)
  const [pendingCancelRequest, setPendingCancelRequest] = useState<PendingCancelRequest | null>(null)
  const [, setCanRenew] = useState(false)
  const [, setRenewalThresholdDays] = useState(7)
  const [renewModalOpen, setRenewModalOpen] = useState(false)
  const [renewing, setRenewing] = useState(false)
  const [selectedMultiplier, setSelectedMultiplier] = useState(1)
  const [renewals, setRenewals] = useState<MembershipRenewal[]>([])
  const [periods, setPeriods] = useState<MembershipPeriod[]>([])
  const [cancelPeriodModal, setCancelPeriodModal] = useState<{ open: boolean; period: MembershipPeriod | null }>({ open: false, period: null })
  const [cancellingPeriod, setCancellingPeriod] = useState(false)
  const [batchCancelDays, setBatchCancelDays] = useState(0)
  const [batchCancelModal, setBatchCancelModal] = useState<{ open: boolean; loading: boolean; totalRefund: number; count: number }>({ open: false, loading: false, totalRefund: 0, count: 0 })
  const [tickedPolicies, setTickedPolicies] = useState<Record<string, { type: string; version: string }> | null>(null)
  const [consentSubmitted, setConsentSubmitted] = useState(false)
  const consentReady = tickedPolicies !== null && Object.keys(tickedPolicies).length > 0
  const [successModalOpen, setSuccessModalOpen] = useState(false)
  const [renewResult, setRenewResult] = useState<{
    newEndDate?: string
    amount: number
    walletBalance: number
    planName: string
  } | null>(null)

  const [changeModalOpen, setChangeModalOpen] = useState(false)
  const [availablePlans, setAvailablePlans] = useState<any>(null)
  const [plansLoading, setPlansLoading] = useState(false)
  const [changeLoading, setChangeLoading] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<any>(null)
  const [renewalHandlingOpen, setRenewalHandlingOpen] = useState(false)
  const [renewalAction, setRenewalAction] = useState<'cancel' | 'convert' | null>(null)
  const [changeHistory, setChangeHistory] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('info')

  useEffect(() => {
    if (renewModalOpen) {
      setTickedPolicies(null)
      setConsentSubmitted(false)
    }
  }, [renewModalOpen])

  useEffect(() => {
    if (searchParams.get('payment') === 'success') {
      message.success('Thanh toán thành công!')
    }
  }, [searchParams])

  const loadData = () => {
    setLoading(true)
    Promise.all([
      membershipService.getMyMembership(),
      membershipService.getMyCancelRequests(),
      membershipService.getMyRenewals(),
      membershipService.getMyPeriods(),
    ])
      .then(([membershipRes, cancelRes, renewalsRes, periodsRes]) => {
        const m = membershipRes.data.membership
        setMembership(m)
        const cycleData = membershipRes.data.cycle
        console.log('[DEBUG] cycle:', cycleData)
        setCycle(cycleData || null)
        setCanRenew(membershipRes.data.canRenew)
        setRenewalThresholdDays(membershipRes.data.renewalThresholdDays ?? 7)
        setPendingCancelRequest(membershipRes.data.pendingCancelRequest || null)
        setRefundInfo(membershipRes.data.refundInfo || null)
        setRenewals(renewalsRes.data.renewals || [])
        setPeriods(periodsRes.data.periods || [])

        const requests = cancelRes.data.cancellationRequests || []
        const pending = requests.find((r) => r.status === 'pending') || null
        setPendingCancel(pending)
        setLastCancelRequest(requests[0] || null)
      })
      .catch(() => message.error('Không thể tải thông tin gói tập'))
      .finally(() => setLoading(false))
  }

  useEffect(loadData, [])



  const memberPlanFeatures = useMemo(() => {
    return membership?.plan?.featureIds || []
  }, [membership?.plan])

  const isCancelled = membership?.status === 'cancelled'
  const isPendingCancel = !!pendingCancel
  const isCancelRequested = membership?.status === 'cancel_requested'
  const planName = membership?.plan?.nameVi || membership?.planNameVi || '-'
  const planPrice = membership?.price || membership?.plan?.price || 0
  const progressPercent = useMemo(() => {
    if (isCancelled || isCancelRequested) return 0
    const duration = membership?.durationDays || membership?.plan?.durationDays || 0
    if (!duration || !membership) return 0
    return Math.max(0, Math.min(100, Math.round((membership.remainingDays / duration) * 100)))
  }, [membership, isCancelled, isCancelRequested])

  const handleCancelPeriod = async () => {
    const period = cancelPeriodModal.period
    if (!period) return
    setCancellingPeriod(true)
    try {
      const res = await membershipService.autoCancelPeriod(period._id)
      message.success(res.data.message)
      setCancelPeriodModal({ open: false, period: null })
      loadData()
      refreshWallet()
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Hủy thất bại')
    } finally {
      setCancellingPeriod(false)
    }
  }

  const handleBatchCancelShowModal = () => {
    if (batchCancelDays <= 0) return
    const targets = pendingPeriods.slice(-batchCancelDays)
    const totalRefund = targets.reduce((s, p) => s + (p.price || 0), 0)
    setBatchCancelModal({ open: true, loading: false, totalRefund, count: targets.length })
  }

  const handleBatchCancelConfirm = async () => {
    if (batchCancelDays <= 0) return
    const targets = pendingPeriods.slice(-batchCancelDays)
    setBatchCancelModal((prev) => ({ ...prev, loading: true }))
    try {
      for (const p of targets) {
        await membershipService.autoCancelPeriod(p._id)
      }
      const totalRefund = targets.reduce((s, p) => s + (p.price || 0), 0)
      message.success(`Đã hoàn ${formatMoney(totalRefund)} vào Ví GymPro.`)
      setBatchCancelDays(0)
      setBatchCancelModal({ open: false, loading: false, totalRefund: 0, count: 0 })
      loadData()
      refreshWallet()
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Hủy thất bại')
      setBatchCancelModal((prev) => ({ ...prev, loading: false }))
    }
  }

  const handleRenew = async () => {
    if (!consentReady) return
    setRenewing(true)
    try {
      if (!consentSubmitted) {
        await acceptMultiplePolicyConsent(
          Object.values(tickedPolicies!).map((p) => ({
            policyType: p.type,
            policyVersion: p.version,
            context: 'renew',
          })),
        )
        setConsentSubmitted(true)
      }
      const activePlanId = membership?.planId || membership?.plan?._id
      if (!activePlanId) {
        throw new Error('Không xác định được gói tập cần gia hạn. Vui lòng tải lại trang.')
      }

      const res = await membershipService.checkoutRenew(activePlanId, selectedMultiplier)
      if (res.data?.status === 'PAID') {
        setRenewResult({
          newEndDate: res.data.newEndDate,
          amount: res.data.payment?.amount || planPrice * selectedMultiplier,
          walletBalance: res.data.walletBalance || 0,
          planName,
        })
        setRenewModalOpen(false)
        setSuccessModalOpen(true)
        loadData()
        refreshWallet()
      } else if (res.data?.paymentUrl) {
        window.location.href = res.data.paymentUrl
      } else {
        message.error('Không thể tạo phiên thanh toán')
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Gia hạn thất bại')
    } finally {
      setRenewing(false)
    }
  }

  const fetchAvailablePlans = async () => {
    setPlansLoading(true)
    try {
      const { data } = await api.get('/memberships/available-plans')
      setAvailablePlans(data)
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể tải danh sách gói')
    } finally {
      setPlansLoading(false)
    }
  }

  const handleChangePlan = async (cancelRenewals = false) => {
    if (!selectedPlan) return
    setChangeLoading(true)
    try {
      const res = await membershipService.changePlanCheckout(selectedPlan._id, cancelRenewals)
      const d = res.data
      if (d?.status && d.status !== 'PAID' && d.paymentUrl) {
        window.location.href = d.paymentUrl
        return
      }
      const msg = d.creditToWallet > 0
        ? `Đổi gói thành công! Đã hoàn ${formatMoney(d.creditToWallet)} vào ví.`
        : d.amountToPay > 0
          ? `Đổi gói thành công! Đã thanh toán ${formatMoney(d.amountToPay)}.`
          : 'Đổi gói thành công!'
      message.success(msg)
      setChangeModalOpen(false)
      setSelectedPlan(null)
      setAvailablePlans(null)
      setRenewalHandlingOpen(false)
      setRenewalAction(null)
      loadData()
      refreshWallet()
      fetchChangeHistory()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Đổi gói thất bại')
    } finally {
      setChangeLoading(false)
    }
  }

  const handleChangePlanClick = () => {
    if (availablePlans?.hasPendingRenewals) {
      setRenewalHandlingOpen(true)
    } else {
      handleChangePlan(false)
    }
  }

  const fetchChangeHistory = async () => {
    try {
      const { data } = await api.get('/memberships/change-history')
      setChangeHistory(data.history || [])
    } catch { /* ignore */ }
  }

  const balanceSufficient = (wallet?.balance || 0) >= planPrice * selectedMultiplier
  const renewTotal = planPrice * selectedMultiplier
  const renewRemaining = Math.max(0, renewTotal - (wallet?.balance || 0))

  const pendingPeriods = useMemo(() => periods.filter(p => {
    const ds = p.displayStatus || p.status
    return ds === 'PENDING' || ds === 'REJECTED'
  }), [periods])

  const completedPeriods = useMemo(() => periods.filter(p => {
    const ds = p.displayStatus || p.status
    return ds === 'COMPLETED'
  }), [periods])

  const cancelledPeriods = useMemo(() => periods.filter(p => {
    const ds = p.displayStatus || p.status
    return ds === 'CANCELLED' || ds === 'REFUNDED'
  }), [periods])

  const planDays = membership?.durationDays || membership?.plan?.durationDays || 0
  const multiplierOptions = [1, 2, 3]

  if (loading) {
    return (
      <MemberLayout>
        <div className="flex min-h-[320px] items-center justify-center"><Spin /></div>
      </MemberLayout>
    )
  }

  return (
    <MemberLayout>
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="m-0 text-xs uppercase tracking-[0.24em] text-[var(--gs-text-soft)]">Gói tập của tôi</p>
            <h1 className="m-0 mt-2 text-3xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">Gói tập của tôi</h1>
          </div>
          {membership ? (
            <Button href="/plans">Xem gói tập</Button>
          ) : (
            <Button href="/plans">Đăng ký gói mới</Button>
          )}
        </div>

        {/* Không có membership + không có pending cycle */}
        {!membership && !cycle && (
          <Card>
            <Empty description="Bạn hiện chưa có gói tập đang hoạt động.">
              <Button type="primary" href="/plans">Đăng ký gói</Button>
            </Empty>
          </Card>
        )}

        {/* Case 2: Có membership đang hoạt động / chờ xử lý */}
        {membership && isPendingCancel ? (
          <Card>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="m-0 text-2xl font-semibold">{planName}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Tag icon={<ExclamationCircleOutlined />} color="warning">Đang chờ hủy</Tag>
                </div>
              </div>
            </div>

            <div className="mb-5 rounded-xl border border-[var(--gs-warning)] bg-[var(--gs-warning-bg)] p-4">
              <div className="flex gap-2">
                <InfoCircleOutlined className="mt-0.5 text-[var(--gs-warning)]" />
                <div className="text-sm text-[var(--gs-text)] whitespace-pre-line">
                  {'Yêu cầu hủy gói tập của bạn đang được xử lý.'}
                </div>
              </div>
            </div>

            <div className="mb-5 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-5">
              <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--gs-text-soft)]">Chi tiết hủy</h4>
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-[var(--gs-text-soft)]">Ngày yêu cầu</div>
                  <div className="mt-0.5 text-base font-semibold text-[var(--gs-text)]">{formatDate(pendingCancel.createdAt)}</div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-[var(--gs-text-soft)]">Phương thức hoàn tiền</div>
                  <div className="mt-0.5 text-base font-semibold text-[var(--gs-text)]">
                    {pendingCancel.refundEligible ? ({
                      WALLET: 'Hoàn vào ví',
                      NONE: 'Không hoàn tiền',
                    }[pendingCancel.refundMethod] || pendingCancel.refundMethod) : 'Không đủ điều kiện hoàn tiền'}
                  </div>
                </div>
                {pendingCancel.refundEligible && (
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-[var(--gs-text-soft)]">Tổng tiền hoàn dự kiến</div>
                    <div className="mt-0.5 text-base font-semibold text-[var(--gs-success)]">{formatMoney(pendingCancel.estimatedRefundAmount)}</div>
                  </div>
                )}
                {pendingCancel.refundEligible && (
                  <div className="sm:col-span-2">
                    <div className="mt-1 text-xs leading-relaxed text-[var(--gs-text-muted)]">
                      {pendingCancel.renewalRefunds?.length > 0
                        ? `Đã bao gồm ${pendingCancel.renewalRefunds.length} gói gia hạn chưa sử dụng.`
                        : 'Không có khoản hoàn nào đủ điều kiện.'}
                    </div>
                  </div>
                )}
                {pendingCancel.refundEligible && (
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-[var(--gs-text-soft)]">Trạng thái hoàn tiền</div>
                    <div className="mt-0.5">
                      <Tag color={{
                        PENDING: 'warning',
                        COMPLETED: 'success',
                        NOT_APPLICABLE: 'default',
                      }[pendingCancel.refundStatus] || 'default'}>
                        {{
                          PENDING: 'Đang chờ',
                          COMPLETED: 'Đã hoàn thành',
                          NOT_APPLICABLE: 'Không áp dụng',
                        }[pendingCancel.refundStatus] || pendingCancel.refundStatus}
                      </Tag>
                    </div>
                  </div>
                )}
                {pendingCancel.reason && (
                  <div className="sm:col-span-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-[var(--gs-text-soft)]">Lý do hủy</div>
                    <div className="mt-0.5 text-base text-[var(--gs-text)]">{pendingCancel.reason}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px rounded-xl border border-[var(--gs-border)] overflow-hidden bg-[var(--gs-border)]">
              <InfoCell label="Gói tập" value={planName} />
              <InfoCell label="Giá" value={formatMoney(membership.price || membership.plan?.price)} />
              <InfoCell label="Thời hạn" value={`${formatDate(membership.startDate)} → ${formatDate(membership.endDate)}`} wide />
            </div>

            <MembershipBenefits features={memberPlanFeatures} />
          </Card>
        ) : membership && isCancelRequested ? (
          <Card>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="m-0 text-2xl font-semibold">{planName}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Tag icon={<ExclamationCircleOutlined />} color="warning">Đang chờ phê duyệt hủy</Tag>
                </div>
              </div>
            </div>

            <div className="mb-5 rounded-xl border border-[var(--gs-warning)] bg-[var(--gs-warning-bg)] p-4">
              <div className="flex gap-2">
                <InfoCircleOutlined className="mt-0.5 text-[var(--gs-warning)]" />
                <div className="text-sm text-[var(--gs-text)] whitespace-pre-line">
                  {'Yêu cầu hủy gói tập của bạn đang được xử lý bởi nhân viên. Bạn vẫn có thể tập luyện trong thời gian chờ duyệt.'}
                </div>
              </div>
            </div>

            {pendingCancelRequest?.reason && (
              <div className="mb-5 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-5">
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--gs-text-soft)]">Chi tiết yêu cầu</h4>
                <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-[var(--gs-text-soft)]">Ngày yêu cầu</div>
                    <div className="mt-0.5 text-base font-semibold text-[var(--gs-text)]">{formatDate(pendingCancelRequest.createdAt)}</div>
                  </div>
                  {pendingCancelRequest.reason && (
                    <div className="sm:col-span-2">
                      <div className="text-xs font-medium uppercase tracking-wide text-[var(--gs-text-soft)]">Lý do hủy</div>
                      <div className="mt-0.5 text-base text-[var(--gs-text)]">{pendingCancelRequest.reason}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px rounded-xl border border-[var(--gs-border)] overflow-hidden bg-[var(--gs-border)]">
              <InfoCell label="Gói tập" value={planName} />
              <InfoCell label="Giá" value={formatMoney(membership.price || membership.plan?.price)} />
              <InfoCell label="Thời hạn" value={`${formatDate(membership.startDate)} → ${formatDate(membership.endDate)}`} wide />
            </div>

            <MembershipBenefits features={memberPlanFeatures} />
          </Card>
        ) : membership && cycle?.status === 'active' && !isPendingCancel && !isCancelRequested ? (
          <Card className="overflow-hidden">
            {/* Header: plan name + status badge */}
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="m-0 text-3xl font-bold text-[var(--gs-text)]">{planName}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold ${
                    membership.displayStatus === 'expired'
                      ? 'bg-red-500/15 text-red-600'
                      : membership.displayStatus === 'cancelled' || membership.displayStatus === 'refunded'
                        ? 'bg-gray-500/15 text-gray-500'
                        : 'bg-green-500/15 text-green-600'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      membership.displayStatus === 'expired'
                        ? 'bg-red-500'
                        : membership.displayStatus === 'cancelled' || membership.displayStatus === 'refunded'
                          ? 'bg-gray-500'
                          : 'bg-green-500'
                    }`} />
                    {(statusMeta[membership.displayStatus] || statusMeta.active).label}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                <Button type="primary" icon={<WalletOutlined />} onClick={() => { setSelectedMultiplier(1); setRenewModalOpen(true) }}>
                  Gia hạn
                </Button>
                {membership?.status === 'active' && membership?.displayStatus !== 'expired' && (
                  <Button icon={<SwapOutlined />} onClick={() => { setSelectedPlan(null); fetchAvailablePlans(); setChangeModalOpen(true) }}>
                    Đổi gói tập
                  </Button>
                )}
                {membership?.status === 'active' && membership?.displayStatus !== 'expired' && (
                  <Button icon={<HistoryOutlined />} onClick={() => { setActiveTab('history'); fetchChangeHistory() }}>
                    Lịch sử
                  </Button>
                )}
                {membership?.status === 'active' && membership.remainingDays > 0 && (
                  <>
                    <div className="h-6 w-px bg-[var(--gs-border)]" />
                    <Button
                      danger
                      icon={<CloseCircleOutlined />}
                      onClick={() => navigate('/my-membership/cancel-request')}
                    >
                      Hủy gói
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Expired warning */}
            {membership?.status === 'active' && membership.remainingDays <= 0 && (
              <div className="mb-5 rounded-xl border border-[var(--gs-warning)] bg-[var(--gs-warning-bg)] p-4">
                <div className="flex items-center gap-2 text-[var(--gs-warning)]">
                  <ExclamationCircleOutlined />
                  <span className="font-medium">Gói tập của bạn đã hết hạn. Vui lòng gia hạn để tiếp tục sử dụng.</span>
                </div>
              </div>
            )}

            {/* Progress bar: theme-colored gradient */}
            <div className="mb-6">
              <div className="flex items-center justify-end mb-1.5">
                <span className="text-xs font-medium text-[var(--gs-text-soft)]">{progressPercent}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--gs-border)]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progressPercent}%`,
                    background: progressPercent <= 20
                      ? 'linear-gradient(90deg, #f87171, #ef4444)'
                      : `linear-gradient(90deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 70%, #000))`,
                  }}
                />
              </div>
            </div>

            {/* Info grid: responsive, replaces Descriptions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px rounded-xl border border-[var(--gs-border)] overflow-hidden bg-[var(--gs-border)]">
              <InfoCell label="Gói tập" value={planName} />
              <InfoCell label="Giá" value={formatMoney(membership.price || membership.plan?.price)} />
              <InfoCell label="Ngày đăng ký" value={formatDate(cycle?.purchasedAt || membership?.createdAt)} />
              <InfoCell label="Ngày bắt đầu" value={cycle?.startDate ? formatDate(cycle.startDate) : formatDate(cycle?.purchasedAt || membership?.createdAt)} />
              <InfoCell label="Ngày hết hạn" value={formatDate(cycle?.expiresAt || undefined)} wide />
              <InfoCell
                label="Còn lại"
                value={
                  membership.displayStatus === 'cancelled' || membership.displayStatus === 'refunded'
                    ? 'Đã hủy'
                    : membership.remainingDays > 0
                      ? `${membership.remainingDays} ngày`
                      : 'Đã hết hạn'
                }
              />
              <div className="col-span-1 sm:col-span-2 lg:col-span-3 flex flex-col gap-0.5 bg-[var(--gs-card)] px-4 py-3.5">
                <span className="text-xs font-medium uppercase tracking-wide text-[var(--gs-text-soft)]">Quyền hoàn tiền</span>
                <span className={`text-sm font-semibold ${refundInfo?.eligible ? 'text-[var(--gs-success)]' : 'text-[var(--gs-text-muted)]'}`}>
                  {refundInfo?.eligible ? '🟢 Có thể hoàn tiền' : '🔒 Không áp dụng'}
                </span>
                <span className="text-xs leading-relaxed text-[var(--gs-text-muted)]">
                  {refundInfo
                    ? refundInfo.reason
                    : 'Không thể xác định điều kiện hoàn tiền.'}
                </span>
                {refundInfo?.eligible && (
                  <span className="text-xs text-[var(--gs-text-soft)]">
                    Hạn hoàn tiền: {formatDate(refundInfo.refundDeadline || undefined)}
                  </span>
                )}
              </div>
            </div>

            <MembershipBenefits features={memberPlanFeatures} />

          </Card>
        ) : null}

        {/* Periods tabs (only for active membership) */}
        {membership && !isPendingCancel && !isCancelRequested && periods.length > 0 && (
          <Card className="mt-6" styles={{ body: { padding: '20px 24px' } }}>
            <h3 className="mb-4 text-base font-semibold text-[var(--gs-text)]">Lịch sử gói</h3>

            <Tabs
              items={[
                {
                  key: 'pending',
                  label: `Gia hạn sắp tới (${pendingPeriods.length})`,
                  children: pendingPeriods.length === 0 ? (
                    <Empty description="Không có gia hạn nào" />
                  ) : (
                    <div className="space-y-3">
                      {pendingPeriods.length > 1 && (
                        <Card size="small" className="mb-3 border border-[var(--gs-info-border)]" styles={{ body: { padding: '16px' } }}>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <InfoCircleOutlined className="text-[var(--gs-info)]" />
                            <span className="text-sm font-semibold text-[var(--gs-text)]">Hủy hàng loạt</span>
                          </div>
                          <Radio.Group
                            value={batchCancelDays}
                            onChange={(e) => setBatchCancelDays(e.target.value)}
                            className="w-full"
                          >
                            {[1, 2, 3].filter(n => n <= pendingPeriods.length).map((n) => {
                              const dayCount = pendingPeriods.slice(-n).reduce((s, p) => s + p.totalDays, 0)
                              return (
                                <div key={n} className="flex items-center gap-2 py-1">
                                  <Radio value={n}>
                                    <span className="text-sm">Hủy {dayCount} ngày mới nhất</span>
                                  </Radio>
                                </div>
                              )
                            })}
                          </Radio.Group>
                          <Button
                            size="small"
                            danger
                            className="mt-2"
                            disabled={batchCancelDays <= 0}
                            onClick={handleBatchCancelShowModal}
                          >
                            Xác nhận hủy
                          </Button>
                        </Card>
                      )}
                      {pendingPeriods.map((p) => {
                        const isRejected = (p.displayStatus || p.status) === 'REJECTED'
                        const globalIdx = periods.findIndex(pp => pp._id === p._id) + 1
                        return (
                          <Card key={p._id} size="small" className="border-[var(--gs-border)] bg-[var(--gs-elevated)]" styles={{ body: { padding: '16px' } }}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-[var(--gs-text)]">Đợt {globalIdx}</span>
                                  {isRejected ? (
                                    <Tag icon={<ExclamationCircleOutlined />} color="orange">Yêu cầu bị từ chối</Tag>
                                  ) : (
                                    <Tag color="blue">Chờ kích hoạt</Tag>
                                  )}
                                </div>
                                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--gs-text-soft)]">
                                  <span>{formatDate(p.startDate)} → {formatDate(p.endDate)}</span>
                                  {p.price > 0 && <span className="font-medium text-[var(--gs-accent)]">{formatMoney(p.price)}</span>}
                                </div>
                                {isRejected && p.rejectionReason && (
                                  <div className="mt-1.5 text-xs text-[var(--gs-text-muted)] italic">Lý do: {p.rejectionReason}</div>
                                )}
                              </div>
                              <Button size="small" danger onClick={() => setCancelPeriodModal({ open: true, period: p })}>
                                {isRejected ? 'Gửi lại yêu cầu' : 'Hủy gia hạn'}
                          </Button>
                          </div>
                        </Card>
                      );
                    })}
                    </div>
                  ),
                },
                {
                  key: 'completed',
                  label: `Gói đã tập xong (${completedPeriods.length})`,
                  children: completedPeriods.length === 0 ? (
                    <Empty description="Chưa có gói nào hoàn thành" />
                  ) : (
                    <div className="space-y-3">
                      {completedPeriods.map((p) => {
                        const cGlobalIdx = periods.findIndex(pp => pp._id === p._id) + 1
                        return (
                        <Card key={p._id} size="small" className="border-[var(--gs-border)] bg-[var(--gs-elevated)] opacity-60" styles={{ body: { padding: '16px' } }}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-[var(--gs-text)]">Đợt {cGlobalIdx}</span>
                                <Tag icon={<CheckCircleFilled />} color="success">Đã sử dụng</Tag>
                              </div>
                              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--gs-text-soft)]">
                                <span>{formatDate(p.startDate)} → {formatDate(p.endDate)}</span>
                                {p.price > 0 && <span className="font-medium text-[var(--gs-accent)]">{formatMoney(p.price)}</span>}
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                    </div>
                  ),
                },
                {
                  key: 'payments',
                  label: `Lịch sử thanh toán (${renewals.length})`,
                  children: renewals.length === 0 ? (
                    <Empty description="Chưa có giao dịch gia hạn nào" />
                  ) : (
                    <div className="space-y-3">
                      {renewals.map((renewal) => {
                        const renewalPlan = renewal.plan || (typeof renewal.planId === 'object' ? renewal.planId : null)
                        const renewalPlanName = renewalPlan?.nameVi || planName
                        return (
                          <Card key={renewal._id} size="small" className="border-[var(--gs-border)] bg-[var(--gs-elevated)]" styles={{ body: { padding: '16px' } }}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-[var(--gs-text)]">Gia hạn {renewalPlanName}</span>
                                  <Tag icon={<CheckCircleFilled />} color="success">Đã thanh toán</Tag>
                                </div>
                                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--gs-text-soft)]">
                                  <span>{dayjs(renewal.renewedAt).format('DD/MM/YYYY HH:mm')}</span>
                                  <span>+{renewal.days} ngày</span>
                                  <span>{formatDate(renewal.oldEndDate)} → {formatDate(renewal.newEndDate)}</span>
                                </div>
                              </div>
                              <span className="text-sm font-bold text-[var(--gs-accent)]">{formatMoney(renewal.price)}</span>
                            </div>
                          </Card>
                        )
                      })}
                    </div>
                  ),
                },
                {
                  key: 'cancelled',
                  label: `Đã hủy (${cancelledPeriods.length})`,
                  children: cancelledPeriods.length === 0 ? (
                    <Empty description="Không có gói nào bị hủy" />
                  ) : (
                    <div className="space-y-3">
                      {cancelledPeriods.map((p) => {
                        const isRefunded = p.refundStatus === 'refunded'
                        const ccGlobalIdx = periods.findIndex(pp => pp._id === p._id) + 1
                        return (
                          <Card key={p._id} size="small" className={`border-[var(--gs-border)] bg-[var(--gs-elevated)] ${!isRefunded ? 'opacity-60' : ''}`} styles={{ body: { padding: '16px' } }}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-[var(--gs-text)]">Đợt {ccGlobalIdx}</span>
                                  {isRefunded ? (
                                    <Tag icon={<CheckCircleFilled />} color="success">Đã hoàn tiền</Tag>
                                  ) : (
                                    <Tag color="error">Đã hủy</Tag>
                                  )}
                                </div>
                                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--gs-text-soft)]">
                                  <span>{formatDate(p.startDate)} → {formatDate(p.endDate)}</span>
                                  {p.price > 0 && <span className="font-medium text-[var(--gs-accent)]">{formatMoney(p.price)}</span>}
                                </div>
                                {isRefunded ? (
                                  <div className="mt-3 space-y-1.5 rounded-lg border border-[var(--gs-success)]/30 bg-[var(--gs-success-bg)] p-3">
                                    <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--gs-success)]">
                                      <CheckCircleFilled />
                                      <span>Hoàn vào Ví GymPro</span>
                                    </div>
                                    <div className="text-sm font-bold text-[var(--gs-success)]">{formatMoney(p.refundAmount || p.price)}</div>
                                    {p.refundAt && (
                                      <div className="text-xs text-[var(--gs-text-muted)]">
                                        Ngày hoàn: {dayjs(p.refundAt).format('DD/MM/YYYY HH:mm')}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="mt-2 text-xs text-[var(--gs-text-muted)] italic">Không hoàn tiền</div>
                                )}
                              </div>
                            </div>
                          </Card>
                        )
                      })}
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        )}

      </div>

      <Modal
        title={
          <span className="inline-flex items-center gap-2">
            <WalletOutlined />
            Xác nhận gia hạn
          </span>
        }
        open={renewModalOpen}
        onCancel={() => setRenewModalOpen(false)}
        destroyOnClose
        footer={null}
        className="policy-ant-modal membership-renew-modal"
        width={760}
        centered
      >
        <div className="policy-modal-shell">
          <div className="policy-modal-content">
            <div className="space-y-3">
              <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-[var(--gs-text-soft)]">Gói tập</span>
                  <span className="text-sm font-semibold text-[var(--gs-text)]">{planName}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4 max-[480px]:grid-cols-1">
                  <div className="rounded-lg border border-[var(--gs-border)] p-3">
                    <div className="text-xs text-[var(--gs-text-muted)]">Thời hạn hiện tại</div>
                    <div className="mt-0.5 font-semibold">{planDays} ngày</div>
                  </div>
                  <div className="rounded-lg border border-[var(--gs-border)] p-3">
                    <div className="text-xs text-[var(--gs-text-muted)]">Ngày hết hạn hiện tại</div>
                    <div className="mt-0.5 font-semibold">{formatDate(membership?.endDate || cycle?.expiresAt)}</div>
                  </div>
                  <div className="rounded-lg border border-[var(--gs-border)] p-3">
                    <div className="text-xs text-[var(--gs-text-muted)]">Số ngày còn lại</div>
                    <div className={`mt-0.5 font-semibold ${membership && membership.remainingDays > 0 ? 'text-[var(--gs-success)]' : 'text-[var(--gs-error)]'}`}>
                      {membership?.remainingDays ?? 0} ngày
                    </div>
                  </div>
                  <div className="rounded-lg border border-[var(--gs-border)] p-3">
                    <div className="text-xs text-[var(--gs-text-muted)]">Giá gói</div>
                    <div className="mt-0.5 font-semibold text-[var(--gs-accent)]">{formatMoney(planPrice)} / {planDays} ngày</div>
                  </div>
                </div>

                <div className="border-t border-[var(--gs-border)] pt-3">
                  <span className="text-sm font-medium text-[var(--gs-text-soft)]">Chọn thời gian gia hạn</span>
                  <Radio.Group
                    className="renewal-duration-options mt-2 grid w-full grid-cols-1 gap-2 sm:grid-cols-3"
                    value={selectedMultiplier}
                    onChange={(e) => setSelectedMultiplier(e.target.value)}
                  >
                      {multiplierOptions.map((m) => {
                        const days = planDays * m
                        const newEnd = dayjs(membership?.endDate || cycle?.expiresAt).add(days, 'day')
                        return (
                          <Radio.Button
                            key={m}
                            value={m}
                            className="renewal-duration-option !m-0 !flex !h-auto !w-full !items-stretch !px-3 !py-3"
                          >
                            <div className="flex w-full flex-col gap-1.5 text-left">
                              <div className="flex flex-col gap-1">
                                <span className="text-sm font-semibold text-[var(--gs-success)]">
                                  + {days} ngày ({m} tháng)
                                </span>
                                <span className="text-xs text-[var(--gs-text-muted)]">
                                  Hết hạn: {newEnd.format('DD/MM/YYYY')}
                                </span>
                              </div>
                              <span className="mt-1 text-sm font-bold text-[var(--gs-text)]">
                                {formatMoney(planPrice * m)}
                              </span>
                            </div>
                          </Radio.Button>
                        )
                      })}
                  </Radio.Group>
                </div>

                <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-bg-subtle)] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--gs-text-soft)]">Tổng cộng ({selectedMultiplier} tháng)</span>
                    <span className="text-base font-bold text-[var(--gs-accent)]">{formatMoney(planPrice * selectedMultiplier)}</span>
                  </div>
                  <div className="mt-1 text-xs text-[var(--gs-text-muted)]">
                    {formatMoney(planPrice)} × {selectedMultiplier} kỳ ({planDays * selectedMultiplier} ngày)
                  </div>
                </div>

                {balanceSufficient ? (
                  <div className="rounded-xl border border-[var(--gs-success-border)] bg-[var(--gs-success-bg)] p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--gs-success)]">
                      <WalletOutlined />
                      {'Số dư đủ để thanh toán bằng ví'}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm max-[480px]:grid-cols-1">
                      <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-3">
                        <div className="text-xs text-[var(--gs-text-muted)]">Số dư hiện tại</div>
                        <div className="mt-0.5 font-semibold">{formatMoney(wallet?.balance || 0)}</div>
                      </div>
                      <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-3">
                        <div className="text-xs text-[var(--gs-text-muted)]">Số dư sau khi gia hạn</div>
                        <div className="mt-0.5 font-semibold text-[var(--gs-success)]">{formatMoney((wallet?.balance || 0) - renewTotal)}</div>
                      </div>
                    </div>
                  </div>
                ) : (wallet?.balance || 0) > 0 ? (
                  <div className="rounded-xl border border-[var(--gs-warning)] bg-[var(--gs-warning-bg)] p-3 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--gs-warning)]">
                      <WalletOutlined />
                      {'Số dư không đủ — thanh toán kết hợp ví + VNPay'}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm max-[480px]:grid-cols-1">
                      <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-3">
                        <div className="text-xs text-[var(--gs-text-muted)]">Tổng tiền gia hạn</div>
                        <div className="mt-0.5 font-bold">{formatMoney(renewTotal)}</div>
                      </div>
                      <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-3">
                        <div className="text-xs text-[var(--gs-text-muted)]">Số dư ví (sẽ dùng hết)</div>
                        <div className="mt-0.5 font-bold">{formatMoney(wallet?.balance || 0)}</div>
                      </div>
                      <div className="col-span-2 rounded-lg border border-[var(--gs-warning)] bg-[var(--gs-warning-bg)] p-3 max-[480px]:col-span-1">
                        <div className="text-xs text-[var(--gs-warning)]">Còn thiếu — thanh toán qua VNPay</div>
                        <div className="mt-0.5 text-lg font-bold text-[var(--gs-warning)]">{formatMoney(renewRemaining)}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[var(--gs-info-border)] bg-[var(--gs-info-bg)] p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--gs-info)]">
                      <WalletOutlined />
                      {'Ví của bạn hiện không có số dư'}
                    </div>
                    <p className="m-0 text-sm text-[var(--gs-text)]">
                      {'Bạn vẫn có thể thanh toán trực tiếp bằng phương thức khác mà không cần nạp ví.'}
                    </p>
                  </div>
                )}
              </div>
              <PolicyConsentCard
                policies={[
                  { type: 'membership', label: 'Chính sách hội viên' },
                  { type: 'terms', label: 'Điều khoản sử dụng' },
                ]}
                context="renew"
                onTickedChange={(ticked) => {
                  setTickedPolicies(Object.keys(ticked).length > 0 ? ticked : null)
                }}
              />
            </div>
          </div>
          <div className="policy-modal-footer">
            <div className="policy-modal-actions">
              <Button onClick={() => setRenewModalOpen(false)}>
                Hủy
              </Button>
              <Tooltip title={!consentReady ? 'Vui lòng đồng ý với chính sách' : undefined}>
                <Button
                  className="policy-confirm-action"
                  type="primary"
                  icon={balanceSufficient ? <WalletOutlined /> : <CreditCardOutlined />}
                  loading={renewing}
                  disabled={!consentReady}
                  onClick={handleRenew}
                >
                  {balanceSufficient
                    ? 'Xác nhận gia hạn'
                    : `Thanh toán ${formatMoney(renewRemaining)}đ qua VNPay`}
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        title={
          <span className="inline-flex items-center gap-2">
            <ExclamationCircleFilled className="text-red-500" />
            Xác nhận hủy gia hạn
          </span>
        }
        open={cancelPeriodModal.open}
        onCancel={() => setCancelPeriodModal({ open: false, period: null })}
        footer={[
          <Button key="back" onClick={() => setCancelPeriodModal({ open: false, period: null })}>
            Quay lại
          </Button>,
          <Button key="submit" danger type="primary" loading={cancellingPeriod} onClick={handleCancelPeriod}>
            Xác nhận hủy
          </Button>,
        ]}
      >
        {cancelPeriodModal.period && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--gs-text)]">
              Bạn có chắc muốn hủy lần gia hạn này?
            </p>
            <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--gs-text-soft)]">Thời hạn</span>
                <span className="font-medium text-[var(--gs-text)]">
                  {formatDate(cancelPeriodModal.period.startDate)} → {formatDate(cancelPeriodModal.period.endDate)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--gs-text-soft)]">Ngày</span>
                <span className="font-medium text-[var(--gs-success)]">+{cancelPeriodModal.period.totalDays} ngày</span>
              </div>
              {cancelPeriodModal.period.price > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--gs-text-soft)]">Giá</span>
                  <span className="font-medium text-[var(--gs-accent)]">{formatMoney(cancelPeriodModal.period.price)}</span>
                </div>
              )}
            </div>
            <div className="rounded-xl border border-[var(--gs-info-border)] bg-[var(--gs-info-bg)] p-3 text-xs text-[var(--gs-text)]">
              Yêu cầu sẽ được gửi tới nhân viên xem xét. Nhân viên sẽ kiểm tra và phản hồi trong thời gian sớm nhất.
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title={
          <span className="inline-flex items-center gap-2">
            <CheckCircleFilled className="text-[var(--gs-success)]" />
            Gia hạn thành công
          </span>
        }
        open={successModalOpen}
        onCancel={() => setSuccessModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setSuccessModalOpen(false)}>
            Đóng
          </Button>,
        ]}
        centered
      >
        {renewResult && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--gs-success-border)] bg-[var(--gs-success-bg)] p-4">
              <div className="flex items-center gap-2 text-[var(--gs-success)]">
                <CheckCircleFilled />
                <span className="font-semibold">{planName} - Gia hạn thành công</span>
              </div>
            </div>
            <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--gs-text-soft)]">Gói tập</span>
                <span className="text-sm font-semibold text-[var(--gs-text)]">{renewResult.planName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--gs-text-soft)]">Số tháng gia hạn</span>
                <span className="text-sm font-semibold text-[var(--gs-text)]">{selectedMultiplier} tháng</span>
              </div>
              {renewResult.newEndDate && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--gs-text-soft)]">Gia hạn đến hết</span>
                  <span className="text-sm font-semibold text-[var(--gs-success)]">{formatDate(renewResult.newEndDate)}</span>
                </div>
              )}
              <div className="border-t border-[var(--gs-border)] pt-3 flex items-center justify-between">
                <span className="text-sm text-[var(--gs-text-soft)]">Số tiền đã thanh toán</span>
                <span className="text-base font-bold text-[var(--gs-accent)]">{formatMoney(renewResult.amount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--gs-text-soft)]">
                  <WalletOutlined className="mr-1" />
                  Số dư ví còn lại
                </span>
                <span className="text-sm font-semibold text-[var(--gs-success)]">{formatMoney(renewResult.walletBalance)}</span>
              </div>
            </div>
            <div className="rounded-xl border border-[var(--gs-info-border)] bg-[var(--gs-info-bg)] p-4 space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircleFilled className="mt-0.5 text-[var(--gs-info)]" />
                <div className="text-sm text-[var(--gs-text)]">
                  Email xác nhận gia hạn đã được gửi đến email của bạn kèm thông tin đợt tập sắp tới.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MailOutlined className="mt-0.5 text-[var(--gs-info)]" />
                <div className="text-sm text-[var(--gs-text)]">
                  Hệ thống sẽ tự động gửi email khi đợt hiện tại kết thúc và khi đợt mới được kích hoạt.
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Change Plan Modal */}
      <Modal
        title="Đổi gói tập"
        open={changeModalOpen}
        onCancel={() => { setChangeModalOpen(false); setSelectedPlan(null); setAvailablePlans(null) }}
        footer={null}
        width={780}
        centered
      >
        <Spin spinning={plansLoading}>
          {availablePlans ? (
            <div className="space-y-4">
              <Card size="small" className="bg-[var(--gs-bg-subtle)]">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs text-[var(--gs-text-muted)]">Gói hiện tại</div>
                    <div className="mt-1 text-lg font-semibold text-[var(--gs-text)]">{availablePlans.currentPlan?.nameVi || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--gs-text-muted)]">Trạng thái</div>
                    <Tag color="green" className="mt-1">{(statusMeta[availablePlans.cycleStatus] || statusMeta.active).label}</Tag>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--gs-text-muted)]">Số ngày còn lại</div>
                    <div className="mt-1 font-semibold text-[var(--gs-success)]">{availablePlans.remainingDays || 0} ngày</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--gs-text-muted)]">Giá trị còn lại quy đổi</div>
                    <div className="mt-1 font-semibold text-[var(--theme-accent)]">{formatMoney(availablePlans.remainingValue || 0)}</div>
                  </div>
                </div>
              </Card>

              {availablePlans.plans?.length === 0 ? (
                <Empty description="Không có gói nào khác" />
              ) : (
                <List
                  className="rounded-xl border border-[var(--gs-border)]"
                  dataSource={availablePlans.plans}
                  renderItem={(plan: any) => {
                    const isSelected = selectedPlan?._id === plan._id
                    const amountToPay = Number(plan.amountToPay ?? Math.max(0, plan.diff || 0))
                    const creditToWallet = Number(plan.creditToWallet ?? Math.max(0, -(plan.diff || 0)))
                    return (
                      <List.Item
                        className={`cursor-pointer px-4 py-3 transition-colors ${isSelected ? 'bg-[var(--theme-accent)]/10' : 'hover:bg-[var(--gs-border)]/20'}`}
                        onClick={() => setSelectedPlan(plan)}
                      >
                        <div className="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-[var(--gs-text)]">{plan.nameVi}</span>
                              {isSelected && <Tag color="purple">Đang chọn</Tag>}
                            </div>
                            <div className="mt-1 text-sm text-[var(--gs-text-muted)]">
                              {formatMoney(plan.price)} / {plan.durationDays} ngày
                            </div>
                            {plan.descriptionVi && (
                              <div className="mt-1 max-w-xl text-xs text-[var(--gs-text-soft)]">{plan.descriptionVi}</div>
                            )}
                            {plan.featureIds?.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {plan.featureIds.slice(0, 4).map((feature: any) => (
                                  <Tag key={feature._id} style={{ fontSize: 11 }}>{feature.name}</Tag>
                                ))}
                                {plan.featureIds.length > 4 && <Tag style={{ fontSize: 11 }}>+{plan.featureIds.length - 4}</Tag>}
                              </div>
                            )}
                          </div>
                          <div className="rounded-lg bg-[var(--gs-bg-subtle)] px-3 py-2 text-right md:min-w-[150px]">
                            {amountToPay > 0 ? (
                              <>
                                <div className="text-xs text-[var(--gs-text-muted)]">Cần thanh toán</div>
                                <div className="font-bold text-[var(--theme-accent)]">{formatMoney(amountToPay)}</div>
                              </>
                            ) : creditToWallet > 0 ? (
                              <>
                                <div className="text-xs text-[var(--gs-text-muted)]">Hoàn vào ví</div>
                                <div className="font-bold text-green-600">{formatMoney(creditToWallet)}</div>
                              </>
                            ) : (
                              <>
                                <div className="text-xs text-[var(--gs-text-muted)]">Không phát sinh</div>
                                <div className="font-bold text-[var(--gs-text)]">0đ</div>
                              </>
                            )}
                          </div>
                        </div>
                      </List.Item>
                    )
                  }}
                />
              )}

              {selectedPlan && (() => {
                const amountToPay = Number(selectedPlan.amountToPay ?? Math.max(0, selectedPlan.diff || 0))
                const creditToWallet = Number(selectedPlan.creditToWallet ?? Math.max(0, -(selectedPlan.diff || 0)))
                const remainingValue = Number(selectedPlan.remainingValue ?? availablePlans.remainingValue ?? 0)
                const currentDuration = availablePlans.durationDays || availablePlans.currentPlan?.durationDays || 0
                const newStartDate = selectedPlan.newStartDate ? dayjs(selectedPlan.newStartDate) : dayjs()
                const newEndDate = selectedPlan.newEndDate ? dayjs(selectedPlan.newEndDate) : newStartDate.add((selectedPlan.durationDays || 1) - 1, 'day')
                const walletBalance = Number(wallet?.balance || 0)
                const currentDaily = currentDuration > 0 ? (availablePlans.currentPlan?.price || 0) / currentDuration : 0
                const newDaily = (selectedPlan.durationDays || 1) > 0 ? (selectedPlan.price || 0) / selectedPlan.durationDays : 0

                return (
                  <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-bg-subtle)] p-4">
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <Tag>{availablePlans.currentPlan?.nameVi}</Tag>
                      <ArrowUpOutlined className="text-[var(--gs-text-muted)]" />
                      <Tag color="blue">{selectedPlan.nameVi}</Tag>
                    </div>

                    <div className="grid gap-3 text-sm md:grid-cols-2">
                      <div className="rounded-lg border border-[var(--gs-border)] p-3">
                        <div className="text-xs text-[var(--gs-text-muted)]">Giá gói hiện tại</div>
                        <div className="font-semibold">{formatMoney(availablePlans.currentPlan?.price)}</div>
                      </div>
                      <div className="rounded-lg border border-[var(--gs-border)] p-3">
                        <div className="text-xs text-[var(--gs-text-muted)]">Giá gói mới</div>
                        <div className="font-semibold">{formatMoney(selectedPlan.price)}</div>
                      </div>
                      <div className="rounded-lg border border-[var(--gs-border)] p-3">
                        <div className="text-xs text-[var(--gs-text-muted)]">Thời hạn gói hiện tại</div>
                        <div className="font-semibold">{currentDuration} ngày</div>
                      </div>
                      <div className="rounded-lg border border-[var(--gs-border)] p-3">
                        <div className="text-xs text-[var(--gs-text-muted)]">Số ngày còn lại</div>
                        <div className="font-semibold">{availablePlans.remainingDays || 0} ngày</div>
                      </div>
                      <div className="rounded-lg border border-[var(--gs-border)] p-3 md:col-span-2">
                        <div className="text-xs text-[var(--gs-text-muted)]">Giá trị còn lại quy đổi</div>
                        <div className="font-semibold text-[var(--theme-accent)]">{formatMoney(remainingValue)}</div>
                      </div>
                      <div className="rounded-lg border border-[var(--gs-border)] p-3">
                        <div className="text-xs text-[var(--gs-text-muted)]">Ngày bắt đầu gói mới</div>
                        <div className="font-semibold">{newStartDate.format('DD/MM/YYYY')}</div>
                      </div>
                      <div className="rounded-lg border border-[var(--gs-border)] p-3">
                        <div className="text-xs text-[var(--gs-text-muted)]">Ngày hết hạn gói mới</div>
                        <div className="font-semibold">{newEndDate.format('DD/MM/YYYY')}</div>
                      </div>
                      <div className="rounded-lg border border-[var(--gs-border)] p-3">
                        <div className="text-xs text-[var(--gs-text-muted)]">Giá/ngày gói hiện tại</div>
                        <div className="font-semibold">{formatMoney(currentDaily)}</div>
                      </div>
                      <div className="rounded-lg border border-[var(--gs-border)] p-3">
                        <div className="text-xs text-[var(--gs-text-muted)]">Giá/ngày gói mới</div>
                        <div className="font-semibold">{formatMoney(newDaily)}</div>
                      </div>
                    </div>

                    {selectedPlan.descriptionVi && (
                      <div className="mt-3 rounded-lg border border-[var(--gs-border)] p-3 text-sm text-[var(--gs-text-soft)]">
                        {selectedPlan.descriptionVi}
                      </div>
                    )}

                    {selectedPlan.featureIds?.length > 0 && (
                      <div className="mt-3 rounded-lg border border-[var(--gs-border)] p-3">
                        <div className="mb-2 text-xs text-[var(--gs-text-muted)]">Quyền lợi gói mới</div>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedPlan.featureIds.map((feature: any) => (
                            <Tag key={feature._id} color="blue" style={{ fontSize: 11 }}>{feature.name}</Tag>
                          ))}
                        </div>
                      </div>
                    )}

                    {creditToWallet > 0 ? (
                      <div className="mt-4 rounded-xl bg-green-500/10 p-3">
                        <div className="flex items-center justify-between gap-3 font-bold">
                          <span>{'Số tiền hoàn vào Ví GymPro'}</span>
                          <span className="text-green-600">{formatMoney(creditToWallet)}</span>
                        </div>
                        <div className="mt-1 text-xs text-[var(--gs-text-muted)]">Tiền dư sẽ được cộng vào ví sau khi đổi gói thành công.</div>
                      </div>
                    ) : amountToPay > 0 && walletBalance >= amountToPay ? (
                      <div className="mt-4 rounded-xl border border-[var(--gs-success-border)] bg-[var(--gs-success-bg)] p-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--gs-success)]">
                          <WalletOutlined />
                          {'Số dư đủ để thanh toán bằng ví'}
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm max-[480px]:grid-cols-1">
                          <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-3">
                            <div className="text-xs text-[var(--gs-text-muted)]">Số tiền cần thanh toán</div>
                            <div className="mt-0.5 font-bold">{formatMoney(amountToPay)}</div>
                          </div>
                          <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-3">
                            <div className="text-xs text-[var(--gs-text-muted)]">Số dư ví</div>
                            <div className="mt-0.5 font-semibold">{formatMoney(walletBalance)}</div>
                          </div>
                        </div>
                      </div>
                    ) : amountToPay > 0 && walletBalance > 0 ? (
                      <div className="mt-4 rounded-xl border border-[var(--gs-warning)] bg-[var(--gs-warning-bg)] p-3 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--gs-warning)]">
                          <WalletOutlined />
                          {'Số dư không đủ — thanh toán kết hợp ví + VNPay'}
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm max-[480px]:grid-cols-1">
                          <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-3">
                            <div className="text-xs text-[var(--gs-text-muted)]">Số tiền cần thanh toán</div>
                            <div className="mt-0.5 font-bold">{formatMoney(amountToPay)}</div>
                          </div>
                          <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-3">
                            <div className="text-xs text-[var(--gs-text-muted)]">Số dư ví (sẽ dùng hết)</div>
                            <div className="mt-0.5 font-bold">{formatMoney(walletBalance)}</div>
                          </div>
                          <div className="col-span-2 rounded-lg border border-[var(--gs-warning)] bg-[var(--gs-warning-bg)] p-3 max-[480px]:col-span-1">
                            <div className="text-xs text-[var(--gs-warning)]">Còn thiếu — thanh toán qua VNPay</div>
                            <div className="mt-0.5 text-lg font-bold text-[var(--gs-warning)]">{formatMoney(Math.max(0, amountToPay - walletBalance))}</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-xl border border-[var(--gs-info-border)] bg-[var(--gs-info-bg)] p-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--gs-info)]">
                          <WalletOutlined />
                          {'Ví của bạn hiện không có số dư'}
                        </div>
                        <p className="m-0 text-sm text-[var(--gs-text)]">
                          {'Bạn vẫn có thể thanh toán trực tiếp bằng phương thức khác mà không cần nạp ví.'}
                        </p>
                      </div>
                    )}

                    <Button type="primary" block className="mt-4" icon={amountToPay > 0 && walletBalance < amountToPay ? <CreditCardOutlined /> : undefined} loading={changeLoading} onClick={handleChangePlanClick}>
                      {creditToWallet > 0 || amountToPay === 0
                        ? 'Xác nhận đổi gói'
                        : (walletBalance >= amountToPay
                            ? 'Thanh toán và đổi gói'
                            : `Thanh toán ${formatMoney(Math.max(0, amountToPay - walletBalance))}đ qua VNPay`)}
                    </Button>
                  </div>
                )
              })()}
            </div>
          ) : (
            <Empty description="Không có dữ liệu" />
          )}
        </Spin>
      </Modal>

      {/* Renewal Handling Modal */}
      <Modal
        title="Xử lý gói gia hạn"
        open={renewalHandlingOpen}
        onCancel={() => { setRenewalHandlingOpen(false); setRenewalAction(null) }}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => { setRenewalHandlingOpen(false); setRenewalAction(null) }}>Hủy</Button>
            <Button type="primary" loading={changeLoading}
              disabled={!renewalAction}
              onClick={() => {
                if (renewalAction === 'cancel') handleChangePlan(true)
                else handleChangePlan(false)
              }}
            >
              Xác nhận
            </Button>
          </div>
        }
        width={560}
        centered
      >
        <div className="space-y-4 py-2">
          <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-bg-subtle)] p-4 text-sm text-[var(--gs-text)]">
            <div>Bạn đang có <strong>{availablePlans?.pendingRenewalsCount}</strong> lần gia hạn chưa sử dụng, tổng giá trị <strong>{formatMoney(availablePlans?.pendingRenewalsTotal || 0)}</strong>.</div>
            <div className="mt-1 text-xs text-[var(--gs-text-muted)]">
              Chọn cách xử lý trước khi đổi sang gói mới.
            </div>
          </div>

          <div className={`rounded-xl border p-4 cursor-pointer transition-colors ${renewalAction === 'convert' ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]/10' : 'border-[var(--gs-border)] hover:bg-[var(--gs-border)]/20'}`}
            onClick={() => setRenewalAction('convert')}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-1 h-4 w-4 rounded-full border-2 ${renewalAction === 'convert' ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]' : 'border-[var(--gs-text-muted)]'}`}>
                {renewalAction === 'convert' && <div className="m-0.5 h-2 w-2 rounded-full bg-white" />}
              </div>
              <div>
                <p className="m-0 text-sm font-semibold text-[var(--gs-text)]">Quy đổi giá trị gia hạn sang gói mới</p>
                <p className="mt-1 text-xs text-[var(--gs-text-muted)]">
                  {selectedPlan && (() => {
                    const amountToPay = Number(selectedPlan.amountToPay ?? Math.max(0, selectedPlan.diff || 0))
                    const creditToWallet = Number(selectedPlan.creditToWallet ?? Math.max(0, -(selectedPlan.diff || 0)))
                    if (amountToPay > 0) return `Giá trị gia hạn sẽ được cộng vào, bạn cần thanh toán thêm ${formatMoney(amountToPay)}.`
                    if (creditToWallet > 0) return `Bạn sẽ được hoàn ${formatMoney(creditToWallet)} vào Ví GymPro.`
                    return 'Không có chênh lệch giá.'
                  })()}
                </p>
              </div>
            </div>
          </div>

          <div className={`rounded-xl border p-4 cursor-pointer transition-colors ${renewalAction === 'cancel' ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]/10' : 'border-[var(--gs-border)] hover:bg-[var(--gs-border)]/20'}`}
            onClick={() => setRenewalAction('cancel')}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-1 h-4 w-4 rounded-full border-2 ${renewalAction === 'cancel' ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)]' : 'border-[var(--gs-text-muted)]'}`}>
                {renewalAction === 'cancel' && <div className="m-0.5 h-2 w-2 rounded-full bg-white" />}
              </div>
              <div>
                <p className="m-0 text-sm font-semibold text-[var(--gs-text)]">Hủy các gói gia hạn và hoàn ví</p>
                <p className="mt-1 text-xs text-[var(--gs-text-muted)]">
                  Các lần gia hạn chưa sử dụng sẽ bị hủy. Bạn được hoàn <strong className="text-green-600">{formatMoney(availablePlans?.pendingRenewalsTotal || 0)}</strong> vào Ví GymPro.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Change History Modal */}
      <Modal title="Lịch sử thay đổi gói" open={activeTab === 'history'} onCancel={() => setActiveTab('info')} footer={null} width={700}
        afterOpenChange={(open) => { if (open) fetchChangeHistory() }}
      >
        {changeHistory.length === 0 ? (
          <Empty description="Chưa có lịch sử thay đổi gói" />
        ) : (
          <Table
            dataSource={changeHistory}
            rowKey="_id"
            pagination={false}
            size="small"
            columns={[
              { title: 'Ngày', dataIndex: 'createdAt', render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm') },
              { title: 'Từ gói', dataIndex: ['fromPlanId', 'nameVi'], render: (v: string, r: any) => <Tag>{v || r.fromPlanId?.nameVi}</Tag> },
              { title: 'Sang gói', dataIndex: ['toPlanId', 'nameVi'], render: (v: string, r: any) => <Tag color="blue">{v || r.toPlanId?.nameVi}</Tag> },
              { title: 'Loại', dataIndex: 'changeType', render: (v: string) => v === 'upgrade' ? <Tag color="green">Nâng cấp</Tag> : v === 'downgrade' ? <Tag color="orange">Hạ cấp</Tag> : <Tag>Gia hạn</Tag> },
              { title: 'Thanh toán', dataIndex: 'amount', render: (v: number) => v > 0 ? formatMoney(v) : '—' },
              { title: 'Hoàn ví', dataIndex: 'walletCredit', render: (v: number) => v > 0 ? <span className="text-green-600">{formatMoney(v)}</span> : '—' },
            ]}
          />
        )}
      </Modal>

      {/* Batch Cancel Confirmation Modal */}
      <Modal
        title="Hủy gia hạn"
        open={batchCancelModal.open}
        onCancel={() => !batchCancelModal.loading && setBatchCancelModal({ open: false, loading: false, totalRefund: 0, count: 0 })}
        footer={
          <div className="flex justify-end gap-2">
            <Button disabled={batchCancelModal.loading} onClick={() => setBatchCancelModal({ open: false, loading: false, totalRefund: 0, count: 0 })}>Hủy</Button>
            <Button danger type="primary" loading={batchCancelModal.loading} onClick={handleBatchCancelConfirm}>
              Xác nhận
            </Button>
          </div>
        }
        width={480}
        centered
      >
        <div className="py-4">
          <p className="m-0 text-sm text-[var(--gs-text)]">Bạn sắp hủy:</p>
          <p className="mt-2 text-base font-semibold text-[var(--gs-text)]">• {batchCancelModal.count} lần gia hạn</p>
          <div className="mt-4 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--gs-text-soft)]">Tổng tiền hoàn</span>
              <span className="text-lg font-bold text-[var(--gs-success)]">{formatMoney(batchCancelModal.totalRefund)}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--gs-text-muted)]">
              Số tiền sẽ được hoàn ngay vào Ví GymPro. Thao tác này không thể hoàn tác.
            </p>
          </div>
        </div>
      </Modal>

    </MemberLayout>
  )
}
