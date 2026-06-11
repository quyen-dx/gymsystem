import { Button, ConfigProvider, theme } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import MemberLayout from './components/layout/header/MemberLayout'
import FeatureDisabled from './components/system/FeatureDisabled'
import { getAuthToken } from './services/api'
import { SystemSettingsProvider, useSystemSettings } from './context/SystemSettingsContext'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import { useAuth } from './hooks/useAuth'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import LoginPage from './pages/auth/LoginPage'
import OauthSuccessPage from './pages/auth/OauthSuccessPage'
import RegisterPage from './pages/auth/Registerpage'
import AdminDashboard from './pages/dashboard/admin/AdminDashboard'
import AdminMembersPage from './pages/dashboard/admin/AdminMembersPage'
import MemberDetailPage from './pages/dashboard/admin/MemberDetailPage'
import AdminPartnershipRequestsPage from './pages/dashboard/admin/AdminPartnershipRequestsPage'
import AdminPlansPage from './pages/dashboard/admin/AdminPlansPage'
import AdminReports from './pages/dashboard/admin/AdminReports'
import AdminTrainersPage from './pages/dashboard/admin/AdminTrainersPage'
import TrainerDetailPage from './pages/dashboard/admin/TrainerDetailPage'
import AdminUsersPage from './pages/dashboard/admin/AdminUsersPage'
import FAQCreatePage from './pages/dashboard/admin/FAQCreatePage'
import FAQManagerPage from './pages/dashboard/admin/FAQManagerPage'
import FeedbackManagerPage from './pages/dashboard/admin/FeedbackManagerPage'
import PolicyCreatePage from './pages/dashboard/admin/PolicyCreatePage'
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
import PTBookingsPage from './pages/dashboard/pt/PTBookingsPage'
import PTClientsPage from './pages/dashboard/pt/PTClientsPage'
import PTSchedulePage from './pages/dashboard/pt/PTSchedulePage'
import PTWorkoutsPage from './pages/dashboard/pt/PTWorkoutsPage'
import SellerOrdersPage from './pages/dashboard/seller/SellerOrdersPage'
import SellerProductCreatePage from './pages/dashboard/seller/SellerProductCreatePage'
import SellerProductEditPage from './pages/dashboard/seller/SellerProductEditPage'
import SellerProductsPage from './pages/dashboard/seller/SellerProductsPage'
import SellerRevenuePage from './pages/dashboard/seller/SellerRevenuePage'
import SellerShopPage from './pages/dashboard/seller/SellerShopPage'
import StaffCheckinPage from './pages/dashboard/staff/StaffCheckinPage'
import StaffMemberPage from './pages/dashboard/staff/StaffMemberPage'
import StaffNotificationsPage from './pages/dashboard/staff/StaffNotificationsPage'
import StaffPaymentsPage from './pages/dashboard/staff/StaffPaymentsPage'
import AboutPage from './pages/public/AboutPage'
import HelpCenterPage from './pages/public/HelpCenterPage'
import MaintenancePage from './pages/public/MaintenancePage'
import PartnershipPage from './pages/public/PartnershipPage'
import PolicyPage from './pages/public/PolicyPage'

{/* ADMIN */ }

{/* Auth */ }

{/* PT */ }

{/* Staff */ }

{/* Member */ }

{/* Seller */ }

function LoadingScreen() {
  const { t } = useTranslation()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), 10000)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="app-loading-screen">
      <div>{timedOut ? t('common.server_unavailable') : t('common.loading')}</div>
      {timedOut && <Button type="primary" onClick={() => window.location.reload()}>{t('common.retry')}</Button>}
    </div>
  )
}

function PrivateRoute({ children, feature }: { children: React.ReactNode; feature?: string | string[] }) {
  const { user, loading } = useAuth()
  const { settings, loading: settingsLoading, isEnabled } = useSystemSettings()

  if (loading || settingsLoading) {
    return <LoadingScreen />
  }

  if (!user) return <Navigate to="/login" />
  if (settings.general.maintenanceMode && user.role !== 'admin') return <Navigate to="/maintenance" replace />
  const requiredFeatures = Array.isArray(feature) ? feature : feature ? [feature] : []
  if (requiredFeatures.some((featurePath) => !isEnabled(featurePath))) return <FeatureDisabled />
  return <>{children}</>
}

