import { ArrowLeftOutlined } from '@ant-design/icons'
import { Button, Divider, Form, Input, Typography, message } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import LanguageSelect from '../../components/common/LanguageSelect'
import FeatureDisabled from '../../components/system/FeatureDisabled'
import { useTheme } from '../../context/ThemeProvider'
import { useSystemSettings } from '../../context/SystemSettingsContext'
import { useAuth } from '../../hooks/useAuth'
import { authService } from '../../services/authService'
import { getErrorMessage } from '../../utils/errorMessages'
const { Title, Text } = Typography

const registerOtpMessageKey = 'register-send-otp'
const registerVerifyMessageKey = 'register-verify-otp'

export default function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { dark } = useTheme()
  const { updateUser } = useAuth()
  const { settings } = useSystemSettings()

  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [loading, setLoading] = useState(false)

  const [form] = Form.useForm()
  const [otpPreview, setOtpPreview] = useState('')

  if (!settings.auth.allowRegistration) return <FeatureDisabled />

  const handleSendOtp = async (values: any) => {
    if (loading) return
    setLoading(true)
    try {
      const identifier = String(values.phone || '').trim()
      const { data } = await authService.sendRegisterOtp({
        provider: identifier.includes('@') ? 'email' : 'phone',
        name: values.name,
        phone: identifier,
        password: values.password,
      })

      setOtpPreview(data.otpPreview || '')
      setStep('otp')

      message.success({ key: registerOtpMessageKey, content: data.message || t('register.otp_sent') })
    } catch (err: any) {
      message.error({ key: registerOtpMessageKey, content: getErrorMessage(t, err.response?.data?.message, 'register.otp_failed') })
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

      message.success({ key: registerVerifyMessageKey, content: t('register.success') })

      if (data?.accessToken && data?.user) {
        localStorage.setItem('token', data.accessToken)
        updateUser(data.user)
        navigate('/dashboard', { replace: true })
        return
      }

      navigate('/login', { replace: true })
    } catch (err: any) {
      message.error({ key: registerVerifyMessageKey, content: getErrorMessage(t, err.response?.data?.message, 'register.otp_invalid') })
    } finally {
      setLoading(false)
    }
  }

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
          transform: 'scale(1.1)',
        }}
      />

      <div className="absolute inset-0 bg-black/65" />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <LanguageSelect />
      </div>

      {/* CARD */}
      <div
        className={`relative z-10 my-auto w-full max-w-md rounded-2xl p-7 shadow-2xl transition-all
          ${dark ? 'bg-[#141414] text-white' : 'bg-[#484848] text-[#edebe6]'}
        `}
        style={{ border: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #5a5a5a' }}
      >
        {/* HEADER */}
        <div className="flex items-center gap-2 mb-4">

          {step === 'otp' && (
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => setStep('form')}
              disabled={loading}
              style={{ color: dark ? '#fff' : '#edebe6' }}
            />
          )}

          <Title
            level={3}
            style={{
              margin: 0,
              color: dark ? '#fff' : '#edebe6',
            }}
          >
            {t('register.title')}
          </Title>
        </div>
        {/* FORM STEP 1 */}
        {step === 'form' && (
          <Form layout="vertical" form={form} onFinish={handleSendOtp}>

            <Form.Item
              label={<span style={{ color: dark ? '#fff' : '#edebe6' }}>{t('register.fullname')}</span>}
              name="name"
              rules={[{ required: true, message: t('register.fullname_required') }]}
            >
              <Input size="large" style={!dark ? { background: '#525252', borderColor: '#5a5a5a', color: '#edebe6' } : undefined} />
            </Form.Item>

            <Form.Item
              label={<span style={{ color: dark ? '#fff' : '#edebe6' }}>{t('register.phone')}</span>}
              name="phone"
              rules={[{ required: true, message: t('register.phone_required') }]}
            >
              <Input size="large" style={!dark ? { background: '#525252', borderColor: '#5a5a5a', color: '#edebe6' } : undefined} />
            </Form.Item>

            <Form.Item
              label={<span style={{ color: dark ? '#fff' : '#edebe6' }}>{t('register.password')}</span>}
              name="password"
              rules={[{ required: true, message: t('register.password_required') }]}
            >
              <Input.Password size="large" style={!dark ? { background: '#525252', borderColor: '#5a5a5a', color: '#edebe6' } : undefined} />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={loading}
              disabled={loading}
            >
              {t('register.send_otp')}
            </Button>

            <Divider />

            <div
              className="text-center text-sm"
              style={{ color: dark ? '#ccc' : 'rgba(237,235,230,0.65)' }}
            >
              {t('register.has_account')}{' '}
              <Link to="/login" className="font-semibold" style={{ color: 'var(--theme-accent)' }}>
                {t('register.login')}
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

            <Text style={{ color: dark ? '#fff' : '#edebe6' }}>
              {t('register.otp_label')}
            </Text>

            <Form.Item
              name="otp"
              rules={[{ required: true, message: t('register.otp_required') }]}
            >
              <Input.OTP length={6} />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={loading}
              disabled={loading}
            >
              {t('register.otp_verify')}
            </Button>

          </Form>
        )}

      </div>
    </div>
  )
}
