import { Button, Form, Input, Select, message } from 'antd'
import {
  createPartnershipRequest,
  partnershipCategories,
  type PartnershipRequestPayload,
} from '../../services/partnershipRequestService'

type PartnershipRequestFormProps = {
  onSuccess?: () => void
  compact?: boolean
}

export default function PartnershipRequestForm({ onSuccess, compact = false }: PartnershipRequestFormProps) {
  const [form] = Form.useForm<PartnershipRequestPayload>()

  const handleSubmit = async (values: PartnershipRequestPayload) => {
    try {
      await createPartnershipRequest(values)
      message.success('Chúng tôi sẽ liên hệ với bạn trong 1-3 ngày làm việc')
      form.resetFields()
      onSuccess?.()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể gửi đăng ký hợp tác')
    }
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      className="[&_.ant-form-item-label>label]:!text-[var(--theme-text)]"
    >
      <Form.Item
        label="Tên thương hiệu / công ty"
        name="brand_name"
        rules={[{ required: true, message: 'Nhập tên thương hiệu / công ty' }]}
      >
        <Input placeholder="Ví dụ: GymPro Nutrition" />
      </Form.Item>

      <Form.Item
        label="Lĩnh vực sản phẩm"
        name="category"
        rules={[{ required: true, message: 'Chọn lĩnh vực sản phẩm' }]}
      >
        <Select
          placeholder="Chọn lĩnh vực"
          options={partnershipCategories.map((item) => ({ label: item, value: item }))}
        />
      </Form.Item>

      <div className={compact ? '' : 'grid grid-cols-2 gap-4 max-[640px]:grid-cols-1'}>
        <Form.Item
          label="Họ tên người liên hệ"
          name="contact_name"
          rules={[{ required: true, message: 'Nhập họ tên người liên hệ' }]}
        >
          <Input placeholder="Nguyễn Văn A" />
        </Form.Item>

        <Form.Item
          label="Số điện thoại"
          name="phone"
          rules={[{ required: true, message: 'Nhập số điện thoại' }]}
        >
          <Input placeholder="0901234567" />
        </Form.Item>
      </div>

      <div className={compact ? '' : 'grid grid-cols-2 gap-4 max-[640px]:grid-cols-1'}>
        <Form.Item
          label="Email"
          name="email"
          rules={[
            { required: true, message: 'Nhập email' },
            { type: 'email', message: 'Email không hợp lệ' },
          ]}
        >
          <Input placeholder="contact@brand.com" />
        </Form.Item>

        <Form.Item label="Website" name="website">
          <Input placeholder="https://brand.com" />
        </Form.Item>
      </div>

      <Form.Item label="Mô tả ngắn về thương hiệu" name="description">
        <Input.TextArea rows={4} placeholder="Sản phẩm chính, thế mạnh thương hiệu, khu vực phân phối..." />
      </Form.Item>

      <Button
        type="primary"
        htmlType="submit"
        block
        className="!h-11 !rounded-xl !bg-[var(--theme-accent)] !text-[var(--theme-button-text)]"
      >
        Gửi đăng ký
      </Button>
    </Form>
  )
}
