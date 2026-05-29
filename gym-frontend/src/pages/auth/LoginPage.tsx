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
import { API_URL } from '../../config/env'
import { useTheme } from '../../context/ThemeProvider'
import { useAuth } from '../../hooks/useAuth'

const { Title } = Typography

const getDashboardPath = (role: string) => {
  if (role === 'admin') return '/'
  if (role === 'seller') return '/'
  if (role === 'staff') return '/'
  if (role === 'pt') return '/'
  return '/'
}

export default function LoginPage() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const { dark } = useTheme()

  const [loading, setLoading] = useState(false)

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
      message.error(err.response?.data?.message || t('login.failed'))
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
    <div className="relative flex min-h-screen items-center justify-center overflow-y-auto px-4 py-6 pt-20 sm:overflow-hidden sm:p-0">

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

          <div className="text-right mt-2">
            <Link to="/forgot-password" className="text-sm" style={{ color: '#ffffff' }}>
              {t('login.forgot_password')}
            </Link>
          </div>

        </Form>

        <Divider>{t('login.divider')}</Divider>

        {/* SOCIAL */}
        <Button
          icon={<GoogleOutlined />}
          block
          size="large"
          onClick={handleGoogle}
        >
          Google
        </Button>

        <Button
          icon={<FacebookFilled />}
          block
          size="large"
          className="mt-3"
          onClick={handleFacebook}
        >
          Facebook
        </Button>

        {/* REGISTER */}
        <div
          className={`text-center mt-6 text-sm ${dark ? 'text-gray-300' : 'text-[rgba(237,235,230,0.65)]'
            }`}
        >
          {t('login.no_account')}{' '}
          <Link to="/register" className="font-semibold" style={{ color: 'var(--theme-accent)' }}>
            {t('login.register')}
          </Link>
        </div>

      </div>
    </div>
  )
}
