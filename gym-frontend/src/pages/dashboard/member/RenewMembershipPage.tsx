import { ArrowLeftOutlined, CheckCircleFilled, CreditCardOutlined, InfoCircleOutlined, WarningOutlined } from '@ant-design/icons'
import { Button, Card, Descriptions, Radio, Spin, Statistic, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { useWallet } from '../../../context/WalletProvider'
import { membershipService, type MyMembership } from '../../../services/membershipService'

const formatMoney = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`
const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString('vi-VN') : '-')

const durationMap = { 1: 1, 2: 2, 3: 3 }

export default function RenewMembershipPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { wallet, refreshWallet } = useWallet()
  const [membership, setMembership] = useState<MyMembership | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [multiplier, setMultiplier] = useState<number>(1)

  const planDays = membership?.durationDays || membership?.plan?.durationDays || 0
  const planPrice = membership?.price || membership?.plan?.price || 0
  const currentBalance = Number(wallet?.balance || 0)

  const totalDays = planDays * multiplier
  const totalPrice = planPrice * multiplier
  const balanceAfter = currentBalance - totalPrice
  const balanceSufficient = balanceAfter >= 0

  const currentEnd = membership?.endDate
  const now = new Date()
  const isStillActive = currentEnd ? new Date(currentEnd) >= now : false

  const newEndDate = useMemo(() => {
    if (!currentEnd) return ''
    const base = isStillActive ? new Date(currentEnd) : now
    const end = new Date(base)
    end.setDate(end.getDate() + totalDays)
    return formatDate(end.toISOString())
  }, [currentEnd, isStillActive, totalDays])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      membershipService.getMyMembership(),
      refreshWallet(),
    ])
      .then(([res]) => {
        const m = res.data.membership
        if (!m) {
          message.error(t('member_renew.toast_no_membership'))
          navigate('/my-membership')
          return
        }
        if (m.status === 'cancelled') {
          message.error(t('member_renew.toast_cancelled'))
          navigate('/my-membership')
          return
        }
        if (res.data.cancellationRequests?.some((r: any) => r.status === 'pending')) {
          message.error(t('member_renew.toast_pending_cancel'))
          navigate('/my-membership')
          return
        }
        setMembership(m)
      })
      .catch(() => {
        message.error(t('member_renew.toast_fetch_error'))
        navigate('/my-membership')
      })
      .finally(() => setLoading(false))
  }, [navigate, t, refreshWallet])

  const planName = membership?.plan?.nameVi || membership?.planNameVi || membership?.plan?.nameEn || membership?.planNameEn || '-'

  const handleRenew = async () => {
    setSubmitting(true)
    try {
      const res = await membershipService.renewPlanWithDuration(multiplier)
      message.success(res.data?.message || t('member_renew.toast_success'))
      await refreshWallet()
      navigate('/my-membership')
    } catch (error: any) {
      message.error(error.response?.data?.message || t('member_renew.toast_failed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <MemberLayout>
        <div className="flex min-h-[400px] items-center justify-center"><Spin /></div>
      </MemberLayout>
    )
  }

  if (!membership) return null

  return (
    <MemberLayout>
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
        <div className="mb-6 flex items-center gap-3">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/my-membership')} />
          <div>
            <p className="m-0 text-xs uppercase tracking-[0.24em] text-[var(--gs-text-soft)]">{t('member_renew.page_subtitle')}</p>
            <h1 className="m-0 mt-1 text-2xl font-semibold text-[var(--gs-text)] max-[480px]:text-xl">{t('member_renew.title')}</h1>
          </div>
        </div>

        <Card className="mb-6" styles={{ body: { padding: '20px 24px' } }}>
          <h3 className="mb-5 text-base font-semibold text-[var(--gs-text)]">{t('member_renew.section_current_plan')}</h3>
          <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
            <Descriptions.Item label={t('member_renew.label_plan_name')}>{planName}</Descriptions.Item>
            <Descriptions.Item label={t('member_renew.label_price')}>{formatMoney(planPrice)}</Descriptions.Item>
            <Descriptions.Item label={t('member_renew.label_duration')}>{t('member_renew.days', { count: planDays })}</Descriptions.Item>
            <Descriptions.Item label={t('member_renew.label_current_end')}>{formatDate(currentEnd)}</Descriptions.Item>
          </Descriptions>
        </Card>

        <Card className="mb-6" styles={{ body: { padding: '20px 24px' } }}>
          <h3 className="mb-4 text-base font-semibold text-[var(--gs-text)]">{t('member_renew.section_select_duration')}</h3>
          <Radio.Group
            value={multiplier}
            onChange={(e) => setMultiplier(e.target.value)}
            className="flex w-full flex-col gap-3"
          >
            {[1, 2, 3].map((m) => {
              const days = planDays * m
              const price = planPrice * m
              return (
                <Radio
                  key={m}
                  value={m}
                  className={`!flex !items-start !gap-3 rounded-xl border-2 p-4 transition-all ${
                    multiplier === m
                      ? 'border-[var(--gs-accent)] bg-[var(--gs-accent-muted)]'
                      : 'border-[var(--gs-border)]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <CreditCardOutlined className="mt-0.5 flex-shrink-0 text-base text-[var(--gs-accent)]" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold leading-snug">
                        {t('member_renew.option_title', { multiplier: m })}
                      </div>
                      <div className="mt-1 text-sm leading-relaxed text-[var(--gs-text-muted)]">
                        {t('member_renew.option_desc', { days, price: formatMoney(price) })}
                      </div>
                    </div>
                  </div>
                </Radio>
              )
            })}
          </Radio.Group>
        </Card>

        <Card className="mb-6" styles={{ body: { padding: '20px 24px' } }}>
          <h3 className="mb-4 text-base font-semibold text-[var(--gs-text)]">{t('member_renew.section_summary')}</h3>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <Statistic
              title={t('member_renew.label_new_end_date')}
              value={newEndDate}
              valueStyle={{ fontSize: 16, fontWeight: 600 }}
            />
            <Statistic
              title={t('member_renew.label_total_price')}
              value={formatMoney(totalPrice)}
              valueStyle={{ fontSize: 16, fontWeight: 600, color: 'var(--gs-success)' }}
            />
            <Statistic
              title={t('member_renew.label_current_balance')}
              value={formatMoney(currentBalance)}
              valueStyle={{ fontSize: 16, fontWeight: 600 }}
            />
          </div>
          <div className={`mt-4 rounded-xl border p-4 ${
            balanceSufficient
              ? 'border-[var(--gs-success)] bg-[var(--gs-success-bg)]'
              : 'border-[var(--gs-warning)] bg-[var(--gs-warning-bg)]'
          }`}>
            <div className="flex items-center gap-2">
              {balanceSufficient ? (
                <CheckCircleFilled className="text-[var(--gs-success)]" />
              ) : (
                <WarningOutlined className="text-[var(--gs-warning)]" />
              )}
              <span className={`font-medium ${balanceSufficient ? 'text-[var(--gs-success)]' : 'text-[var(--gs-warning)]'}`}>
                {balanceSufficient
                  ? t('member_renew.balance_sufficient', { balance: formatMoney(balanceAfter) })
                  : t('member_renew.balance_insufficient', { short: formatMoney(Math.abs(balanceAfter)) })
                }
              </span>
            </div>
          </div>
        </Card>

        {!balanceSufficient && (
          <div className="mb-6 rounded-xl border border-[var(--gs-warning)] bg-[var(--gs-warning-bg)] p-4">
            <div className="flex gap-2">
              <InfoCircleOutlined className="mt-0.5 text-[var(--gs-warning)]" />
              <div className="text-sm text-[var(--gs-text)]">{t('member_renew.insufficient_hint')}</div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="m-0 text-sm font-medium text-[var(--gs-text)]">{t('member_renew.confirm_title')}</p>
            <p className="m-0 mt-0.5 text-xs text-[var(--gs-text-muted)]">{t('member_renew.confirm_desc')}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button onClick={() => navigate('/my-membership')}>{t('member_renew.back_btn')}</Button>
            <Button
              type="primary"
              loading={submitting}
              disabled={!balanceSufficient}
              onClick={handleRenew}
            >
              {t('member_renew.submit_btn')}
            </Button>
          </div>
        </div>
      </div>
    </MemberLayout>
  )
}
