import {
  BarChartOutlined,
  BulbOutlined,
  CalendarOutlined,
  DashboardOutlined,
  LogoutOutlined,
  TeamOutlined,
  UserOutlined,
  ShopOutlined,
} from '@ant-design/icons'
import {
  Avatar,
  Button,
  Divider,
  Layout,
  Menu,
  Typography,
} from 'antd'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '../../context/ThemeProvider'
import { useAuth } from '../../hook/useAuth'
import AccountProfileModal from '../account/AccountProfileModal'

const { Sider, Content } = Layout
const { Text } = Typography

const roleMenus: Record<string, any[]> = {
  admin: [
    { key: '/dashboard/admin', label: 'Overview', icon: <DashboardOutlined /> },
    { key: '/dashboard/admin/users', label: 'Users', icon: <UserOutlined /> },
    { key: '/dashboard/admin/plans', label: 'Plans', icon: <CalendarOutlined /> },
    { key: '/dashboard/admin/shop', label: 'Shop', icon: <BulbOutlined /> },
    { key: '/dashboard/admin/members', label: 'Members', icon: <TeamOutlined /> },
    { key: '/dashboard/admin/pts', label: 'Trainers (PT)', icon: <UserOutlined /> },
    { key: '/dashboard/admin/reports', label: 'Reports', icon: <BarChartOutlined /> },
  ],
  staff: [
    { key: '/dashboard/staff', label: 'Check-in', icon: <DashboardOutlined /> },
    { key: '/dashboard/staff/members', label: 'Members', icon: <TeamOutlined /> },
  ],
  pt: [
    { key: '/dashboard/pt', label: 'Schedule', icon: <CalendarOutlined /> },
    { key: '/dashboard/pt/members', label: 'Students', icon: <TeamOutlined /> },
  ],
  seller: [
    { key: '/dashboard/seller/products', label: 'My Products', icon: <ShopOutlined /> },
  ],
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const [accountOpen, setAccountOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const { dark, toggleTheme } = useTheme()

  const items = roleMenus[user?.role as string] || []

  return (
    <Layout style={{ minHeight: '100vh' }}>

      {/* SIDEBAR */}
      <Sider
        width={260}
        theme={dark ? 'dark' : 'light'}
      >

        {/* LOGO */}
        <div
          style={{
            padding: 20,
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: 2,
            color: dark ? '#fff' : '#000',
          }}
        >
          GS DASHBOARD
        </div>

        {/* 🔥 THEME TOGGLE BUTTON */}
        <div style={{ padding: '0 16px 10px' }}>
          <Button
            icon={<BulbOutlined />}
            onClick={toggleTheme}
            block
          >
            {dark ? 'Light mode' : 'Dark mode'}
          </Button>
        </div>

        <Menu
          theme={dark ? 'dark' : 'light'}
          mode="inline"
          selectedKeys={[location.pathname]}
          items={items.map((i) => ({
            key: i.key,
            icon: i.icon,
            label: i.label,
            onClick: () => navigate(i.key),
          }))}
        />

        <Divider />

        {/* USER CARD */}
        <div style={{ padding: 16 }}>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 12,
              cursor: 'pointer',
            }}
            onClick={() => setAccountOpen(true)}
          >
            <Avatar
              size={44}
              src={
                user?.avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || '')}`
              }
            />

            <div>
              <div style={{ fontWeight: 600, color: dark ? '#fff' : '#000' }}>
                {user?.name}
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {user?.role}
              </Text>
            </div>
          </div>

          <Button
            icon={<LogoutOutlined />}
            danger
            block
            onClick={logout}
          >
            Đăng xuất
          </Button>

        </div>

      </Sider>

      {/* CONTENT */}
      <Layout>
        <Content
          style={{
            padding: 24,
            background: dark ? '#0f0f0f' : '#f5f5f5',
          }}
        >
          {children}
        </Content>
      </Layout>

      <AccountProfileModal open={accountOpen} onClose={() => setAccountOpen(false)} />

    </Layout>
  )
}