function HomeRoute() {
  const { user, loading } = useAuth()
  const { settings, loading: settingsLoading } = useSystemSettings()
  const hasToken = Boolean(getAuthToken())

  if (!hasToken && loading) return <Navigate to="/about" replace />

  if ((hasToken && loading) || settingsLoading) {
    return <LoadingScreen />
  }

  if (settings.general.maintenanceMode && user?.role !== 'admin') return <Navigate to="/maintenance" replace />
  return user ? <MemberDashboard /> : <Navigate to="/about" replace />
}

function MaintenanceRoute() {
  const { user, loading } = useAuth()

  if (!loading && user?.role === 'admin') return <Navigate to="/admin/system-settings" replace />
  return <MaintenancePage />
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
  const { tokens, dark } = useTheme()
  const { user, loading } = useAuth()
  const { settings, loading: settingsLoading } = useSystemSettings()
  const location = useLocation()

  if (!loading && !settingsLoading && user && user.role !== 'admin' && settings.general.maintenanceMode && location.pathname !== '/maintenance') {
    return <Navigate to="/maintenance" replace />
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorBgBase: tokens.bg,
          colorBgContainer: tokens.card,
          colorBgElevated: tokens.elevated,
          colorBgLayout: tokens.bg,
          colorBorder: tokens.border,
          colorBorderSecondary: tokens.border,
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
          colorPrimary: tokens.buttonBg,
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
            itemHoverColor: tokens.text,
            colorBgContainer: tokens.card,
            itemSelectedBg: tokens.activeBg,
            itemSelectedColor: tokens.activeText,
            itemHoverBg: tokens.outlineHoverBg,
            itemActiveBg: tokens.elevated,
            subMenuItemBg: tokens.card,
            groupTitleColor: tokens.muted,
            colorText: tokens.text,
            darkItemColor: tokens.text,
            darkItemBg: tokens.card,
            darkItemHoverBg: tokens.elevated,
            darkItemSelectedBg: tokens.activeBg,
            darkItemSelectedColor: tokens.activeText,
            darkItemHoverColor: tokens.text,
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
        <Route path="/maintenance" element={<MaintenanceRoute />} />
        <Route path="/hop-tac" element={<PartnershipPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/help" element={<PrivateRoute><HelpCenterPage /></PrivateRoute>} />
        <Route path="/policies" element={<PrivateRoute><PolicyPage /></PrivateRoute>} />


        {/* ADMIN */}
        <Route path="/admin" element={<PrivateRoute><AdminDashboard /></PrivateRoute>} />
        <Route path="/admin/plans" element={<PrivateRoute feature="billing.allowPlanPurchase"><AdminPlansPage /></PrivateRoute>} />
        <Route path="/admin/partnerships" element={<PrivateRoute><AdminPartnershipRequestsPage /></PrivateRoute>} />
        <Route path="/admin/shop" element={<Navigate to="/admin/partnerships" />} />
        <Route path="/admin/users" element={<PrivateRoute><AdminUsersPage /></PrivateRoute>} />
        <Route path="/admin/members" element={<PrivateRoute><AdminMembersPage /></PrivateRoute>} />
        <Route path="/admin/members/:id" element={<PrivateRoute><MemberDetailPage /></PrivateRoute>} />
        <Route path="/admin/trainers" element={<PrivateRoute feature="pt.moduleEnabled"><AdminTrainersPage /></PrivateRoute>} />
        <Route path="/admin/trainers/:id" element={<PrivateRoute feature="pt.moduleEnabled"><TrainerDetailPage /></PrivateRoute>} />
        <Route path="/admin/pts" element={<Navigate to="/admin/trainers" replace />} />
        <Route path="/admin/reports" element={<PrivateRoute feature="reports.revenueChartEnabled"><AdminReports /></PrivateRoute>} />
        <Route path="/admin/system-settings" element={<PrivateRoute><SystemSettingsPage /></PrivateRoute>} />
        <Route path="/admin/faqs/create" element={<PrivateRoute><FAQCreatePage /></PrivateRoute>} />
        <Route path="/admin/faqs" element={<PrivateRoute><FAQManagerPage /></PrivateRoute>} />
        <Route path="/admin/feedback" element={<PrivateRoute><FeedbackManagerPage /></PrivateRoute>} />
        <Route path="/admin/policies/create" element={<PrivateRoute><PolicyCreatePage /></PrivateRoute>} />
        <Route path="/admin/policies" element={<PrivateRoute><PolicyManagerPage /></PrivateRoute>} />
        {/* SELLER */}
        <Route path="/seller" element={<Navigate to="/seller/products" />} />
        <Route path="/seller/products" element={<PrivateRoute feature="shop.productStoreEnabled"><SellerProductsPage /></PrivateRoute>} />
        <Route path="/seller/products/create" element={<PrivateRoute feature="shop.productStoreEnabled"><SellerProductCreatePage /></PrivateRoute>} />
        <Route path="/seller/products/edit/:id" element={<PrivateRoute feature="shop.productStoreEnabled"><SellerProductEditPage /></PrivateRoute>} />
        <Route path="/seller/orders" element={<PrivateRoute feature="shop.productStoreEnabled"><SellerOrdersPage /></PrivateRoute>} />
        <Route path="/seller/shop" element={<PrivateRoute feature="shop.productStoreEnabled"><SellerShopPage /></PrivateRoute>} />
        <Route path="/seller/revenue" element={<PrivateRoute feature="shop.productStoreEnabled"><SellerRevenuePage /></PrivateRoute>} />
        {/* STAFF */}
        <Route path="/staff" element={<Navigate to="/staff/checkin" replace />} />
        <Route path="/staff/checkin" element={<PrivateRoute feature="checkin.qrCheckinEnabled"><StaffCheckinPage /></PrivateRoute>} />
        <Route path="/staff/members" element={<PrivateRoute><StaffMemberPage /></PrivateRoute>} />
        <Route path="/staff/payments" element={<PrivateRoute><StaffPaymentsPage /></PrivateRoute>} />
        <Route path="/staff/notifications" element={<PrivateRoute><StaffNotificationsPage /></PrivateRoute>} />

        {/* PT */}
        <Route path="/pt" element={<Navigate to="/pt/schedule" replace />} />
        <Route path="/pt/schedule" element={<PrivateRoute feature="pt.scheduleEnabled"><PTSchedulePage /></PrivateRoute>} />
        <Route path="/pt/clients" element={<PrivateRoute feature="pt.moduleEnabled"><PTClientsPage /></PrivateRoute>} />
        <Route path="/pt/student" element={<Navigate to="/pt/clients" replace />} />
        <Route path="/pt/workouts" element={<PrivateRoute feature="pt.moduleEnabled"><PTWorkoutsPage /></PrivateRoute>} />
        <Route path="/pt/bookings" element={<PrivateRoute feature="pt.moduleEnabled"><PTBookingsPage /></PrivateRoute>} />

        {/* MEMBER */}
        <Route path="/" element={<HomeRoute />} />
        <Route path="/dashboard" element={<PrivateRoute><MemberDashboard /></PrivateRoute>} />
        <Route path="/deposit" element={<PrivateRoute feature="billing.qrPaymentEnabled"><DepositPage /></PrivateRoute>} />
        <Route path="/checkout" element={<PrivateRoute feature="shop.cartEnabled"><CheckoutPage /></PrivateRoute>} />
        <Route path="/orders" element={<PrivateRoute><OrderHistoryPage /></PrivateRoute>} />
        <Route path="/track/:id" element={<PrivateRoute><OrderTrackingPage /></PrivateRoute>} />
        <Route path="/store" element={<PrivateRoute feature="shop.productStoreEnabled"><MemberStorePage /></PrivateRoute>} />
        <Route path="/store/:storeId" element={<PrivateRoute feature="shop.productStoreEnabled"><MemberStorePage /></PrivateRoute>} />
        <Route path="/cart" element={<PrivateRoute feature="shop.cartEnabled"><CartPage /></PrivateRoute>} />
        <Route path="/product/:id" element={<PrivateRoute feature={['shop.productStoreEnabled', 'shop.productDetailPageEnabled']}><ProductDetailPage /></PrivateRoute>} />
        <Route path="/booking" element={<PrivateRoute feature="pt.memberBookingEnabled"><BookingPage /></PrivateRoute>} />
        <Route path="/health" element={<PrivateRoute feature="workout.healthLogEnabled"><HealthPage /></PrivateRoute>} />
        <Route path="/workout" element={<PrivateRoute feature="workout.workoutPlanEnabled"><WorkoutPage /></PrivateRoute>} />
        <Route path="/checkin" element={<PrivateRoute feature="checkin.qrCheckinEnabled"><MemberCheckinPage /></PrivateRoute>} />
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
      <SystemSettingsProvider>
        <AppWithTheme />
      </SystemSettingsProvider>
    </ThemeProvider>
  )
}
