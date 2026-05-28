import {
  CalendarOutlined,
  CreditCardOutlined,
  DashboardOutlined,
  FundOutlined,
  HeartOutlined,
  HomeOutlined,
  MenuOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons'
import {
  Avatar,
  Badge,
  Button,
  Drawer,
  Layout,
  Menu,
  Skeleton,
  Typography,
} from 'antd'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCart } from '../../../context/useCart'
import { useWallet } from '../../../context/WalletProvider'
import { useAuth } from '../../../hooks/useAuth'
import AccountProfileModal from '../../../pages/auth/AccountProfileModal'
import { getShops } from '../../../services/shopService'
import type { ProductShop } from '../../../types/member/product'
import AiChatWidget from '../../chat/AiChatWidget'
import MemberFooter from '../footer/MemberFooter'

const { Header, Content } = Layout
const { Text } = Typography
const MEMBER_INTERACTION_LOCK_ROUTES = [
  '/',
  '/wallet',
  '/wallet/deposit',
  '/transfer',
  '/checkout',
  '/orders',
  '/cart',
  '/workout',
  '/checkin',
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
  const [accountOpen, setAccountOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false)
  const [storeDropdownLoading, setStoreDropdownLoading] = useState(false)
  const [storeDropdownFetched, setStoreDropdownFetched] = useState(false)
  const [storeDropdownShops, setStoreDropdownShops] = useState<ProductShop[]>([])
  const { cartCount } = useCart()
  const { wallet } = useWallet()
  const navigate = useNavigate()
  const location = useLocation()
  const navItems = [
    { key: '/', label: 'Trang chủ', icon: <HomeOutlined /> },
    { key: '/store', label: 'Cửa hàng', icon: <ShopOutlined /> },
    { key: '/booking', label: 'Đặt lịch PT', icon: <CalendarOutlined /> },
    { key: '/health', label: 'Sức khoẻ', icon: <HeartOutlined /> },
    { key: '/workout', label: 'Lộ trình', icon: <FundOutlined /> },
    { key: '/checkin', label: 'Checkin', icon: <CreditCardOutlined /> },
  ]

  const selectedKey =
    navItems
      .map((item) => item.key)
      .sort((a, b) => b.length - a.length)
      .find((key) => location.pathname === key || location.pathname.startsWith(`${key}/`)) ||
    '/'

  const goTo = (path: string) => {
    navigate(path)
    setMenuOpen(false)
    setStoreDropdownOpen(false)
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
  const avatarUrl =
    user?.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || '')}`

  const openProfileModal = () => {
    setAccountOpen(true)
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

  return (
    <Layout className="member-shell" style={{ minHeight: '100vh' }}>
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
          <div
            className="member-shell-logo-mark"
            style={{
              background: 'var(--theme-accent)',
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
          <div className="member-shell-brand" style={{ color: 'var(--theme-accent)' }}>GymPro</div>
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
                              const avatar = shop.avatar || owner?.avatar

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
        </nav>

        {(user?.role === 'admin' || user?.role === 'pt' || user?.role === 'staff' || user?.role === 'seller') && (
          <button
            type="button"
            className="member-shell-nav-item"
            onClick={() => {
              const target = user?.role === 'pt' ? '/pt/schedule' : user?.role === 'staff' ? '/staff/checkin' : user?.role === 'seller' ? '/seller/products' : '/admin'
              goTo(target)
            }}
            style={{ marginLeft: 8 }}
          >
            <DashboardOutlined />
            <span>Quản lý {user?.role === 'admin' ? 'Admin' : user?.role === 'pt' ? 'PT' : user?.role === 'staff' ? 'Staff' : 'Shop'}</span>
          </button>
        )}

        <div className="member-shell-desktop-actions">
          <div
            className="member-shell-wallet-pill"
            style={{ background: 'var(--theme-elevated)', color: 'var(--theme-text)' }}
          >
            <Text style={{ fontSize: 12, color: 'var(--theme-muted)' }}>Ví:</Text>
            <Text strong style={{ fontSize: 14 }}>
              {walletText}
            </Text>
            <Button
              type="link"
              size="small"
              onClick={() => goTo('/wallet')}
              style={{ padding: 0, height: 'auto', fontSize: 12, marginLeft: 4 }}
            >
              Nạp tiền
            </Button>
          </div>

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

          <div
            className="member-shell-user"
            onClick={openProfileModal}
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
              {user?.name}
            </Text>
          </div>
        </div>

        <div className="member-shell-mobile-actions">
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

      { !hideFooter && <MemberFooter /> }

      <Drawer
        title="GymPro"
        placement="right"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        width={320}
      >
        <div className="flex items-center gap-3 p-4">
          <img className="h-10 w-10 rounded-full object-cover" src={avatarUrl} alt={user?.name || 'Avatar'} />
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-sm font-medium text-[#edebe6]" style={{ color: 'var(--theme-text)' }}>{user?.name}</p>
            <p className="m-0 truncate text-xs text-[rgba(237,235,230,0.5)]">{user?.role || 'Member'}</p>
          </div>
          <button
            onClick={openProfileModal}
            className="whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs text-gray-300 transition-colors"
            style={{ borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-card)', color: 'var(--theme-text)' }}
            type="button"
          >
            Tài khoản
          </button>
        </div>

        <div className="member-shell-drawer-wallet">
          <Text type="secondary">Ví hiện tại</Text>
          <Text strong style={{ fontSize: 18 }}>
            {walletText}
          </Text>
          <Button type="primary" block onClick={() => goTo('/wallet')}>
            Nạp / xem ví
          </Button>
        </div>

        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={navItems}
          onClick={(event) => goTo(event.key)}
          style={{ borderInlineEnd: 0 }}
        />

        {(user?.role === 'admin' || user?.role === 'pt' || user?.role === 'staff' || user?.role === 'seller') && (
          <>
            <div style={{ padding: '8px 16px 0' }}>
              <div style={{ height: 1, background: 'var(--theme-border)' }} />
            </div>
            <Menu
              mode="inline"
              selectedKeys={[]}
              items={[{
                key: user?.role === 'pt' ? '/pt/schedule' : user?.role === 'staff' ? '/staff/checkin' : user?.role === 'seller' ? '/seller/products' : '/admin',
                label: `Quản lý ${user?.role === 'admin' ? 'Admin' : user?.role === 'pt' ? 'PT' : user?.role === 'staff' ? 'Staff' : 'Shop'}`,
                icon: <DashboardOutlined />,
              }]}
              onClick={(event) => goTo(event.key)}
              style={{ borderInlineEnd: 0 }}
            />
          </>
        )}

      </Drawer>

      <AccountProfileModal open={accountOpen} onClose={() => setAccountOpen(false)} />
  { !accountOpen && !menuOpen && <AiChatWidget /> }
    </Layout >
  )
}
