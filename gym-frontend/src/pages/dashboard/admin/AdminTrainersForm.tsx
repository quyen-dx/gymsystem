import { Button, DatePicker, Form, Input, InputNumber, Select, Upload, message } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
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
        oneToOnePrice: pt.oneToOnePrice || 0,
        groupPrice: pt.groupPrice || 0,
        groupCapacity: pt.groupCapacity || 5,
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
        fd.append('oneToOnePrice', String(values.oneToOnePrice || 0))
        fd.append('groupPrice', String(values.groupPrice || 0))
        fd.append('groupCapacity', String(values.groupCapacity || 5))
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
          oneToOnePrice: values.oneToOnePrice || 0,
          groupPrice: values.groupPrice || 0,
          groupCapacity: values.groupCapacity || 5,
          specialties: values.specialties || [],
          certificates: values.certificates || [],
          dateOfBirth: values.dateOfBirth ? new Date(values.dateOfBirth as Date).toISOString() : undefined,
          ...(!isEdit && values.password ? { password: values.password as string } : {}),
        }
      }

      if (isEdit) {
        await trainerService.updatePT(pt!._id, payload)
        message.success('Cập nhật PT thành công')
      } else {
        await trainerService.createPT(payload)
        message.success('Tạo PT mới thành công')
      }
      onSuccess?.()
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } }; message?: string }
      message.error(apiError?.response?.data?.message || apiError?.message || 'Thao tác thất bại')
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
              label="Họ và tên"
              name="name"
              rules={[{ required: true, message: 'Vui lòng nhập tên PT' }]}
            >
              <Input placeholder="Nhập tên PT" size="large" />
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
          </div>

          <div style={cardStyle} className="p-6 max-[640px]:p-4">
            <h2 style={sectionTitleStyle}>Chuyên môn & Tiểu sử</h2>

            <Form.Item label="Chuyên môn" name="specialties">
              <Select
                mode="tags"
                placeholder="Chọn chuyên môn"
                size="large"
                options={SPECIALTY_OPTIONS.map((s) => ({ value: s, label: s }))}
              />
            </Form.Item>

            <Form.Item label="Tiểu sử" name="bio">
              <Input.TextArea rows={4} placeholder="Nhập tiểu sử" size="large" />
            </Form.Item>

            <Form.Item label="Số năm kinh nghiệm" name="experienceYears">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="Nhập số năm kinh nghiệm" size="large" />
            </Form.Item>
          </div>

          <div style={cardStyle} className="p-6 max-[640px]:p-4">
            <h2 style={sectionTitleStyle}>Giá dịch vụ PT</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Form.Item label="Giá PT 1-1 / buổi (VNĐ)" name="oneToOnePrice">
                <InputNumber
                  min={0}
                  step={10000}
                  style={{ width: '100%' }}
                  placeholder="Ví dụ: 300000"
                  size="large"
                />
              </Form.Item>

              <Form.Item label="Giá PT nhóm / người (VNĐ)" name="groupPrice">
                <InputNumber
                  min={0}
                  step={10000}
                  style={{ width: '100%' }}
                  placeholder="Ví dụ: 120000"
                  size="large"
                />
              </Form.Item>
            </div>

            <Form.Item label="Sức chứa nhóm tối đa" name="groupCapacity">
              <InputNumber
                min={1}
                max={50}
                style={{ width: '100%' }}
                placeholder="Ví dụ: 5"
                size="large"
              />
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
                  {avatarFile ? avatarFile.name : 'Tải lên ảnh đại diện'}
                </Button>
              </Upload>
            </Form.Item>
          </div>

          {!isEdit && (
            <div style={cardStyle} className="p-6 max-[640px]:p-4">
              <h2 style={sectionTitleStyle}>Mật khẩu</h2>

              <Form.Item
                label="Mật khẩu"
                name="password"
                rules={[
                  { required: true, message: 'Vui lòng nhập mật khẩu' },
                  { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự' },
                ]}
              >
                <Input.Password placeholder="Nhập mật khẩu" size="large" />
              </Form.Item>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <Button size="large" onClick={() => navigate('/admin/trainers')}>
              Hủy
            </Button>
            <Button type="primary" htmlType="submit" size="large" loading={loading}>
              {isEdit ? 'Cập nhật PT' : 'Thêm PT'}
            </Button>
          </div>
        </div>
      </Form>

      <div style={{ height: 40 }} />
    </>
  )
}
