import { ConfigProvider, theme } from 'antd'
import { Navigate, Route, Routes } from 'react-router-dom'
import MemberLayout from './components/layout/header/MemberLayout'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import { useAuth } from './hook/useAuth'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import LoginPage from './pages/auth/LoginPage'
import OauthSuccessPage from './pages/auth/OauthSuccessPage'
import RegisterPage from './pages/auth/Registerpage'
import AdminDashboard from './pages/dashboard/admin/AdminDashboard'
import AdminMembersPage from './pages/dashboard/admin/AdminMembersPage'
import AdminPlansPage from './pages/dashboard/admin/AdminPlansPage'
import AdminReports from './pages/dashboard/admin/AdminReports'
import AdminShopPage from './pages/dashboard/admin/AdminShopPage'
import AdminShortsPage from './pages/dashboard/admin/AdminShortsPage'
import AdminTrainersPage from './pages/dashboard/admin/AdminTrainersPage'
import AdminUsersPage from './pages/dashboard/admin/AdminUsersPage'
import BookingPage from './pages/dashboard/member/BookingPage'
import CartPage from './pages/dashboard/member/CartPage'
import ChannelPage from './pages/dashboard/member/ChannelPage'
import CheckoutPage from './pages/dashboard/member/CheckoutPage'
import DepositPage from './pages/dashboard/member/DepositPage'
import HealthPage from './pages/dashboard/member/HealthPage'
import MemberDashboard from './pages/dashboard/member/MemberDashboard'
import MemberStorePage from './pages/dashboard/member/MemberStorePage'
import OrderHistoryPage from './pages/dashboard/member/OrderHistoryPage'
import OrderTrackingPage from './pages/dashboard/member/OrderTrackingPage'
import ProductDetailPage from './pages/dashboard/member/ProductDetailPage'
import ShortsPage from './pages/dashboard/member/ShortsPage'
import TransferPage from './pages/dashboard/member/TransferPage'
import WalletPage from './pages/dashboard/member/WalletPage'
import WorkoutPage from './pages/dashboard/member/WorkoutPage'
import PTSchedulePage from './pages/dashboard/pt/PTSchedulePage'
import PTStudentPage from './pages/dashboard/pt/PTStudentPage'
import SellerOrdersPage from './pages/dashboard/seller/SellerOrdersPage'
import SellerProductsPage from './pages/dashboard/seller/SellerProductsPage'
import StaffCheckinPage from './pages/dashboard/staff/StaffCheckinPage'
import StaffMemberPage from './pages/dashboard/staff/StaffMemberPage'

{/* ADMIN */ }

{/* Auth */ }

{/* PT */ }

{/* Staff */ }

{/* Member */ }

{/* Seller */ }

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Đang tải...
      </div>
    )
  }

  return user ? <>{children}</> : <Navigate to="/login" />
}

function MemberCheckinPage() {
  return (
    <MemberLayout>
      <div className="member-page">
        <div className="rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))] p-8 max-[640px]:p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">
            QR Check-in
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-[var(--gs-text)]">Check-in hội viên</h1>
          <p className="mt-2 text-sm text-[var(--gs-text-muted)]">
            Chức năng QR Check-in đang được phát triển.
          </p>
        </div>
      </div>
    </MemberLayout>
  )
}

