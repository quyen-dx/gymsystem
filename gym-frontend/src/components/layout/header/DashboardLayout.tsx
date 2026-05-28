import {
  BarChartOutlined,
  CalendarOutlined,
  DashboardOutlined,
  LogoutOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  Avatar,
  Button,
  Divider,
  Layout,
  Menu,
  Typography,
} from 'antd'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '../../../context/ThemeProvider'
import { useAuth } from '../../../hooks/useAuth'
import AccountProfileModal from '../../../pages/auth/AccountProfileModal'
import { getPendingPartnershipRequestCount } from '../../../services/partnershipRequestService'

const { Sider, Content } = Layout
const { Text } = Typography

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const [accountOpen, setAccountOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()

  const { dark } = useTheme()

  useEffect(() => {
    if (user?.role === 'admin') {
      getPendingPartnershipRequestCount()
        .then((res) => setPendingCount(res.data.count || 0))
        .catch(() => { })
    }
  }, [user?.role])

  const roleMenus: Record<string, any[]> = {
    admin: [
      { key: '/dashboard/admin', label: 'Overview', icon: <DashboardOutlined /> },
      { key: '/dashboard/admin/users', label: 'Users', icon: <UserOutlined /> },
      { key: '/dashboard/admin/plans', label: 'Plans', icon: <CalendarOutlined /> },
      {
        key: '/dashboard/admin/partnerships',
        label: (
          <span style={{ position: 'relative', display: 'inline-block', paddingRight: 22 }}>
            <span>Partnerships</span>
            {pendingCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: 0,
                  transform: 'translateY(-50%)',
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: '#ff4d4f',
                  color: '#fff',
                  fontSize: 10,
                  lineHeight: '18px',
                  textAlign: 'center',
                  padding: '0 4px',
                  fontWeight: 600,
                }}
              >
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </span>
        ),
        icon: <TeamOutlined />,
      },

      { key: '/dashboard/admin/members', label: 'Members', icon: <TeamOutlined /> },
      { key: '/dashboard/admin/pts', label: 'Trainers (PT)', icon: <UserOutlined /> },
      { key: '/dashboard/admin/reports', label: 'Reports', icon: <BarChartOutlined /> },
    ],
    staff: [
      { key: '/dashboard/staff/checkin', label: 'Check-in', icon: <DashboardOutlined /> },
      { key: '/dashboard/staff/members', label: 'Members', icon: <TeamOutlined /> },
    ],
    pt: [
      { key: '/dashboard/pt/schedule', label: 'Schedule', icon: <CalendarOutlined /> },
      { key: '/dashboard/pt/student', label: 'Students', icon: <TeamOutlined /> },
    ],
    seller: [
      { key: '/dashboard/seller/products', label: 'My Products', icon: <ShopOutlined /> },
      { key: '/dashboard/seller/orders', label: 'Đơn hàng', icon: <ShoppingCartOutlined /> },
    ],
    member: []
  }

  const items = roleMenus[user?.role as string] || []

  return (
    <Layout style={{ minHeight: '100vh' }}>

      {/* SIDEBAR */}
      <Sider
        width={260}
        theme={dark ? 'dark' : 'light'}
        style={{ background: 'var(--theme-card)', color: 'var(--theme-text)' }}
      >

        {/* LOGO */}
        <div
          style={{
            padding: 20,
            fontWeight: 700,
            fontSize: 16,
            letterSpacing: 2,
            color: 'var(--theme-text)',
          }}
        >
          GP DASHBOARD
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
              <div style={{ fontWeight: 600, color: 'var(--theme-text)' }}>
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
            background: 'var(--theme-bg)',
            color: 'var(--theme-text)',
          }}
        >
          {children}
        </Content>
      </Layout>

      <AccountProfileModal open={accountOpen} onClose={() => setAccountOpen(false)} />

    </Layout>
  )
}
