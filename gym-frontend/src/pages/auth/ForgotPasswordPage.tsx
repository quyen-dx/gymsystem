import { MoonOutlined, SunOutlined } from '@ant-design/icons'
import { Button, Divider, Form, Input, Steps, Typography, message } from 'antd'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTheme } from '../../context/ThemeProvider'
import { authService } from '../../services/authService'

const { Title, Text } = Typography

type Step = 'identifier' | 'otp' | 'password'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const { dark, toggleTheme } = useTheme()

  const [step, setStep] = useState<Step>('identifier')
  const [loading, setLoading] = useState(false)

  const [identifier, setIdentifier] = useState('')
  const [otpPreview, setOtpPreview] = useState('')
  const [resetToken, setResetToken] = useState('')

  const identifierType = useMemo(
    () => (identifier.includes('@') ? 'email' : 'số điện thoại'),
    [identifier],
  )

  const handleSendOtp = async (values: Record<string, string>) => {
    setLoading(true)
    try {
      setIdentifier(values.identifier)
      const { data } = await authService.sendForgotPasswordOtp(values.identifier)
      setOtpPreview(data.otpPreview || '')
      setStep('otp')
      message.success(data.message || 'OTP đã được gửi')
    } catch (error) {
      const err = error as any;
      message.error(err.response?.data?.message || 'Không thể gửi OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (values: Record<string, string>) => {
    setLoading(true)
    try {
      const { data } = await authService.verifyForgotPasswordOtp({
        identifier,
        otp: values.otp,
      })
      setResetToken(data.resetToken)
      setStep('password')
      message.success('OTP hợp lệ')
    } catch (error) {
      const err = error as any;
      message.error(err.response?.data?.message || 'OTP không đúng')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (values: Record<string, string>) => {
    setLoading(true)
    try {
      if (values.newPassword !== values.confirmPassword) {
        message.error('Mật khẩu xác nhận không khớp')
        return
      }
      await authService.resetPassword({
        resetToken,
        newPassword: values.newPassword,
      })
      message.success('Đổi mật khẩu thành công')
      setTimeout(() => navigate('/login'), 800)
    } catch (error) {
      const err = error as any;
      message.error(err.response?.data?.message || 'Không thể đặt lại mật khẩu')
    } finally {
      setLoading(false)
    }
  }

  const cardBg = dark ? '#141414' : '#ffffff'
  const textColor = dark ? '#ffffff' : '#000000'
  const subTextColor = dark ? '#9ca3af' : '#6b7280'

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
          transform: 'scale(1.05)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{ background: dark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)' }}
      />

      {/* CARD */}
      <div
        className="relative z-10 w-full max-w-md rounded-2xl p-7 shadow-2xl"
        style={{ background: cardBg }}
      >
        {/* TOGGLE THEME */}
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          <Button
            shape="circle"
            onClick={toggleTheme}
            icon={dark ? <SunOutlined /> : <MoonOutlined />}
          />
        </div>

        <Title level={3} style={{ textAlign: 'center', color: textColor }}>
          Khôi phục mật khẩu
        </Title>

        <Steps
          size="small"
          current={step === 'identifier' ? 0 : step === 'otp' ? 1 : 2}
          items={[
            { title: <span style={{ color: textColor }}>Thông tin</span> },
            { title: <span style={{ color: textColor }}>OTP</span> },
            { title: <span style={{ color: textColor }}>Mật khẩu</span> },
          ]}
          className="mb-6"
        />

        {!!otpPreview && (
          <div
            className="mb-4 rounded-lg p-2 text-center"
            style={{
              background: dark ? 'rgba(234,88,12,0.15)' : '#fff7ed',
              color: dark ? '#fb923c' : '#c2410c',
            }}
          >
            OTP demo: <b>{otpPreview}</b>
          </div>
        )}

        {/* STEP 1 */}
        {step === 'identifier' && (
          <Form layout="vertical" onFinish={handleSendOtp}>
            <Form.Item
              label={<span style={{ color: textColor }}>Email hoặc số điện thoại</span>}
              name="identifier"
              rules={[{ required: true, message: 'Nhập thông tin' }]}
            >
              <Input
                size="large"
                placeholder="Email hoặc số điện thoại"
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </Form.Item>

            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              Gửi OTP
            </Button>
          </Form>
        )}

        {/* STEP 2 */}
        {step === 'otp' && (
          <Form layout="vertical" onFinish={handleVerifyOtp}>
            <Text style={{ color: subTextColor }}>
              Đã gửi OTP tới: <b style={{ color: textColor }}>{identifier}</b> ({identifierType})
            </Text>

            <Form.Item
              label={<span style={{ color: textColor }}>OTP</span>}
              name="otp"
              rules={[{ required: true, message: 'Nhập OTP' }]}
              className="mt-3"
            >
              <Input.OTP length={6} />
            </Form.Item>

            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              Xác minh
            </Button>

            <Divider />

            <Button block onClick={() => setStep('identifier')}>
              Quay lại
            </Button>
          </Form>
        )}

        {/* STEP 3 */}
        {step === 'password' && (
          <Form layout="vertical" onFinish={handleResetPassword}>
            <Form.Item
              label={<span style={{ color: textColor }}>Mật khẩu mới</span>}
              name="newPassword"
              rules={[{ required: true, message: 'Nhập mật khẩu mới' }]}
            >
              <Input.Password size="large" />
            </Form.Item>

            <Form.Item
              label={<span style={{ color: textColor }}>Xác nhận mật khẩu</span>}
              name="confirmPassword"
              rules={[{ required: true, message: 'Nhập lại mật khẩu' }]}
            >
              <Input.Password size="large" />
            </Form.Item>

            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              Đặt lại mật khẩu
            </Button>
          </Form>
        )}

        <div className="text-center mt-6 text-sm">
          <Link to="/login" className="text-orange-500 font-semibold">
            Quay lại đăng nhập
          </Link>
        </div>
      </div>
    </div>
  )
}