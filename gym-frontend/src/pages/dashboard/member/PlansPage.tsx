import { CheckCircleOutlined, CreditCardOutlined } from '@ant-design/icons'
import { Button, Card, Descriptions, Empty, Modal, Spin, Tag, message } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { useWallet } from '../../../context/WalletProvider'
import { membershipService, type MembershipPlan } from '../../../services/membershipService'

const formatMoney = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`

export default function PlansPage() {
  const { t, i18n } = useTranslation()
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null)
  const { wallet, refreshWallet } = useWallet()
  const navigate = useNavigate()
  const lang = i18n.language

  useEffect(() => {
    membershipService.getPlans()
      .then((res) => setPlans(res.data.plans || []))
      .catch(() => message.error(t('member_plans.toast_fetch_error')))
      .finally(() => setLoading(false))
  }, [])

  const getName = (plan: MembershipPlan) => lang.startsWith('vi') ? plan.nameVi || plan.nameEn : plan.nameEn || plan.nameVi
  const getDesc = (plan: MembershipPlan) => lang.startsWith('vi') ? plan.descriptionVi || plan.descriptionEn : plan.descriptionEn || plan.descriptionVi
  const getFeatures = (plan: MembershipPlan) => lang.startsWith('vi') ? plan.featuresVi || plan.featuresEn || [] : plan.featuresEn || plan.featuresVi || []

  const handleRegister = async () => {
    if (!selectedPlan) return
    const plan = selectedPlan
    setSubmittingId(plan._id)
    try {
      const res = await membershipService.subscribePlan(plan._id)
      message.success(res.data?.message || t('member_plans.toast_register_success'))
      setSelectedPlan(null)
      await refreshWallet()
      navigate('/my-membership')
    } catch (error: any) {
      const status = error.response?.status
      const msg = error.response?.data?.message || ''
      if (status === 400 && (msg.includes('đang có gói tập') || msg.includes('active plan'))) {
        message.error(t('member_plans.toast_active_exists'))
      } else {
        message.error(msg || t('member_plans.toast_register_error'))
      }
    } finally {
      setSubmittingId(null)
    }
  }

  const currentBalance = Number(wallet?.balance || 0)
  const selectedPrice = Number(selectedPlan?.price || 0)
  const balanceAfter = currentBalance - selectedPrice

  return (
    <MemberLayout>
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="m-0 text-xs uppercase tracking-[0.24em] text-[var(--gs-text-soft)]">{t('member_plans.page_subtitle')}</p>
            <h1 className="m-0 mt-2 text-3xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">{t('member_plans.title')}</h1>
          </div>
          <Button href="/my-membership">{t('member_plans.my_membership_btn')}</Button>
        </div>

        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center"><Spin /></div>
        ) : plans.length === 0 ? (
          <Empty description={t('member_plans.empty')} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan._id}
                className="h-full"
                style={{ borderTop: `4px solid ${plan.color || '#1677ff'}` }}
                title={<span>{getName(plan)}</span>}
                extra={<Tag color="blue">{t('member_plans.days', { days: plan.durationDays })}</Tag>}
              >
                <div className="mb-4 text-2xl font-semibold">{formatMoney(plan.price)}</div>
                <p className="min-h-[44px] text-sm text-[var(--gs-text-muted)]">{getDesc(plan) || t('member_plans.card_desc_fallback')}</p>
                <div className="mb-5 space-y-2">
                  {getFeatures(plan).slice(0, 5).map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-sm">
                      <CheckCircleOutlined style={{ color: plan.color || '#1677ff' }} />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <Button
                  type="primary"
                  icon={<CreditCardOutlined />}
                  block
                  loading={submittingId === plan._id}
                  onClick={() => setSelectedPlan(plan)}
                >
                  {t('member_plans.register_btn')}
                </Button>
              </Card>
            ))}
          </div>
        )}

        <Modal
          title={t('member_plans.modal_title')}
          open={Boolean(selectedPlan)}
          onCancel={() => setSelectedPlan(null)}
          footer={[
            <Button key="cancel" onClick={() => setSelectedPlan(null)}>{t('member_plans.modal_cancel')}</Button>,
            <Button
              key="confirm"
              type="primary"
              loading={Boolean(submittingId)}
              onClick={handleRegister}
            >
              {t('member_plans.modal_confirm')}
            </Button>,
          ]}
        >
          {selectedPlan && (
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label={t('member_plans.label_plan_name')}>{getName(selectedPlan)}</Descriptions.Item>
              <Descriptions.Item label={t('member_plans.label_price')}>{formatMoney(selectedPlan.price)}</Descriptions.Item>
              <Descriptions.Item label={t('member_plans.label_current_balance')}>{formatMoney(currentBalance)}</Descriptions.Item>
              <Descriptions.Item label={t('member_plans.label_balance_after')}>
                <span style={{ color: balanceAfter < 0 ? 'var(--gs-danger)' : 'inherit' }}>
                  {formatMoney(balanceAfter)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label={t('member_plans.label_duration')}>{t('member_plans.days', { days: selectedPlan.durationDays })}</Descriptions.Item>
            </Descriptions>
          )}
        </Modal>
      </div>
    </MemberLayout>
  )
}
