import { ArrowLeftOutlined, CheckCircleOutlined, WalletOutlined, WarningOutlined } from '@ant-design/icons'
import { Button, Card, Checkbox, Input, Progress, Spin, Tooltip, message } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { membershipService, type MyMembership } from '../../../services/membershipService'
import { acceptPolicyConsent, checkConsentStatus } from '../../../utils/policyConsent'

const formatMoney = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`
const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString('vi-VN') : '-')

export default function CancelMembershipPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [, setMembership] = useState<MyMembership | null>(null)
  const [loading, setLoading] = useState(true)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [usedDays, setUsedDays] = useState(0)
  const [remainingDays, setRemainingDays] = useState(0)
  const [totalDays, setTotalDays] = useState(0)
  const [usedPercent, setUsedPercent] = useState(0)
  const [refundEligible, setRefundEligible] = useState(false)
  const [estimatedRefund, setEstimatedRefund] = useState(0)
  const [refundPolicyCode, setRefundPolicyCode] = useState<'REFUND_100' | 'REFUND_50' | 'NO_REFUND'>('NO_REFUND')
  const [planPrice, setPlanPrice] = useState(0)
  const [planName, setPlanName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [policyAccepted, setPolicyAccepted] = useState(false)
  const [consentStatus, setConsentStatus] = useState<Record<string, any> | null>(null)
  const allConsented = consentStatus && ['refund', 'membership'].every((t) => consentStatus[t]?.accepted)
  const canSubmitCancel = allConsented || policyAccepted
  const refundEligibility = {
    eligible: refundEligible,
    estimatedAmount: estimatedRefund,
    maxRefundAmount: planPrice,
    policyCode: refundPolicyCode,
  }

  useEffect(() => {
    setLoading(true)
    membershipService
      .getMyMembership()
      .then((res) => {
        const m = res.data.membership
        if (!m) {
          message.error(t('member_cancel.toast_no_membership'))
          navigate('/my-membership')
          return
        }
        setMembership(m)
        setPlanName(m.plan?.nameVi || m.planNameVi || '-')
        setPlanPrice(m.price || m.plan?.price || 0)
        setStartDate(formatDate(m.startDate))
        setEndDate(formatDate(m.endDate))

        const start = new Date(m.startDate).getTime()
        const end = new Date(m.endDate).getTime()
        const now = Date.now()
        const totalMs = end - start
        const usedMs = Math.max(0, now - start)
        const totalDays = Math.max(1, Math.round(totalMs / (1000 * 60 * 60 * 24)))
        const used = Math.max(1, Math.min(totalDays, Math.ceil(usedMs / (1000 * 60 * 60 * 24))))
        const remaining = Math.max(0, Math.round((end - now) / (1000 * 60 * 60 * 24)))
        const percent = Math.round((used / totalDays) * 100)
        setUsedDays(used)
        setRemainingDays(remaining)
        setTotalDays(totalDays)
        setUsedPercent(percent)

        if (percent > 50) {
          setRefundEligible(false)
          setEstimatedRefund(0)
          setRefundPolicyCode('NO_REFUND')
        } else if (used <= 7) {
          setRefundEligible(true)
          setEstimatedRefund(m.price || 0)
          setRefundPolicyCode('REFUND_100')
        } else {
          setRefundEligible(true)
          setEstimatedRefund(Math.floor((m.price || 0) * 0.5))
          setRefundPolicyCode('REFUND_50')
        }
      })
      .catch(() => {
        message.error(t('member_cancel.toast_fetch_error'))
        navigate('/my-membership')
      })
      .finally(() => setLoading(false))
  }, [navigate, t])

  useEffect(() => {
    checkConsentStatus(['refund', 'membership']).then(setConsentStatus)
  }, [])

  const handleSubmit = async () => {
    if (!reason.trim()) {
      message.warning(t('member_cancel.toast_reason_required'))
      return
    }
    if (!canSubmitCancel) {
      message.warning(t('member_cancel.toast_policy_required'))
      return
    }
    setSubmitting(true)
    try {
      const data: any = { reason: reason.trim(), policyAccepted }
      if (refundEligibility.eligible && refundEligibility.estimatedAmount > 0) {
        data.refundMethod = 'WALLET'
      }
      const res = await membershipService.createCancelRequest(data)
      message.success(res.data.message)
      navigate('/my-membership')
    } catch (error: any) {
      message.error(error.response?.data?.message || t('member_cancel.toast_submit_failed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <MemberLayout>
        <div className="flex min-h-[400px] items-center justify-center">
          <Spin />
        </div>
      </MemberLayout>
    )
  }

  const statusLabel = refundEligibility.policyCode === 'NO_REFUND'
    ? t('member_cancel.used_over_50')
    : t('member_cancel.used_percent', { percent: usedPercent })

  const policyResultText = refundEligibility.policyCode === 'REFUND_100'
    ? t('member_cancel.policy_result_100', { days: usedDays })
    : refundEligibility.policyCode === 'REFUND_50'
      ? t('member_cancel.policy_result_50', { days: usedDays })
      : t('member_cancel.policy_result_none')

  const refundPolicyStatus = refundEligibility.eligible
    ? {
        icon: <CheckCircleOutlined />,
        title: t('member_cancel.policy_eligible_title'),
        text: t('member_cancel.policy_eligible_100_text', { amount: formatMoney(refundEligibility.maxRefundAmount) }),
        note: t('member_cancel.policy_eligible_note'),
        tone: 'success' as const,
      }
    : {
        icon: <WarningOutlined />,
        title: t('member_cancel.policy_not_eligible_title'),
        text: t('member_cancel.policy_not_eligible_over_50_text'),
        note: '',
        tone: 'warning' as const,
      }

  const infoItems = [
    { label: t('member_cancel.label_plan_name'), value: planName },
    { label: t('member_cancel.label_plan_price'), value: formatMoney(planPrice) },
    { label: t('member_cancel.label_start_date'), value: startDate },
    { label: t('member_cancel.label_end_date'), value: endDate },
    { label: t('member_cancel.label_used_days'), value: t('member_cancel.days', { count: usedDays }) },
    { label: t('member_cancel.label_total_days'), value: t('member_cancel.days', { count: totalDays }) },
    { label: t('member_cancel.label_remaining_days'), value: t('member_cancel.days', { count: remainingDays }) },
    { label: t('member_cancel.label_used_percent'), value: `${usedPercent}%` },
    {
      label: t('member_cancel.label_estimated_refund'),
      value: refundEligibility.eligible ? formatMoney(refundEligibility.estimatedAmount) : t('member_cancel.value_not_eligible'),
      highlight: refundEligibility.eligible ? 'success' as const : 'muted' as const,
    },
  ]

  return (
    <MemberLayout>
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
        <div className="mb-6 flex items-center gap-3">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/my-membership')} />
          <div>
            <p className="m-0 text-xs uppercase tracking-[0.24em] text-[var(--gs-text-soft)]">{t('member_cancel.page_subtitle')}</p>
            <h1 className="m-0 mt-1 text-2xl font-semibold text-[var(--gs-text)] max-[480px]:text-xl">{t('member_cancel.title')}</h1>
          </div>
        </div>

        <Card className="mb-6" styles={{ body: { padding: '20px 24px' } }}>
          <h3 className="mb-5 text-base font-semibold text-[var(--gs-text)]">{t('member_cancel.section_plan_info')}</h3>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            {infoItems.slice(0, 4).map((item) => (
              <div key={item.label}>
                <div className="mb-0.5 text-xs font-medium uppercase tracking-wide text-[var(--gs-text-soft)]">{item.label}</div>
                <div className="truncate text-base font-semibold text-[var(--gs-text)]">{item.value}</div>
              </div>
            ))}
            {infoItems.slice(4).map((item) => (
              <div key={item.label}>
                <div className="mb-0.5 text-xs font-medium uppercase tracking-wide text-[var(--gs-text-soft)]">{item.label}</div>
                <div
                  className={`truncate text-base font-semibold ${
                    item.highlight === 'success'
                      ? 'text-[var(--gs-success)]'
                      : item.highlight === 'muted'
                        ? 'text-[var(--gs-text-muted)]'
                        : 'text-[var(--gs-text)]'
                  }`}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <Progress
              percent={usedPercent}
              status={refundEligibility.policyCode === 'NO_REFUND' ? 'exception' : 'active'}
              format={() => statusLabel}
              strokeLinecap="round"
            />
          </div>
          <div className={`mt-5 rounded-xl border p-4 text-sm leading-6 ${
            refundEligibility.policyCode === 'NO_REFUND'
              ? 'border-[var(--gs-warning)] bg-[var(--gs-warning-bg)] text-[var(--gs-text)]'
              : 'border-[var(--gs-success)] bg-[var(--gs-success-bg)] text-[var(--gs-text)]'
          }`}>
            {policyResultText}
          </div>
        </Card>

        {refundEligibility.eligible && refundEligibility.estimatedAmount > 0 && (
          <>
            <Card className="mb-6" styles={{ body: { padding: '20px 24px' } }}>
              <h3 className="mb-4 text-base font-semibold text-[var(--gs-text)]">{t('member_cancel.section_refund_method')}</h3>
              <div className="rounded-xl border-2 border-[var(--gs-accent)] bg-[var(--gs-accent-muted)] p-4">
                <div className="flex items-start gap-3">
                  <WalletOutlined className="mt-0.5 flex-shrink-0 text-base text-[var(--gs-accent)]" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold leading-snug">{t('member_cancel.refund_wallet_title')}</div>
                    <div className="mt-1 text-sm leading-relaxed text-[var(--gs-text-muted)]">
                      {t('member_cancel.refund_wallet_desc')}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

          </>
        )}

        <Card className="mb-6" styles={{ body: { padding: '20px 24px' } }}>
          <h3 className="mb-4 text-base font-semibold text-[var(--gs-text)]">
            {t('member_cancel.section_reason')} <span className="text-red-500">*</span>
          </h3>
          <Input.TextArea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('member_cancel.reason_placeholder')}
          />
        </Card>

        <Card className="mb-6" styles={{ body: { padding: '20px 24px' } }}>
          <h3 className="mb-4 text-base font-semibold text-[var(--gs-text)]">{t('member_cancel.section_terms')}</h3>
          <div className={`mb-4 rounded-xl border p-5 ${
            refundPolicyStatus.tone === 'success'
              ? 'border-[var(--gs-success)] bg-[var(--gs-success-bg)]'
              : 'border-[var(--gs-warning)] bg-[var(--gs-warning-bg)]'
          }`}>
            <div className={`mb-2 flex items-center gap-2 ${
              refundPolicyStatus.tone === 'success' ? 'text-[var(--gs-success)]' : 'text-[var(--gs-warning)]'
            }`}>
              {refundPolicyStatus.icon}
              <span className="font-semibold">{refundPolicyStatus.title}</span>
            </div>
            <p className="m-0 text-sm leading-relaxed text-[var(--gs-text)]">{refundPolicyStatus.text}</p>
            {refundPolicyStatus.note && (
              <p className="mt-2 text-xs text-[var(--gs-text-muted)]">{refundPolicyStatus.note}</p>
            )}
          </div>
          {consentStatus && !allConsented && (
            <p className="m-0 mb-3 rounded-lg border border-[var(--theme-accent-border)] bg-[var(--theme-accent-muted)] px-3 py-2 text-xs text-[var(--theme-accent)]">
              {t('member_cancel.version_changed') || 'Chính sách đã được cập nhật. Vui lòng đọc và xác nhận lại trước khi tiếp tục.'}
            </p>
          )}
          {consentStatus && allConsented && (
            <p className="m-0 mb-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
              {t('member_cancel.all_consented') || 'Bạn đã đồng ý với phiên bản chính sách hiện tại.'}
            </p>
          )}
          <Checkbox
            className="policy-confirm-checkbox"
            checked={policyAccepted}
            disabled={false}
            onChange={async (event) => {
              const checked = event.target.checked
              setPolicyAccepted(checked)
              if (checked) {
                try {
                  await acceptPolicyConsent('refund', '1.0')
                } catch {
                  // silent
                }
              }
            }}
          >
            <span className="text-sm text-[var(--theme-text)]">
              {t('member_cancel.policy_accept_all')}{' '}
              <Link
                to="/policies"
                className="font-medium underline-offset-2 hover:underline"
                style={{ color: 'var(--theme-accent)' }}
                onMouseEnter={(event) => { event.currentTarget.style.color = 'var(--theme-accent-hover)' }}
                onMouseLeave={(event) => { event.currentTarget.style.color = 'var(--theme-accent)' }}
              >
                {t('member_cancel.policy_view_short')}
              </Link>
            </span>
          </Checkbox>
        </Card>

        <div className="flex flex-col gap-3 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="m-0 text-sm font-medium text-[var(--gs-text)]">{t('member_cancel.confirm_title')}</p>
            <p className="m-0 mt-0.5 text-xs text-[var(--gs-text-muted)]">
              {t('member_cancel.confirm_desc')}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button onClick={() => navigate('/my-membership')}>{t('member_cancel.back_btn')}</Button>
            <Tooltip title={!canSubmitCancel ? t('member_cancel.tooltip_accept_required') : undefined}>
              <Button
                className="policy-confirm-action"
                type="primary"
                danger
                loading={submitting}
                disabled={!reason.trim() || !canSubmitCancel}
                onClick={handleSubmit}
              >
                {t('member_cancel.submit_btn')}
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>
    </MemberLayout>
  )
}
