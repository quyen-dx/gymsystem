import {
  BarChartOutlined,
  BellOutlined,
  CalendarOutlined,
  CommentOutlined,
  CreditCardOutlined,
  DashboardOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  HomeOutlined,
  LogoutOutlined,
  MenuOutlined,
  MoneyCollectOutlined,
  QuestionCircleOutlined,
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
import { usePtRequests } from '../../../context/PtRequestProvider'
import { useSystemSettings } from '../../../context/SystemSettingsContext'
import { useAuth } from '../../../hooks/useAuth'
import { membershipService } from '../../../services/membershipService'
import { notificationService } from '../../../services/notificationService'
import { getPendingPartnershipRequestCount } from '../../../services/partnershipRequestService'
import { shiftChangeService } from '../../../services/shiftChangeService'
import { ptAssignmentEndService } from '../../../services/ptAssignmentEndService'
import { workoutService } from '../../../services/workoutService'
import { socketService } from '../../../services/socketService'
import NotificationBell from '../../notifications/NotificationBell'
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
  const [pendingRefundCount, setPendingRefundCount] = useState(0)
  const [pendingShiftChangeCount, setPendingShiftChangeCount] = useState(0)
  const [pendingEndRequestCount, setPendingEndRequestCount] = useState(0)
  const [pendingWorkoutReportCount, setPendingWorkoutReportCount] = useState(0)
  const [pendingNotificationCount, setPendingNotificationCount] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { badgeCount: pt1on1BadgeCount, groupBadgeCount } = usePtRequests()
  const membersPendingTotal = pt1on1BadgeCount + groupBadgeCount

  useEffect(() => {
    if (sidebarOpen) window.dispatchEvent(new CustomEvent('gympro:overlay-open'))
  }, [sidebarOpen])

  const location = useLocation()

  const actualRole = user?.role
  const viewRole = getViewRoleFromPath(location.pathname, actualRole)
  const roleLabel: Record<string, string> = { admin: 'Quản trị', staff: 'Nhân viên', pt: 'PT', seller: 'Người bán', member: 'Thành viên' }
  const displayName = getUserDisplayName(user, 'Tài khoản')
  const avatarName = getUserInitialName(user, 'U')

  useEffect(() => {
    const loadCounts = async () => {
      if (user?.role === 'super_admin' || user?.role === 'admin') {
        getPendingPartnershipRequestCount()
          .then((res) => setPendingCount(res.data.count || 0))
          .catch(() => { })
      }
      if (user?.role === 'staff' || user?.role === 'super_admin' || user?.role === 'admin') {
        membershipService.getPendingRefundRequestCount()
          .then((res) => setPendingRefundCount(res.data.count || 0))
          .catch(() => { })
      }
    }
    loadCounts()
    const interval = setInterval(loadCounts, 30000)
    return () => clearInterval(interval)
  }, [user?.role])

  useEffect(() => {
    socketService.connect()
    const handler = (data: { count: number }) => setPendingRefundCount(data.count)
    socketService.on('refund_request_update', handler)
    return () => {
      socketService.off('refund_request_update', handler)
    }
  }, [])

  // PT end request count: fetch + socket
  useEffect(() => {
    if (!['admin', 'super_admin'].includes(user?.role || '')) return

    ptAssignmentEndService.getAllRequests({ status: 'pending', limit: 1 })
      .then((res) => setPendingEndRequestCount(res.data?.pagination?.total || 0))
      .catch(() => {})

    const handler = (data: { pendingCount: number }) => setPendingEndRequestCount(data.pendingCount)
    socketService.on('pt_end_request:count_updated', handler)
    return () => { socketService.off('pt_end_request:count_updated', handler) }
  }, [user?.role])

  // Workout report count: fetch + socket
  useEffect(() => {
    if (!['admin', 'super_admin'].includes(user?.role || '')) return

    workoutService.getWorkoutReports({ status: 'pending', limit: 1 })
      .then((res) => setPendingWorkoutReportCount(res.data.pagination?.total || 0))
      .catch(() => {})

    const handler = (data: { pendingCount: number }) => setPendingWorkoutReportCount(data.pendingCount)
    socketService.on('workout_report:count_updated', handler)
    return () => { socketService.off('workout_report:count_updated', handler) }
  }, [user?.role])

  // Shift change count: dùng chung nguồn realtime với badge nút "Yêu cầu thay ca"
  useEffect(() => {
    if (!['admin', 'super_admin'].includes(user?.role || '')) return

    const refreshCount = () => {
      Promise.all([
        shiftChangeService.getAll({ status: 'pending', limit: 1 }),
        shiftChangeService.getAll({ status: 'waiting_assignment', limit: 1 }),
      ])
        .then(([a, b]) => setPendingShiftChangeCount((a.data.total || 0) + (b.data.total || 0)))
        .catch(() => { })
    }
    refreshCount()
    const countHandler = (data: { pendingCount: number }) => setPendingShiftChangeCount(data.pendingCount)
    const refreshHandler = () => refreshCount()
    socketService.on('shift_change:count_updated', countHandler)
    socketService.on('shift_change:new_request', refreshHandler)
    socketService.on('shift_change:updated', refreshHandler)
    return () => {
      socketService.off('shift_change:count_updated', countHandler)
      socketService.off('shift_change:new_request', refreshHandler)
      socketService.off('shift_change:updated', refreshHandler)
    }
  }, [user?.role])

  // Notifications: fetch unread count + realtime via socket
  useEffect(() => {
    if (user?.role !== 'pt') return

    const fetchUnreadCount = () => {
      notificationService.getMyNotifications()
        .then((res) => {
          const data = res.data.data || []
          setPendingNotificationCount(data.filter((n: { isRead?: boolean }) => !n.isRead).length)
        })
        .catch(() => { })
    }

    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000)

    // Socket: lắng nghe notification mới
    socketService.connect()
    const handler = () => {
      setPendingNotificationCount((prev) => prev + 1)
    }
    socketService.on('notification:new', handler)

    return () => {
      clearInterval(interval)
      socketService.off('notification:new', handler)
    }
  }, [user?.role])

  const badgeLabel = (text: string, count: number) => (
    <span style={{ position: 'relative', display: 'inline-block', paddingRight: 22 }}>
      <span>{text}</span>
      {count > 0 && (
        <span style={{
          position: 'absolute', top: '50%', right: 0, transform: 'translateY(-50%)',
          minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#f5222d',
          color: '#fff', fontSize: 10, lineHeight: '18px', textAlign: 'center',
          padding: '0 4px', fontWeight: 600,
        }}>
          {count > 99 ? '99+' : count}
        </span>
      )}
    </span>
  )

  type RoleMenuItem = {
    key: string
    label: React.ReactNode
    icon?: React.ReactNode
    hidden?: boolean
  }

  const roleMenus: Record<string, RoleMenuItem[]> = {
    admin: [
      { key: '/', label: 'Trang chủ', icon: <HomeOutlined /> },
      { key: '/admin', label: 'Tổng quan', icon: <DashboardOutlined /> },

      { key: '/admin/checkin', label: 'Quản lý Check-in', icon: <CalendarOutlined /> },

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

      { key: '/admin/members', label: badgeLabel('Hội viên', membersPendingTotal), icon: <TeamOutlined /> },
      ...(isEnabled('pt.moduleEnabled') ? [
        { key: '/admin/trainers', label: badgeLabel('Huấn luyện viên (PT)', pendingEndRequestCount + pendingWorkoutReportCount + pendingShiftChangeCount), icon: <UserOutlined /> },
      ] : []),
      { key: '/admin/floors-zones', label: 'Tầng & Khu vực', icon: <DashboardOutlined /> },
      ...(isEnabled('reports.revenueChartEnabled') ? [{ key: '/admin/reports', label: 'Thống kê', icon: <BarChartOutlined /> }] : []),
      { key: '/admin/faqs', label: 'Quản lý FAQ', icon: <QuestionCircleOutlined /> },
      { key: '/admin/feedback', label: 'Quản lý phản hồi', icon: <CommentOutlined /> },
      { key: '/admin/policies', label: 'Chính sách', icon: <FileTextOutlined /> },
      ...(isEnabled('pt.moduleEnabled') ? [] : []),
      // { key: '/admin/notifications', label: 'Thông báo', icon: <BellOutlined /> },
      // { key: '/admin/system-settings', label: 'Cài đặt hệ thống', icon: <SettingOutlined /> },
    ],
    staff: [
      { key: '/', label: 'Trang chủ', icon: <HomeOutlined /> },
      ...(isEnabled('checkin.qrCheckinEnabled') ? [{ key: '/staff/checkin', label: 'Check-in', icon: <DashboardOutlined /> }] : []),
      { key: '/staff/members', label: 'Hội viên', icon: <TeamOutlined /> },
      {
        key: '/staff/payments',
        label: (
          <span style={{ position: 'relative', display: 'inline-block', paddingRight: 22 }}>
            <span>{'Thanh toán'}</span>
            {pendingRefundCount > 0 && (
              <span style={{
                position: 'absolute', top: '50%', right: 0, transform: 'translateY(-50%)',
                minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#f5222d',
                color: '#fff', fontSize: 10, lineHeight: '18px', textAlign: 'center',
                padding: '0 4px', fontWeight: 600,
              }}>
                {pendingRefundCount > 99 ? '99+' : pendingRefundCount}
              </span>
            )}
          </span>
        ),
        icon: <CreditCardOutlined />,
      },
    ],
    pt: [
      { key: '/', label: 'Trang chủ', icon: <HomeOutlined /> },
      ...(isEnabled('pt.scheduleEnabled') ? [
        { key: '/pt/schedule', label: 'Lịch làm việc', icon: <CalendarOutlined /> },

      ] : []),
      ...(isEnabled('pt.moduleEnabled') ? [
        { key: '/pt/clients', label: 'Khách hàng', icon: <TeamOutlined /> },
        { key: '/pt/workouts', label: 'Thư viện giáo án', icon: <FileTextOutlined /> },
        { key: '/pt/my-workouts', label: 'Giáo án của tôi', icon: <FolderOpenOutlined /> },
      ] : []),
      { key: '/pt/notifications', label: badgeLabel('Thông báo', pendingNotificationCount), icon: <BellOutlined /> },
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {['admin', 'super_admin', 'staff'].includes(user?.role || '') && <NotificationBell />}
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

    </div>
  )
}
