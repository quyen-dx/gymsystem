import { ArrowLeftOutlined } from '@ant-design/icons'
import { Button, Divider, Form, Input, Typography, message } from 'antd'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import FeatureDisabled from '../../components/system/FeatureDisabled'
import TypewriterSlogans from '../../components/system/TypewriterSlogans'
import { useSystemSettings } from '../../context/SystemSettingsContext'
import { useAuth } from '../../hooks/useAuth'
import { setAuthToken } from '../../services/api'
import { authService } from '../../services/authService'
import { getLocalizedText } from '../../utils/localization'
const { Title, Text } = Typography

const registerOtpMessageKey = 'register-send-otp'
const registerVerifyMessageKey = 'register-verify-otp'

const pickLocalizedSlogans = (slogans: Array<{ vi?: string; en?: string }> = [], language: string) => {
  return slogans
    .map((item) => getLocalizedText(item, language, ''))
    .filter(Boolean)
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { updateUser } = useAuth()
  const { settings } = useSystemSettings()

  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [loading, setLoading] = useState(false)

  const [form] = Form.useForm()
  const [otpPreview, setOtpPreview] = useState('')
  const slogans = pickLocalizedSlogans(settings.general.slogans, 'vi')

  if (!settings.auth.allowRegistration) return <FeatureDisabled />

  const handleSendOtp = async (values: any) => {
    if (loading) return
    setLoading(true)
    try {
      const identifier = String(values.phone || '').trim()
      const fullName = String(values.fullName || '').trim()
      const { data } = await authService.sendRegisterOtp({
        provider: identifier.includes('@') ? 'email' : 'phone',
        fullName,
        name: fullName,
        phone: identifier,
        password: values.password,
      })

      setOtpPreview(data.otpPreview || '')
      setStep('otp')

      message.success({ key: registerOtpMessageKey, content: data.message || 'Mã OTP đã được gửi' })
    } catch (err: any) {
      message.error({ key: registerOtpMessageKey, content: err.response?.data?.message || 'Gửi mã OTP thất bại' })
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (values: any) => {
    if (loading) return
    setLoading(true)
    try {
      const phone = form.getFieldValue('phone')

      const { data } = await authService.verifyRegisterOtp({
        identifier: phone,
        otp: values.otp,
      })

      message.success({ key: registerVerifyMessageKey, content: 'Đăng ký thành công' })

      if (data?.accessToken && data?.user) {
        setAuthToken(data.accessToken, data.refreshToken)
        updateUser(data.user)
        navigate('/dashboard', { replace: true })
        return
      }

      navigate('/login', { replace: true })
    } catch (err: any) {
      message.error({ key: registerVerifyMessageKey, content: err.response?.data?.message || 'Mã OTP không hợp lệ' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-y-auto overflow-x-hidden px-4 py-8 sm:overflow-hidden sm:p-0">

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

      <div className="absolute inset-0 bg-black/65" />

      {/* CARD */}
      <div
        className="relative z-10 my-auto w-full max-w-sm rounded-2xl p-7 shadow-2xl transition-all"
        style={{
          background: 'var(--gs-card)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid var(--gs-border-strong)',
        }}
      >
        <div className="mb-5 text-center">
          <div
            className="mx-auto mb-3 grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-[var(--theme-button-bg)] font-black text-[var(--theme-button-text)]"
            style={{ border: '1px solid var(--theme-button-border)' }}
          >
            {settings.general.logoUrl
              ? <img src={settings.general.logoUrl} alt={settings.general.siteName} className="h-full w-full object-cover" />
              : <span className="text-base font-black">GP</span>
            }
          </div>
          {slogans.length > 0 && (
            <div style={{ color: 'var(--gs-text)' }}>
              <TypewriterSlogans
                slogans={slogans}
                language={'vi'}
                className="mt-1 text-xs font-semibold uppercase tracking-[0.18em]"
              />
            </div>
          )}
        </div>

        {/* HEADER */}
        <div className="mb-4 flex items-center justify-center gap-2">

          {step === 'otp' && (
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => setStep('form')}
              disabled={loading}
              className="!absolute !left-5"
              style={{ color: 'var(--gs-text)' }}
            />
          )}

          <Title
            level={3}
            style={{
              margin: 0,
              textAlign: 'center',
              color: 'var(--gs-text)',
            }}
          >
            {'Đăng ký'}
          </Title>
        </div>
        {/* FORM STEP 1 */}
        {step === 'form' && (
          <Form layout="vertical" form={form} onFinish={handleSendOtp}>

            <Form.Item
              label={<span style={{ color: 'var(--gs-text)' }}>{'Họ và tên'}</span>}
              name="fullName"
              rules={[{ required: true, message: 'Vui lòng nhập họ và tên' }]}
            >
              <Input size="large" style={{ background: 'var(--gs-input-bg)', borderColor: 'var(--gs-border)', color: 'var(--gs-text)' }} />
            </Form.Item>

            <Form.Item
              label={<span style={{ color: 'var(--gs-text)' }}>{'Số điện thoại'}</span>}
              name="phone"
              rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}
            >
              <Input size="large" style={{ background: 'var(--gs-input-bg)', borderColor: 'var(--gs-border)', color: 'var(--gs-text)' }} />
            </Form.Item>

            <Form.Item
              label={<span style={{ color: 'var(--gs-text)' }}>{'Mật khẩu'}</span>}
              name="password"
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
            >
              <Input.Password size="large" style={{ background: 'var(--gs-input-bg)', borderColor: 'var(--gs-border)', color: 'var(--gs-text)' }} />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={loading}
              disabled={loading}
            >
              {'Gửi mã OTP'}
            </Button>

            <Divider style={{ borderColor: 'var(--gs-border)' }} />

            <div
              className="text-center text-sm"
              style={{ color: 'var(--gs-muted)' }}
            >
              {'Đã có tài khoản?'}{' '}
              <Link to="/login" className="auth-link-action ml-2">
                {'Đăng nhập'}
              </Link>
            </div>

          </Form>
        )}

        {/* STEP 2 OTP */}
        {step === 'otp' && (
          <Form layout="vertical" onFinish={handleVerifyOtp}>

            {settings.auth.demoOtpEnabled && otpPreview && (
              <div className="mb-3 text-center text-orange-500">
                OTP demo: <b>{otpPreview}</b>
              </div>
            )}

            <Text style={{ color: 'var(--gs-text)' }}>
              {'Nhập mã OTP'}
            </Text>

            <Form.Item
              name="otp"
              rules={[{ required: true, message: 'Vui lòng nhập mã OTP' }]}
            >
              <Input.OTP length={6} style={{ color: 'var(--gs-text)' }} />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={loading}
              disabled={loading}
            >
              {'Xác thực'}
            </Button>

          </Form>
        )}

      </div>
    </div>
  )
}
