import { ArrowLeftOutlined, CheckCircleOutlined, CreditCardOutlined, MoneyCollectOutlined, QrcodeOutlined } from '@ant-design/icons'
import { Avatar, Button, Checkbox, Radio, Skeleton, Tag, message } from 'antd'
import dayjs from 'dayjs'
import { QRCodeCanvas } from 'qrcode.react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { membershipService, type MembershipPlan } from '../../../services/membershipService'
import { memberService } from '../../../services/memberService'
import type { MemberDetail } from '../../../types/admin/member'
import { getUserDisplayName } from '../../../utils/userDisplay'

type PaymentMethod = 'CASH' | 'POS' | 'BANK_TRANSFER'
type PaymentState = {
  paymentId: string
  paymentUrl: string
  status: 'PENDING' | 'PAID' | string
  amount: number
  method: PaymentMethod
}

const formatVND = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`
const formatDate = (value?: string) => value ? dayjs(value).format('DD/MM/YYYY') : '—'

export default function StaffPlanCounterPage({ mode }: { mode: 'register' | 'renew' }) {
  const { memberId = '' } = useParams()
  const navigate = useNavigate()

  const [member, setMember] = useState<MemberDetail | null>(null)
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [confirmed, setConfirmed] = useState(false)
  const [payment, setPayment] = useState<PaymentState | null>(null)
  const [loading, setLoading] = useState(true)
  const [creatingPayment, setCreatingPayment] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const selectedPlan = useMemo(() => plans.find((plan) => plan._id === selectedPlanId) || null, [plans, selectedPlanId])
  const activeMembership = member?.activeMembership
  const isRenew = mode === 'renew'
  const finalButtonLabel = isRenew ? 'Gia hạn gói' : 'Kích hoạt gói'

  useEffect(() => {
    let mounted = true
    Promise.all([
      memberService.getMemberById(memberId),
      membershipService.getPlans(),
    ])
      .then(([memberRes, plansRes]) => {
        if (!mounted) return
        setMember(memberRes.data.member)
        setPlans((plansRes.data.plans || []).filter((plan) => plan.isActive !== false))
      })
      .catch(() => message.error('Không thể tải dữ liệu hội viên/gói tập'))
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [memberId])

  useEffect(() => {
    setConfirmed(false)
    setPayment(null)
  }, [method, selectedPlanId])

  useEffect(() => {
    if (!payment?.paymentId || payment.status === 'PAID') return
    const timer = window.setInterval(async () => {
      try {
        const res = await memberService.getOfflinePlanPayment(payment.paymentId)
        const status = res.data?.data?.status
        setPayment((current) => current ? { ...current, status } : current)
      } catch {
        window.clearInterval(timer)
      }
    }, 3000)
    return () => window.clearInterval(timer)
  }, [payment?.paymentId, payment?.status])

  const createPayment = async () => {
    if (!selectedPlan) {
      message.warning('Vui lòng chọn gói tập')
      return null
    }
    if (method !== 'BANK_TRANSFER' && !confirmed) {
      message.warning(method === 'CASH' ? 'Vui lòng xác nhận đã thu đủ tiền mặt' : 'Vui lòng xác nhận giao dịch POS thành công')
      return null
    }

    setCreatingPayment(true)
    try {
      const res = await memberService.createOfflinePlanPayment(memberId, {
        planId: selectedPlan._id,
        method,
        confirmed: method !== 'BANK_TRANSFER' ? confirmed : false,
        flow: mode,
      })
      const data = res.data?.data
      const nextPayment = {
        paymentId: data.paymentId,
        paymentUrl: data.paymentUrl,
        status: data.status,
        amount: data.amount,
        method: data.method,
      }
      setPayment(nextPayment)
      return nextPayment
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Không thể tạo payment')
      return null
    } finally {
      setCreatingPayment(false)
    }
  }

  const ensurePayment = async () => payment || createPayment()

  const handleActivate = async () => {
    const currentPayment = await ensurePayment()
    if (!currentPayment) return
    if (currentPayment.status !== 'PAID') {
      message.warning('Payment chưa PAID, chưa thể kích hoạt gói')
      return
    }
    if (!selectedPlan) return

    setSubmitting(true)
    try {
      if (isRenew) {
        await memberService.renewPlan(memberId, selectedPlan._id, currentPayment.paymentId, 'endDate')
        message.success('Gia hạn gói thành công')
      } else {
        await memberService.registerPlan(memberId, selectedPlan._id, currentPayment.paymentId)
        message.success('Kích hoạt gói thành công')
      }
      navigate('/staff/members')
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Không thể hoàn tất thao tác')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-6xl p-6"><Skeleton active paragraph={{ rows: 10 }} /></div>
      </DashboardLayout>
    )
  }

  if (!member) {
    return (
      <DashboardLayout>
        <div className="p-6">Không tìm thấy hội viên.</div>
      </DashboardLayout>
    )
  }

  const canFinish = Boolean(selectedPlan && payment?.status === 'PAID')

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/staff/members')} className="mb-5">
          Quay lại
        </Button>

        <div className="mb-6">
          <h1 className="m-0 text-3xl font-semibold text-[var(--gs-text)]">{isRenew ? 'Gia hạn gói' : 'Đăng ký gói'}</h1>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <section className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card)] p-5">
              <h2 className="mb-4 text-lg font-semibold">Thông tin hội viên</h2>
              <div className="flex flex-wrap items-center gap-4">
                <Avatar size={72} src={member.avatar}>{getUserDisplayName(member).charAt(0)}</Avatar>
                <div className="grid flex-1 grid-cols-1 gap-2 md:grid-cols-2">
                  <div><span className="text-[var(--gs-text-muted)]">Mã hội viên: </span><b>{member.memberCode || '—'}</b></div>
                  <div><span className="text-[var(--gs-text-muted)]">Họ tên: </span><b>{getUserDisplayName(member)}</b></div>
                  <div><span className="text-[var(--gs-text-muted)]">Email: </span><b>{member.email || '—'}</b></div>
                  <div><span className="text-[var(--gs-text-muted)]">SĐT: </span><b>{member.phone || '—'}</b></div>
                </div>
              </div>
            </section>

            {isRenew && activeMembership && (
              <section className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card)] p-5">
                <h2 className="mb-4 text-lg font-semibold">Gói hiện tại</h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <div><span className="block text-sm text-[var(--gs-text-muted)]">Tên gói</span><b>{activeMembership.planId?.nameVi || activeMembership.planId?.nameEn || '—'}</b></div>
                  <div><span className="block text-sm text-[var(--gs-text-muted)]">Ngày bắt đầu</span><b>{formatDate(activeMembership.startDate)}</b></div>
                  <div><span className="block text-sm text-[var(--gs-text-muted)]">Ngày hết hạn</span><b>{formatDate(activeMembership.endDate)}</b></div>
                  <div><span className="block text-sm text-[var(--gs-text-muted)]">Số ngày còn lại</span><b>{member.remainingDays}</b></div>
                </div>
              </section>
            )}

            <section className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card)] p-5">
              <h2 className="mb-4 text-lg font-semibold">{isRenew ? 'Chọn gói gia hạn' : 'Chọn gói tập'}</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {plans.map((plan) => {
                  const selected = selectedPlanId === plan._id
                  const features = plan.featuresVi?.length ? plan.featuresVi : plan.featuresEn || []
                  return (
                    <button
                      type="button"
                      key={plan._id}
                      onClick={() => setSelectedPlanId(plan._id)}
                      className={`min-h-[190px] rounded-lg border p-4 text-left transition ${
                        selected ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-muted)]' : 'border-[var(--gs-border)] bg-[var(--gs-card)]'
                      }`}
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{plan.nameVi || plan.nameEn}</div>
                          <div className="mt-1 text-xl font-bold text-[var(--theme-accent)]">{formatVND(plan.price)}</div>
                        </div>
                        {selected && <CheckCircleOutlined className="text-lg text-[var(--theme-accent)]" />}
                      </div>
                      <Tag>{plan.durationDays} ngày</Tag>
                      <ul className="mt-3 space-y-1 pl-4 text-sm text-[var(--gs-text-muted)]">
                        {features.slice(0, 4).map((feature) => <li key={feature} className="list-disc">{feature}</li>)}
                      </ul>
                    </button>
                  )
                })}
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card)] p-5">
              <h2 className="mb-4 text-lg font-semibold">Thanh toán</h2>
              <Radio.Group value={method} onChange={(e) => setMethod(e.target.value)} className="flex w-full flex-col gap-2">
                <Radio.Button value="CASH"><MoneyCollectOutlined /> Tiền mặt</Radio.Button>
                <Radio.Button value="POS"><CreditCardOutlined /> Quẹt thẻ</Radio.Button>
                <Radio.Button value="BANK_TRANSFER"><QrcodeOutlined /> Chuyển khoản</Radio.Button>
              </Radio.Group>

              <div className="mt-5 rounded-lg border border-[var(--gs-border)] p-4">
                {method === 'CASH' && (
                  <Checkbox checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}>
                    Tôi xác nhận đã thu đủ tiền mặt
                  </Checkbox>
                )}
                {method === 'POS' && (
                  <Checkbox checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}>
                    Tôi xác nhận giao dịch POS/quẹt thẻ thành công
                  </Checkbox>
                )}
                {method === 'BANK_TRANSFER' && (
                  <div className="space-y-4 text-center">
                    {!payment && (
                      <Button type="primary" block loading={creatingPayment} disabled={!selectedPlan} onClick={createPayment}>
                        Tạo QR chuyển khoản
                      </Button>
                    )}
                    {payment?.paymentUrl && (
                      <>
                        <QRCodeCanvas value={payment.paymentUrl} size={240} includeMargin />
                        <Tag color={payment.status === 'PAID' ? 'success' : 'processing'}>{payment.status}</Tag>
                      </>
                    )}
                  </div>
                )}
              </div>

              {selectedPlan && (
                <div className="mt-5 rounded-lg bg-[var(--gs-card)] text-sm">
                  <div className="flex justify-between"><span>Gói:</span><b>{selectedPlan.nameVi || selectedPlan.nameEn}</b></div>
                  <div className="mt-2 flex justify-between"><span>Số tiền:</span><b>{formatVND(selectedPlan.price)}</b></div>
                </div>
              )}
            </section>

            {method !== 'BANK_TRANSFER' && !payment && (
              <Button block loading={creatingPayment} disabled={!selectedPlan || !confirmed} onClick={createPayment}>
                Xác nhận payment
              </Button>
            )}

            {payment && (
              <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card)] p-4 text-sm">
                <div className="flex justify-between"><span>Payment:</span><b>{payment.paymentId}</b></div>
                <div className="mt-2 flex justify-between"><span>Trạng thái:</span><Tag color={payment.status === 'PAID' ? 'success' : 'processing'}>{payment.status}</Tag></div>
              </div>
            )}

            <Button type="primary" size="large" block loading={submitting} disabled={!canFinish} onClick={handleActivate}>
              {finalButtonLabel}
            </Button>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  )
}
