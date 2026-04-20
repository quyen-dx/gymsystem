import {
  BulbOutlined,
  CalendarOutlined,
  FundOutlined,
  HeartOutlined,
  HomeOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import {
  Avatar,
  Button,
  Layout,
  Menu,
  Typography,
} from 'antd'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../context/ThemeProvider'
import { useAuth } from '../../hook/useAuth'

const { Header, Content } = Layout
const { Text } = Typography

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // 🔥 theme mới (Antd Provider của mày)
  const { dark, toggleTheme } = useTheme()

  const navItems = [
    { key: '/dashboard/member', label: 'Trang chủ', icon: <HomeOutlined /> },
    { key: '/dashboard/member/booking', label: 'Đặt lịch PT', icon: <CalendarOutlined /> },
    { key: '/dashboard/member/health', label: 'Sức khoẻ', icon: <HeartOutlined /> },
    { key: '/dashboard/member/workout', label: 'Lộ trình', icon: <FundOutlined /> },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>

      {/* HEADER */}
      <Header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: dark ? '#141414' : '#fff',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          padding: '0 24px',
        }}
      >

        {/* LOGO */}
        <div
          onClick={() => navigate('/dashboard/member')}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              background: '#b6462f',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
            }}
          >
            GS
          </div>

          <div style={{ fontWeight: 600 }}>
            GymSystem
          </div>

          <Text type="secondary" style={{ fontSize: 12 }}>
            Member space
          </Text>
        </div>

        {/* NAV */}
        <Menu
          mode="horizontal"
          selectedKeys={[window.location.pathname]}
          items={navItems}
          onClick={(e) => navigate(e.key)}
          style={{
            flex: 1,
            justifyContent: 'center',
            border: 'none',
            background: 'transparent',
          }}
        />

        {/* RIGHT ACTIONS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

          {/* 🔥 TOGGLE THEME */}
          <Button
            icon={<BulbOutlined />}
            onClick={toggleTheme}
          >
            {dark ? 'Light' : 'Dark'}
          </Button>

  
          <div
            onClick={() => navigate('/profile')}
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
          >
            <Avatar
              src={
                user?.avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || '')}`
              }
            />
            <Text strong style={{ color: dark ? '#fff' : '#000' }}>
              {user?.name}
            </Text>
          </div>
          <Button danger icon={<LogoutOutlined />} onClick={logout}>
            Đăng xuất
          </Button>

        </div>

      </Header>

      {/* CONTENT */}
      <Content
        style={{
          padding: 24,
          background: dark ? '#0f0f0f' : '#f5f5f5',
          minHeight: '100vh',
        }}
      >
        {children}
      </Content>

    </Layout>
  )
}