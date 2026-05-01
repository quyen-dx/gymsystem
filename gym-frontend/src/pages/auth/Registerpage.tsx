import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authService } from '../../services/authService'
import { Button, Form, Input, Typography, message, Divider } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useTheme } from '../../context/ThemeProvider'
import { SunOutlined, MoonOutlined } from '@ant-design/icons'
const { Title, Text } = Typography

const getDashboardPath = (role: string) => {
  if (role === 'admin') return '/dashboard/admin'
  if (role === 'seller') return '/dashboard/seller/products'
  if (role === 'staff') return '/dashboard/staff'
  if (role === 'pt') return '/dashboard/pt'
  return '/dashboard/member'
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { dark ,toggleTheme } = useTheme()

  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [loading, setLoading] = useState(false)

  const [form] = Form.useForm()
  const [otpPreview, setOtpPreview] = useState('')

  const handleSendOtp = async (values: any) => {
    setLoading(true)
    try {
      const { data } = await authService.sendRegisterOtp({
        provider: 'phone',
        name: values.name,
        phone: values.phone,
        password: values.password,
      })

      setOtpPreview(data.otpPreview || '')
      setStep('otp')

      message.success(data.message || 'OTP đã được gửi')
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Gửi OTP thất bại')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (values: any) => {
    setLoading(true)
    try {
      const phone = form.getFieldValue('phone')

      const { data } = await authService.verifyRegisterOtp({
        identifier: phone,
        otp: values.otp,
      })

      message.success('Đăng ký thành công')

      localStorage.setItem('token', data.accessToken)
      navigate(getDashboardPath(data.user.role))
    } catch (err: any) {
      message.error(err.response?.data?.message || 'OTP không hợp lệ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">

      {/* BACKGROUND */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1600&q=80')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(8px)',
          transform: 'scale(1.1)',
        }}
      />

      <div className="absolute inset-0 bg-black/60" />

      {/* CARD */}
      <div
        className={`relative z-10 w-full max-w-md rounded-2xl p-7 shadow-2xl transition-all
          ${dark ? 'bg-[#141414] text-white' : 'bg-white text-black'}
        `}
      >

        {/* HEADER */}
        <div className="flex items-center gap-2 mb-4">

          {step === 'otp' && (
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => setStep('form')}
              style={{ color: dark ? '#fff' : '#000' }}
            />
          )}

          <Title
            level={3}
            style={{
              margin: 0,
              color: dark ? '#fff' : '#000',
            }}
          >
            Đăng ký
          </Title>
        </div>
<div style={{ position: 'absolute', top: 16, right: 16 }}>
  <Button
    shape="circle"
    onClick={toggleTheme}
    icon={dark ? <SunOutlined /> : <MoonOutlined />}
  />
</div>
        {/* FORM STEP 1 */}
        {step === 'form' && (
          <Form layout="vertical" form={form} onFinish={handleSendOtp}>

            <Form.Item
              label={<span style={{ color: dark ? '#fff' : '#000' }}>Họ và tên</span>}
              name="name"
              rules={[{ required: true, message: 'Nhập họ tên' }]}
            >
              <Input size="large" />
            </Form.Item>

            <Form.Item
              label={<span style={{ color: dark ? '#fff' : '#000' }}>Số điện thoại</span>}
              name="phone"
              rules={[{ required: true, message: 'Nhập số điện thoại' }]}
            >
              <Input size="large" />
            </Form.Item>

            <Form.Item
              label={<span style={{ color: dark ? '#fff' : '#000' }}>Mật khẩu</span>}
              name="password"
              rules={[{ required: true, message: 'Nhập mật khẩu' }]}
            >
              <Input.Password size="large" />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={loading}
            >
              Gửi OTP
            </Button>

            <Divider />

            <div
              className="text-center text-sm"
              style={{ color: dark ? '#ccc' : '#000' }}
            >
              Đã có tài khoản?{' '}
              <Link to="/login" className="!text-orange-500 font-semibold">
                Đăng nhập
              </Link>
            </div>

          </Form>
        )}

        {/* STEP 2 OTP */}
        {step === 'otp' && (
          <Form layout="vertical" onFinish={handleVerifyOtp}>

            {otpPreview && (
              <div className="mb-3 text-center text-orange-500">
                OTP demo: <b>{otpPreview}</b>
              </div>
            )}

            <Text style={{ color: dark ? '#fff' : '#000' }}>
              Nhập OTP
            </Text>

            <Form.Item
              name="otp"
              rules={[{ required: true, message: 'Nhập OTP' }]}
            >
              <Input.OTP length={6} />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={loading}
            >
              Xác minh
            </Button>

          </Form>
        )}

      </div>
    </div>
  )
}
