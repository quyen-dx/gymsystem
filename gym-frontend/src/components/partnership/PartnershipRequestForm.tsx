import { Button, Form, Input, Select, message } from 'antd'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const [form] = Form.useForm<PartnershipRequestPayload>()

  const handleSubmit = async (values: PartnershipRequestPayload) => {
    try {
      await createPartnershipRequest(values)
      message.success(t('partnership_form.msg_success'))
      form.resetFields()
      onSuccess?.()
    } catch (err: any) {
      message.error(err.response?.data?.message || t('partnership_form.msg_failed'))
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
        label={t('partnership_form.brand_name')}
        name="brand_name"
        rules={[{ required: true, message: t('partnership_form.brand_name_required') }]}
      >
        <Input placeholder={t('partnership_form.brand_name_placeholder')} />
      </Form.Item>

      <Form.Item
        label={t('partnership_form.category')}
        name="category"
        rules={[{ required: true, message: t('partnership_form.category_required') }]}
      >
        <Select
          placeholder={t('partnership_form.category_placeholder')}
          options={partnershipCategories.map((item) => ({ label: item, value: item }))}
        />
      </Form.Item>

      <div className={compact ? '' : 'grid grid-cols-2 gap-4 max-[640px]:grid-cols-1'}>
        <Form.Item
          label={t('partnership_form.contact_name')}
          name="contact_name"
          rules={[{ required: true, message: t('partnership_form.contact_name_required') }]}
        >
          <Input placeholder={t('partnership_form.contact_name_placeholder')} />
        </Form.Item>

        <Form.Item
          label={t('partnership_form.phone')}
          name="phone"
          rules={[{ required: true, message: t('partnership_form.phone_required') }]}
        >
          <Input placeholder={t('partnership_form.phone_placeholder')} />
        </Form.Item>
      </div>

      <div className={compact ? '' : 'grid grid-cols-2 gap-4 max-[640px]:grid-cols-1'}>
        <Form.Item
          label={t('partnership_form.email')}
          name="email"
          rules={[
            { required: true, message: t('partnership_form.email_required') },
            { type: 'email', message: t('partnership_form.email_invalid') },
          ]}
        >
          <Input placeholder={t('partnership_form.email_placeholder')} />
        </Form.Item>

        <Form.Item label={t('partnership_form.website')} name="website">
          <Input placeholder={t('partnership_form.website_placeholder')} />
        </Form.Item>
      </div>

      <Form.Item label={t('partnership_form.description')} name="description">
        <Input.TextArea rows={4} placeholder={t('partnership_form.description_placeholder')} />
      </Form.Item>

      <Button
        type="primary"
        htmlType="submit"
        block
        className="!h-11 !rounded-xl !bg-[var(--theme-button-bg)] !text-[var(--theme-button-text)]"
      >
        {t('partnership_form.submit')}
      </Button>
    </Form>
  )
}
