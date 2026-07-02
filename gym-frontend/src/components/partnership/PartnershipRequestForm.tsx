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
      message.success('Gửi yêu cầu hợp tác thành công')
      form.resetFields()
      onSuccess?.()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Gửi yêu cầu thất bại')
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
        label="Tên thương hiệu"
        name="brand_name"
        rules={[{ required: true, message: 'Vui lòng nhập tên thương hiệu' }]}
      >
        <Input placeholder="VD: Thương hiệu của bạn" />
      </Form.Item>

      <Form.Item
        label="Danh mục"
        name="category"
        rules={[{ required: true, message: 'Vui lòng chọn danh mục' }]}
      >
        <Select
          placeholder="Chọn danh mục"
          options={partnershipCategories.map((item) => ({ label: item, value: item }))}
        />
      </Form.Item>

      <div className={compact ? '' : 'grid grid-cols-2 gap-4 max-[640px]:grid-cols-1'}>
        <Form.Item
          label="Người liên hệ"
          name="contact_name"
          rules={[{ required: true, message: 'Vui lòng nhập tên người liên hệ' }]}
        >
          <Input placeholder="VD: Nguyễn Văn A" />
        </Form.Item>

        <Form.Item
          label="Số điện thoại"
          name="phone"
          rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}
        >
          <Input placeholder="VD: 0901234567" />
        </Form.Item>
      </div>

      <div className={compact ? '' : 'grid grid-cols-2 gap-4 max-[640px]:grid-cols-1'}>
        <Form.Item
          label="Email"
          name="email"
          rules={[
            { required: true, message: 'Vui lòng nhập email' },
            { type: 'email', message: 'Email không hợp lệ' },
          ]}
        >
          <Input placeholder="VD: email@example.com" />
        </Form.Item>

        <Form.Item label="Website" name="website">
          <Input placeholder="VD: https://example.com" />
        </Form.Item>
      </div>

      <Form.Item label="Mô tả" name="description">
        <Input.TextArea rows={4} placeholder="Mô tả ngắn về thương hiệu của bạn..." />
      </Form.Item>

      <Button
        type="primary"
        htmlType="submit"
        block
        className="!h-11 !rounded-xl !bg-[var(--theme-button-bg)] !text-[var(--theme-button-text)]"
      >
        Gửi yêu cầu
      </Button>
    </Form>
  )
}
