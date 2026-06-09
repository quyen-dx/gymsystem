import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Upload,
  message,
} from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { trainerService } from '../../../services/trainerService'
import type { PT } from '../../../types/admin/trainer'
import { UploadOutlined } from '@ant-design/icons'

const SPECIALTY_OPTIONS = [
  'Yoga', 'GYM', 'Boxing', 'CrossFit', 'Pilates', 'Zumba', 'Personal Training',
  'Cardio', 'Strength Training', 'HIIT', 'Dance', 'Meditation',
]

interface Props {
  open: boolean
  pt: PT | null
  onClose: () => void
  onSuccess: () => void
}

export default function TrainerFormModal({ open, pt, onClose, onSuccess }: Props) {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const isEdit = !!pt

  useEffect(() => {
    if (open) {
      if (pt) {
        form.setFieldsValue({
          name: pt.name,
          email: pt.email || '',
          phone: pt.phone || '',
          dateOfBirth: pt.dateOfBirth ? new Date(pt.dateOfBirth) : null,
          gender: pt.gender || undefined,
          specialties: pt.specialties || [],
          bio: pt.bio || '',
          experienceYears: pt.experienceYears || 0,
          introVideoUrl: pt.introVideoUrl || '',
          certificates: pt.certificates || [],
        })
      } else {
        form.resetFields()
        setAvatarFile(null)
      }
    }
  }, [open, pt, form])

  const handleSubmit = async (values: Record<string, unknown>) => {
    setLoading(true)
    try {
      let payload: FormData | Record<string, unknown>

      if (avatarFile) {
        const fd = new FormData()
        fd.append('avatar', avatarFile)
        fd.append('name', values.name as string)
        fd.append('email', (values.email as string) || '')
        fd.append('phone', (values.phone as string) || '')
        fd.append('bio', (values.bio as string) || '')
        fd.append('gender', (values.gender as string) || '')
        fd.append('experienceYears', String(values.experienceYears || 0))
        fd.append('introVideoUrl', (values.introVideoUrl as string) || '')
        fd.append('specialties', JSON.stringify(values.specialties || []))
        fd.append('certificates', JSON.stringify(values.certificates || []))
        if (values.dateOfBirth) fd.append('dateOfBirth', new Date(values.dateOfBirth as Date).toISOString())
        if (!isEdit && values.password) fd.append('password', values.password as string)
        payload = fd
      } else {
        payload = {
          name: values.name as string,
          email: (values.email as string) || '',
          phone: (values.phone as string) || '',
          bio: (values.bio as string) || '',
          gender: (values.gender as string) || undefined,
          experienceYears: values.experienceYears || 0,
          introVideoUrl: (values.introVideoUrl as string) || '',
          specialties: values.specialties || [],
          certificates: values.certificates || [],
          dateOfBirth: values.dateOfBirth ? new Date(values.dateOfBirth as Date).toISOString() : undefined,
          ...(!isEdit && values.password ? { password: values.password as string } : {}),
        }
      }

      if (isEdit) {
        await trainerService.updatePT(pt!._id, payload)
        message.success(t('admin.trainers.messages.update_success'))
      } else {
        await trainerService.createPT(payload)
        message.success(t('admin.trainers.messages.create_success'))
      }
      onSuccess()
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } }
      message.error(apiError?.response?.data?.message || t('admin.trainers.messages.action_failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={isEdit ? t('admin.trainers.edit') : t('admin.trainers.add')}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText={isEdit ? t('admin.trainers.form.submit_edit') : t('admin.trainers.form.submit_add')}
      cancelText={t('admin.trainers.form.cancel')}
      destroyOnHidden
      width={640}
    >
      <Form layout="vertical" form={form} onFinish={handleSubmit}>
        <Form.Item
          label={t('admin.trainers.form.name')}
          name="name"
          rules={[{ required: true, message: t('admin.trainers.form.name_required') }]}
        >
          <Input placeholder={t('admin.trainers.form.name_placeholder')} />
        </Form.Item>

        <Form.Item label={t('admin.trainers.form.email')} name="email">
          <Input placeholder={t('admin.trainers.form.email_placeholder')} type="email" />
        </Form.Item>

        <Form.Item label={t('admin.trainers.form.phone')} name="phone">
          <Input placeholder={t('admin.trainers.form.phone_placeholder')} />
        </Form.Item>

        <Form.Item label={t('admin.trainers.form.gender')} name="gender">
          <Select
            allowClear
            placeholder={t('admin.trainers.form.gender')}
            options={[
              { value: 'male', label: t('admin.trainers.form.gender_male') },
              { value: 'female', label: t('admin.trainers.form.gender_female') },
              { value: 'other', label: t('admin.trainers.form.gender_other') },
            ]}
          />
        </Form.Item>

        <Form.Item label={t('admin.trainers.form.dateOfBirth')} name="dateOfBirth">
          <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="DD/MM/YYYY" />
        </Form.Item>

        <Form.Item label={t('admin.trainers.form.specialties')} name="specialties">
          <Select
            mode="tags"
            placeholder={t('admin.trainers.form.specialties_placeholder')}
            options={SPECIALTY_OPTIONS.map((s) => ({ value: s, label: s }))}
          />
        </Form.Item>

        <Form.Item label={t('admin.trainers.form.bio')} name="bio">
          <Input.TextArea rows={3} placeholder={t('admin.trainers.form.bio_placeholder')} />
        </Form.Item>

        <Form.Item label={t('admin.trainers.form.experienceYears')} name="experienceYears">
          <InputNumber min={0} style={{ width: '100%' }} placeholder={t('admin.trainers.form.experienceYears_placeholder')} />
        </Form.Item>

        <Form.Item label={t('admin.trainers.form.videoIntro')} name="introVideoUrl">
          <Input placeholder={t('admin.trainers.form.videoIntro_placeholder')} />
        </Form.Item>

        <Form.Item label={t('admin.trainers.form.certificates')} name="certificates">
          <Select
            mode="tags"
            placeholder={t('admin.trainers.form.certificates_placeholder')}
          />
        </Form.Item>

        {!isEdit && (
          <Form.Item label={t('admin.trainers.form.password')} name="password">
            <Input.Password placeholder={t('admin.trainers.form.password_placeholder')} />
          </Form.Item>
        )}

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
              {avatarFile ? avatarFile.name : t('admin.trainers.form.avatar_upload')}
            </Button>
          </Upload>
        </Form.Item>
      </Form>
    </Modal>
  )
}
