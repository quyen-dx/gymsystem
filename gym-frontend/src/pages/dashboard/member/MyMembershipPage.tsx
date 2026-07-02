import { CalendarOutlined, CheckCircleFilled, CloseCircleOutlined, ExclamationCircleOutlined, InfoCircleOutlined, WalletOutlined } from '@ant-design/icons'
import { Button, Card, Descriptions, Empty, Modal, Progress, Spin, Tag, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { useWallet } from '../../../context/WalletProvider'
import { membershipService, type CancellationRequest, type MyMembership } from '../../../services/membershipService'

const formatMoney = (value?: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`
const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString('vi-VN') : '-'

export default function MyMembershipPage() {
  const { wallet, refreshWallet } = useWallet()
  const statusMeta: Record<string, { color: string; label: string }> = {
    active: { color: 'success', label: 'Đang hoạt động' },
    expiring_soon: { color: 'warning', label: 'Sắp hết hạn' },
    expired: { color: 'error', label: 'Đã hết hạn' },
  }
  const [searchParams] = useSearchParams()
  const [membership, setMembership] = useState<MyMembership | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingCancel, setPendingCancel] = useState<CancellationRequest | null>(null)
  const [lastCancelRequest, setLastCancelRequest] = useState<CancellationRequest | null>(null)
  const [canRenew, setCanRenew] = useState(false)
  const [renewalThresholdDays, setRenewalThresholdDays] = useState(7)
  const [renewModalOpen, setRenewModalOpen] = useState(false)
  const [renewing, setRenewing] = useState(false)

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
    ])
      .then(([membershipRes, cancelRes]) => {
        const m = membershipRes.data.membership
        setMembership(m)
        setCanRenew(membershipRes.data.canRenew)
        setRenewalThresholdDays(membershipRes.data.renewalThresholdDays ?? 7)

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
  const planName = membership?.plan?.nameVi || membership?.planNameVi || membership?.plan?.nameEn || membership?.planNameEn || '-'
  const planPrice = membership?.price || membership?.plan?.price || 0
  const progressPercent = useMemo(() => {
    if (isCancelled) return 0
    const duration = membership?.durationDays || membership?.plan?.durationDays || 0
    if (!duration || !membership) return 0
    return Math.max(0, Math.min(100, Math.round((membership.remainingDays / duration) * 100)))
  }, [membership, isCancelled])

  const handleRenew = async () => {
    setRenewing(true)
    try {
      await membershipService.renewPlanWithWallet()
      message.success('Gia hạn thành công')
      setRenewModalOpen(false)
      loadData()
      refreshWallet()
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Gia hạn thất bại')
    } finally {
      setRenewing(false)
    }
  }

  const balanceSufficient = (wallet?.balance || 0) >= planPrice

  if (loading) {
    return (
      <MemberLayout>
        <div className="flex min-h-[320px] items-center justify-center"><Spin /></div>
      </MemberLayout>
    )
  }

  if (!membership) {
    return (
      <MemberLayout>
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="m-0 text-xs uppercase tracking-[0.24em] text-[var(--gs-text-soft)]">Gói tập của tôi</p>
              <h1 className="m-0 mt-2 text-3xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">Gói tập của tôi</h1>
            </div>
            <Button href="/plans">Xem gói tập</Button>
          </div>
          <Card>
            <Empty description='Bạn chưa đăng ký gói tập nào'>
              <Button type="primary" href="/plans">Đăng ký ngay</Button>
            </Empty>
          </Card>
        </div>
      </MemberLayout>
    )
  }

  return (
    <MemberLayout>
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="m-0 text-xs uppercase tracking-[0.24em] text-[var(--gs-text-soft)]">Quản lý gói tập</p>
            <h1 className="m-0 mt-2 text-3xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">Gói tập của tôi</h1>
          </div>
          <Button href="/plans">Xem gói tập</Button>
        </div>

        {isCancelled ? (
          <Card>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="m-0 text-2xl font-semibold">{planName}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Tag color="error">Đã hủy</Tag>
                </div>
              </div>
            </div>

            {lastCancelRequest?.refundMethod === 'WALLET' && lastCancelRequest?.refundStatus === 'COMPLETED' && (
              <div className="mb-4 rounded-xl border border-[var(--gs-success)] bg-[var(--gs-success-bg)] p-4">
                <div className="flex items-center gap-2 text-[var(--gs-success)]">
                  <CheckCircleFilled />
                  <span className="font-medium">{`Đã hoàn tiền ${formatMoney(lastCancelRequest.finalRefundAmount)}`}</span>
                </div>
              </div>
            )}

            <Descriptions bordered column={{ xs: 1, sm: 2, lg: 3 }}>
              <Descriptions.Item label='Gói tập'>{planName}</Descriptions.Item>
              <Descriptions.Item label='Giá'>{formatMoney(membership.price || membership.plan?.price)}</Descriptions.Item>
              <Descriptions.Item label='Ngày bắt đầu'>{formatDate(membership.startDate)}</Descriptions.Item>
              <Descriptions.Item label='Ngày kết thúc'>{formatDate(membership.endDate)}</Descriptions.Item>
              <Descriptions.Item label='Trạng thái'>Đã hủy</Descriptions.Item>
            </Descriptions>
          </Card>
        ) : isPendingCancel ? (
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
        ) : (
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
                {canRenew ? (
                  <Button type="primary" icon={<WalletOutlined />} onClick={() => setRenewModalOpen(true)}>
                    Gia hạn
                  </Button>
                ) : (
                  <Button type="primary" icon={<WalletOutlined />} disabled>
                    Gia hạn
                  </Button>
                )}
                {membership?.status === 'active' && membership.remainingDays > 0 && (
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={() => window.location.href = '/my-membership/cancel-request'}
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

            {!canRenew && membership.remainingDays > 0 && (
              <div className="mb-5 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-4">
                <div className="flex items-center gap-2 text-[var(--gs-text-soft)]">
                  <InfoCircleOutlined />
                  <span className="font-medium">{`Chỉ có thể gia hạn trong vòng ${renewalThresholdDays} ngày trước khi hết hạn`}</span>
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
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--gs-text-soft)]">Thời gian gia hạn</span>
              <span className="text-sm font-semibold text-[var(--gs-success)]">
                +{membership?.durationDays || membership?.plan?.durationDays || 0} ngày
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--gs-text-soft)]">Giá</span>
              <span className="text-base font-bold text-[var(--gs-accent)]">{formatMoney(planPrice)}</span>
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
    </MemberLayout>
  )
}
