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
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation } from 'react-router-dom'
import { useTheme } from '../../../context/ThemeProvider'
import { useSystemSettings } from '../../../context/SystemSettingsContext'
import { useAuth } from '../../../hooks/useAuth'
import AccountProfileModal from '../../../pages/auth/AccountProfileModal'
import AdminAIChatWidget from '../../chat/AdminAIChatWidget'
import LanguageSelect from '../../common/LanguageSelect'
import { getPendingPartnershipRequestCount } from '../../../services/partnershipRequestService'

const { Text } = Typography

const getViewRoleFromPath = (pathname: string, actualRole?: string) => {
  if (pathname.startsWith('/staff')) return 'staff'
  if (pathname.startsWith('/pt')) return 'pt'
  if (pathname.startsWith('/seller')) return 'seller'
  if (pathname.startsWith('/member') || pathname.startsWith('/user')) return 'member'
  if (pathname.startsWith('/admin')) return 'admin'
  return actualRole || 'member'
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const { settings, isEnabled } = useSystemSettings()
  const [accountOpen, setAccountOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { dark } = useTheme()
  const location = useLocation()

  const actualRole = user?.role
  const viewRole = getViewRoleFromPath(location.pathname, actualRole)

  useEffect(() => {
    if (user?.role === 'admin') {
      getPendingPartnershipRequestCount()
        .then((res) => setPendingCount(res.data.count || 0))
        .catch(() => { })
    }
  }, [user?.role])

  const roleMenus: Record<string, any[]> = {
    admin: [
      { key: '/', label: t('nav.website'), icon: <HomeOutlined /> },
      { key: '/admin', label: t('nav.overview'), icon: <DashboardOutlined /> },
      { key: '/admin/users', label: t('nav.users'), icon: <UserOutlined /> },
      ...(isEnabled('billing.allowPlanPurchase') ? [{ key: '/admin/plans', label: t('nav.plans'), icon: <CalendarOutlined /> }] : []),
      {
        key: '/admin/partnerships',
        label: (
          <span style={{ position: 'relative', display: 'inline-block', paddingRight: 22 }}>
            <span>{t('nav.partnerships')}</span>
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

      { key: '/admin/members', label: t('nav.members'), icon: <TeamOutlined /> },
      ...(isEnabled('pt.moduleEnabled') ? [{ key: '/admin/trainers', label: `${t('nav.trainers')} (PT)`, icon: <UserOutlined /> }] : []),
      ...(isEnabled('reports.revenueChartEnabled') ? [{ key: '/admin/reports', label: t('nav.reports'), icon: <BarChartOutlined /> }] : []),
      { key: '/admin/faqs', label: t('nav.faq_manager'), icon: <QuestionCircleOutlined /> },
      { key: '/admin/feedback', label: t('nav.feedback_manager'), icon: <CommentOutlined /> },
      { key: '/admin/policies', label: t('nav.policies'), icon: <FileTextOutlined /> },
      { key: '/admin/system-settings', label: t('nav.system_settings'), icon: <SettingOutlined /> },
    ],
    staff: [
      { key: '/', label: t('nav.website'), icon: <HomeOutlined /> },
      ...(isEnabled('checkin.qrCheckinEnabled') ? [{ key: '/staff/checkin', label: t('nav.checkin'), icon: <DashboardOutlined /> }] : []),
      { key: '/staff/members', label: t('nav.members'), icon: <TeamOutlined /> },
      { key: '/staff/payments', label: t('nav.payments'), icon: <CreditCardOutlined /> },
      { key: '/staff/notifications', label: t('nav.notifications'), icon: <CommentOutlined /> },
    ],
    pt: [
      { key: '/', label: t('nav.website'), icon: <HomeOutlined /> },
      ...(isEnabled('pt.scheduleEnabled') ? [{ key: '/pt/schedule', label: t('nav.schedule'), icon: <CalendarOutlined /> }] : []),
      ...(isEnabled('pt.moduleEnabled') ? [
        { key: '/pt/clients', label: t('nav.clients'), icon: <TeamOutlined /> },
        { key: '/pt/workouts', label: t('nav.workout'), icon: <FileTextOutlined /> },
        { key: '/pt/bookings', label: t('nav.bookings'), icon: <CalendarOutlined /> },
      ] : []),
    ],
    seller: [
      { key: '/', label: t('nav.website'), icon: <HomeOutlined /> },
      ...(isEnabled('shop.productStoreEnabled') ? [
        { key: '/seller/products', label: t('nav.my_products'), icon: <ShopOutlined /> },
        { key: '/seller/orders', label: t('nav.orders'), icon: <ShoppingCartOutlined /> },
        { key: '/seller/shop', label: t('nav.shop'), icon: <ShopOutlined /> },
        { key: '/seller/revenue', label: t('nav.revenue'), icon: <BarChartOutlined /> },
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
      {settings.general.logoUrl ? <img src={settings.general.logoUrl} alt={settings.general.siteName} style={{ maxHeight: 30 }} /> : `${t(`role.${viewRole}`)} Dashboard`}
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

      {actualRole === 'admin' && viewRole !== 'admin' && (
        <NavLink
          to="/admin"
          className="dashboard-sidebar-item"
          onClick={closeSidebar}
          style={{ margin: '4px 0' }}
        >
          <span className="dashboard-sidebar-icon"><DashboardOutlined /></span>
          <span className="dashboard-sidebar-label">{t('admin.backToAdmin')}</span>
        </NavLink>
      )}

      <Divider />

      <div style={{ padding: '0 16px 12px' }}>
        <LanguageSelect />
      </div>

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

      <AccountProfileModal open={accountOpen} onClose={() => setAccountOpen(false)} />

      {settings.ai.floatingChatbotEnabled && settings.ai.adminAiEnabled && <AdminAIChatWidget />}
    </div>
  )
}