function AppWithTheme() {
  const { tokens, themeKey } = useTheme()

  return (
    <ConfigProvider
      key={themeKey}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorBgBase: tokens.bg,
          colorBgContainer: tokens.card,
          colorBgElevated: tokens.elevated,
          colorBgLayout: tokens.bg,
          colorBorder: tokens.border,
          colorBorderSecondary: 'rgba(255,255,255,0.06)',
          colorFillTertiary: tokens.inputBg,
          colorText: tokens.text,
          colorTextBase: tokens.text,
          colorTextHeading: tokens.text,
          colorTextLabel: tokens.text,
          colorTextSecondary: tokens.muted,
          colorTextTertiary: tokens.muted,
          colorTextDescription: tokens.muted,
          colorTextDisabled: tokens.muted,
          colorTextPlaceholder: tokens.placeholder,
          colorIcon: tokens.text,
          colorIconHover: tokens.accent,
          colorPrimary: tokens.accent,
          colorPrimaryHover: tokens.accentHover,
          colorPrimaryText: tokens.buttonText,
        },
        components: {
          Layout: {
            headerBg: tokens.card,
            bodyBg: tokens.bg,
            siderBg: tokens.card,
            footerBg: tokens.card,
          },
          Menu: {
            itemBg: tokens.card,
            itemColor: tokens.text,
            itemHoverColor: 'var(--theme-accent)',
            colorBgContainer: tokens.card,
            itemSelectedBg: 'var(--theme-accent-muted)',
            itemSelectedColor: 'var(--theme-accent)',
            itemHoverBg: 'var(--theme-accent-muted)',
            itemActiveBg: tokens.elevated,
            subMenuItemBg: tokens.card,
            groupTitleColor: tokens.muted,
            colorText: tokens.text,
            darkItemColor: tokens.text,
            darkItemBg: tokens.card,
            darkItemHoverBg: tokens.elevated,
            activeBarBorderWidth: 0,
          },
          Card: { colorBgContainer: tokens.card },
          Modal: { contentBg: tokens.elevated, headerBg: tokens.elevated },
          Table: { colorBgContainer: tokens.card, headerBg: tokens.elevated },
          Select: { colorBgContainer: tokens.inputBg, colorBorder: tokens.border },
          Input: {
            colorBgContainer: tokens.inputBg,
            colorBorder: tokens.border,
            colorText: tokens.text,
            colorTextPlaceholder: tokens.placeholder,
            activeBorderColor: tokens.accent,
            hoverBorderColor: tokens.accent,
          },
          Button: {
            colorBgContainer: tokens.elevated,
            colorBorder: tokens.border,
            colorText: tokens.text,
            primaryColor: tokens.buttonText,
            defaultBg: 'transparent',
            defaultBorderColor: tokens.safeAccent,
            defaultColor: tokens.safeAccent,
            defaultHoverBg: tokens.accentMuted,
            defaultHoverBorderColor: tokens.safeAccent,
            defaultHoverColor: tokens.safeAccent,
          },
          DatePicker: { colorBgContainer: tokens.inputBg, colorBorder: tokens.border },
          Drawer: { colorBgElevated: tokens.elevated },
          Tabs: {
            itemColor: tokens.text,
            itemHoverColor: tokens.text,
            itemSelectedColor: tokens.accent,
            inkBarColor: tokens.accent,
            colorText: tokens.text,
          },
        },
      }}
    >
      <Routes>

        {/* AUTH */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/oauth-success" element={<OauthSuccessPage />} />



        {/* ADMIN */}
        <Route path="/dashboard/admin" element={<PrivateRoute><AdminDashboard /></PrivateRoute>} />
        <Route path="/dashboard/admin/plans" element={<PrivateRoute><AdminPlansPage /></PrivateRoute>} />
        <Route path="/dashboard/admin/shop" element={<PrivateRoute><AdminShopPage /></PrivateRoute>} />
        <Route path="/dashboard/admin/users" element={<PrivateRoute><AdminUsersPage /></PrivateRoute>} />
        <Route path="/dashboard/admin/members" element={<PrivateRoute><AdminMembersPage /></PrivateRoute>} />
        <Route path="/dashboard/admin/pts" element={<PrivateRoute><AdminTrainersPage /></PrivateRoute>} />
        <Route path="/dashboard/admin/shorts" element={<PrivateRoute><AdminShortsPage /></PrivateRoute>} />
        <Route path="/dashboard/admin/reports" element={<PrivateRoute><AdminReports /></PrivateRoute>} />
        {/* SELLER */}
        <Route path="/dashboard/seller/products" element={<PrivateRoute><SellerProductsPage /></PrivateRoute>} />
        <Route path="/dashboard/seller/orders" element={<PrivateRoute><SellerOrdersPage /></PrivateRoute>} />
        {/* STAFF */}
        <Route path="/dashboard/staff/checkin" element={<PrivateRoute><StaffCheckinPage /></PrivateRoute>} />
        <Route path="/dashboard/staff/members" element={<PrivateRoute><StaffMemberPage /></PrivateRoute>} />

        {/* PT */}
        <Route path="/dashboard/pt/schedule" element={<PrivateRoute><PTSchedulePage /></PrivateRoute>} />
        <Route path="/dashboard/pt/student" element={<PrivateRoute><PTStudentPage /></PrivateRoute>} />

        {/* MEMBER */}
        <Route path="/dashboard/member" element={<PrivateRoute><MemberDashboard /></PrivateRoute>} />
        <Route path="/dashboard/member/wallet" element={<PrivateRoute><WalletPage /></PrivateRoute>} />
        <Route path="/dashboard/member/wallet/deposit" element={<PrivateRoute><DepositPage /></PrivateRoute>} />
        <Route path="/dashboard/member/transfer" element={<PrivateRoute><TransferPage /></PrivateRoute>} />
        <Route path="/dashboard/member/checkout" element={<PrivateRoute><CheckoutPage /></PrivateRoute>} />
        <Route path="/dashboard/member/orders" element={<PrivateRoute><OrderHistoryPage /></PrivateRoute>} />
        <Route path="/dashboard/member/track/:id" element={<PrivateRoute><OrderTrackingPage /></PrivateRoute>} />
        <Route path="/dashboard/member/store" element={<PrivateRoute><MemberStorePage /></PrivateRoute>} />
        <Route path="/dashboard/member/shop/:shopId" element={<PrivateRoute><MemberStorePage /></PrivateRoute>} />
        <Route path="/dashboard/member/cart" element={<PrivateRoute><CartPage /></PrivateRoute>} />
        <Route path="/dashboard/member/store/:id" element={<PrivateRoute><ProductDetailPage /></PrivateRoute>} />
        <Route path="/dashboard/member/booking" element={<PrivateRoute><BookingPage /></PrivateRoute>} />
        <Route path="/dashboard/member/health" element={<PrivateRoute><HealthPage /></PrivateRoute>} />
        <Route path="/dashboard/member/workout" element={<PrivateRoute><WorkoutPage /></PrivateRoute>} />
        <Route path="/dashboard/member/checkin" element={<PrivateRoute><MemberCheckinPage /></PrivateRoute>} />
        <Route path="/shorts" element={<PrivateRoute><MemberLayout hideFooter><ShortsPage /></MemberLayout></PrivateRoute>} />
        <Route path="/channel/:userId" element={<PrivateRoute><MemberLayout><ChannelPage /></MemberLayout></PrivateRoute>} />
        {/* DEFAULT */}
        <Route path="/" element={<Navigate to="/login" />} />

      </Routes>
    </ConfigProvider>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppWithTheme />
    </ThemeProvider>
  )
}
