import { ArrowLeftOutlined, BankOutlined, CheckCircleOutlined, WalletOutlined, WarningOutlined } from '@ant-design/icons'
import { Button, Card, Input, Progress, Radio, Spin, message } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { membershipService, type MyMembership } from '../../../services/membershipService'

const formatMoney = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`
const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString('vi-VN') : '-')

export default function CancelMembershipPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [membership, setMembership] = useState<MyMembership | null>(null)
  const [loading, setLoading] = useState(true)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [usedDays, setUsedDays] = useState(0)
  const [remainingDays, setRemainingDays] = useState(0)
  const [usedPercent, setUsedPercent] = useState(0)
  const [refundEligible, setRefundEligible] = useState(false)
  const [estimatedRefund, setEstimatedRefund] = useState(0)
  const [planPrice, setPlanPrice] = useState(0)
  const [planName, setPlanName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [refundMethod, setRefundMethod] = useState<string>('WALLET')
  const [bankName, setBankName] = useState('')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [bankAccountName, setBankAccountName] = useState('')
  const [bankNote, setBankNote] = useState('')

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
        const used = Math.max(0, Math.min(totalDays, Math.round(usedMs / (1000 * 60 * 60 * 24))))
        const remaining = Math.max(0, Math.round((end - now) / (1000 * 60 * 60 * 24)))
        const percent = Math.round((used / totalDays) * 100)
        setUsedDays(used)
        setRemainingDays(remaining)
        setUsedPercent(percent)

        if (percent < 30) {
          setRefundEligible(true)
          const refund = Math.floor((m.price || 0) * remaining / totalDays)
          setEstimatedRefund(refund)
        } else {
          setRefundEligible(false)
          setEstimatedRefund(0)
        }
      })
      .catch(() => {
        message.error(t('member_cancel.toast_fetch_error'))
        navigate('/my-membership')
      })
      .finally(() => setLoading(false))
  }, [navigate, t])

  const handleSubmit = async () => {
    if (!reason.trim()) {
      message.warning(t('member_cancel.toast_reason_required'))
      return
    }
    if (refundEligible && refundMethod === 'BANK_TRANSFER') {
      if (!bankAccountNumber.trim() || !bankAccountName.trim()) {
        message.warning(t('member_cancel.toast_bank_info_required'))
        return
      }
    }
    setSubmitting(true)
    try {
      const data: any = { reason: reason.trim() }
      if (refundEligible && estimatedRefund > 0) {
        data.refundMethod = refundMethod
        if (refundMethod === 'BANK_TRANSFER') {
          data.bankName = bankName.trim()
          data.bankAccountNumber = bankAccountNumber.trim()
          data.bankAccountName = bankAccountName.trim()
          data.bankNote = bankNote.trim()
        }
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

  const statusLabel = usedPercent >= 30
    ? t('member_cancel.used_over_30')
    : t('member_cancel.used_percent', { percent: usedPercent })

  const infoItems = [
    { label: t('member_cancel.label_plan_name'), value: planName },
    { label: t('member_cancel.label_plan_price'), value: formatMoney(planPrice) },
    { label: t('member_cancel.label_start_date'), value: startDate },
    { label: t('member_cancel.label_end_date'), value: endDate },
    { label: t('member_cancel.label_used_days'), value: t('member_cancel.days', { count: usedDays }) },
    { label: t('member_cancel.label_remaining_days'), value: t('member_cancel.days', { count: remainingDays }) },
    { label: t('member_cancel.label_used_percent'), value: `${usedPercent}%` },
    {
      label: t('member_cancel.label_estimated_refund'),
      value: refundEligible ? formatMoney(estimatedRefund) : t('member_cancel.value_not_eligible'),
      highlight: refundEligible ? 'success' as const : 'muted' as const,
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
              status={usedPercent >= 30 ? 'exception' : 'active'}
              format={() => statusLabel}
              strokeLinecap="round"
            />
          </div>
        </Card>

        {refundEligible && estimatedRefund > 0 && (
          <>
            <Card className="mb-6" styles={{ body: { padding: '20px 24px' } }}>
              <h3 className="mb-4 text-base font-semibold text-[var(--gs-text)]">{t('member_cancel.section_refund_method')}</h3>
              <Radio.Group
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value)}
                className="flex w-full flex-col gap-3"
              >
                <Radio
                  value="WALLET"
                  className={`!flex !items-start !gap-3 rounded-xl border-2 p-4 transition-all ${
                    refundMethod === 'WALLET'
                      ? 'border-[var(--gs-accent)] bg-[var(--gs-accent-muted)]'
                      : 'border-[var(--gs-border)]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <WalletOutlined className="mt-0.5 flex-shrink-0 text-base text-[var(--gs-accent)]" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold leading-snug">{t('member_cancel.refund_wallet_title')}</div>
                      <div className="mt-1 text-sm leading-relaxed text-[var(--gs-text-muted)]">
                        {t('member_cancel.refund_wallet_desc')}
                      </div>
                    </div>
                  </div>
                </Radio>
                <Radio
                  value="BANK_TRANSFER"
                  className={`!flex !items-start !gap-3 rounded-xl border-2 p-4 transition-all ${
                    refundMethod === 'BANK_TRANSFER'
                      ? 'border-[var(--gs-accent)] bg-[var(--gs-accent-muted)]'
                      : 'border-[var(--gs-border)]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <BankOutlined className="mt-0.5 flex-shrink-0 text-base text-[var(--gs-accent)]" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold leading-snug">{t('member_cancel.refund_bank_title')}</div>
                      <div className="mt-1 text-sm leading-relaxed text-[var(--gs-text-muted)]">
                        {t('member_cancel.refund_bank_desc')}
                      </div>
                    </div>
                  </div>
                </Radio>
              </Radio.Group>

              {refundMethod === 'BANK_TRANSFER' && (
                <div className="mt-4 space-y-4 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-5">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[var(--gs-text)]">{t('member_cancel.bank_label_name')}</label>
                    <Input
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder={t('member_cancel.bank_placeholder_name')}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[var(--gs-text)]">{t('member_cancel.bank_label_account_number')}</label>
                      <Input
                        value={bankAccountNumber}
                        onChange={(e) => setBankAccountNumber(e.target.value)}
                        placeholder={t('member_cancel.bank_placeholder_account_number')}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[var(--gs-text)]">{t('member_cancel.bank_label_account_name')}</label>
                      <Input
                        value={bankAccountName}
                        onChange={(e) => setBankAccountName(e.target.value)}
                        placeholder={t('member_cancel.bank_placeholder_account_name')}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[var(--gs-text)]">{t('member_cancel.bank_label_note')}</label>
                    <Input.TextArea
                      rows={2}
                      value={bankNote}
                      onChange={(e) => setBankNote(e.target.value)}
                      placeholder={t('member_cancel.bank_placeholder_note')}
                    />
                  </div>
                </div>
              )}
            </Card>

            <Card className="mb-6" styles={{ body: { padding: '20px 24px' } }}>
              <h3 className="mb-4 text-base font-semibold text-[var(--gs-text)]">{t('member_cancel.section_refund_policy')}</h3>
              <div className="rounded-xl border border-[var(--gs-success)] bg-[var(--gs-success-bg)] p-5">
                <div className="mb-2 flex items-center gap-2 text-[var(--gs-success)]">
                  <CheckCircleOutlined />
                  <span className="font-semibold">{t('member_cancel.policy_eligible_title')}</span>
                </div>
                <p className="m-0 text-sm leading-relaxed text-[var(--gs-text)]">
                  {t('member_cancel.policy_eligible_text', { amount: formatMoney(estimatedRefund), percent: usedPercent })}
                </p>
                <p className="mt-2 text-xs text-[var(--gs-text-muted)]">
                  {t('member_cancel.policy_eligible_note')}
                </p>
              </div>
            </Card>
          </>
        )}

        {!refundEligible && (
          <Card className="mb-6" styles={{ body: { padding: '20px 24px' } }}>
            <h3 className="mb-4 text-base font-semibold text-[var(--gs-text)]">{t('member_cancel.section_refund_policy')}</h3>
            <div className="rounded-xl border border-[var(--gs-warning)] bg-[var(--gs-warning-bg)] p-5">
              <div className="mb-2 flex items-center gap-2 text-[var(--gs-warning)]">
                <WarningOutlined />
                <span className="font-semibold">{t('member_cancel.policy_not_eligible_title')}</span>
              </div>
              <p className="m-0 text-sm leading-relaxed text-[var(--gs-text)]">
                {t('member_cancel.policy_not_eligible_text')}
              </p>
            </div>
          </Card>
        )}

        <Card className="mb-6" styles={{ body: { padding: '20px 24px' } }}>
          <h3 className="mb-4 text-base font-semibold text-[var(--gs-text)]">{t('member_cancel.section_reason')}</h3>
          <Input.TextArea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('member_cancel.reason_placeholder')}
          />
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
            <Button
              type="primary"
              danger
              loading={submitting}
              disabled={!reason.trim()}
              onClick={handleSubmit}
            >
              {t('member_cancel.submit_btn')}
            </Button>
          </div>
        </div>
      </div>
    </MemberLayout>
  )
}
