import {
  EyeInvisibleOutlined,
  EyeTwoTone,
  FacebookFilled,
  GoogleOutlined,
  MoonOutlined,
  SunOutlined,
} from '@ant-design/icons'
import { Button, Divider, Form, Input, Typography, message } from 'antd'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTheme } from '../../context/ThemeProvider'
import { useAuth } from '../../hook/useAuth'

const { Title } = Typography

const getDashboardPath = (role: string) => {
  if (role === 'admin') return '/dashboard/admin'
  if (role === 'seller') return '/dashboard/seller/products'
  if (role === 'staff') return '/dashboard/staff'
  if (role === 'pt') return '/dashboard/pt'
  return '/dashboard/member'
}

export default function LoginPage() {

  const { login } = useAuth()
  const navigate = useNavigate()
  const { dark, toggleTheme } = useTheme()

  const [loading, setLoading] = useState(false)

  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      const user = await login({
        provider: 'phone', // giữ nguyên field này nhưng backend sẽ ignore
        identifier: values.phone,
        password: values.password,
      })

      message.success('Đăng nhập thành công')
      setTimeout(() => navigate(getDashboardPath(user.role)), 500)
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = () => {
    window.location.href =
      (import.meta.env.VITE_API_URL || 'http://localhost:5000/api') +
      '/auth/google'
  }
  const handleFacebook = () => {
    window.location.href =
      (import.meta.env.VITE_API_URL || 'http://localhost:5000/api') +
      '/auth/facebook'
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
        className={`relative z-10 w-full max-w-sm rounded-2xl p-7 shadow-2xl transition-all
          ${dark ? 'bg-[#141414] text-white' : 'bg-white text-black'}
        `}
      >

        {/* TITLE */}
        <Title
          level={3}
          style={{
            textAlign: 'center',
            marginBottom: 24,
            color: dark ? '#fff' : '#000',
          }}
        >
          Đăng nhập
        </Title>
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          <Button
            shape="circle"
            onClick={toggleTheme}
            icon={dark ? <SunOutlined /> : <MoonOutlined />}
          />
        </div>
        {/* FORM */}
        <Form layout="vertical" onFinish={handleSubmit}>

          <Form.Item
            label={<span style={{ color: dark ? '#fff' : '#000' }}>Số điện thoại / Email / Username</span>}
            name="phone"
            rules={[{ required: true, message: 'Nhập thông tin đăng nhập' }]}
          >
            <Input size="large" placeholder="Số điện thoại, email hoặc username" />
          </Form.Item>

          <Form.Item
            label={<span style={{ color: dark ? '#fff' : '#000' }}>Mật khẩu</span>}
            name="password"
            rules={[{ required: true, message: 'Nhập mật khẩu' }]}
          >
            <Input.Password
              size="large"
              placeholder="Mật khẩu"
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
            Đăng nhập
          </Button>

          <div className="text-right mt-2">
            <Link to="/forgot-password" className="text-sm text-blue-500">
              Quên mật khẩu?
            </Link>
          </div>

        </Form>

        <Divider>Hoặc</Divider>

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
          className={`text-center mt-6 text-sm ${dark ? 'text-gray-300' : 'text-black'
            }`}
        >
          Chưa có tài khoản?{' '}
          <Link to="/register" className="text-orange-500 font-semibold">
            Đăng ký
          </Link>
        </div>

      </div>
    </div>
  )
}
