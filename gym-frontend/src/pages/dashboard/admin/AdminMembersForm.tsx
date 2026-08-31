import { Button, DatePicker, Form, Input, Select, Upload, message } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { memberService } from '../../../services/memberService'
import type { MemberListItem } from '../../../types/admin/member'
import { UploadOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { getUserDisplayName } from '../../../utils/userDisplay'

const PHONE_REGEX = /^0\d{9,10}$/

interface Props {
  member?: MemberListItem | null
  onSuccess?: () => void
  pageTitle?: string
  pageDescription?: string
}

export default function AdminMembersForm({ member, onSuccess, pageTitle, pageDescription }: Props) {
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  useEffect(() => {
    if (member) {
      form.setFieldsValue({
        name: getUserDisplayName(member, ''),
        email: member.email || '',
        phone: member.phone || '',
        contactEmail: member.contactEmail || '',
        dateOfBirth: member.dateOfBirth ? dayjs(member.dateOfBirth) : null,
        gender: member.gender || undefined,
        detailedAddress: member.detailedAddress || '',
        emergencyContactName: member.emergencyContact?.name || '',
        emergencyContactPhone: member.emergencyContact?.phone || '',
        emergencyContactRelationship: member.emergencyContact?.relationship || '',
        healthHeight: member.healthInfo?.height ?? undefined,
        healthWeight: member.healthInfo?.weight ?? undefined,
        healthGoals: member.healthInfo?.goals?.join(', ') || '',
        activityLevel: member.healthInfo?.activityLevel || '',
        healthNotes: member.healthInfo?.notes || '',
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
        fd.append('contactEmail', (values.contactEmail as string) || '')
        fd.append('detailedAddress', (values.detailedAddress as string) || '')
        fd.append('emergencyContactName', (values.emergencyContactName as string) || '')
        fd.append('emergencyContactPhone', (values.emergencyContactPhone as string) || '')
        fd.append('emergencyContactRelationship', (values.emergencyContactRelationship as string) || '')
        fd.append('healthHeight', String(values.healthHeight ?? ''))
        fd.append('healthWeight', String(values.healthWeight ?? ''))
        fd.append('healthGoals', (values.healthGoals as string) || '')
        fd.append('activityLevel', (values.activityLevel as string) || '')
        fd.append('healthNotes', (values.healthNotes as string) || '')
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
          contactEmail: (values.contactEmail as string) || '',
          detailedAddress: (values.detailedAddress as string) || '',
          emergencyContactName: (values.emergencyContactName as string) || '',
          emergencyContactPhone: (values.emergencyContactPhone as string) || '',
          emergencyContactRelationship: (values.emergencyContactRelationship as string) || '',
          healthHeight: values.healthHeight ?? '',
          healthWeight: values.healthWeight ?? '',
          healthGoals: (values.healthGoals as string) || '',
          activityLevel: (values.activityLevel as string) || '',
          healthNotes: (values.healthNotes as string) || '',
        }
      }

      await memberService.updateMember(member._id, payload)
      message.success('Cập nhật thành viên thành công')
      onSuccess?.()
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } }
      message.error(apiError?.response?.data?.message || 'Thao tác thất bại')
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
            ← Quay lại
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
            <h2 style={sectionTitleStyle}>Thông tin cơ bản</h2>

            <Form.Item
              label="Tên"
              name="name"
              rules={[{ required: true, message: 'Vui lòng nhập tên thành viên' }]}
            >
              <Input placeholder="Nhập tên thành viên" size="large" />
            </Form.Item>

            <Form.Item
              label="Email"
              name="email"
              rules={[
                { type: 'email', message: 'Email không hợp lệ' },
              ]}
            >
              <Input placeholder="Nhập email" size="large" />
            </Form.Item>

            <Form.Item
              label="Số điện thoại"
              name="phone"
              rules={[
                { pattern: PHONE_REGEX, message: 'Số điện thoại không hợp lệ (VD: 0912345678)' },
              ]}
            >
              <Input placeholder="Nhập số điện thoại" size="large" />
            </Form.Item>

            <Form.Item label="Email liên hệ" name="contactEmail" rules={[{ type: 'email', message: 'Email liên hệ không hợp lệ' }]}>
              <Input placeholder="Email dùng để liên hệ (nếu khác email đăng nhập)" size="large" />
            </Form.Item>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Form.Item label="Giới tính" name="gender">
                <Select
                  allowClear
                  placeholder="Giới tính"
                  size="large"
                  options={[
                    { value: 'male', label: 'Nam' },
                    { value: 'female', label: 'Nữ' },
                    { value: 'other', label: 'Khác' },
                  ]}
                />
              </Form.Item>

              <Form.Item label="Ngày sinh" name="dateOfBirth">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="DD/MM/YYYY" size="large" />
              </Form.Item>
            </div>

            <Form.Item label="Địa chỉ" name="detailedAddress">
              <Input.TextArea rows={2} placeholder="Địa chỉ liên hệ" />
            </Form.Item>
          </div>

          <div style={cardStyle} className="p-6 max-[640px]:p-4">
            <h2 style={sectionTitleStyle}>Liên hệ khẩn cấp</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Form.Item label="Họ tên" name="emergencyContactName"><Input placeholder="Người liên hệ" /></Form.Item>
              <Form.Item label="Số điện thoại" name="emergencyContactPhone"><Input placeholder="Số điện thoại" /></Form.Item>
              <Form.Item label="Mối quan hệ" name="emergencyContactRelationship"><Input placeholder="Ví dụ: Người thân" /></Form.Item>
            </div>
          </div>

          <div style={cardStyle} className="p-6 max-[640px]:p-4">
            <h2 style={sectionTitleStyle}>Thông tin sức khỏe</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Form.Item label="Chiều cao (cm)" name="healthHeight"><Input type="number" min={1} /></Form.Item>
              <Form.Item label="Cân nặng (kg)" name="healthWeight"><Input type="number" min={1} /></Form.Item>
            </div>
            <Form.Item label="Mục tiêu tập luyện" name="healthGoals" extra="Ngăn cách các mục tiêu bằng dấu phẩy">
              <Input placeholder="Ví dụ: Giảm mỡ, Tăng sức bền" />
            </Form.Item>
            <Form.Item label="Mức độ hoạt động" name="activityLevel">
              <Select allowClear options={[{ value: 'low', label: 'Thấp' }, { value: 'medium', label: 'Trung bình' }, { value: 'high', label: 'Cao' }]} />
            </Form.Item>
            <Form.Item label="Lưu ý sức khỏe" name="healthNotes">
              <Input.TextArea rows={3} placeholder="Dị ứng, chấn thương hoặc lưu ý khi tập" />
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
                  {avatarFile ? avatarFile.name : 'Chọn ảnh đại diện'}
                </Button>
              </Upload>
            </Form.Item>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button size="large" onClick={() => navigate('/admin/members')}>
              Hủy
            </Button>
            <Button type="primary" htmlType="submit" size="large" loading={loading}>
              Lưu thay đổi
            </Button>
          </div>
        </div>
      </Form>

      <div style={{ height: 40 }} />
    </>
  )
}
