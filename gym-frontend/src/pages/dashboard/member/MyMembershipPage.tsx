import { CalendarOutlined, CheckCircleFilled, CloseCircleOutlined, CreditCardOutlined, ExclamationCircleOutlined, InfoCircleOutlined, SettingOutlined } from '@ant-design/icons'
import { Button, Card, Descriptions, Empty, Progress, Spin, Switch, Tag, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { membershipService, type CancellationRequest, type MyMembership } from '../../../services/membershipService'

const formatMoney = (value?: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`
const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString('vi-VN') : '-'

export default function MyMembershipPage() {
  const { t } = useTranslation()
  const statusMeta = {
    active: { color: 'success', label: t('member_membership.status_active') },
    expiring_soon: { color: 'warning', label: t('member_membership.status_expiring_soon') },
    expired: { color: 'error', label: t('member_membership.status_expired') },
  }
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [membership, setMembership] = useState<MyMembership | null>(null)
  const [loading, setLoading] = useState(true)
  const [togglingAutoRenew, setTogglingAutoRenew] = useState(false)
  const [pendingCancel, setPendingCancel] = useState<CancellationRequest | null>(null)
  const [lastCancelRequest, setLastCancelRequest] = useState<CancellationRequest | null>(null)

  useEffect(() => {
    if (searchParams.get('payment') === 'success') {
      message.success(t('member_membership.toast_payment_success'))
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

        const requests = cancelRes.data.cancellationRequests || []
        const pending = requests.find((r) => r.status === 'pending') || null
        setPendingCancel(pending)
        setLastCancelRequest(requests[0] || null)
      })
      .catch(() => message.error(t('member_membership.toast_fetch_error')))
      .finally(() => setLoading(false))
  }

  useEffect(loadData, [])

  const isCancelled = membership?.status === 'cancelled'
  const isPendingCancel = !!pendingCancel
  const planName = membership?.plan?.nameVi || membership?.planNameVi || membership?.plan?.nameEn || membership?.planNameEn || '-'
  const progressPercent = useMemo(() => {
    if (isCancelled) return 0
    const duration = membership?.durationDays || membership?.plan?.durationDays || 0
    if (!duration || !membership) return 0
    return Math.max(0, Math.min(100, Math.round((membership.remainingDays / duration) * 100)))
  }, [membership, isCancelled])

  const handleToggleAutoRenew = (checked: boolean) => {
    setTogglingAutoRenew(true)
    membershipService.toggleAutoRenew()
      .then((res) => {
        message.success(res.data.message)
        setMembership((prev) => prev ? { ...prev, autoRenew: res.data.autoRenew } : prev)
      })
      .catch(() => message.error(t('member_membership.toast_toggle_auto_renew_error')))
      .finally(() => setTogglingAutoRenew(false))
  }

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
        <div className="mx-auto w-full max-w-5xl px-4 py-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="m-0 text-xs uppercase tracking-[0.24em] text-[var(--gs-text-soft)]">{t('member_membership.page_subtitle')}</p>
              <h1 className="m-0 mt-2 text-3xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">{t('member_membership.title')}</h1>
            </div>
            <Button href="/plans">{t('member_membership.view_plans_btn')}</Button>
          </div>
          <Card>
            <Empty description={t('member_membership.empty')}>
              <Button type="primary" href="/plans">{t('member_membership.register_btn')}</Button>
            </Empty>
          </Card>
        </div>
      </MemberLayout>
    )
  }

  return (
    <MemberLayout>
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="m-0 text-xs uppercase tracking-[0.24em] text-[var(--gs-text-soft)]">{t('member_membership.page_subtitle')}</p>
            <h1 className="m-0 mt-2 text-3xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">{t('member_membership.title')}</h1>
          </div>
          <Button href="/plans">{t('member_membership.view_plans_btn')}</Button>
        </div>

        {isCancelled ? (
          <Card>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="m-0 text-2xl font-semibold">{planName}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Tag color="error">{t('member_membership.status_cancelled')}</Tag>
                </div>
              </div>
            </div>

            {lastCancelRequest?.refundMethod === 'WALLET' && lastCancelRequest?.refundStatus === 'COMPLETED' && (
              <div className="mb-4 rounded-xl border border-[var(--gs-success)] bg-[var(--gs-success-bg)] p-4">
                <div className="flex items-center gap-2 text-[var(--gs-success)]">
                  <CheckCircleFilled />
                  <span className="font-medium">{t('member_membership.cancel_refund_completed', { amount: formatMoney(lastCancelRequest.finalRefundAmount) })}</span>
                </div>
              </div>
            )}

            <Descriptions bordered column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label={t('member_membership.label_plan_name')}>{planName}</Descriptions.Item>
              <Descriptions.Item label={t('member_membership.label_price')}>{formatMoney(membership.price || membership.plan?.price)}</Descriptions.Item>
              <Descriptions.Item label={t('member_membership.label_start_date')}>{formatDate(membership.startDate)}</Descriptions.Item>
              <Descriptions.Item label={t('member_membership.label_end_date')}>{formatDate(membership.endDate)}</Descriptions.Item>
              <Descriptions.Item label={t('member_membership.label_status')}>{t('member_membership.status_cancelled')}</Descriptions.Item>
            </Descriptions>
          </Card>
        ) : isPendingCancel ? (
          <Card>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="m-0 text-2xl font-semibold">{planName}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Tag icon={<ExclamationCircleOutlined />} color="warning">{t('member_membership.cancel_pending_badge')}</Tag>
                  <Tag icon={<CalendarOutlined />}>{t('member_membership.days_remaining', { days: membership.remainingDays })}</Tag>
                </div>
              </div>
            </div>

            <div className="mb-5 rounded-xl border border-[var(--gs-warning)] bg-[var(--gs-warning-bg)] p-4">
              <div className="flex gap-2">
                <InfoCircleOutlined className="mt-0.5 text-[var(--gs-warning)]" />
                <div className="text-sm text-[var(--gs-text)] whitespace-pre-line">
                  {t('member_membership.cancel_alert_text')}
                </div>
              </div>
            </div>

            <div className="mb-5 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-5">
              <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--gs-text-soft)]">{t('member_membership.cancel_section_title')}</h4>
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-[var(--gs-text-soft)]">{t('member_membership.cancel_label_request_date')}</div>
                    <div className="mt-0.5 text-base font-semibold text-[var(--gs-text)]">{formatDate(pendingCancel.createdAt)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-[var(--gs-text-soft)]">{t('member_membership.cancel_label_refund_method')}</div>
                    <div className="mt-0.5 text-base font-semibold text-[var(--gs-text)]">
                      {pendingCancel.refundEligible ? ({
                        WALLET: t('member_membership.refund_method_wallet'),
                        BANK_TRANSFER: t('member_membership.refund_method_bank'),
                        CASH_COUNTER: t('member_membership.refund_method_cash'),
                        NONE: t('member_membership.refund_method_none'),
                      }[pendingCancel.refundMethod] || pendingCancel.refundMethod) : t('member_membership.cancel_not_eligible')}
                    </div>
                  </div>
                  {pendingCancel.refundEligible && (
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-[var(--gs-text-soft)]">{t('member_membership.cancel_label_estimated_refund')}</div>
                      <div className="mt-0.5 text-base font-semibold text-[var(--gs-success)]">{formatMoney(pendingCancel.estimatedRefundAmount)}</div>
                    </div>
                  )}
                  {pendingCancel.refundEligible && (
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-[var(--gs-text-soft)]">{t('member_membership.cancel_label_refund_status')}</div>
                      <div className="mt-0.5">
                        <Tag color={{
                          PENDING: 'warning',
                          COMPLETED: 'success',
                          NOT_APPLICABLE: 'default',
                        }[pendingCancel.refundStatus] || 'default'}>
                          {{
                            PENDING: t('member_membership.refund_status_pending'),
                            COMPLETED: t('member_membership.refund_status_completed'),
                            NOT_APPLICABLE: t('member_membership.refund_status_not_applicable'),
                          }[pendingCancel.refundStatus] || pendingCancel.refundStatus}
                        </Tag>
                      </div>
                    </div>
                  )}
                  {pendingCancel.reason && (
                    <div className="sm:col-span-2">
                      <div className="text-xs font-medium uppercase tracking-wide text-[var(--gs-text-soft)]">{t('member_membership.cancel_label_reason')}</div>
                      <div className="mt-0.5 text-base text-[var(--gs-text)]">{pendingCancel.reason}</div>
                    </div>
                  )}
              </div>
            </div>

            <Descriptions bordered column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label={t('member_membership.label_plan_name')}>{planName}</Descriptions.Item>
              <Descriptions.Item label={t('member_membership.label_price')}>{formatMoney(membership.price || membership.plan?.price)}</Descriptions.Item>
              <Descriptions.Item label={t('member_membership.label_start_date')}>{formatDate(membership.startDate)}</Descriptions.Item>
              <Descriptions.Item label={t('member_membership.label_end_date')}>{formatDate(membership.endDate)}</Descriptions.Item>
              <Descriptions.Item label={t('member_membership.label_remaining_days')}>{membership.remainingDays}</Descriptions.Item>
              <Descriptions.Item label={t('member_membership.label_status')}>{t('member_membership.cancel_pending_status')}</Descriptions.Item>
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
                  <Tag icon={<CalendarOutlined />}>{t('member_membership.days_remaining', { days: membership.remainingDays })}</Tag>
                </div>
              </div>
              <div className="flex gap-2">
                {membership?.status === 'active' && membership.remainingDays > 0 && (
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={() => window.location.href = '/my-membership/cancel-request'}
                  >
                    {t('member_membership.cancel_btn')}
                  </Button>
                )}
              </div>
            </div>

            {membership?.status === 'active' && membership.remainingDays > 0 && (
              <div className="mb-5 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <SettingOutlined className="text-lg text-[var(--gs-text-soft)]" />
                    <div>
                      <div className="text-sm font-medium text-[var(--gs-text)]">{t('member_membership.auto_renew_label')}</div>
                      <div className="text-xs text-[var(--gs-text-muted)]">{t(membership.autoRenew ? 'member_membership.auto_renew_enabled_desc' : 'member_membership.auto_renew_disabled_desc', { price: formatMoney(membership.price || membership.plan?.price) })}</div>
                    </div>
                  </div>
                  <Switch
                    checked={!!membership.autoRenew}
                    loading={togglingAutoRenew}
                    onChange={handleToggleAutoRenew}
                  />
                </div>
              </div>
            )}

            <Progress percent={progressPercent} status={membership.displayStatus === 'expired' ? 'exception' : 'active'} />

            <Descriptions bordered column={{ xs: 1, sm: 2 }} className="mt-6">
              <Descriptions.Item label={t('member_membership.label_plan_name')}>{planName}</Descriptions.Item>
              <Descriptions.Item label={t('member_membership.label_price')}>{formatMoney(membership.price || membership.plan?.price)}</Descriptions.Item>
              <Descriptions.Item label={t('member_membership.label_start_date')}>{formatDate(membership.startDate)}</Descriptions.Item>
              <Descriptions.Item label={t('member_membership.label_end_date')}>{formatDate(membership.endDate)}</Descriptions.Item>
              <Descriptions.Item label={t('member_membership.label_remaining_days')}>{membership.remainingDays}</Descriptions.Item>
              <Descriptions.Item label={t('member_membership.label_status')}>{(statusMeta[membership.displayStatus] || statusMeta.active).label}</Descriptions.Item>
            </Descriptions>
          </Card>
        )}
      </div>
    </MemberLayout>
  )
}