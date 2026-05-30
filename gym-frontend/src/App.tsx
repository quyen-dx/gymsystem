import { ConfigProvider, theme } from 'antd'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import MemberLayout from './components/layout/header/MemberLayout'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import { useAuth } from './hooks/useAuth'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import LoginPage from './pages/auth/LoginPage'
import OauthSuccessPage from './pages/auth/OauthSuccessPage'
import RegisterPage from './pages/auth/Registerpage'
import AdminDashboard from './pages/dashboard/admin/AdminDashboard'
import AdminMembersPage from './pages/dashboard/admin/AdminMembersPage'
import AdminPartnershipRequestsPage from './pages/dashboard/admin/AdminPartnershipRequestsPage'
import AdminPlansPage from './pages/dashboard/admin/AdminPlansPage'
import AdminReports from './pages/dashboard/admin/AdminReports'
import AdminTrainersPage from './pages/dashboard/admin/AdminTrainersPage'
import AdminUsersPage from './pages/dashboard/admin/AdminUsersPage'
import FAQManagerPage from './pages/dashboard/admin/FAQManagerPage'
import FeedbackManagerPage from './pages/dashboard/admin/FeedbackManagerPage'
import PolicyManagerPage from './pages/dashboard/admin/PolicyManagerPage'
import SystemSettingsPage from './pages/dashboard/admin/SystemSettingsPage'
import BookingPage from './pages/dashboard/member/BookingPage'
import CartPage from './pages/dashboard/member/CartPage'
import CheckoutPage from './pages/dashboard/member/CheckoutPage'
import DepositPage from './pages/dashboard/member/DepositPage'
import HealthPage from './pages/dashboard/member/HealthPage'
import MemberDashboard from './pages/dashboard/member/MemberDashboard'
import MemberStorePage from './pages/dashboard/member/MemberStorePage'
import MyActivityPage from './pages/dashboard/member/MyActivityPage'
import MyFeedbackPage from './pages/dashboard/member/MyFeedbackPage'
import OrderHistoryPage from './pages/dashboard/member/OrderHistoryPage'
import OrderTrackingPage from './pages/dashboard/member/OrderTrackingPage'
import ProductDetailPage from './pages/dashboard/member/ProductDetailPage'

import WorkoutPage from './pages/dashboard/member/WorkoutPage'
import PTSchedulePage from './pages/dashboard/pt/PTSchedulePage'
import PTStudentPage from './pages/dashboard/pt/PTStudentPage'
import SellerOrdersPage from './pages/dashboard/seller/SellerOrdersPage'
import SellerProductsPage from './pages/dashboard/seller/SellerProductsPage'
import StaffCheckinPage from './pages/dashboard/staff/StaffCheckinPage'
import StaffMemberPage from './pages/dashboard/staff/StaffMemberPage'
import AboutPage from './pages/public/AboutPage'
import PartnershipPage from './pages/public/PartnershipPage'
import HelpCenterPage from './pages/public/HelpCenterPage'
import PolicyPage from './pages/public/PolicyPage'

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

function HomeRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Đang tải...
      </div>
    )
  }

  return user ? <MemberDashboard /> : <Navigate to="/about" replace />
}

