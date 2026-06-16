import { Button, DatePicker, Form, Input, InputNumber, Select, Upload, message } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { trainerService } from '../../../services/trainerService'
import type { PT } from '../../../types/admin/trainer'
import { UploadOutlined, ArrowLeftOutlined } from '@ant-design/icons'

const SPECIALTY_OPTIONS = [
  'Yoga', 'GYM', 'Boxing', 'CrossFit', 'Pilates', 'Zumba', 'Personal Training',
  'Cardio', 'Strength Training', 'HIIT', 'Dance', 'Meditation',
]

const PHONE_REGEX = /^0\d{9,10}$/
interface Props {
  pt?: PT | null
  onSuccess?: () => void
  isEdit?: boolean
  pageTitle?: string
  pageDescription?: string
}

export default function AdminTrainersForm({ pt, onSuccess, isEdit: editProp, pageTitle, pageDescription }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const isEdit = editProp ?? !!pt

  useEffect(() => {
    if (pt) {
      form.setFieldsValue({
        name: pt.name,
        email: pt.email || '',
        phone: pt.phone || '',
        dateOfBirth: pt.dateOfBirth ? dayjs(pt.dateOfBirth) : null,
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
  }, [pt, form])

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
      onSuccess?.()
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } }
      message.error(apiError?.response?.data?.message || t('admin.trainers.messages.action_failed'))
    } finally {
      setLoading(false)
    }
  }

  const cardStyle: React.CSSProperties = {
    borderRadius: 24,
    border: '1px solid var(--gs-border)',
    background: 'var(--gs-card)',
  }

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 20,
    color: 'var(--gs-text)',
  }

  return (
    <>
      <div className="mb-6 flex items-center gap-3">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/admin/trainers')}
          style={{ color: 'var(--gs-text)', fontSize: 15 }}
        >
          {isEdit ? '← ' + t('admin.trainers.detail.back') : '← ' + t('admin.trainers.detail.back')}
        </Button>
      </div>

      {pageTitle && (
        <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] px-8 py-6 max-[640px]:px-5 max-[640px]:py-5" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent, #b6462f) 14%, transparent), transparent)' }}>
          <h1 className="text-3xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">
            {pageTitle}
          </h1>
          {pageDescription && (
            <p className="mt-1 text-sm text-[var(--gs-text-muted)]">{pageDescription}</p>
          )}
        </div>
      )}

      <Form layout="vertical" form={form} onFinish={handleSubmit}>
        <div className="grid gap-6">
          <div style={cardStyle} className="p-6 max-[640px]:p-4">
            <h2 style={sectionTitleStyle}>{t('admin.trainers.detail.basic_info')}</h2>

            <Form.Item
              label={t('admin.trainers.form.name')}
              name="name"
              rules={[{ required: true, message: t('admin.trainers.form.name_required') }]}
            >
              <Input placeholder={t('admin.trainers.form.name_placeholder')} size="large" />
            </Form.Item>

            <Form.Item
              label={t('admin.trainers.form.email')}
              name="email"
              rules={[
                { type: 'email', message: 'Email không hợp lệ' },
              ]}
            >
              <Input placeholder={t('admin.trainers.form.email_placeholder')} size="large" />
            </Form.Item>

            <Form.Item
              label={t('admin.trainers.form.phone')}
              name="phone"
              rules={[
                { pattern: PHONE_REGEX, message: 'Số điện thoại không hợp lệ (VD: 0912345678)' },
              ]}
            >
              <Input placeholder={t('admin.trainers.form.phone_placeholder')} size="large" />
            </Form.Item>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Form.Item label={t('admin.trainers.form.gender')} name="gender">
                <Select
                  allowClear
                  placeholder={t('admin.trainers.form.gender')}
                  size="large"
                  options={[
                    { value: 'male', label: t('admin.trainers.form.gender_male') },
                    { value: 'female', label: t('admin.trainers.form.gender_female') },
                    { value: 'other', label: t('admin.trainers.form.gender_other') },
                  ]}
                />
              </Form.Item>

              <Form.Item label={t('admin.trainers.form.dateOfBirth')} name="dateOfBirth">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="DD/MM/YYYY" size="large" />
              </Form.Item>
            </div>
          </div>

          <div style={cardStyle} className="p-6 max-[640px]:p-4">
            <h2 style={sectionTitleStyle}>{t('admin.trainers.form.specialties')} & {t('admin.trainers.form.bio')}</h2>

            <Form.Item label={t('admin.trainers.form.specialties')} name="specialties">
              <Select
                mode="tags"
                placeholder={t('admin.trainers.form.specialties_placeholder')}
                size="large"
                options={SPECIALTY_OPTIONS.map((s) => ({ value: s, label: s }))}
              />
            </Form.Item>

            <Form.Item label={t('admin.trainers.form.bio')} name="bio">
              <Input.TextArea rows={4} placeholder={t('admin.trainers.form.bio_placeholder')} size="large" />
            </Form.Item>

            <Form.Item label={t('admin.trainers.form.experienceYears')} name="experienceYears">
              <InputNumber min={0} style={{ width: '100%' }} placeholder={t('admin.trainers.form.experienceYears_placeholder')} size="large" />
            </Form.Item>
          </div>

          <div style={cardStyle} className="p-6 max-[640px]:p-4">
            <h2 style={sectionTitleStyle}>Avatar</h2>

            <Form.Item label="Avatar">
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={(file) => {
                  setAvatarFile(file)
                  return false
                }}
              >
                <Button icon={<UploadOutlined />} size="large">
                  {avatarFile ? avatarFile.name : t('admin.trainers.form.avatar_upload')}
                </Button>
              </Upload>
            </Form.Item>
          </div>

          {!isEdit && (
            <div style={cardStyle} className="p-6 max-[640px]:p-4">
              <h2 style={sectionTitleStyle}>{t('admin.trainers.form.password')}</h2>

              <Form.Item
                label={t('admin.trainers.form.password')}
                name="password"
                rules={[
                  { required: true, message: 'Vui lòng nhập mật khẩu' },
                  { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự' },
                ]}
              >
                <Input.Password placeholder={t('admin.trainers.form.password_placeholder')} size="large" />
              </Form.Item>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button size="large" onClick={() => navigate('/admin/trainers')}>
              {t('admin.trainers.form.cancel')}
            </Button>
            <Button type="primary" htmlType="submit" size="large" loading={loading}>
              {isEdit ? t('admin.trainers.form.submit_edit') : t('admin.trainers.form.submit_add')}
            </Button>
          </div>
        </div>
      </Form>

      <div style={{ height: 40 }} />
    </>
  )
}
