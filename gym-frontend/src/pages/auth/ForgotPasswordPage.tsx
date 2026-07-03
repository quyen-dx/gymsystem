import { Button, Divider, Form, Input, Steps, Typography, message } from 'antd'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import FeatureDisabled from '../../components/system/FeatureDisabled'
import { useTheme } from '../../context/ThemeProvider'
import { useSystemSettings } from '../../context/SystemSettingsContext'
import { authService } from '../../services/authService'

const { Title, Text } = Typography

type Step = 'identifier' | 'otp' | 'password'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const { dark } = useTheme()
  const { settings } = useSystemSettings()

  const [step, setStep] = useState<Step>('identifier')
  const [loading, setLoading] = useState(false)

  const [identifier, setIdentifier] = useState('')
  const [otpPreview, setOtpPreview] = useState('')
  const [resetToken, setResetToken] = useState('')

  if (!settings.auth.forgotPasswordEmailEnabled && !settings.auth.forgotPasswordSmsOtpEnabled) return <FeatureDisabled />

  const identifierType = useMemo(
    () => (identifier.includes('@')
      ? 'Email'
      : 'Số điện thoại'),
    [identifier],
  )

  const handleSendOtp = async (values: Record<string, string>) => {
    setLoading(true)
    try {
      setIdentifier(values.identifier)
      const { data } = await authService.sendForgotPasswordOtp(values.identifier)
      setOtpPreview(data.otpPreview || '')
      setStep('otp')
      message.success(data.message || 'Mã OTP đã được gửi')
    } catch (error) {
      const err = error as any;
      message.error(err.response?.data?.message || 'Gửi mã OTP thất bại')
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
      message.success('Mã OTP hợp lệ')
    } catch (error) {
      const err = error as any;
      message.error(err.response?.data?.message || 'Mã OTP không hợp lệ')
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
      message.success('Đặt lại mật khẩu thành công')
      setTimeout(() => navigate('/login'), 800)
    } catch (error) {
      const err = error as any;
      message.error(err.response?.data?.message || 'Đặt lại mật khẩu thất bại')
    } finally {
      setLoading(false)
    }
  }

  const textColor = 'var(--gs-text)'
  const subTextColor = 'var(--gs-muted)'
  const inputStyle = { background: 'var(--theme-input-bg)', borderColor: 'var(--gs-border)', color: 'var(--gs-text)' }

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-y-auto px-4 py-8 sm:overflow-hidden sm:p-0">

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
        className="relative z-10 w-full max-w-md rounded-2xl p-7 pb-16 shadow-2xl"
        style={{
          background: dark ? 'rgba(15,15,18,0.92)' : 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
          color: textColor,
        }}
      >
        <div className="mb-5 text-center">
          <div
            className="mx-auto mb-3 grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-[var(--theme-button-bg)] font-black text-[var(--theme-button-text)]"
            style={{ border: `1px solid ${dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.12)'}` }}
          >
            {settings.general.logoUrl
              ? <img src={settings.general.logoUrl} alt={settings.general.siteName} className="h-full w-full object-cover" />
              : <span className="text-base font-black">GP</span>
            }
          </div>
        </div>
        <Title level={3} style={{ textAlign: 'center', color: textColor }}>
          {'Quên mật khẩu'}
        </Title>

        <Steps
          size="small"
          current={step === 'identifier' ? 0 : step === 'otp' ? 1 : 2}
          items={[
            { title: <span style={{ color: textColor }}>{'Thông tin'}</span> },
            { title: <span style={{ color: textColor }}>{'Xác thực OTP'}</span> },
            { title: <span style={{ color: textColor }}>{'Mật khẩu mới'}</span> },
          ]}
          className="mb-6 [&_.ant-steps-item-icon]:!bg-[var(--theme-active-bg)] [&_.ant-steps-item-icon]:!border-[var(--theme-active-bg)] [&_.ant-steps-icon]:!text-[var(--theme-active-text)]"
        />

        {settings.auth.demoOtpEnabled && !!otpPreview && (
          <div
            className="mb-4 rounded-lg p-2 text-center"
            style={{
              background: 'var(--gs-card)',
              color: 'var(--gs-text)',
            }}
          >
            OTP demo: <b>{otpPreview}</b>
          </div>
        )}

        {/* STEP 1 */}
        {step === 'identifier' && (
          <Form layout="vertical" onFinish={handleSendOtp}>
            <Form.Item
              label={<span style={{ color: textColor }}>{'Email hoặc số điện thoại'}</span>}
              name="identifier"
              rules={[{ required: true, message: 'Vui lòng nhập email hoặc số điện thoại' }]}
            >
              <Input
                size="large"
                placeholder={'Nhập email hoặc số điện thoại'}
                onChange={(e) => setIdentifier(e.target.value)}
                style={inputStyle}
              />
            </Form.Item>

            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              {'Gửi mã OTP'}
            </Button>
          </Form>
        )}

        {/* STEP 2 */}
        {step === 'otp' && (
          <Form layout="vertical" onFinish={handleVerifyOtp}>
            <Text style={{ color: subTextColor }}>
              {'Mã OTP đã được gửi đến'} <b style={{ color: textColor }}>{identifier}</b> ({identifierType})
            </Text>

            <Form.Item
              label={<span style={{ color: textColor }}>{'Mã OTP'}</span>}
              name="otp"
              rules={[{ required: true, message: 'Vui lòng nhập mã OTP' }]}
              className="mt-3"
            >
              <Input.OTP length={6} style={inputStyle} />
            </Form.Item>

            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              {'Xác thực'}
            </Button>

            <Divider />

            <Button block onClick={() => setStep('identifier')} style={{ background: 'var(--theme-input-bg)', borderColor: 'var(--gs-border)', color: 'var(--gs-text)' }}>
              {'Quay lại'}
            </Button>
          </Form>
        )}

        {/* STEP 3 */}
        {step === 'password' && (
          <Form layout="vertical" onFinish={handleResetPassword}>
            <Form.Item
              label={<span style={{ color: textColor }}>{'Mật khẩu mới'}</span>}
              name="newPassword"
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu mới' }]}
            >
              <Input.Password size="large" style={inputStyle} />
            </Form.Item>

            <Form.Item
              label={<span style={{ color: textColor }}>{'Xác nhận mật khẩu'}</span>}
              name="confirmPassword"
              rules={[{ required: true, message: 'Vui lòng xác nhận mật khẩu' }]}
            >
              <Input.Password size="large" style={inputStyle} />
            </Form.Item>

            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              {'Đặt lại mật khẩu'}
            </Button>
          </Form>
        )}

        <div className="text-center mt-6 text-sm">
          <Link to="/login" className="auth-link-action">
            {'Quay lại đăng nhập'}
          </Link>
        </div>
      </div>
    </div>
  )
}
