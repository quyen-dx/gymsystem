import {
  BarChartOutlined,
  CalendarOutlined,
  CommentOutlined,
  CreditCardOutlined,
  DashboardOutlined,
  FileTextOutlined,
  HomeOutlined,
  LogoutOutlined,
  MenuOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
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
  Typography,
} from 'antd'
import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useSystemSettings } from '../../../context/SystemSettingsContext'
import { useAuth } from '../../../hooks/useAuth'
import AdminAIChatWidget from '../../chat/AdminAIChatWidget'
import { getPendingPartnershipRequestCount } from '../../../services/partnershipRequestService'
import { getUserDisplayName, getUserInitialName } from '../../../utils/userDisplay'

const { Text } = Typography

const getViewRoleFromPath = (pathname: string, actualRole?: string) => {
  if (pathname.startsWith('/staff')) return 'staff'
  if (pathname.startsWith('/pt')) return 'pt'
  if (pathname.startsWith('/seller')) return 'seller'
  if (pathname.startsWith('/member') || pathname.startsWith('/user')) return 'member'
  if (pathname.startsWith('/admin')) return 'admin'
  if (actualRole === 'super_admin') return 'admin'
  return actualRole || 'member'
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const { settings, isEnabled } = useSystemSettings()
  const navigate = useNavigate()
  const [pendingCount, setPendingCount] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const location = useLocation()

  const actualRole = user?.role
  const viewRole = getViewRoleFromPath(location.pathname, actualRole)
  const roleLabel: Record<string, string> = { admin: 'Quản trị', staff: 'Nhân viên', pt: 'PT', seller: 'Người bán', member: 'Thành viên' }
  const displayName = getUserDisplayName(user, 'Tài khoản')
  const avatarName = getUserInitialName(user, 'U')

  useEffect(() => {
    if (user?.role === 'super_admin' || user?.role === 'admin') {
      getPendingPartnershipRequestCount()
        .then((res) => setPendingCount(res.data.count || 0))
        .catch(() => { })
    }
  }, [user?.role])

  const roleMenus: Record<string, any[]> = {
    admin: [
      { key: '/', label: 'Trang chủ', icon: <HomeOutlined /> },
      { key: '/admin', label: 'Tổng quan', icon: <DashboardOutlined /> },
      { key: '/admin/users', label: 'Người dùng', icon: <UserOutlined /> },
      ...(isEnabled('billing.allowPlanPurchase') ? [{ key: '/admin/plans', label: 'Gói tập', icon: <CalendarOutlined /> }] : []),
      {
        key: '/admin/partnerships',
        label: (
          <span style={{ position: 'relative', display: 'inline-block', paddingRight: 22 }}>
            <span>{'Đối tác'}</span>
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
                  backgroundColor: 'var(--gs-danger)',
                  color: 'var(--gs-text)',
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

      { key: '/admin/members', label: 'Hội viên', icon: <TeamOutlined /> },
      ...(isEnabled('pt.moduleEnabled') ? [{ key: '/admin/trainers', label: `${'Huấn luyện viên'} (PT)`, icon: <UserOutlined /> }] : []),
      ...(isEnabled('reports.revenueChartEnabled') ? [{ key: '/admin/reports', label: 'Báo cáo', icon: <BarChartOutlined /> }] : []),
      { key: '/admin/faqs', label: 'Quản lý FAQ', icon: <QuestionCircleOutlined /> },
      { key: '/admin/feedback', label: 'Quản lý phản hồi', icon: <CommentOutlined /> },
      { key: '/admin/policies', label: 'Chính sách', icon: <FileTextOutlined /> },
      { key: '/admin/system-settings', label: 'Cài đặt hệ thống', icon: <SettingOutlined /> },
    ],
    staff: [
      { key: '/', label: 'Trang chủ', icon: <HomeOutlined /> },
      ...(isEnabled('checkin.qrCheckinEnabled') ? [{ key: '/staff/checkin', label: 'Check-in', icon: <DashboardOutlined /> }] : []),
      { key: '/staff/members', label: 'Hội viên', icon: <TeamOutlined /> },
      { key: '/staff/payments', label: 'Thanh toán', icon: <CreditCardOutlined /> },
      { key: '/staff/notifications', label: 'Thông báo', icon: <CommentOutlined /> },
    ],
    pt: [
      { key: '/', label: 'Trang chủ', icon: <HomeOutlined /> },
      ...(isEnabled('pt.scheduleEnabled') ? [{ key: '/pt/schedule', label: 'Lịch trình', icon: <CalendarOutlined /> }] : []),
      ...(isEnabled('pt.moduleEnabled') ? [
        { key: '/pt/clients', label: 'Khách hàng', icon: <TeamOutlined /> },
        { key: '/pt/workouts', label: 'Bài tập', icon: <FileTextOutlined /> },
      ] : []),
    ],
    seller: [
      { key: '/', label: 'Trang chủ', icon: <HomeOutlined /> },
      ...(isEnabled('shop.productStoreEnabled') ? [
        { key: '/seller/products', label: 'Sản phẩm của tôi', icon: <ShopOutlined /> },
        { key: '/seller/orders', label: 'Đơn hàng', icon: <ShoppingCartOutlined /> },
        { key: '/seller/shop', label: 'Cửa hàng', icon: <ShopOutlined /> },
        { key: '/seller/revenue', label: 'Doanh thu', icon: <BarChartOutlined /> },
      ] : []),
    ],
    member: []
  }

  const items = roleMenus[viewRole] || []

  const closeSidebar = () => setSidebarOpen(false)

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
      {settings.general.logoUrl ? <img src={settings.general.logoUrl} alt={settings.general.siteName} style={{ maxHeight: 30 }} /> : `${roleLabel[viewRole] || viewRole} Dashboard`}
    </div>
  )

  const sidebarMenu = (
    <>
      <nav className="dashboard-sidebar-menu" aria-label="Dashboard navigation">
        {items.map((item) => (
          <NavLink
            key={item.key}
            to={item.key}
            end={item.key === '/' || item.key === '/admin'}
            className={({ isActive }) => `dashboard-sidebar-item${isActive ? ' is-active' : ''}`}
            onClick={closeSidebar}
          >
            <span className="dashboard-sidebar-icon">{item.icon}</span>
            <span className="dashboard-sidebar-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {(actualRole === 'super_admin' || actualRole === 'admin') && viewRole !== 'admin' && (
        <NavLink
          to="/admin"
          className="dashboard-sidebar-item"
          onClick={closeSidebar}
          style={{ margin: '4px 0' }}
        >
          <span className="dashboard-sidebar-icon"><DashboardOutlined /></span>
          <span className="dashboard-sidebar-label">{'Quay lại Admin'}</span>
        </NavLink>
      )}

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
          onClick={() => { navigate('/account/profile'); closeSidebar() }}
        >
          <Avatar
            size={44}
            src={
              user?.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarName)}`
            }
          />

          <div>
            <div style={{ fontWeight: 600, color: 'var(--theme-text)' }}>
              {displayName}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {user?.role}
            </Text>
          </div>
        </div>

        <Button icon={<LogoutOutlined />} danger block onClick={logout}>
          {'Đăng xuất'}
        </Button>
      </div>
    </>
  )

  return (
    <div className="dashboard-layout-root">

      {/* DESKTOP SIDEBAR */}
      <div className="dashboard-desktop-sider" style={{ background: 'var(--theme-card)', color: 'var(--theme-text)' }}>
        {sidebarBranding}
        {sidebarMenu}
      </div>

      {/* MAIN: mobile header + content */}
      <div className="dashboard-inner">
        {/* MOBILE HEADER + DRAWER */}
        <div className="dashboard-mobile-header">
          <Button
            type="text"
            icon={<MenuOutlined style={{ fontSize: 20, color: 'var(--theme-text)' }} />}
            onClick={() => setSidebarOpen(true)}
          />
          <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: 2, color: 'var(--theme-text)' }}>
            {settings.general.siteName}
          </div>
          <Avatar
            size={32}
            src={
              user?.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarName)}`
            }
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/account/profile')}
          />
        </div>

        <Drawer
          className="dashboard-mobile-drawer"
          title={null}
          placement="left"
          open={sidebarOpen}
          onClose={closeSidebar}
          size={280}
          closable={false}
          mask={{ closable: true }}
          styles={{ body: { padding: 0, background: 'var(--theme-card)' } }}
        >
          <div className="dashboard-drawer-close">
            <span className="drawer-brand">{settings.general.siteName}</span>
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
        <div
          className="dashboard-content"
          style={{
            background: 'var(--theme-bg)',
            color: 'var(--theme-text)',
          }}
        >
          {children}
        </div>
      </div>

      {settings.ai.systemAiEnabled && settings.ai.adminAiEnabled && <AdminAIChatWidget />}
    </div>
  )
}
