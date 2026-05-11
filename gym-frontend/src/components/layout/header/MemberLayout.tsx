import {
  CalendarOutlined,
  CreditCardOutlined,
  FundOutlined,
  HeartOutlined,
  HomeOutlined,
  MenuOutlined,
  PlaySquareOutlined,
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
  Typography,
} from 'antd'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '../../../context/ThemeProvider'
import { useCart } from '../../../context/useCart'
import { useWallet } from '../../../context/WalletProvider'
import { useAuth } from '../../../hook/useAuth'
import AccountProfileModal from '../../../pages/auth/AccountProfileModal'
import AiChatWidget from '../../chat/AiChatWidget'
import MemberFooter from '../footer/MemberFooter'

const { Header, Content } = Layout
const { Text } = Typography
const MEMBER_INTERACTION_LOCK_ROUTES = [
  '/dashboard/member',
  '/dashboard/member/wallet',
  '/dashboard/member/wallet/deposit',
  '/dashboard/member/transfer',
  '/dashboard/member/checkout',
  '/dashboard/member/orders',
  '/dashboard/member/cart',
  '/dashboard/member/workout',
  '/dashboard/member/checkin',
  '/shorts',
]

const shouldLockMemberInteractions = (pathname: string) => (
  MEMBER_INTERACTION_LOCK_ROUTES.includes(pathname) ||
  pathname.startsWith('/dashboard/member/track/') ||
  pathname.startsWith('/dashboard/member/store') ||
  pathname.startsWith('/dashboard/member/shop/')
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
  const { cartCount } = useCart()
  const { wallet } = useWallet()
  const navigate = useNavigate()
  const location = useLocation()
  const { dark } = useTheme()

  const navItems = [
    { key: '/dashboard/member', label: 'Trang chủ', icon: <HomeOutlined /> },
    { key: '/dashboard/member/store', label: 'Cửa hàng', icon: <ShopOutlined /> },
    { key: '/shorts', label: 'Shorts', icon: <PlaySquareOutlined /> },
    { key: '/dashboard/member/booking', label: 'Đặt lịch PT', icon: <CalendarOutlined /> },
    { key: '/dashboard/member/health', label: 'Sức khoẻ', icon: <HeartOutlined /> },
    { key: '/dashboard/member/workout', label: 'Lộ trình', icon: <FundOutlined /> },
    { key: '/dashboard/member/checkin', label: 'Checkin', icon: <CreditCardOutlined /> },
  ]

  const selectedKey =
    navItems
      .map((item) => item.key)
      .sort((a, b) => b.length - a.length)
      .find((key) => location.pathname === key || location.pathname.startsWith(`${key}/`)) ||
    '/dashboard/member'

  const goTo = (path: string) => {
    navigate(path)
    setMenuOpen(false)
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
          background: dark ? '#141414' : '#3e3e3e',
          borderBottom: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #5a5a5a',
        }}
      >
        <div
          className="member-shell-logo"
          onClick={() => goTo('/dashboard/member')}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter') goTo('/dashboard/member')
          }}
        >
          <div className="member-shell-logo-mark">GS</div>
          <div className="member-shell-brand">GymSystem</div>
        </div>

        <Menu
          className="member-shell-desktop-nav"
          mode="horizontal"
          selectedKeys={[selectedKey]}
          items={navItems}
          onClick={(event) => goTo(event.key)}
          style={{
            flex: 1,
            justifyContent: 'center',
            border: 'none',
            background: 'transparent',
            minWidth: 0,
          }}
        />

        <div className="member-shell-desktop-actions">
          <div
            className="member-shell-wallet-pill"
            style={{ background: dark ? '#262626' : '#484848' }}
          >
            <Text style={{ fontSize: 12, color: dark ? '#aaa' : 'rgba(237,235,230,0.5)' }}>Ví:</Text>
            <Text strong style={{ fontSize: 14 }}>
              {walletText}
            </Text>
            <Button
              type="link"
              size="small"
              onClick={() => goTo('/dashboard/member/wallet')}
              style={{ padding: 0, height: 'auto', fontSize: 12, marginLeft: 4 }}
            >
              Nạp tiền
            </Button>
          </div>

          <Badge count={cartCount} size="small">
            <Button
              type="text"
              icon={<ShoppingCartOutlined style={{ fontSize: 18 }} />}
              onClick={() => goTo('/dashboard/member/cart')}
            />
          </Badge>

          {location.pathname === '/shorts' && (
            <Button
              type="primary"
              icon={<PlaySquareOutlined />}
              onClick={() => navigate('/shorts?upload=1')}
            >
              Tải video short
            </Button>
          )}

          <div
            className="member-shell-user"
            onClick={openProfileModal}
          >
            <Avatar src={avatarUrl} />
            <Text strong style={{ color: '#edebe6' }}>
              {user?.name}
            </Text>
          </div>
        </div>

        <div className="member-shell-mobile-actions">
          <Badge count={cartCount} size="small">
            <Button
              type="text"
              icon={<ShoppingCartOutlined style={{ fontSize: 18 }} />}
              onClick={() => goTo('/dashboard/member/cart')}
            />
          </Badge>
          <Button type="text" icon={<MenuOutlined />} onClick={() => setMenuOpen(true)} />
        </div>
      </Header>

      <Content
        className="member-shell-content"
        style={{
          background: dark ? '#0f0f0f' : '#3e3e3e',
        }}
      >
        {children}
      </Content>

      {!hideFooter && <MemberFooter />}

      <Drawer
        title="GymSystem"
        placement="right"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        width={320}
      >
        <div className="flex items-center gap-3 p-4">
          <img className="h-10 w-10 rounded-full object-cover" src={avatarUrl} alt={user?.name || 'Avatar'} />
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-sm font-medium text-[#edebe6]">{user?.name}</p>
            <p className="m-0 truncate text-xs text-[rgba(237,235,230,0.5)]">{user?.role || 'Member'}</p>
          </div>
          <button
            onClick={openProfileModal}
            className="whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs text-gray-300 transition-colors"
            style={{ borderColor: '#5a5a5a', backgroundColor: '#484848' }}
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
          <Button type="primary" block onClick={() => goTo('/dashboard/member/wallet')}>
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

        <div className="member-shell-drawer-actions">
          {location.pathname === '/shorts' && (
            <Button block type="primary" icon={<PlaySquareOutlined />} onClick={() => goTo('/shorts?upload=1')}>
              Tải video short
            </Button>
          )}
        </div>
      </Drawer>

      <AccountProfileModal open={accountOpen} onClose={() => setAccountOpen(false)} />
      {location.pathname !== '/shorts' && !accountOpen && !menuOpen && <AiChatWidget />}
    </Layout>
  )
}
