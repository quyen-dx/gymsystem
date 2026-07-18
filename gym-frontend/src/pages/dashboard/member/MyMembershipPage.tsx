import { ArrowUpOutlined, CalendarOutlined, CheckCircleFilled, CloseCircleOutlined, DownOutlined, ExclamationCircleFilled, ExclamationCircleOutlined, HistoryOutlined, InfoCircleOutlined, MailOutlined, SwapOutlined, WalletOutlined } from '@ant-design/icons'
import { Button, Card, Descriptions, Empty, List, Modal, Radio, Spin, Table, Tabs, Tag, Tooltip, message } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import PolicyConsentCard from '../../../components/wallet/PolicyConsentCard'
import api from '../../../services/api'
import { useWallet } from '../../../context/WalletProvider'
import { acceptMultiplePolicyConsent } from '../../../utils/policyConsent'
import { membershipService, type CancellationRequest, type MembershipPeriod, type MembershipRenewal, type MyMembership, type PendingCancelRequest } from '../../../services/membershipService'
import { planFeatureService, type PlanFeature } from '../../../services/planFeatureService'

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
    expiring_soon: { color: 'warning', label: 'Sắp hết hạn' },
    expired: { color: 'error', label: 'Đã hết hạn' },
    cancel_requested: { color: 'warning', label: 'Đang chờ phê duyệt hủy' },
  }
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [membership, setMembership] = useState<MyMembership | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingCancel, setPendingCancel] = useState<CancellationRequest | null>(null)
  const [, setLastCancelRequest] = useState<CancellationRequest | null>(null)
  const [pendingCancelRequest, setPendingCancelRequest] = useState<PendingCancelRequest | null>(null)
  const [, setCanRenew] = useState(false)
  const [, setRenewalThresholdDays] = useState(7)
  const [renewModalOpen, setRenewModalOpen] = useState(false)
  const [renewing, setRenewing] = useState(false)
  const [selectedMultiplier, setSelectedMultiplier] = useState(1)
  const [, setRenewals] = useState<MembershipRenewal[]>([])
  const [periods, setPeriods] = useState<MembershipPeriod[]>([])
  const [cancelPeriodModal, setCancelPeriodModal] = useState<{ open: boolean; period: MembershipPeriod | null }>({ open: false, period: null })
  const [cancellingPeriod, setCancellingPeriod] = useState(false)
  const [batchCancelDays, setBatchCancelDays] = useState(0)
  const [batchCancelling, setBatchCancelling] = useState(false)
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
  const [allFeatures, setAllFeatures] = useState<PlanFeature[]>([])
  const [changeModalOpen, setChangeModalOpen] = useState(false)
  const [availablePlans, setAvailablePlans] = useState<any>(null)
  const [plansLoading, setPlansLoading] = useState(false)
  const [changeLoading, setChangeLoading] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<any>(null)
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
        setCanRenew(membershipRes.data.canRenew)
        setRenewalThresholdDays(membershipRes.data.renewalThresholdDays ?? 7)
        setPendingCancelRequest(membershipRes.data.pendingCancelRequest || null)
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

  useEffect(() => {
    planFeatureService.getAll({ isActive: true })
      .then((res) => setAllFeatures(res.data.data || []))
      .catch(() => {})
  }, [])

  const memberPlanFeatures = useMemo(() => {
    const planFeatures = membership?.plan?.features || membership?.plan?.featureIds
    if (!planFeatures || planFeatures.length === 0) return []
    if (allFeatures.length === 0) return []

    if (typeof planFeatures[0] === 'string') {
      return allFeatures.filter((f) => planFeatures.includes(f._id))
    }
    return planFeatures.map((pf: any) => {
      const match = allFeatures.find((af) => af._id === pf._id || af._id === pf)
      return match || pf
    })
  }, [membership?.plan, allFeatures])

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
       await membershipService.createRefundRequest({
        periodId: period._id,
        reason: 'Hủy gia hạn',
      })
      message.success('Yêu cầu đã được gửi tới nhân viên. Vui lòng chờ phê duyệt.')
      setCancelPeriodModal({ open: false, period: null })
      loadData()
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Hủy thất bại')
    } finally {
      setCancellingPeriod(false)
    }
  }

  const handleBatchCancel = async () => {
    if (batchCancelDays <= 0) return
    const targets = pendingPeriods.slice(-batchCancelDays)
    setBatchCancelling(true)
    try {
      for (const p of targets) {
        await membershipService.createRefundRequest({ periodId: p._id, reason: 'Hủy gia hạn' })
      }
      message.success(`Đã gửi yêu cầu hủy ${targets.length} kỳ gia hạn.`)
      setBatchCancelDays(0)
      loadData()
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Hủy thất bại')
    } finally {
      setBatchCancelling(false)
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
      const res = await membershipService.renewPlanWithDuration(selectedMultiplier)
      setRenewResult({
        newEndDate: res.data.newEndDate,
        amount: res.data.payment?.amount || planPrice * selectedMultiplier,
        walletBalance: res.data.walletBalance,
        planName,
      })
      setRenewModalOpen(false)
      setSuccessModalOpen(true)
      loadData()
      refreshWallet()
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

  const handleChangePlan = async () => {
    if (!selectedPlan) return
    setChangeLoading(true)
    try {
      const res = await api.post('/memberships/change-plan', { newPlanId: selectedPlan._id })
      const d = res.data
      const msg = d.creditToWallet > 0
        ? `Đổi gói thành công! Đã hoàn ${formatMoney(d.creditToWallet)} vào ví.`
        : d.amountToPay > 0
          ? `Đổi gói thành công! Đã thanh toán ${formatMoney(d.amountToPay)}.`
          : 'Đổi gói thành công!'
      message.success(msg)
      setChangeModalOpen(false)
      setSelectedPlan(null)
      setAvailablePlans(null)
      loadData()
      refreshWallet()
      fetchChangeHistory()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Đổi gói thất bại')
    } finally {
      setChangeLoading(false)
    }
  }

  const fetchChangeHistory = async () => {
    try {
      const { data } = await api.get('/memberships/change-history')
      setChangeHistory(data.history || [])
    } catch { /* ignore */ }
  }

  const balanceSufficient = (wallet?.balance || 0) >= planPrice * selectedMultiplier

  const pendingPeriods = useMemo(() => periods.filter(p => {
    const ds = p.displayStatus || p.status
    return ds === 'PENDING' || ds === 'REJECTED'
  }), [periods])

  const completedPeriods = useMemo(() => periods.filter(p => {
    const ds = p.displayStatus || p.status
    return ds === 'COMPLETED'
  }), [periods])

  const cancelRequestedPeriods = useMemo(() => periods.filter(p => {
    const ds = p.displayStatus || p.status
    return ds === 'CANCEL_REQUESTED'
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

        {/* Không có membership */}
        {!membership && (
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
                  <Tag icon={<CalendarOutlined />}>{`${membership.remainingDays} ngày còn lại`}</Tag>
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
                    <div className="text-xs font-medium uppercase tracking-wide text-[var(--gs-text-soft)]">Số tiền hoàn dự kiến</div>
                    <div className="mt-0.5 text-base font-semibold text-[var(--gs-success)]">{formatMoney(pendingCancel.estimatedRefundAmount)}</div>
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
              <InfoCell label="Số ngày còn lại" value={`${membership.remainingDays} ngày`} />
            </div>

            {memberPlanFeatures.length > 0 && (
              <div className="mt-6">
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--gs-text-soft)]">Quyền lợi</h4>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {memberPlanFeatures.map((f: any) => (
                    <div key={f._id} className="flex items-center gap-2 rounded-lg border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-3">
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: f.color, flexShrink: 0 }} />
                      <span className="text-sm font-medium text-[var(--gs-text)]">{f.name}</span>
                      {f.category && (
                        <Tag style={{ margin: 0, fontSize: 10, lineHeight: '16px' }} color="blue">{f.category}</Tag>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ) : membership && isCancelRequested ? (
          <Card>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="m-0 text-2xl font-semibold">{planName}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Tag icon={<ExclamationCircleOutlined />} color="warning">Đang chờ phê duyệt hủy</Tag>
                  <Tag icon={<CalendarOutlined />}>{`${membership.remainingDays} ngày còn lại`}</Tag>
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
              <InfoCell label="Số ngày còn lại" value={`${membership.remainingDays} ngày`} />
            </div>

            {memberPlanFeatures.length > 0 && (
              <div className="mt-6">
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--gs-text-soft)]">Quyền lợi</h4>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {memberPlanFeatures.map((f: any) => (
                    <div key={f._id} className="flex items-center gap-2 rounded-lg border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-3">
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: f.color, flexShrink: 0 }} />
                      <span className="text-sm font-medium text-[var(--gs-text)]">{f.name}</span>
                      {f.category && (
                        <Tag style={{ margin: 0, fontSize: 10, lineHeight: '16px' }} color="blue">{f.category}</Tag>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ) : membership && !isPendingCancel && !isCancelRequested ? (
          <Card className="overflow-hidden">
            {/* Header: plan name + status badge */}
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="m-0 text-3xl font-bold text-[var(--gs-text)]">{planName}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold ${
                    membership.displayStatus === 'expiring_soon'
                      ? 'bg-amber-500/15 text-amber-600'
                      : membership.displayStatus === 'expired'
                        ? 'bg-red-500/15 text-red-600'
                        : 'bg-green-500/15 text-green-600'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      membership.displayStatus === 'expiring_soon'
                        ? 'bg-amber-500'
                        : membership.displayStatus === 'expired'
                          ? 'bg-red-500'
                          : 'bg-green-500'
                    }`} />
                    {(statusMeta[membership.displayStatus] || statusMeta.active).label}
                  </span>
                  <span className="text-sm text-[var(--gs-text-muted)]">
                    <CalendarOutlined className="mr-1" />
                    {membership.remainingDays > 0
                      ? `${membership.remainingDays} ngày còn lại`
                      : 'Đã hết hạn'}
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
              <InfoCell label="Thời hạn" value={`${formatDate(membership.startDate)} → ${formatDate(membership.endDate)}`} wide />
              <InfoCell label="Số ngày còn lại" value={`${membership.remainingDays} ngày`} />
              <InfoCell label="Ngày đăng ký" value={formatDate(membership.createdAt)} />
            </div>

            {/* Features with icons */}
            {memberPlanFeatures.length > 0 && (
              <div className="mt-6">
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--gs-text-soft)]">Quyền lợi</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {memberPlanFeatures.map((f: any) => (
                    <div key={f._id} className="flex items-center gap-3 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg" style={{ background: 'var(--theme-accent-muted)', color: 'var(--theme-accent)' }}>
                        {f.icon ? <span className="text-lg">{f.icon}</span> : <CheckCircleFilled />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-[var(--gs-text)]">{f.name}</div>
                        {f.category && (
                          <span className="text-xs text-[var(--gs-text-muted)]">{f.category}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                            loading={batchCancelling}
                            onClick={handleBatchCancel}
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
                                    <Tag color="blue">Đang chờ kích hoạt</Tag>
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
                  key: 'cancel_requested',
                  label: `Chờ phê duyệt (${cancelRequestedPeriods.length})`,
                  children: cancelRequestedPeriods.length === 0 ? (
                    <Empty description="Không có yêu cầu nào" />
                  ) : (
                    <div className="space-y-3">
                      {cancelRequestedPeriods.map((p) => {
                        const crGlobalIdx = periods.findIndex(pp => pp._id === p._id) + 1
                        return (
                        <Card key={p._id} size="small" className="border-[var(--gs-warning)] bg-[var(--gs-warning-bg)]" styles={{ body: { padding: '16px' } }}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-[var(--gs-text)]">Đợt {crGlobalIdx}</span>
                                <Tag icon={<ExclamationCircleOutlined />} color="warning">Đang chờ phê duyệt</Tag>
                              </div>
                              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--gs-text-soft)]">
                                <span>{formatDate(p.startDate)} → {formatDate(p.endDate)}</span>
                                {p.price > 0 && <span className="font-medium text-[var(--gs-accent)]">{formatMoney(p.price)}</span>}
                              </div>
                              <div className="mt-2 text-xs leading-relaxed text-[var(--gs-text-muted)]">
                                Yêu cầu hủy đã được gửi tới nhân viên.
                              </div>
                            </div>
                            <Button size="small" disabled>Đã gửi yêu cầu</Button>
                          </div>
                        </Card>
                      );
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
                        const isRefunded = (p.displayStatus || p.status) === 'REFUNDED'
                        const ccGlobalIdx = periods.findIndex(pp => pp._id === p._id) + 1
                        return (
                          <Card key={p._id} size="small" className="border-[var(--gs-border)] bg-[var(--gs-elevated)] opacity-60" styles={{ body: { padding: '16px' } }}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-[var(--gs-text)]">Đợt {ccGlobalIdx}</span>
                                  {isRefunded ? (
                                    <Tag color="orange">Đã hoàn tiền</Tag>
                                  ) : (
                                    <Tag color="error">Đã hủy</Tag>
                                  )}
                                </div>
                                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--gs-text-soft)]">
                                  <span>{formatDate(p.startDate)} → {formatDate(p.endDate)}</span>
                                  {p.price > 0 && <span className="font-medium text-[var(--gs-accent)]">{formatMoney(p.price)}</span>}
                                </div>
                                {isRefunded && (
                                  <div className="mt-1.5 text-xs font-medium text-[var(--gs-success)]">
                                    <CheckCircleFilled className="mr-1" />
                                    Đã hoàn {formatMoney(p.price)}
                                  </div>
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
        className="policy-ant-modal"
        width={640}
        centered
      >
        <div className="policy-modal-shell">
          <div className="policy-modal-content">
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--gs-text-soft)]">Gói tập</span>
                  <span className="text-sm font-semibold text-[var(--gs-text)]">{planName}</span>
                </div>
                <div className="border-t border-[var(--gs-border)] pt-3">
                  <span className="text-sm font-medium text-[var(--gs-text-soft)]">Chọn thời gian gia hạn</span>
                  <Radio.Group
                    className="mt-2 w-full"
                    value={selectedMultiplier}
                    onChange={(e) => setSelectedMultiplier(e.target.value)}
                  >
                      {multiplierOptions.map((m) => {
                        const days = planDays * m
                        return (
                          <Radio.Button
                            key={m}
                            value={m}
                            className="!flex !h-auto !w-full !items-center !px-4 !py-3 [&:not(:first-child)]:!border-t-0"
                            style={{ border: '1px solid var(--gs-border)', borderRadius: 0 }}
                          >
                            <div className="flex w-full items-center justify-between gap-4">
                              <span className="text-sm font-semibold text-[var(--gs-success)]">
                                + {days} ngày ({m} tháng)
                              </span>
                            </div>
                          </Radio.Button>
                        )
                      })}
                  </Radio.Group>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--gs-text-soft)]">Giá</span>
                  <span className="text-base font-bold text-[var(--gs-accent)]">{formatMoney(planPrice * selectedMultiplier)}</span>
                </div>
                <div className="border-t border-[var(--gs-border)] pt-3 flex items-center justify-between">
                  <span className="text-sm text-[var(--gs-text-soft)]">
                    <WalletOutlined className="mr-1" />
                    {'Số dư ví'}
                  </span>
                  <span className={`text-sm font-semibold ${balanceSufficient ? 'text-[var(--gs-success)]' : 'text-[var(--gs-error)]'}`}>
                    {formatMoney(wallet?.balance || 0)}
                  </span>
                </div>
              </div>
              {!balanceSufficient && (
                <div className="rounded-xl border border-[var(--gs-warning)] bg-[var(--gs-warning-bg)] p-3 text-sm text-[var(--gs-warning)]">
                  {'Số dư ví không đủ để gia hạn. Vui lòng nạp thêm tiền.'}
                </div>
              )}
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
              <Tooltip title={!consentReady ? 'Vui lòng đồng ý với chính sách' : !balanceSufficient ? 'Số dư ví không đủ' : undefined}>
                <Button
                  className="policy-confirm-action"
                  type="primary"
                  loading={renewing}
                  disabled={!consentReady || !balanceSufficient}
                  onClick={handleRenew}
                >
                  Xác nhận gia hạn
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
      <Modal title="Đổi gói tập" open={changeModalOpen} onCancel={() => { setChangeModalOpen(false); setSelectedPlan(null); setAvailablePlans(null) }} footer={null} width={640}>
        <Spin spinning={plansLoading}>
          {availablePlans ? (
            <>
              <Card size="small" className="mb-4 bg-[var(--gs-bg-subtle)]">
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="Gói hiện tại">{availablePlans.currentPlan?.nameVi}</Descriptions.Item>
                  <Descriptions.Item label="Còn lại">{availablePlans.remainingDays} ngày</Descriptions.Item>
                </Descriptions>
              </Card>
              {availablePlans.plans?.length === 0 ? (
                <Empty description="Không có gói nào khác" />
              ) : (
                <List
                  dataSource={availablePlans.plans}
                  renderItem={(plan: any) => {
                    const isSelected = selectedPlan?._id === plan._id
                    const needPay = plan.diff > 0
                    return (
                      <List.Item
                        className={`cursor-pointer rounded-lg px-3 py-3 transition-colors ${isSelected ? 'bg-[var(--theme-accent)]/10 border border-[var(--theme-accent)]' : 'hover:bg-[var(--gs-border)]/20'}`}
                        onClick={() => setSelectedPlan(plan)}
                      >
                        <div className="flex w-full items-center justify-between">
                          <div>
                            <span className="font-semibold">{plan.nameVi}</span>
                            <div className="text-sm text-[var(--gs-text-muted)]">{formatMoney(plan.price)} / {plan.durationDays} ngày</div>
                            {plan.featureIds?.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {plan.featureIds.slice(0, 3).map((f: any) => (
                                  <Tag key={f._id || f} style={{ fontSize: 10 }}>{f.name || '...'}</Tag>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            {needPay ? (
                              <>
                                <div className="text-xs text-[var(--gs-text-muted)]">Cần thanh toán</div>
                                <div className="font-bold text-[var(--theme-accent)]">{formatMoney(Math.abs(plan.diff))}</div>
                              </>
                            ) : (
                              <>
                                <div className="text-xs text-[var(--gs-text-muted)]">Hoàn vào ví</div>
                                <div className="font-bold text-green-600">{formatMoney(Math.abs(plan.diff))}</div>
                              </>
                            )}
                          </div>
                        </div>
                      </List.Item>
                    )
                  }}
                />
              )}
              {selectedPlan && (
                <div className="mt-4 rounded-xl border border-[var(--gs-border)] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag>{availablePlans.currentPlan?.nameVi}</Tag>
                    <ArrowUpOutlined className="text-[var(--gs-text-muted)]" />
                    <Tag color="blue">{selectedPlan.nameVi}</Tag>
                  </div>
                  <div className="flex justify-between text-sm"><span>Giá gói hiện tại</span><span>{formatMoney(availablePlans.currentPlan?.price)}</span></div>
                  <div className="flex justify-between text-sm"><span>Giá gói mới</span><span>{formatMoney(selectedPlan.price)}</span></div>
                  {selectedPlan.diff > 0 ? (
                    <>
                      <hr className="my-2" />
                      <div className="flex justify-between font-bold"><span>Thanh toán thêm</span><span className="text-[var(--theme-accent)]">{formatMoney(Math.abs(selectedPlan.diff))}</span></div>
                      <div className="mt-1 text-xs text-[var(--gs-text-muted)]">Số dư ví: {formatMoney(wallet?.balance)}</div>
                      <Button type="primary" block className="mt-3" loading={changeLoading} onClick={handleChangePlan}
                        disabled={wallet ? wallet.balance < Math.abs(selectedPlan.diff) : true}
                      >
                        Thanh toán và đổi gói
                      </Button>
                    </>
                  ) : (
                    <>
                      <hr className="my-2" />
                      <div className="flex justify-between font-bold"><span>Hoàn vào Ví GymPro</span><span className="text-green-600">{formatMoney(Math.abs(selectedPlan.diff))}</span></div>
                      <div className="mt-1 text-xs text-[var(--gs-text-muted)]">Bạn không cần thanh toán thêm. Tiền dư sẽ được cộng vào ví.</div>
                      <Button type="primary" block className="mt-3" loading={changeLoading} onClick={handleChangePlan}>
                        Xác nhận đổi gói
                      </Button>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <Empty description="Không có dữ liệu" />
          )}
        </Spin>
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

    </MemberLayout>
  )
}
