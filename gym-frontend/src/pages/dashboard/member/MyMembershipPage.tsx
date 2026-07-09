import { CalendarOutlined, CheckCircleFilled, CloseCircleOutlined, ExclamationCircleFilled, ExclamationCircleOutlined, InfoCircleOutlined, WalletOutlined } from '@ant-design/icons'
import { Button, Card, Descriptions, Empty, Modal, Progress, Radio, Spin, Tabs, Tag, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { useWallet } from '../../../context/WalletProvider'
import { membershipService, type CancellationRequest, type MembershipPeriod, type MembershipRenewal, type MyMembership, type PendingCancelRequest } from '../../../services/membershipService'

const formatMoney = (value?: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`
const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString('vi-VN') : '-'

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

  const isCancelled = membership?.status === 'cancelled'
  const isPendingCancel = !!pendingCancel
  const isCancelRequested = membership?.status === 'cancel_requested'
  const planName = membership?.plan?.nameVi || membership?.planNameVi || membership?.plan?.nameEn || membership?.planNameEn || '-'
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
    setRenewing(true)
    try {
      const res = await membershipService.renewPlanWithDuration(selectedMultiplier)
      message.success(res.data?.message || 'Gia hạn thành công')
      setRenewModalOpen(false)
      loadData()
      refreshWallet()
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Gia hạn thất bại')
    } finally {
      setRenewing(false)
    }
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

            <Descriptions bordered column={{ xs: 1, sm: 2, lg: 3 }}>
              <Descriptions.Item label='Gói tập'>{planName}</Descriptions.Item>
              <Descriptions.Item label='Giá'>{formatMoney(membership.price || membership.plan?.price)}</Descriptions.Item>
              <Descriptions.Item label='Ngày bắt đầu'>{formatDate(membership.startDate)}</Descriptions.Item>
              <Descriptions.Item label='Ngày kết thúc'>{formatDate(membership.endDate)}</Descriptions.Item>
              <Descriptions.Item label='Số ngày còn lại'>{membership.remainingDays}</Descriptions.Item>
              <Descriptions.Item label='Trạng thái'>Đang chờ hủy</Descriptions.Item>
            </Descriptions>
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

            <Descriptions bordered column={{ xs: 1, sm: 2, lg: 3 }}>
              <Descriptions.Item label='Gói tập'>{planName}</Descriptions.Item>
              <Descriptions.Item label='Giá'>{formatMoney(membership.price || membership.plan?.price)}</Descriptions.Item>
              <Descriptions.Item label='Ngày bắt đầu'>{formatDate(membership.startDate)}</Descriptions.Item>
              <Descriptions.Item label='Ngày kết thúc'>{formatDate(membership.endDate)}</Descriptions.Item>
              <Descriptions.Item label='Số ngày còn lại'>{membership.remainingDays}</Descriptions.Item>
              <Descriptions.Item label='Trạng thái'>Đang chờ phê duyệt hủy</Descriptions.Item>
            </Descriptions>
          </Card>
        ) : membership && !isPendingCancel && !isCancelRequested ? (
          <Card>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="m-0 text-2xl font-semibold">{planName}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Tag color={(statusMeta[membership.displayStatus] || statusMeta.active).color}>
                    {(statusMeta[membership.displayStatus] || statusMeta.active).label}
                  </Tag>
                  <Tag icon={<CalendarOutlined />}>{`${membership.remainingDays} ngày còn lại`}</Tag>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="primary" icon={<WalletOutlined />} onClick={() => { setSelectedMultiplier(1); setRenewModalOpen(true) }}>
                  Gia hạn
                </Button>
                {membership?.status === 'active' && membership.remainingDays > 0 && (
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={() => navigate('/my-membership/cancel-request')}
                  >
                    Hủy gói
                  </Button>
                )}
              </div>
            </div>

            {membership?.status === 'active' && membership.remainingDays <= 0 && (
              <div className="mb-5 rounded-xl border border-[var(--gs-warning)] bg-[var(--gs-warning-bg)] p-4">
                <div className="flex items-center gap-2 text-[var(--gs-warning)]">
                  <ExclamationCircleOutlined />
                  <span className="font-medium">Gói tập của bạn đã hết hạn. Vui lòng gia hạn để tiếp tục sử dụng.</span>
                </div>
              </div>
            )}

            <Progress percent={progressPercent} status={membership.displayStatus === 'expired' ? 'exception' : 'active'} />

            <Descriptions bordered column={{ xs: 1, sm: 2, lg: 3 }} className="mt-6">
              <Descriptions.Item label='Gói tập'>{planName}</Descriptions.Item>
              <Descriptions.Item label='Giá'>{formatMoney(membership.price || membership.plan?.price)}</Descriptions.Item>
              <Descriptions.Item label='Ngày bắt đầu'>{formatDate(membership.startDate)}</Descriptions.Item>
              <Descriptions.Item label='Ngày kết thúc'>{formatDate(membership.endDate)}</Descriptions.Item>
              <Descriptions.Item label='Số ngày còn lại'>{membership.remainingDays}</Descriptions.Item>
              <Descriptions.Item label='Trạng thái'>{(statusMeta[membership.displayStatus] || statusMeta.active).label}</Descriptions.Item>
            </Descriptions>
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
        footer={[
          <Button key="cancel" onClick={() => setRenewModalOpen(false)}>
            Hủy
          </Button>,
          <Button
            key="renew"
            type="primary"
            loading={renewing}
            disabled={!balanceSufficient}
            onClick={handleRenew}
          >
            Xác nhận gia hạn
          </Button>,
        ]}
      >
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

    </MemberLayout>
  )
}
