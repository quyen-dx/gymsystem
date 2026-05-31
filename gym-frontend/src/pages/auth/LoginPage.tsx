import {
  EyeInvisibleOutlined,
  EyeTwoTone,
  FacebookFilled,
  GoogleOutlined,
} from '@ant-design/icons'
import { Button, Divider, Form, Input, Typography, message } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import LanguageSelect from '../../components/common/LanguageSelect'
import TypewriterSlogans from '../../components/system/TypewriterSlogans'
import { API_URL } from '../../config/env'
import { useTheme } from '../../context/ThemeProvider'
import { useSystemSettings } from '../../context/SystemSettingsContext'
import { useAuth } from '../../hooks/useAuth'
import { getErrorMessage } from '../../utils/errorMessages'
import { getLocalizedText } from '../../utils/localization'

const { Title } = Typography

const getDashboardPath = (role: string) => {
  if (role === 'admin') return '/admin'
  if (role === 'seller') return '/seller'
  if (role === 'staff') return '/staff'
  if (role === 'pt') return '/pt'
  return '/'
}

const pickLocalizedSlogans = (slogans: Array<{ vi?: string; en?: string }> = [], language: string) => {
  return slogans
    .map((item) => getLocalizedText(item, language, ''))
    .filter(Boolean)
}

export default function LoginPage() {
  const { t, i18n } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const { dark } = useTheme()
  const { settings } = useSystemSettings()

  const [loading, setLoading] = useState(false)
  const slogans = pickLocalizedSlogans(settings.general.slogans, i18n.language)

  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      const user = await login({
        provider: 'phone',
        identifier: values.phone,
        password: values.password,
      })

      message.success(t('login.success'))
      setTimeout(() => navigate(getDashboardPath(user.role)), 500)
    } catch (err: any) {
      const errorCode = err.response?.data?.code
      if (errorCode === 'MAINTENANCE_MODE') {
        navigate('/maintenance', { replace: true })
        return
      }
      message.error(getErrorMessage(t, err.response?.data?.message, 'login.failed', errorCode))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = () => {
    window.location.href = `${API_URL}/auth/google`
  }
  const handleFacebook = () => {
    window.location.href = `${API_URL}/auth/facebook`
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
        className={`relative z-10 w-full max-w-sm rounded-2xl p-7 shadow-2xl transition-all
          ${dark ? 'bg-[#141414] text-white' : 'bg-[#484848] text-[#edebe6]'}
        `}
        style={{ border: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #5a5a5a' }}
      >
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-[var(--theme-accent)] font-black text-[var(--theme-button-text)]">
            {settings.general.logoUrl ? <img src={settings.general.logoUrl} alt={settings.general.siteName} className="h-full w-full object-cover" /> : 'GP'}
          </div>
          <div className="text-lg font-black tracking-wide text-[var(--theme-text)]">{settings.general.siteName}</div>
          {slogans.length > 0 && (
            <TypewriterSlogans
              slogans={slogans}
              language={i18n.language}
              className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--theme-accent)]"
            />
          )}
        </div>

        {/* TITLE */}
        <Title
          level={3}
          style={{
            textAlign: 'center',
            marginBottom: 24,
            color: dark ? '#fff' : '#edebe6',
          }}
        >
          {t('login.title')}
        </Title>
        {/* FORM */}
        <Form layout="vertical" onFinish={handleSubmit}>

          <Form.Item
            label={<span style={{ color: dark ? '#fff' : '#edebe6' }}>{t('login.label')}</span>}
            name="phone"
            rules={[{ required: true, message: t('login.required') }]}
          >
            <Input size="large" placeholder={t('login.placeholder')} style={!dark ? { background: '#525252', borderColor: '#5a5a5a', color: '#edebe6' } : undefined} />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: dark ? '#fff' : '#edebe6' }}>{t('login.password_label')}</span>}
            name="password"
            rules={[{ required: true, message: t('login.password_required') }]}
          >
            <Input.Password
              size="large"
              placeholder={t('login.password_placeholder')}
              style={!dark ? { background: '#525252', borderColor: '#5a5a5a', color: '#edebe6' } : undefined}
              iconRender={(v) =>
                v ? <EyeTwoTone /> : <EyeInvisibleOutlined />
              }
            />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={loading}
          >
            {t('login.submit')}
          </Button>

          {(settings.auth.forgotPasswordEmailEnabled || settings.auth.forgotPasswordSmsOtpEnabled) && (
            <div className="text-right mt-2">
              <Link to="/forgot-password" className="text-sm" style={{ color: '#ffffff' }}>
                {t('login.forgot_password')}
              </Link>
            </div>
          )}

        </Form>

        {(settings.auth.googleOAuthEnabled || settings.auth.facebookOAuthEnabled) && <Divider>{t('login.divider')}</Divider>}

        {/* SOCIAL */}
        {settings.auth.googleOAuthEnabled && (
          <Button
            icon={<GoogleOutlined />}
            block
            size="large"
            onClick={handleGoogle}
          >
            Google
          </Button>
        )}

        {settings.auth.facebookOAuthEnabled && (
          <Button
            icon={<FacebookFilled />}
            block
            size="large"
            className="mt-3"
            onClick={handleFacebook}
          >
            Facebook
          </Button>
        )}

        {/* REGISTER */}
        {settings.auth.allowRegistration && (
          <div
            className={`text-center mt-6 text-sm ${dark ? 'text-gray-300' : 'text-[rgba(237,235,230,0.65)]'
              }`}
          >
            {t('login.no_account')}{' '}
            <Link to="/register" className="font-semibold" style={{ color: 'var(--theme-accent)' }}>
              {t('login.register')}
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
