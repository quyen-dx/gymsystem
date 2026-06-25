import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import { Button, DatePicker, Form, Input, Select, message } from 'antd'
import type { Dayjs } from 'dayjs'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { memberService } from '../../../services/memberService'

type MemberFormValues = {
  name: string
  phone?: string
  email?: string
  dateOfBirth?: Dayjs
  gender?: string
  password?: string
}

export default function StaffMemberNewPage() {
  const navigate = useNavigate()
  const [form] = Form.useForm<MemberFormValues>()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (values: MemberFormValues) => {
    setSubmitting(true)
    try {
      await memberService.createMember({
        name: values.name.trim(),
        phone: values.phone?.trim() || '',
        email: values.email?.trim() || '',
        dateOfBirth: values.dateOfBirth ? values.dateOfBirth.toISOString() : undefined,
        gender: values.gender,
        password: values.password?.trim() || 'member123',
      })
      message.success('Tạo hội viên thành công')
      navigate('/staff/members')
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Tạo hội viên thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/staff/members')} className="mb-5">
          Quay lại
        </Button>

        <div className="mb-6">
          <h1 className="m-0 text-3xl font-semibold text-[var(--gs-text)]">Tạo hội viên</h1>
          <p className="mt-2 text-sm text-[var(--gs-text-muted)]">Nhập thông tin cơ bản để tạo tài khoản hội viên mới.</p>
        </div>

        <div className="rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card)] p-6">
          <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ password: 'member123' }}>
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

            <div className="mt-2 flex justify-end">
              <Button type="primary" size="large" htmlType="submit" loading={submitting} icon={<SaveOutlined />}>
                Tạo hội viên
              </Button>
            </div>
          </Form>
        </div>
      </div>
    </DashboardLayout>
  )
}
