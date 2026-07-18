import {
  BellOutlined,
  CalendarOutlined,
  CommentOutlined,
  CreditCardOutlined,
  DashboardOutlined,
  FileTextOutlined,
  FundOutlined,
  HomeOutlined,
  MenuOutlined,
  QuestionCircleOutlined,
  ShopOutlined,
  ShoppingCartOutlined
} from '@ant-design/icons'
import {
  Avatar,
  Badge,
  Button,
  Drawer,
  Layout,
  Skeleton,
  Typography,
} from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSystemSettings } from '../../../context/SystemSettingsContext'
import { useCart } from '../../../context/useCart'
import { useWallet } from '../../../context/WalletProvider'
import { useAuth } from '../../../hooks/useAuth'
import { notificationService } from '../../../services/notificationService'
import { getShops } from '../../../services/shopService'
import { socketService } from '../../../services/socketService'
import type { ProductShop } from '../../../types/member/product'
import { getUserDisplayName, getUserInitialName } from '../../../utils/userDisplay'
import MemberFooter from '../footer/MemberFooter'

const { Header, Content } = Layout
const { Text } = Typography
const MEMBER_INTERACTION_LOCK_ROUTES = [
  '/',
  '/deposit',
  '/checkout',
  '/orders',
  '/cart',
  '/workout',
  '/checkin',
  '/checkin/scan',
  '/checkin/sessions',
]

const shouldLockMemberInteractions = (pathname: string) => (
  MEMBER_INTERACTION_LOCK_ROUTES.includes(pathname) ||
  pathname.startsWith('/track/') ||
  pathname.startsWith('/store')
)

