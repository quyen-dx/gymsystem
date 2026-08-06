import { ArrowLeftOutlined, CheckCircleOutlined, SaveOutlined } from '@ant-design/icons'
import { Alert, Button, Card, DatePicker, Descriptions, Form, Input, InputNumber, Radio, Select, Spin, Tag, message } from 'antd'
import type { Dayjs } from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { membershipService, type MembershipPlan } from '../../../services/membershipService'
import { memberService } from '../../../services/memberService'

type PaymentMethod = 'CASH' | 'POS' | 'BANK_TRANSFER'

type MemberFormValues = {
  name: string
  phone?: string
  email?: string
  dateOfBirth?: Dayjs
  gender?: string
  password?: string
  planId: string
  paymentMethod: PaymentMethod
  amountPaid: number
  memo?: string
}

const formatMoney = (value?: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`

export default function StaffMemberNewPage() {
  const navigate = useNavigate()
  const [form] = Form.useForm<MemberFormValues>()
  const [submitting, setSubmitting] = useState(false)
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(false)

  const selectedPlanId = Form.useWatch('planId', form)
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan._id === selectedPlanId) || null,
    [plans, selectedPlanId],
  )

  useEffect(() => {
    setLoadingPlans(true)
    membershipService.getPlans()
      .then((res) => setPlans((res.data.plans || []).filter((plan) => plan.isActive !== false)))
      .catch(() => message.error('Không thể tải danh sách gói tập'))
      .finally(() => setLoadingPlans(false))
  }, [])

  useEffect(() => {
    if (selectedPlan) {
      form.setFieldValue('amountPaid', selectedPlan.price)
    }
  }, [form, selectedPlan])

  const handleSubmit = async (values: MemberFormValues) => {
    if (!selectedPlan) {
      message.warning('Vui lòng chọn gói tập cho hội viên mới')
      return
    }

    setSubmitting(true)
    try {
      await memberService.createAndRegister({
        name: values.name.trim(),
        phone: values.phone?.trim() || '',
        email: values.email?.trim() || '',
        dateOfBirth: values.dateOfBirth ? values.dateOfBirth.toISOString() : undefined,
        gender: values.gender,
        password: values.password?.trim() || 'member123',
        planId: selectedPlan._id,
        paymentMethod: values.paymentMethod,
        amountPaid: Number(values.amountPaid || 0),
        memo: values.memo?.trim() || undefined,
      })
      message.success('Tạo hội viên và đăng ký gói tập thành công')
      navigate('/staff/members')
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Tạo hội viên và đăng ký gói thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/staff/members')} className="mb-5">
          Quay lại
        </Button>

        <div className="mb-6">
          <h1 className="m-0 text-3xl font-semibold text-[var(--gs-text)]">Thêm hội viên và đăng ký gói</h1>
          <p className="mt-2 text-sm text-[var(--gs-text-muted)]">
            Khách mới sẽ được tạo tài khoản hội viên, chọn gói tập và ghi nhận thanh toán tại quầy trong cùng một bước.
          </p>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ password: 'member123', paymentMethod: 'CASH' as PaymentMethod }}
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
            <div className="space-y-6">
              <Card title="1. Thông tin hội viên">
                <div className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
                  <Form.Item
                    name="name"
                    label="Họ tên"
                    rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập họ tên' }]}
                  >
                    <Input size="large" placeholder="Nguyễn Văn A" />
                  </Form.Item>

                  <Form.Item name="phone" label="SĐT">
                    <Input size="large" placeholder="090xxxxxxx" />
                  </Form.Item>

                  <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Email không hợp lệ' }]}>
                    <Input size="large" placeholder="email@example.com" />
                  </Form.Item>

                  <Form.Item name="dateOfBirth" label="Ngày sinh">
                    <DatePicker className="w-full" size="large" format="DD/MM/YYYY" />
                  </Form.Item>

                  <Form.Item name="gender" label="Giới tính">
                    <Select
                      size="large"
                      allowClear
                      placeholder="Chọn giới tính"
                      options={[
                        { value: 'male', label: 'Nam' },
                        { value: 'female', label: 'Nữ' },
                        { value: 'other', label: 'Khác' },
                      ]}
                    />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    label="Mật khẩu mặc định"
                    rules={[{ min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự' }]}
                  >
                    <Input.Password size="large" placeholder="member123" />
                  </Form.Item>
                </div>
              </Card>

              <Card
                title="2. Chọn gói tập đầu tiên"
                extra={loadingPlans ? <Spin size="small" /> : <Tag>{plans.length} gói</Tag>}
              >
                <Form.Item
                  name="planId"
                  rules={[{ required: true, message: 'Vui lòng chọn gói tập' }]}
                >
                  <Radio.Group className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {plans.map((plan) => (
                      <Radio.Button
                        key={plan._id}
                        value={plan._id}
                        className="!h-auto !rounded-xl !border !border-[var(--gs-border)] !bg-[var(--gs-card)] !p-0"
                      >
                        <div className="min-h-[150px] p-4">
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <div>
                              <div className="text-base font-semibold text-[var(--gs-text)]">{plan.nameVi}</div>
                              <div className="mt-1 text-lg font-bold text-[var(--theme-accent)]">{formatMoney(plan.price)}</div>
                            </div>
                            {selectedPlanId === plan._id && <CheckCircleOutlined className="text-[var(--theme-accent)]" />}
                          </div>
                          <Tag>{plan.durationDays} ngày</Tag>
                          <div className="mt-3 space-y-1">
                            {plan.featureIds?.slice(0, 3).map((feature) => (
                              <div key={feature._id} className="text-xs text-[var(--gs-text-muted)]">• {feature.name}</div>
                            ))}
                          </div>
                        </div>
                      </Radio.Button>
                    ))}
                  </Radio.Group>
                </Form.Item>
              </Card>
            </div>

            <div className="space-y-6">
              <Card title="3. Thanh toán tại quầy">
                <Form.Item
                  name="paymentMethod"
                  label="Phương thức thanh toán"
                  rules={[{ required: true, message: 'Vui lòng chọn phương thức thanh toán' }]}
                >
                  <Radio.Group className="flex w-full flex-col gap-2">
                    <Radio.Button value="CASH">Tiền mặt</Radio.Button>
                    <Radio.Button value="POS">Quẹt thẻ / POS</Radio.Button>
                    <Radio.Button value="BANK_TRANSFER">Chuyển khoản tại quầy</Radio.Button>
                  </Radio.Group>
                </Form.Item>

                <Form.Item
                  name="amountPaid"
                  label="Số tiền đã thu"
                  rules={[
                    { required: true, message: 'Vui lòng nhập số tiền đã thu' },
                    {
                      validator: (_, value) => {
                        if (!selectedPlan || Number(value || 0) >= Number(selectedPlan.price || 0)) return Promise.resolve()
                        return Promise.reject(new Error('Số tiền thu phải lớn hơn hoặc bằng giá gói'))
                      },
                    },
                  ]}
                >
                  <InputNumber className="w-full" min={0} step={10000} formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(value) => Number(String(value || '').replace(/\D/g, '')) as any} addonAfter="VNĐ" />
                </Form.Item>

                <Form.Item name="memo" label="Ghi chú thanh toán">
                  <Input.TextArea rows={3} placeholder="VD: thu tiền mặt tại quầy, mã giao dịch..." />
                </Form.Item>

                {selectedPlan ? (
                  <Descriptions bordered size="small" column={1}>
                    <Descriptions.Item label="Gói tập">{selectedPlan.nameVi}</Descriptions.Item>
                    <Descriptions.Item label="Thời hạn">{selectedPlan.durationDays} ngày</Descriptions.Item>
                    <Descriptions.Item label="Giá gói">{formatMoney(selectedPlan.price)}</Descriptions.Item>
                  </Descriptions>
                ) : (
                  <Alert type="info" showIcon message="Chọn gói tập để xem tổng tiền cần thu." />
                )}
              </Card>

              <Button type="primary" size="large" htmlType="submit" loading={submitting} icon={<SaveOutlined />} block>
                Tạo hội viên và đăng ký gói
              </Button>
            </div>
          </div>
        </Form>
      </div>
    </DashboardLayout>
  )
}
