import {
  BulbOutlined,
  CalendarOutlined,
  FundOutlined,
  HeartOutlined,
  HomeOutlined,
  LogoutOutlined,
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
  Typography,
} from 'antd'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '../../context/ThemeProvider'
import { useCart } from '../../context/useCart'
import { useWallet } from '../../context/WalletProvider'
import { useAuth } from '../../hook/useAuth'
import AccountProfileModal from '../../pages/auth/AccountProfileModal'
import AiChatWidget from '../chat/AiChatWidget'

const { Header, Content } = Layout
const { Text } = Typography

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const [accountOpen, setAccountOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { cartCount } = useCart()
  const { wallet } = useWallet()
  const navigate = useNavigate()
  const location = useLocation()
  const { dark, toggleTheme } = useTheme()

  const navItems = [
    { key: '/dashboard/member', label: 'Trang chủ', icon: <HomeOutlined /> },
    { key: '/dashboard/member/store', label: 'Cửa hàng', icon: <ShopOutlined /> },
    { key: '/dashboard/member/booking', label: 'Đặt lịch PT', icon: <CalendarOutlined /> },
    { key: '/dashboard/member/health', label: 'Sức khoẻ', icon: <HeartOutlined /> },
    { key: '/dashboard/member/workout', label: 'Lộ trình', icon: <FundOutlined /> },
    { key: '/dashboard/member/orders', label: 'Đơn hàng', icon: <ShoppingCartOutlined /> },
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

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        className="member-shell-header"
        style={{
          background: dark ? '#141414' : '#fff',
          borderBottom: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
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
          <Text className="member-shell-space-label" type="secondary">
            Member space
          </Text>
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
            style={{ background: dark ? '#262626' : '#f0f0f0' }}
          >
            <Text style={{ fontSize: 12, color: dark ? '#aaa' : '#666' }}>Ví:</Text>
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

          <Button
            icon={<BulbOutlined />}
            onClick={toggleTheme}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            {dark ? 'Light' : 'Dark'}
          </Button>

          <div
            className="member-shell-user"
            onClick={() => setAccountOpen(true)}
          >
            <Avatar
              src={
                user?.avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || '')}`
              }
            />
            <Text strong style={{ color: dark ? '#fff' : '#000' }}>
              {user?.name}
            </Text>
          </div>

          <Button danger icon={<LogoutOutlined />} onClick={logout}>
            Đăng xuất
          </Button>
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
          background: dark ? '#0f0f0f' : '#f5f5f5',
        }}
      >
        {children}
      </Content>

      <Drawer
        title="GymSystem"
        placement="right"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        width={320}
      >
        <div className="member-shell-drawer-profile">
          <Avatar
            size={44}
            src={
              user?.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || '')}`
            }
          />
          <div style={{ minWidth: 0 }}>
            <Text strong>{user?.name}</Text>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Member
              </Text>
            </div>
          </div>
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
          <Button block icon={<BulbOutlined />} onClick={toggleTheme}>
            {dark ? 'Light' : 'Dark'}
          </Button>
          <Button block onClick={() => { setAccountOpen(true); setMenuOpen(false) }}>
            Tài khoản
          </Button>
          <Button block danger icon={<LogoutOutlined />} onClick={logout}>
            Đăng xuất
          </Button>
        </div>
      </Drawer>

      <AccountProfileModal open={accountOpen} onClose={() => setAccountOpen(false)} />
      <AiChatWidget />
    </Layout>
  )
}
