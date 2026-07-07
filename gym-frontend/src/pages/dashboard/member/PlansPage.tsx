import { CheckCircleOutlined, CreditCardOutlined } from '@ant-design/icons'
import { Button, Card, Descriptions, Empty, Modal, Select, Spin, Tag, Tooltip, message } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { useWallet } from '../../../context/WalletProvider'
import { membershipService, type MembershipPlan } from '../../../services/membershipService'
import PolicyConsentCard from '../../../components/wallet/PolicyConsentCard'
import { acceptMultiplePolicyConsent } from '../../../utils/policyConsent'

const formatMoney = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`

const SPECIALIZATIONS = ['Yoga', 'GYM', 'Boxing', 'CrossFit', 'Pilates', 'Zumba', 'Personal Training', 'Cardio', 'Weight Loss', 'Muscle Gain']

export default function PlansPage() {
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [specializationFilter, setSpecializationFilter] = useState<string | undefined>(undefined)
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlan | null>(null)
  const [tickedPolicies, setTickedPolicies] = useState<Record<string, { type: string; version: string }> | null>(null)
  const [consentSubmitted, setConsentSubmitted] = useState(false)
  const consentReady = tickedPolicies !== null && Object.keys(tickedPolicies).length > 0
  const { wallet, refreshWallet } = useWallet()
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    const params: Record<string, any> = {}
    if (specializationFilter) {
      params.specialization = specializationFilter
    }
    membershipService.getPlans(params)
      .then((res) => setPlans(res.data.plans || []))
      .catch(() => message.error('Không thể tải danh sách gói tập'))
      .finally(() => setLoading(false))
  }, [specializationFilter])



  const getName = (plan: MembershipPlan) => plan.nameVi || plan.nameEn
  const getDesc = (plan: MembershipPlan) => plan.descriptionVi || plan.descriptionEn
  const getFeatures = (plan: MembershipPlan) => plan.featuresVi || plan.featuresEn || []

  const handleRegister = async () => {
    if (!selectedPlan) return
    if (!consentReady) return
    const plan = selectedPlan
    setSubmittingId(plan._id)
    try {
      if (!consentSubmitted) {
        await acceptMultiplePolicyConsent(
          Object.values(tickedPolicies!).map((p) => ({
            policyType: p.type,
            policyVersion: p.version,
            context: 'plans',
          })),
        )
        setConsentSubmitted(true)
      }
      const res = await membershipService.subscribePlan(plan._id)
      message.success(res.data?.message || 'Đăng ký gói tập thành công')
      setSelectedPlan(null)
      await refreshWallet()
      navigate('/my-membership')
    } catch (error: any) {
      const status = error.response?.status
      const msg = error.response?.data?.message || ''
      if (status === 400 && (msg.includes('đang có gói tập') || msg.includes('active plan'))) {
        message.error('Bạn đang có gói tập hoạt động')
      } else {
        message.error(msg || 'Đăng ký thất bại')
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
            <p className="m-0 text-xs uppercase tracking-[0.24em] text-[var(--gs-text-soft)]">GÓI TẬP</p>
            <h1 className="m-0 mt-2 text-3xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">Chọn gói tập</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button href="/my-membership">Gói của tôi</Button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center"><Spin /></div>
        ) : plans.length === 0 ? (
          <Empty description="Không có gói tập nào" />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan._id}
                className="h-full"
                style={{
                  borderTop: `4px solid ${plan.color || '#1677ff'}`,
                  display: 'flex',
                  flexDirection: 'column',
                }}
                styles={{ body: { flex: 1 } }}
                title={<span>{getName(plan)}</span>}
                extra={<Tag color="blue">{plan.durationDays} ngày</Tag>}
              >
                <div className="flex h-full flex-col">
                  <div className="mb-4 text-2xl font-semibold">{formatMoney(plan.price)}</div>
                  <p className="min-h-[44px] text-sm text-[var(--gs-text-muted)]">{getDesc(plan) || 'Gói tập phù hợp với nhu cầu của bạn'}</p>
                  <div className="mb-5 flex-1 space-y-2">
                    {getFeatures(plan).map((feature) => (
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
                    onClick={() => {
                      setSelectedPlan(plan)
                      setTickedPolicies(null)
                      setConsentSubmitted(false)
                    }}
                  >
                    Đăng ký
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Modal
          title="Xác nhận đăng ký"
          open={Boolean(selectedPlan)}
          destroyOnHidden
          onCancel={() => {
            setSelectedPlan(null)
            setTickedPolicies(null)
            setConsentSubmitted(false)
          }}
          footer={null}
          className="policy-ant-modal"
          width={640}
          centered
        >
          {selectedPlan && (
            <div key={selectedPlan._id} className="policy-modal-shell">
              <div className="policy-modal-content">
                <div className="space-y-4">
                  <Descriptions bordered column={1} size="small">
                    <Descriptions.Item label="Tên gói">{getName(selectedPlan)}</Descriptions.Item>
                    <Descriptions.Item label="Giá">{formatMoney(selectedPlan.price)}</Descriptions.Item>
                    <Descriptions.Item label="Số dư hiện tại">{formatMoney(currentBalance)}</Descriptions.Item>
                    <Descriptions.Item label="Số dư sau khi đăng ký">
                      <span style={{ color: balanceAfter < 0 ? 'var(--gs-danger)' : 'inherit' }}>
                        {formatMoney(balanceAfter)}
                      </span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Thời hạn">{selectedPlan.durationDays} ngày</Descriptions.Item>
                  </Descriptions>

                  <PolicyConsentCard
                    key={selectedPlan._id}
                    policies={[
                      { type: 'membership', label: 'Chính sách hội viên' },
                      { type: 'terms', label: 'Điều khoản sử dụng' },
                    ]}
                    context="plans"
                    onTickedChange={(ticked) => {
                      setTickedPolicies(Object.keys(ticked).length > 0 ? ticked : null)
                    }}
                  />
                </div>
              </div>
              <div className="policy-modal-footer">
                <div className="policy-modal-actions">
                  <Button
                    onClick={() => {
                      setSelectedPlan(null)
                      setTickedPolicies(null)
                      setConsentSubmitted(false)
                    }}
                  >
                    Hủy
                  </Button>
                  <Tooltip title={!consentReady ? 'Vui lòng đồng ý với chính sách' : undefined}>
                    <Button
                      className="policy-confirm-action"
                      type="primary"
                      loading={Boolean(submittingId)}
                      disabled={!consentReady}
                      onClick={handleRegister}
                    >
                      Xác nhận
                    </Button>
                  </Tooltip>
                </div>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </MemberLayout>
  )
}
