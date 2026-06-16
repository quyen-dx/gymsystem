import { Button, DatePicker, Form, Input, Select, Upload, message } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { memberService } from '../../../services/memberService'
import type { MemberListItem } from '../../../types/admin/member'
import { UploadOutlined, ArrowLeftOutlined } from '@ant-design/icons'

const PHONE_REGEX = /^0\d{9,10}$/

interface Props {
  member?: MemberListItem | null
  onSuccess?: () => void
  pageTitle?: string
  pageDescription?: string
}

export default function AdminMembersForm({ member, onSuccess, pageTitle, pageDescription }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  useEffect(() => {
    if (member) {
      form.setFieldsValue({
        name: member.name,
        email: member.email || '',
        phone: member.phone || '',
        dateOfBirth: member.dateOfBirth ? dayjs(member.dateOfBirth) : null,
        gender: member.gender || undefined,
      })
    } else {
      form.resetFields()
      setAvatarFile(null)
    }
  }, [member, form])

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (!member) return
    setLoading(true)
    try {
      let payload: FormData | Record<string, unknown>

      if (avatarFile) {
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

      await memberService.updateMember(member._id, payload)
      message.success(t('admin.members.update_success'))
      onSuccess?.()
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } }
      message.error(apiError?.response?.data?.message || t('admin.members.messages.action_failed'))
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
          onClick={() => navigate('/admin/members')}
          style={{ color: 'var(--gs-text)', fontSize: 15 }}
        >
          ← {t('admin.members.detail.back')}
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
            <h2 style={sectionTitleStyle}>{t('admin.members.detail.basic_info')}</h2>

            <Form.Item
              label={t('admin.members.form.name')}
              name="name"
              rules={[{ required: true, message: t('admin.members.form.name_required') }]}
            >
              <Input placeholder={t('admin.members.form.name_placeholder')} size="large" />
            </Form.Item>

            <Form.Item
              label={t('admin.members.form.email')}
              name="email"
              rules={[
                { type: 'email', message: 'Email không hợp lệ' },
              ]}
            >
              <Input placeholder={t('admin.members.form.email_placeholder')} size="large" />
            </Form.Item>

            <Form.Item
              label={t('admin.members.form.phone')}
              name="phone"
              rules={[
                { pattern: PHONE_REGEX, message: 'Số điện thoại không hợp lệ (VD: 0912345678)' },
              ]}
            >
              <Input placeholder={t('admin.members.form.phone_placeholder')} size="large" />
            </Form.Item>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Form.Item label={t('admin.members.form.gender')} name="gender">
                <Select
                  allowClear
                  placeholder={t('admin.members.form.gender')}
                  size="large"
                  options={[
                    { value: 'male', label: t('admin.members.form.gender_male') },
                    { value: 'female', label: t('admin.members.form.gender_female') },
                    { value: 'other', label: t('admin.members.form.gender_other') },
                  ]}
                />
              </Form.Item>

              <Form.Item label={t('admin.members.form.dateOfBirth')} name="dateOfBirth">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="DD/MM/YYYY" size="large" />
              </Form.Item>
            </div>
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
                  {avatarFile ? avatarFile.name : t('admin.members.form.avatar_upload')}
                </Button>
              </Upload>
            </Form.Item>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button size="large" onClick={() => navigate('/admin/members')}>
              {t('admin.members.form.cancel')}
            </Button>
            <Button type="primary" htmlType="submit" size="large" loading={loading}>
              {t('admin.members.form.submit_edit')}
            </Button>
          </div>
        </div>
      </Form>

      <div style={{ height: 40 }} />
    </>
  )
}