export default function MemberLayout({
  children,
  hideFooter = false,
}: {
  children: React.ReactNode
  hideFooter?: boolean
}) {
  const { user } = useAuth()
  const { settings, isEnabled } = useSystemSettings()
  const [menuOpen, setMenuOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false)
  const [storeDropdownLoading, setStoreDropdownLoading] = useState(false)
  const [storeDropdownFetched, setStoreDropdownFetched] = useState(false)
  const [storeDropdownShops, setStoreDropdownShops] = useState<ProductShop[]>([])
  const [moreDropdownOpen, setMoreDropdownOpen] = useState(false)
  const moreDropdownRef = useRef<HTMLDivElement>(null)
  const { cartCount } = useCart()
  const { wallet } = useWallet()
  const navigate = useNavigate()
  const location = useLocation()

  const [unreadNotifCount, setUnreadNotifCount] = useState(0)

  useEffect(() => {
    const fetchNotifCount = async () => {
      try {
        const res = await notificationService.getMyNotifications()
        const items = res.data?.data || []
        setUnreadNotifCount(items.filter((n: any) => !n.isRead).length)
      } catch { /* ignore */ }
    }
    fetchNotifCount()
    const interval = setInterval(fetchNotifCount, 30000)

    // Socket: lang nghe notification moi
    socketService.connect()
    const handler = () => {
      setUnreadNotifCount((prev) => prev + 1)
    }
    socketService.on('notification:new', handler)

    return () => {
      clearInterval(interval)
      socketService.off('notification:new', handler)
    }
  }, [])
  const navItems = [
    { key: '/', label: 'Trang chủ', icon: <HomeOutlined /> },
    ...(isEnabled('shop.productStoreEnabled') ? [{ key: '/store', label: 'Cửa hàng', icon: <ShopOutlined /> }] : []),
    ...(isEnabled('billing.allowPlanPurchase') ? [{ key: '/my-membership', label: 'Gói tập', icon: <CalendarOutlined /> }] : []),
    ...(isEnabled('pt.moduleEnabled') ? [{ key: '/booking', label: 'Đặt lịch PT', icon: <CalendarOutlined /> }] : []),
    ...(isEnabled('workout.workoutPlanEnabled') ? [{ key: '/workout', label: 'Lịch tập', icon: <FundOutlined /> }] : []),
    ...(isEnabled('checkin.qrCheckinEnabled') ? [{ key: '/checkin', label: 'Check-in', icon: <CreditCardOutlined /> }] : []),
  ]
  const moreNavItems = [
    { key: '/feedback', label: 'Phản hồi', icon: <CommentOutlined /> },
    { key: '/policies', label: 'Chính sách', icon: <FileTextOutlined /> },
    { key: '/help', label: 'Trợ giúp', icon: <QuestionCircleOutlined /> },
  ]
  const drawerNavItems = [...navItems, ...moreNavItems]

  const selectedKey =
    drawerNavItems
      .map((item) => item.key)
      .sort((a, b) => b.length - a.length)
      .find((key) => location.pathname === key || location.pathname.startsWith(`${key}/`)) ||
    '/'
  const moreActive = moreNavItems.some((item) => selectedKey === item.key)

  const goTo = (path: string) => {
    navigate(path)
    setMenuOpen(false)
    setStoreDropdownOpen(false)
    setMoreDropdownOpen(false)
  }

  const loadStoreDropdown = () => {
    if (storeDropdownFetched || storeDropdownLoading) return
    setStoreDropdownLoading(true)
    getShops()
      .then((res) => setStoreDropdownShops(res.data.shops || res.data || []))
      .catch(() => setStoreDropdownShops([]))
      .finally(() => {
        setStoreDropdownFetched(true)
        setStoreDropdownLoading(false)
      })
  }

  const handleStoreMouseEnter = () => {
    setStoreDropdownOpen(true)
    loadStoreDropdown()
  }

  const walletText = wallet ? `${wallet.balance.toLocaleString('vi-VN')}đ` : '0đ'
  const displayName = getUserDisplayName(user, 'Tài khoản')
  const avatarName = getUserInitialName(user, 'U')
  const avatarUrl =
    user?.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarName)}`

  const openProfilePage = () => {
    navigate('/account/profile')
    setMenuOpen(false)
  }

  const lockMemberInteractions = shouldLockMemberInteractions(location.pathname)
  const navbarIconButtonStyle = {
    color: 'var(--theme-text)',
    transition: 'color 0.18s',
  }

  useEffect(() => {
    document.body.classList.toggle('member-interaction-lock', lockMemberInteractions)
    return () => {
      document.body.classList.remove('member-interaction-lock')
    }
  }, [lockMemberInteractions])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  useEffect(() => {
    if (!moreDropdownOpen) return

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!moreDropdownRef.current?.contains(event.target as Node)) {
        setMoreDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [moreDropdownOpen])

  return (
    <Layout className="member-shell" style={{ minHeight: '100dvh' }}>
      <Header
        className="member-shell-header"
        style={{
          background: 'var(--theme-card)',
          borderBottom: '1px solid var(--theme-border)',
          color: 'var(--theme-text)',
        }}
      >
        <div
          className="member-shell-logo"
          onClick={() => goTo('/')}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter') goTo('/')
          }}
        >
          {settings.general.logoUrl ? (
            <img src={settings.general.logoUrl} alt={settings.general.siteName} style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} />
          ) : (
            <div
              className="member-shell-logo-mark"
              style={{
                background: 'var(--theme-button-bg)',
                color: 'var(--theme-button-text)',
                boxShadow: '0 0 12px var(--theme-accent-muted), 0 0 4px var(--theme-accent)',
                borderRadius: 8,
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              GP
            </div>
          )}
          <div className="member-shell-brand" style={{ color: 'var(--gs-text)' }}>{settings.general.siteName}</div>
        </div>

        <nav className="member-shell-desktop-nav" aria-label="Member navigation">
          {navItems.map((item) => {
            const active = selectedKey === item.key
            const isStore = item.key === '/store'
            const showStoreDropdown = isStore && storeDropdownOpen && (storeDropdownLoading || storeDropdownShops.length > 0)

            if (isStore) {
              return (
                <div
                  key={item.key}
                  className="member-store-nav-wrapper"
                  onMouseEnter={handleStoreMouseEnter}
                  onMouseLeave={() => setStoreDropdownOpen(false)}
                >
                  <button
                    type="button"
                    className={`member-shell-nav-item${active ? ' is-active' : ''}`}
                    onClick={() => goTo(item.key)}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>

                  {showStoreDropdown && (
                    <div className="member-store-dropdown">
                      {storeDropdownLoading ? (
                        <div className="member-store-dropdown-loading">
                          {[0, 1, 2].map((index) => (
                            <div key={index} className="member-store-dropdown-skeleton">
                              <Skeleton.Avatar active size={28} />
                              <Skeleton.Input active size="small" style={{ width: 132 }} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <>
                          <div className="member-store-dropdown-list">
                            {storeDropdownShops.map((shop) => {
                              const owner = shop.user_id
                              const name = shop.name || owner?.name || 'Cửa hàng'
                              const avatar = owner?.avatar || shop.avatar

                              return (
                                <button
                                  key={shop._id}
                                  type="button"
                                  className="member-store-dropdown-item"
                                  onClick={() => goTo(`/store/${shop._id}`)}
                                >
                                  <Avatar size={28} src={avatar} icon={<ShopOutlined />}>
                                    {name.charAt(0)}
                                  </Avatar>
                                  <span>{name}</span>
                                </button>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <button
                key={item.key}
                type="button"
                className={`member-shell-nav-item${active ? ' is-active' : ''}`}
                onClick={() => goTo(item.key)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            )
          })}
          <div className="member-more-nav-wrapper" ref={moreDropdownRef}>
            <button
              type="button"
              className={`member-shell-nav-item${moreActive ? ' is-active' : ''}`}
              onClick={() => setMoreDropdownOpen((open) => !open)}
            >
              <span>Thêm</span>
              <span aria-hidden="true">▾</span>
            </button>

            {moreDropdownOpen && (
              <div className="member-more-dropdown">
                {moreNavItems.map((item) => {
                  const active = selectedKey === item.key
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`member-more-dropdown-item${active ? ' is-active' : ''}`}
                      onClick={() => goTo(item.key)}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </nav>

        {(user?.role === 'super_admin' || user?.role === 'admin') && !location.pathname.startsWith('/admin') && (
          <button
            type="button"
            className="member-shell-nav-item"
            onClick={() => goTo('/admin')}
            style={{ marginLeft: 8 }}
          >
            <DashboardOutlined />
            <span>Quay lại Admin</span>
          </button>
        )}

        <div className="member-shell-desktop-actions">
          <Badge count={unreadNotifCount} size="small" offset={[2, -2]}>
            <Button
              type="text"
              icon={<BellOutlined style={{ fontSize: 18 }} />}
              onClick={() => goTo('/notifications')}
              style={navbarIconButtonStyle}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--theme-accent)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--theme-text)'}
            />
          </Badge>
          {isEnabled('billing.qrPaymentEnabled') && (
            <div
              className="member-shell-wallet-pill"
              style={{ background: 'var(--theme-elevated)', color: 'var(--theme-text)' }}
            >
              <Text style={{ fontSize: 12, color: 'var(--theme-muted)' }}>Ví</Text>
              <Text strong style={{ fontSize: 14 }}>
                {walletText}
              </Text>
              <Button
                type="link"
                size="small"
                onClick={() => goTo('/deposit')}
                style={{ padding: 0, height: 'auto', fontSize: 12, marginLeft: 4 }}
              >
                Nạp tiền
              </Button>
            </div>
          )}

          {isEnabled('shop.cartEnabled') && (
            <Badge count={cartCount} size="small">
              <Button
                type="text"
                icon={<ShoppingCartOutlined style={{ fontSize: 18 }} />}
                onClick={() => goTo('/cart')}
                style={navbarIconButtonStyle}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--theme-accent)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--theme-text)'}
              />
            </Badge>
          )}



          <div
            className="member-shell-user"
            onClick={openProfilePage}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 10px',
              borderRadius: 20,
              cursor: 'pointer',
              transition: 'background 0.18s',
              background: hovered
                ? 'var(--theme-accent-muted)'
                : 'transparent',
              border: `1px solid ${hovered
                ? 'var(--theme-accent-border)'
                : 'transparent'}`,
            }}
          >
            <Avatar src={avatarUrl} />
            <Text strong style={{ color: 'var(--theme-text)' }}>
              {displayName}
            </Text>
          </div>
        </div>

        <div className="member-shell-mobile-actions">
          <Badge count={unreadNotifCount} size="small" offset={[2, -2]}>
            <Button
              type="text"
              icon={<BellOutlined style={{ fontSize: 18 }} />}
              onClick={() => goTo('/member/notifications')}
              style={navbarIconButtonStyle}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--theme-accent)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--theme-text)'}
            />
          </Badge>
          {isEnabled('shop.cartEnabled') && (
            <Badge count={cartCount} size="small">
              <Button
                type="text"
                icon={<ShoppingCartOutlined style={{ fontSize: 18 }} />}
                onClick={() => goTo('/cart')}
                style={navbarIconButtonStyle}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--theme-accent)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--theme-text)'}
              />
            </Badge>
          )}
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setMenuOpen(true)}
            style={navbarIconButtonStyle}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--theme-accent)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--theme-text)'}
          />
        </div>
      </Header>

      <Content
        className="member-shell-content"
        style={{
          background: 'var(--theme-bg)',
          color: 'var(--theme-text)',
        }}
      >
        {children}
      </Content>

      {!hideFooter && <MemberFooter />}

      <Drawer
        title={settings.general.siteName}
        placement="right"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        size={320}
      >
        <div className="flex items-center gap-3 p-4">
          <img className="h-10 w-10 rounded-full object-cover" src={avatarUrl} alt={displayName} />
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-sm font-medium" style={{ color: 'var(--theme-text)' }}>{displayName}</p>
            <p className="m-0 truncate text-xs" style={{ color: 'var(--gs-text-muted)' }}>{(user?.role === 'admin' || user?.role === 'super_admin') ? 'Quản trị viên' : user?.role === 'pt' ? 'Huấn luyện viên' : user?.role === 'seller' ? 'Người bán' : user?.role === 'staff' ? 'Nhân viên' : 'Hội viên'}</p>
          </div>
          <button
            onClick={openProfilePage}
            className="whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs transition-colors"
            style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card)', color: 'var(--theme-text)' }}
            type="button"
          >
            Tài khoản
          </button>
        </div>

        {isEnabled('billing.qrPaymentEnabled') && (
          <div className="member-shell-drawer-wallet">
            <Text type="secondary">Số dư</Text>
            <Text strong style={{ fontSize: 18 }}>
              {walletText}
            </Text>
            <Button type="primary" block onClick={() => goTo('/deposit')}>
              Nạp tiền
            </Button>
          </div>
        )}

        <nav className="member-drawer-nav" aria-label="Member mobile navigation">
          {drawerNavItems.map((item) => {
            const active = selectedKey === item.key
            return (
              <button
                key={item.key}
                type="button"
                className={`member-drawer-nav-item${active ? ' is-active' : ''}`}
                onClick={() => goTo(item.key)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        {(user?.role === 'super_admin' || user?.role === 'admin') && !location.pathname.startsWith('/admin') && (
          <>
            <div style={{ padding: '8px 16px 0' }}>
              <div style={{ height: 1, background: 'var(--theme-border)' }} />
            </div>
            <nav className="member-drawer-nav" aria-label="Management navigation">
              <button
                type="button"
                className="member-drawer-nav-item"
                onClick={() => goTo('/admin')}
              >
                <DashboardOutlined />
                <span>Quay lại Admin</span>
              </button>
            </nav>
          </>
        )}

      </Drawer>

    </Layout >
  )
}
