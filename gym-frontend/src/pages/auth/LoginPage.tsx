import {
  EyeInvisibleOutlined,
  EyeTwoTone,
  FacebookFilled,
} from '@ant-design/icons'
import { Button, Divider, Form, Input, Typography, message } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import LanguageSelect from '../../components/common/LanguageSelect'
import TypewriterSlogans from '../../components/system/TypewriterSlogans'
import { API_URL } from '../../config/env'
import { useSystemSettings } from '../../context/SystemSettingsContext'
import { useAuth } from '../../hooks/useAuth'
import { getErrorMessage } from '../../utils/errorMessages'
import { getLocalizedText } from '../../utils/localization'

const { Title } = Typography

const socialButtonStyle = {
  background: 'var(--gs-card)',
  borderColor: 'var(--gs-border)',
  color: 'var(--gs-text)',
}

const GoogleBrandIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.35 0-4.34-1.59-5.05-3.72H.94v2.33A9 9 0 0 0 9 18Z" />
    <path fill="#FBBC05" d="M3.95 10.7A5.41 5.41 0 0 1 3.67 9c0-.59.1-1.16.28-1.7V4.97H.94A9 9 0 0 0 0 9c0 1.45.35 2.82.94 4.03l3.01-2.33Z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.42 0 9 0A9 9 0 0 0 .94 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58Z" />
  </svg>
)

const getDashboardPath = (role: string) => {
  if (role === 'super_admin' || role === 'admin') return '/admin'
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

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <LanguageSelect />
      </div>

      {/* CARD */}
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl p-7 shadow-2xl transition-all"
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
                language={i18n.language}
                className="mt-1 text-xs font-semibold uppercase tracking-[0.18em]"
              />
            </div>
          )}
        </div>

        {/* TITLE */}
        <Title
          level={3}
          style={{
            textAlign: 'center',
            marginBottom: 24,
            color: 'var(--gs-text)',
          }}
        >
          {t('login.title')}
        </Title>
        {/* FORM */}
        <Form layout="vertical" onFinish={handleSubmit}>

          <Form.Item
            label={<span style={{ color: 'var(--gs-text)' }}>{t('login.label')}</span>}
            name="phone"
            rules={[{ required: true, message: t('login.required') }]}
          >
            <Input size="large" placeholder={t('login.placeholder')} style={{ background: 'var(--gs-input-bg)', borderColor: 'var(--gs-border)', color: 'var(--gs-text)' }} />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: 'var(--gs-text)' }}>{t('login.password_label')}</span>}
            name="password"
            rules={[{ required: true, message: t('login.password_required') }]}
          >
            <Input.Password
              size="large"
              placeholder={t('login.password_placeholder')}
              style={{ background: 'var(--gs-input-bg)', borderColor: 'var(--gs-border)', color: 'var(--gs-text)' }}
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
              <Link to="/forgot-password" className="auth-link-action text-sm">
                {t('login.forgot_password')}
              </Link>
            </div>
          )}

        </Form>

        {(settings.auth.googleOAuthEnabled || settings.auth.facebookOAuthEnabled) && <Divider style={{ borderColor: 'var(--gs-border)' }}>{t('login.divider')}</Divider>}

        {/* SOCIAL */}
        {settings.auth.googleOAuthEnabled && (
          <Button
            icon={<GoogleBrandIcon />}
            block
            size="large"
            onClick={handleGoogle}
            style={socialButtonStyle}
          >
            Google
          </Button>
        )}

        {settings.auth.facebookOAuthEnabled && (
          <Button
            icon={<FacebookFilled style={{ color: '#1877F2' }} />}
            block
            size="large"
            className="mt-3"
            onClick={handleFacebook}
            style={socialButtonStyle}
          >
            Facebook
          </Button>
        )}

        {/* REGISTER */}
        {settings.auth.allowRegistration && (
          <div
            className="text-center mt-6 text-sm text-[var(--gs-muted)]"
          >
            {t('login.no_account')}{' '}
            <Link to="/register" className="auth-link-action ml-2">
              {t('login.register')}
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
