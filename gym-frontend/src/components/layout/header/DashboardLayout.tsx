import {
  BarChartOutlined,
  CalendarOutlined,
  DashboardOutlined,
  HomeOutlined,
  LogoutOutlined,
  MenuOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  Avatar,
  Button,
  Divider,
  Drawer,
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
  const [sidebarOpen, setSidebarOpen] = useState(false)
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
      { key: '/', label: 'Trang web', icon: <HomeOutlined /> },
      { key: '/admin', label: 'Overview', icon: <DashboardOutlined /> },
      { key: '/admin/users', label: 'Users', icon: <UserOutlined /> },
      { key: '/admin/plans', label: 'Plans', icon: <CalendarOutlined /> },
      {
        key: '/admin/partnerships',
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

      { key: '/admin/members', label: 'Members', icon: <TeamOutlined /> },
      { key: '/admin/pts', label: 'Trainers (PT)', icon: <UserOutlined /> },
      { key: '/admin/reports', label: 'Reports', icon: <BarChartOutlined /> },
    ],
    staff: [
      { key: '/', label: 'Trang web', icon: <HomeOutlined /> },
      { key: '/staff/checkin', label: 'Check-in', icon: <DashboardOutlined /> },
      { key: '/staff/members', label: 'Members', icon: <TeamOutlined /> },
    ],
    pt: [
      { key: '/', label: 'Trang web', icon: <HomeOutlined /> },
      { key: '/pt/schedule', label: 'Schedule', icon: <CalendarOutlined /> },
      { key: '/pt/student', label: 'Students', icon: <TeamOutlined /> },
    ],
    seller: [
      { key: '/', label: 'Trang web', icon: <HomeOutlined /> },
      { key: '/seller/products', label: 'My Products', icon: <ShopOutlined /> },
      { key: '/seller/orders', label: 'Đơn hàng', icon: <ShoppingCartOutlined /> },
    ],
    member: []
  }

  const items = roleMenus[user?.role as string] || []

  const closeSidebar = () => setSidebarOpen(false)

  const handleNavigate = (key: string) => {
    navigate(key)
    closeSidebar()
  }

  const sidebarBranding = (
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
  )

  const sidebarMenu = (
    <>
      <Menu
        theme={dark ? 'dark' : 'light'}
        mode="inline"
        selectedKeys={[location.pathname]}
        items={items.map((i) => ({
          key: i.key,
          icon: i.icon,
          label: i.label,
          onClick: () => handleNavigate(i.key),
        }))}
      />

      <Divider />

      <div style={{ padding: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 12,
            cursor: 'pointer',
          }}
          onClick={() => { setAccountOpen(true); closeSidebar() }}
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

        <Button icon={<LogoutOutlined />} danger block onClick={logout}>
          Đăng xuất
        </Button>
      </div>
    </>
  )

  return (
    <Layout className="dashboard-layout-root" style={{ minHeight: '100vh' }}>

      {/* DESKTOP SIDEBAR */}
      <Sider
        className="dashboard-desktop-sider"
        width={260}
        theme={dark ? 'dark' : 'light'}
        style={{ background: 'var(--theme-card)', color: 'var(--theme-text)' }}
      >
        {sidebarBranding}
        {sidebarMenu}
      </Sider>

      {/* MAIN: mobile header + content stacked vertically */}
      <Layout className="dashboard-inner">
        {/* MOBILE HEADER + DRAWER */}
        <div className="dashboard-mobile-header">
          <Button
            type="text"
            icon={<MenuOutlined style={{ fontSize: 20, color: 'var(--theme-text)' }} />}
            onClick={() => setSidebarOpen(true)}
          />
          <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: 2, color: 'var(--theme-text)' }}>
            GYM PRO
          </div>
          <Avatar
            size={32}
            src={
              user?.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || '')}`
            }
            style={{ cursor: 'pointer' }}
            onClick={() => setAccountOpen(true)}
          />
        </div>

        <Drawer
          className="dashboard-mobile-drawer"
          title={null}
          placement="left"
          open={sidebarOpen}
          onClose={closeSidebar}
          width={280}
          closable={false}
          maskClosable={true}
          styles={{ body: { padding: 0, background: 'var(--theme-card)' } }}
        >
          <div className="dashboard-drawer-close">
            <span className="drawer-brand">GYM PRO</span>
            <button
              type="button"
              onClick={closeSidebar}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 18,
                color: 'var(--theme-text)',
                padding: '4px 8px',
                lineHeight: 1,
              }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="dashboard-drawer-scroll">
            {sidebarMenu}
          </div>
        </Drawer>

        {/* CONTENT */}
        <Content
          className="dashboard-content"
          style={{
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
