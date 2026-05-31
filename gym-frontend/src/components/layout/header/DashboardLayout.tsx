import {
  BarChartOutlined,
  CalendarOutlined,
  CommentOutlined,
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
  Layout,
  Menu,
  Typography,
} from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '../../../context/ThemeProvider'
import { useSystemSettings } from '../../../context/SystemSettingsContext'
import { useAuth } from '../../../hooks/useAuth'
import AccountProfileModal from '../../../pages/auth/AccountProfileModal'
import AdminAIChatWidget from '../../chat/AdminAIChatWidget'
import { getPendingPartnershipRequestCount } from '../../../services/partnershipRequestService'
import { systemExperienceService } from '../../../services/systemExperienceService'

const { Sider, Content } = Layout
const { Text } = Typography

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const { settings, isEnabled } = useSystemSettings()
  const [accountOpen, setAccountOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [branding, setBranding] = useState({ gymName: 'GymPro', logoUrl: '' })
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

  useEffect(() => {
    systemExperienceService.getSettings()
      .then((res) => {
        const settings = res.data.settings || {}
        setBranding({ gymName: settings.gymName || 'GymPro', logoUrl: settings.logoUrl || '' })
        if (settings.faviconUrl) {
          const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null
          if (link) link.href = settings.faviconUrl
        }
      })
      .catch(() => { })
  }, [])

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

      { key: '/admin/members', label: t('nav.members'), icon: <TeamOutlined /> },
      ...(isEnabled('pt.moduleEnabled') ? [{ key: '/admin/pts', label: `${t('nav.trainers')} (PT)`, icon: <UserOutlined /> }] : []),
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
    ],
    pt: [
      { key: '/', label: t('nav.website'), icon: <HomeOutlined /> },
      ...(isEnabled('pt.scheduleEnabled') ? [{ key: '/pt/schedule', label: t('nav.schedule'), icon: <CalendarOutlined /> }] : []),
      ...(isEnabled('pt.moduleEnabled') ? [{ key: '/pt/student', label: t('nav.students'), icon: <TeamOutlined /> }] : []),
    ],
    seller: [
      { key: '/', label: t('nav.website'), icon: <HomeOutlined /> },
      ...(isEnabled('shop.productStoreEnabled') ? [
        { key: '/seller/products', label: t('nav.my_products'), icon: <ShopOutlined /> },
        { key: '/seller/orders', label: t('nav.orders'), icon: <ShoppingCartOutlined /> },
      ] : []),
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
      {branding.logoUrl ? <img src={branding.logoUrl} alt={branding.gymName} style={{ maxHeight: 30 }} /> : `${branding.gymName} DASHBOARD`}
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

      {settings.ai.floatingChatbotEnabled && settings.ai.adminAiEnabled && <AdminAIChatWidget />}
    </Layout>
  )
}
