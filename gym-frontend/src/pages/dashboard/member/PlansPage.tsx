import { CheckCircleOutlined, CreditCardOutlined, QrcodeOutlined, WalletOutlined } from '@ant-design/icons'
import { Button, Card, Descriptions, Empty, Modal, Spin, Tag, Tooltip, message } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { useWallet } from '../../../context/WalletProvider'
import { membershipService, type MembershipPlan } from '../../../services/membershipService'
import PolicyConsentCard from '../../../components/wallet/PolicyConsentCard'
import { acceptMultiplePolicyConsent } from '../../../utils/policyConsent'

const formatMoney = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}\u0111`

export default function PlansPage() {
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [specializationFilter] = useState<string | undefined>(undefined)
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
      .catch(() => message.error('Kh\u00f4ng th\u1ec3 t\u1ea3i danh s\u00e1ch g\u00f3i t\u1eadp'))
      .finally(() => setLoading(false))
  }, [specializationFilter])

  const getName = (plan: MembershipPlan) => plan.nameVi
  const getDesc = (plan: MembershipPlan) => plan.descriptionVi
  const getFeatures = (plan: MembershipPlan) => plan.featureIds || []

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
      const res = await membershipService.checkoutPlan(plan._id)
      if (res.data?.status === 'PAID') {
        message.success(res.data?.message || '\u0110\u0103ng k\u00fd g\u00f3i t\u1eadp th\u00e0nh c\u00f4ng')
        setSelectedPlan(null)
        await refreshWallet()
        navigate('/my-membership')
      } else if (res.data?.paymentUrl) {
        window.location.href = res.data.paymentUrl
      } else {
        message.error('Kh\u00f4ng th\u1ec3 t\u1ea1o phi\u00ean thanh to\u00e1n')
      }
    } catch (error: any) {
      const status = error.response?.status
      const msg = error.response?.data?.message || ''
      if (status === 400 && (msg.includes('\u0111ang c\u00f3 g\u00f3i t\u1eadp') || msg.includes('active plan'))) {
        message.error('B\u1ea1n \u0111ang c\u00f3 g\u00f3i t\u1eadp ho\u1ea1t \u0111\u1ed9ng')
      } else {
        message.error(msg || '\u0110\u0103ng k\u00fd th\u1ea5t b\u1ea1i')
      }
    } finally {
      setSubmittingId(null)
    }
  }

  const currentBalance = Number(wallet?.balance || 0)
  const selectedPrice = Number(selectedPlan?.price || 0)
  const balanceAfter = currentBalance - selectedPrice
  const balanceSufficient = currentBalance >= selectedPrice
  const remainingAmount = Math.max(0, selectedPrice - currentBalance)

  return (
    <MemberLayout>
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="m-0 text-xs uppercase tracking-[0.24em] text-[var(--gs-text-soft)]">{'G\u00d3I T\u1eacP'}</p>
            <h1 className="m-0 mt-2 text-3xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">{'Ch\u1ecdn g\u00f3i t\u1eadp'}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button href="/my-membership">{'G\u00f3i c\u1ee7a t\u00f4i'}</Button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center"><Spin /></div>
        ) : plans.length === 0 ? (
          <Empty description={'Kh\u00f4ng c\u00f3 g\u00f3i t\u1eadp n\u00e0o'} />
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
                extra={<Tag color="blue">{plan.durationDays} {'ng\u00e0y'}</Tag>}
              >
                <div className="flex h-full flex-col">
                  <div className="mb-4 text-2xl font-semibold">{formatMoney(plan.price)}</div>
                  <p className="min-h-[44px] text-sm text-[var(--gs-text-muted)]">
                    {getDesc(plan) || 'G\u00f3i t\u1eadp ph\u00f9 h\u1ee3p v\u1edbi nhu c\u1ea7u c\u1ee7a b\u1ea1n'}
                  </p>
                  <div className="mb-5 flex-1 space-y-2">
                    {getFeatures(plan).map((feature) => (
                      <div key={feature._id} className="flex items-center gap-2 text-sm">
                        <CheckCircleOutlined style={{ color: plan.color || '#1677ff' }} />
                        <span>{feature.name}</span>
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
                    {'\u0110\u0103ng k\u00fd'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Modal
          title={'X\u00e1c nh\u1eadn \u0111\u0103ng k\u00fd'}
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
                    <Descriptions.Item label={'T\u00ean g\u00f3i'}>{getName(selectedPlan)}</Descriptions.Item>
                    <Descriptions.Item label={'Gi\u00e1'}>{formatMoney(selectedPlan.price)}</Descriptions.Item>
                    <Descriptions.Item label={'Th\u1eddi h\u1ea1n'}>{selectedPlan.durationDays} {'ng\u00e0y'}</Descriptions.Item>
                  </Descriptions>

                  {balanceSufficient ? (
                    <div className="rounded-xl border border-[var(--gs-success-border)] bg-[var(--gs-success-bg)] p-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--gs-success)]">
                        <WalletOutlined />
                        {'S\u1ed1 d\u01b0 \u0111\u1ee7 \u0111\u1ec3 thanh to\u00e1n b\u1eb1ng v\u00ed'}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm max-[480px]:grid-cols-1">
                        <div className="rounded-lg border border-[var(--gs-border)] p-3">
                          <div className="text-xs text-[var(--gs-text-muted)]">{'S\u1ed1 d\u01b0 hi\u1ec7n t\u1ea1i'}</div>
                          <div className="mt-0.5 font-semibold">{formatMoney(currentBalance)}</div>
                        </div>
                        <div className="rounded-lg border border-[var(--gs-border)] p-3">
                          <div className="text-xs text-[var(--gs-text-muted)]">{'S\u1ed1 d\u01b0 sau khi \u0111\u0103ng k\u00fd'}</div>
                          <div className="mt-0.5 font-semibold text-[var(--gs-success)]">{formatMoney(balanceAfter)}</div>
                        </div>
                      </div>
                    </div>
                  ) : currentBalance > 0 ? (
                    <div className="rounded-xl border border-[var(--gs-warning)] bg-[var(--gs-warning-bg)] p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--gs-warning)]">
                        <WalletOutlined />
                        {'S\u1ed1 d\u01b0 kh\u00f4ng \u0111\u1ee7 \u2014 thanh to\u00e1n k\u1ebft h\u1ee3p'}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm max-[480px]:grid-cols-1">
                        <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-3">
                          <div className="text-xs text-[var(--gs-text-muted)]">{'T\u1ed5ng ti\u1ec1n g\u00f3i'}</div>
                          <div className="mt-0.5 font-bold">{formatMoney(selectedPrice)}</div>
                        </div>
                        <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-3">
                          <div className="text-xs text-[var(--gs-text-muted)]">{'S\u1ed1 d\u01b0 v\u00ed (s\u1ebd d\u00f9ng h\u1ebft)'}</div>
                          <div className="mt-0.5 font-bold">{formatMoney(currentBalance)}</div>
                        </div>
                        <div className="col-span-2 rounded-lg border border-[var(--gs-warning)] bg-[var(--gs-warning-bg)] p-3 max-[480px]:col-span-1">
                          <div className="text-xs text-[var(--gs-warning)]">{'C\u00f2n thi\u1ebfu \u2014 thanh to\u00e1n qua VNPay'}</div>
                          <div className="mt-0.5 text-lg font-bold text-[var(--gs-warning)]">{formatMoney(remainingAmount)}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[var(--gs-info-border)] bg-[var(--gs-info-bg)] p-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--gs-info)]">
                        <QrcodeOutlined />
                        {'V\u00ed c\u1ee7a b\u1ea1n hi\u1ec7n kh\u00f4ng c\u00f3 s\u1ed1 d\u01b0'}
                      </div>
                      <p className="m-0 text-sm text-[var(--gs-text)]">
                        {'B\u1ea1n v\u1eabn c\u00f3 th\u1ec3 thanh to\u00e1n tr\u1ef1c ti\u1ebfp b\u1eb1ng ph\u01b0\u01a1ng th\u1ee9c kh\u00e1c m\u00e0 kh\u00f4ng c\u1ea7n n\u1ea1p v\u00ed.'}
                      </p>
                    </div>
                  )}

                  <PolicyConsentCard
                    key={selectedPlan._id}
                    policies={[
                      { type: 'membership', label: 'Ch\u00ednh s\u00e1ch h\u1ed9i vi\u00ean' },
                      { type: 'terms', label: '\u0110i\u1ec1u kho\u1ea3n s\u1eed d\u1ee5ng' },
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
                    {'H\u1ee7y'}
                  </Button>
                  <Tooltip title={!consentReady ? 'Vui l\u00f2ng \u0111\u1ed3ng \u00fd v\u1edbi ch\u00ednh s\u00e1ch' : undefined}>
                    <Button
                      className="policy-confirm-action"
                      type="primary"
                      icon={balanceSufficient ? <WalletOutlined /> : <CreditCardOutlined />}
                      loading={Boolean(submittingId)}
                      disabled={!consentReady}
                      onClick={handleRegister}
                    >
                      {balanceSufficient
                        ? 'X\u00e1c nh\u1eadn \u0111\u0103ng k\u00fd'
                        : `Thanh to\u00e1n ${formatMoney(remainingAmount)}\u0111 qua VNPay`}
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
