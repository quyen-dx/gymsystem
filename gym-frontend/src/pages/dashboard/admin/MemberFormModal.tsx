import {
  Button,
  DatePicker,
  Form,
  Input,
  Modal,
  Select,
  Upload,
  message,
} from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { memberService } from '../../../services/memberService'
import type { MemberListItem } from '../../../types/admin/member'
import { UploadOutlined } from '@ant-design/icons'

interface Props {
  open: boolean
  member: MemberListItem | null
  onClose: () => void
  onSuccess: () => void
}

export default function MemberFormModal({ open, member, onClose, onSuccess }: Props) {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const isEdit = !!member

  useEffect(() => {
    if (open) {
      if (member) {
        form.setFieldsValue({
          name: member.name,
          email: member.email || '',
          phone: member.phone || '',
          dateOfBirth: member.dateOfBirth ? new Date(member.dateOfBirth) : null,
          gender: member.gender || undefined,
        })
      } else {
        form.resetFields()
        setAvatarFile(null)
      }
    }
  }, [open, member, form])

  const handleSubmit = async (values: Record<string, unknown>) => {
    setLoading(true)
    try {
      let payload: FormData | Record<string, unknown>

      if (isEdit && avatarFile) {
        const fd = new FormData()
        fd.append('avatar', avatarFile)
        fd.append('name', values.name as string)
        fd.append('email', (values.email as string) || '')
        fd.append('phone', (values.phone as string) || '')
        if (values.gender) fd.append('gender', values.gender as string)
        if (values.dateOfBirth) fd.append('dateOfBirth', new Date(values.dateOfBirth as Date).toISOString())
        payload = fd
      } else {
        payload = {
          name: values.name as string,
          email: (values.email as string) || '',
          phone: (values.phone as string) || '',
          gender: (values.gender as string) || undefined,
          dateOfBirth: values.dateOfBirth ? new Date(values.dateOfBirth as Date).toISOString() : undefined,
        }
      }

      if (isEdit) {
        await memberService.updateMember(member!._id, payload)
        message.success(t('admin.members.update_success'))
      } else {
        (payload as Record<string, unknown>).password = (values.password as string) || undefined
        await memberService.createMember(payload as Record<string, unknown>)
        message.success(t('admin.members.create_success'))
      }
      onSuccess()
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } }
      message.error(apiError?.response?.data?.message || t('admin.members.messages.action_failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={isEdit ? t('admin.members.edit') : t('admin.members.add')}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText={isEdit ? t('admin.members.form.submit_edit') : t('admin.members.form.submit_add')}
      cancelText={t('admin.members.form.cancel')}
      destroyOnClose
      width={520}
    >
      <Form layout="vertical" form={form} onFinish={handleSubmit}>
        <Form.Item
          label={t('admin.members.form.name')}
          name="name"
          rules={[{ required: true, message: t('admin.members.form.name_required') }]}
        >
          <Input placeholder={t('admin.members.form.name_placeholder')} />
        </Form.Item>

        <Form.Item label={t('admin.members.form.email')} name="email">
          <Input placeholder={t('admin.members.form.email_placeholder')} type="email" />
        </Form.Item>

        <Form.Item label={t('admin.members.form.phone')} name="phone">
          <Input placeholder={t('admin.members.form.phone_placeholder')} />
        </Form.Item>

        <Form.Item label={t('admin.members.form.gender')} name="gender">
          <Select
            allowClear
            placeholder={t('admin.members.form.gender')}
            options={[
              { value: 'male', label: t('admin.members.form.gender_male') },
              { value: 'female', label: t('admin.members.form.gender_female') },
              { value: 'other', label: t('admin.members.form.gender_other') },
            ]}
          />
        </Form.Item>

        <Form.Item label={t('admin.members.form.dateOfBirth')} name="dateOfBirth">
          <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="DD/MM/YYYY" />
        </Form.Item>

        {!isEdit && (
          <Form.Item label={t('admin.members.form.password')} name="password">
            <Input.Password placeholder={t('admin.members.form.password_placeholder')} />
          </Form.Item>
        )}

        {isEdit && (
          <Form.Item label="Avatar">
            <Upload
              accept="image/*"
              showUploadList={false}
              beforeUpload={(file) => {
                setAvatarFile(file)
                return false
              }}
            >
              <Button icon={<UploadOutlined />}>
                {avatarFile ? avatarFile.name : t('admin.members.form.avatar_upload')}
              </Button>
            </Upload>
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}