function MemberCheckinPage() {
  const { t } = useTranslation()
  return (
    <MemberLayout>
      <div className="member-page">
        <div className="rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))] p-8 max-[640px]:p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">
            {t('checkin_page.overline')}
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-[var(--gs-text)]">{t('checkin_page.title')}</h1>
          <p className="mt-2 text-sm text-[var(--gs-text-muted)]">
            {t('checkin_page.under_development')}
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
            activeBarHeight: 0,
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
        <Route path="/hop-tac" element={<PartnershipPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/gioi-thieu" element={<AboutPage />} />
        <Route path="/help" element={<PrivateRoute><HelpCenterPage /></PrivateRoute>} />
        <Route path="/policies" element={<PrivateRoute><PolicyPage /></PrivateRoute>} />


        {/* ADMIN */}
        <Route path="/admin" element={<PrivateRoute><AdminDashboard /></PrivateRoute>} />
        <Route path="/admin/plans" element={<PrivateRoute><AdminPlansPage /></PrivateRoute>} />
        <Route path="/admin/partnerships" element={<PrivateRoute><AdminPartnershipRequestsPage /></PrivateRoute>} />
        <Route path="/admin/shop" element={<Navigate to="/admin/partnerships" />} />
        <Route path="/admin/users" element={<PrivateRoute><AdminUsersPage /></PrivateRoute>} />
        <Route path="/admin/members" element={<PrivateRoute><AdminMembersPage /></PrivateRoute>} />
        <Route path="/admin/pts" element={<PrivateRoute><AdminTrainersPage /></PrivateRoute>} />
        <Route path="/admin/reports" element={<PrivateRoute><AdminReports /></PrivateRoute>} />
        <Route path="/admin/system-settings" element={<PrivateRoute><SystemSettingsPage /></PrivateRoute>} />
        <Route path="/admin/faqs" element={<PrivateRoute><FAQManagerPage /></PrivateRoute>} />
        <Route path="/admin/feedback" element={<PrivateRoute><FeedbackManagerPage /></PrivateRoute>} />
        <Route path="/admin/policies" element={<PrivateRoute><PolicyManagerPage /></PrivateRoute>} />
        {/* SELLER */}
        <Route path="/seller" element={<Navigate to="/seller/products" />} />
        <Route path="/seller/products" element={<PrivateRoute><SellerProductsPage /></PrivateRoute>} />
        <Route path="/seller/orders" element={<PrivateRoute><SellerOrdersPage /></PrivateRoute>} />
        {/* STAFF */}
        <Route path="/staff" element={<Navigate to="/staff/checkin" />} />
        <Route path="/staff/checkin" element={<PrivateRoute><StaffCheckinPage /></PrivateRoute>} />
        <Route path="/staff/members" element={<PrivateRoute><StaffMemberPage /></PrivateRoute>} />

        {/* PT */}
        <Route path="/pt" element={<Navigate to="/pt/schedule" />} />
        <Route path="/pt/schedule" element={<PrivateRoute><PTSchedulePage /></PrivateRoute>} />
        <Route path="/pt/student" element={<PrivateRoute><PTStudentPage /></PrivateRoute>} />

        {/* MEMBER */}
        <Route path="/" element={<HomeRoute />} />
        <Route path="/deposit" element={<PrivateRoute><DepositPage /></PrivateRoute>} />
        <Route path="/checkout" element={<PrivateRoute><CheckoutPage /></PrivateRoute>} />
        <Route path="/orders" element={<PrivateRoute><OrderHistoryPage /></PrivateRoute>} />
        <Route path="/track/:id" element={<PrivateRoute><OrderTrackingPage /></PrivateRoute>} />
        <Route path="/store" element={<PrivateRoute><MemberStorePage /></PrivateRoute>} />
        <Route path="/store/:storeId" element={<PrivateRoute><MemberStorePage /></PrivateRoute>} />
        <Route path="/cart" element={<PrivateRoute><CartPage /></PrivateRoute>} />
        <Route path="/product/:id" element={<PrivateRoute><ProductDetailPage /></PrivateRoute>} />
        <Route path="/booking" element={<PrivateRoute><BookingPage /></PrivateRoute>} />
        <Route path="/health" element={<PrivateRoute><HealthPage /></PrivateRoute>} />
        <Route path="/workout" element={<PrivateRoute><WorkoutPage /></PrivateRoute>} />
        <Route path="/checkin" element={<PrivateRoute><MemberCheckinPage /></PrivateRoute>} />
        <Route path="/feedback" element={<PrivateRoute><MyFeedbackPage /></PrivateRoute>} />
        <Route path="/my-feedback" element={<PrivateRoute><MyFeedbackPage /></PrivateRoute>} />
        <Route path="/my-activity" element={<PrivateRoute><MyActivityPage /></PrivateRoute>} />
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
