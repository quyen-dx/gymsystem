import { App as AntdApp, Button, ConfigProvider, theme } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import FeatureDisabled from './components/system/FeatureDisabled'
import { getAuthToken, startRefreshScheduler } from './services/api'
import { SystemSettingsProvider, useSystemSettings } from './context/SystemSettingsContext'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import { useAuth } from './hooks/useAuth'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import LoginPage from './pages/auth/LoginPage'
import OauthSuccessPage from './pages/auth/OauthSuccessPage'
import RegisterPage from './pages/auth/Registerpage'
import AdminCheckinPage from './pages/dashboard/admin/AdminCheckinPage'
import AdminDashboard from './pages/dashboard/admin/AdminDashboard'
import AdminMembersPage from './pages/dashboard/admin/AdminMembersPage'
import MatchmakingPage from './pages/dashboard/admin/MatchmakingPage'
import AdminMembersEditPage from './pages/dashboard/admin/AdminMembersEditPage'
import MemberDetailPage from './pages/dashboard/admin/MemberDetailPage'
import AdminPartnershipRequestsPage from './pages/dashboard/admin/AdminPartnershipRequestsPage'
import AdminPlanCreatePage from './pages/dashboard/admin/AdminPlanCreatePage'
import AdminPlansPage from './pages/dashboard/admin/AdminPlansPage'
import AdminFeatureManagePage from './pages/dashboard/admin/AdminFeatureManagePage'
import AdminReports from './pages/dashboard/admin/AdminReports'
import AdminTrainersPage from './pages/dashboard/admin/AdminTrainersPage'
import AdminTrainersCreatePage from './pages/dashboard/admin/AdminTrainersCreatePage'
import AdminTrainersEditPage from './pages/dashboard/admin/AdminTrainersEditPage'
import TrainerDetailPage from './pages/dashboard/admin/TrainerDetailPage'
import AdminUsersPage from './pages/dashboard/admin/AdminUsersPage'
import AdminUserDetailPage from './pages/dashboard/admin/AdminUserDetailPage'

import FAQCreatePage from './pages/dashboard/admin/FAQCreatePage'
import FAQManagerPage from './pages/dashboard/admin/FAQManagerPage'
import FeedbackManagerPage from './pages/dashboard/admin/FeedbackManagerPage'
import PolicyCreatePage from './pages/dashboard/admin/PolicyCreatePage'
import PolicyManagerPage from './pages/dashboard/admin/PolicyManagerPage'
import SystemSettingsPage from './pages/dashboard/admin/SystemSettingsPage'
import BookingPage from './pages/dashboard/member/BookingPage'
import CartPage from './pages/dashboard/member/CartPage'
import MemberCheckinPage from './pages/dashboard/member/MemberCheckinPage'
import MemberScanPage from './pages/dashboard/member/MemberScanPage'
import MemberSessionSelectPage from './pages/dashboard/member/MemberSessionSelectPage'
import CheckoutPage from './pages/dashboard/member/CheckoutPage'
import DepositPage from './pages/dashboard/member/DepositPage'
import MemberDashboard from './pages/dashboard/member/MemberDashboard'
import MemberStorePage from './pages/dashboard/member/MemberStorePage'
import MyActivityPage from './pages/dashboard/member/MyActivityPage'
import MyFeedbackPage from './pages/dashboard/member/MyFeedbackPage'
import MemberNotificationsPage from './pages/dashboard/member/MemberNotificationsPage'
import MyMembershipPage from './pages/dashboard/member/MyMembershipPage'
import CancelMembershipPage from './pages/dashboard/member/CancelMembershipPage'
import RenewMembershipPage from './pages/dashboard/member/RenewMembershipPage'
import OrderHistoryPage from './pages/dashboard/member/OrderHistoryPage'
import OrderTrackingPage from './pages/dashboard/member/OrderTrackingPage'
import PlansPage from './pages/dashboard/member/PlansPage'
import ProductDetailPage from './pages/dashboard/member/ProductDetailPage'

import WorkoutPage from './pages/dashboard/member/WorkoutPage'
import AdminTrainingClassesPage from './pages/dashboard/admin/TrainingClassesPage'
import AdminFloorsZonesPage from './pages/dashboard/admin/FloorsZonesPage'
import AdminTrainerSchedulesPage from './pages/dashboard/admin/AdminTrainerSchedulesPage'
import AdminReplacementRequestsPage from './pages/dashboard/admin/AdminReplacementRequestsPage'
import PTClientsPage from './pages/dashboard/pt/PTClientsPage'
import CreateSchedulePage from './pages/dashboard/pt/CreateSchedulePage'
import PTWorkoutProgressPage from './pages/dashboard/pt/PTWorkoutProgressPage'
import PTSchedulePage from './pages/dashboard/pt/PTSchedulePage'
import PTNotificationsPage from './pages/dashboard/pt/PTNotificationsPage'
import PTWorkoutFormPage from './pages/dashboard/pt/PTWorkoutFormPage'
import PTWorkoutsPage from './pages/dashboard/pt/PTWorkoutsPage'
import PTWorkoutViewPage from './pages/dashboard/pt/PTWorkoutViewPage'
import AdminWorkoutReportsPage from './pages/dashboard/admin/AdminWorkoutReportsPage'
import AdminPTAssignmentEndRequestsPage from './pages/dashboard/admin/AdminPTAssignmentEndRequestsPage'
import AdminNotificationsPage from './pages/dashboard/admin/AdminNotificationsPage'
import SellerOrdersPage from './pages/dashboard/seller/SellerOrdersPage'
import SellerProductCreatePage from './pages/dashboard/seller/SellerProductCreatePage'
import SellerProductEditPage from './pages/dashboard/seller/SellerProductEditPage'
import SellerProductsPage from './pages/dashboard/seller/SellerProductsPage'
import SellerRevenuePage from './pages/dashboard/seller/SellerRevenuePage'
import SellerShopPage from './pages/dashboard/seller/SellerShopPage'
import StaffCheckinPage from './pages/dashboard/staff/StaffCheckinPage'
import StaffMemberPage from './pages/dashboard/staff/StaffMemberPage'
import StaffNotificationsPage from './pages/dashboard/staff/StaffNotificationsPage'
import StaffMemberNewPage from './pages/dashboard/staff/StaffMemberNewPage'
import StaffPlanCounterPage from './pages/dashboard/staff/StaffPlanCounterPage'
import StaffPaymentsPage from './pages/dashboard/staff/StaffPaymentsPage'
import AboutPage from './pages/public/AboutPage'
import HelpCenterPage from './pages/public/HelpCenterPage'
import MaintenancePage from './pages/public/MaintenancePage'
import PartnershipPage from './pages/public/PartnershipPage'
import PolicyPage from './pages/public/PolicyPage'
import DepositScanPage from './pages/public/DepositScanPage'
import BankTransferDemoPage from './pages/public/BankTransferDemoPage'
import BankTransferPage from './pages/public/BankTransferPage'
import AccountProfilePage from './pages/auth/AccountProfilePage'
import BookingDetailPage from './pages/dashboard/member/BookingDetailPage'



function LoadingScreen() {
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), 10000)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="app-loading-screen">
      <div>{timedOut ? 'Máy chủ không khả dụng' : 'Đang tải...'}</div>
      {timedOut && <Button type="primary" onClick={() => window.location.reload()}>{'Thử lại'}</Button>}
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

  if (!loading && (user?.role === 'super_admin' || user?.role === 'admin')) return <Navigate to="/admin/system-settings" replace />
  return <MaintenancePage />
}





function AppWithTheme() {
  const { tokens, dark } = useTheme()
  const { user, loading } = useAuth()
  const { settings, loading: settingsLoading } = useSystemSettings()
  const location = useLocation()

  useEffect(() => {
    if (getAuthToken()) startRefreshScheduler()
  }, [])
  const antdTheme = useMemo(() => ({
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
  }), [dark, tokens])

  useEffect(() => {
    ConfigProvider.config({
      holderRender: (children) => (
        <ConfigProvider theme={antdTheme}>
          <AntdApp>{children}</AntdApp>
        </ConfigProvider>
      ),
    })
  }, [antdTheme])

  if (!loading && !settingsLoading && user && user.role !== 'super_admin' && user.role !== 'admin' && settings.general.maintenanceMode && location.pathname !== '/maintenance') {
    return <Navigate to="/maintenance" replace />
  }

  return (
    <ConfigProvider theme={antdTheme}>
      <AntdApp>
        <Routes>

        {/* AUTH */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/oauth-success" element={<OauthSuccessPage />} />
        <Route path="/maintenance" element={<MaintenanceRoute />} />
        <Route path="/deposit-scan" element={<DepositScanPage />} />
        <Route path="/bank-transfer-demo" element={<BankTransferDemoPage />} />
        <Route path="/bank-transfer/:paymentId" element={<BankTransferPage />} />
        <Route path="/hop-tac" element={<PartnershipPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/help" element={<PrivateRoute><HelpCenterPage /></PrivateRoute>} />
        <Route path="/policies" element={<PrivateRoute><PolicyPage /></PrivateRoute>} />


        {/* ADMIN */}
        <Route path="/admin" element={<PrivateRoute><AdminDashboard /></PrivateRoute>} />
        <Route path="/admin/plans/create" element={<PrivateRoute feature="billing.allowPlanPurchase"><AdminPlanCreatePage /></PrivateRoute>} />
        <Route path="/admin/plans" element={<PrivateRoute feature="billing.allowPlanPurchase"><AdminPlansPage /></PrivateRoute>} />
        <Route path="/admin/features" element={<PrivateRoute><AdminFeatureManagePage /></PrivateRoute>} />
        <Route path="/admin/partnerships" element={<PrivateRoute><AdminPartnershipRequestsPage /></PrivateRoute>} />
        <Route path="/admin/shop" element={<Navigate to="/admin/partnerships" />} />
        <Route path="/admin/users" element={<PrivateRoute><AdminUsersPage /></PrivateRoute>} />
        <Route path="/admin/users/:id" element={<PrivateRoute><AdminUserDetailPage /></PrivateRoute>} />
        <Route path="/admin/members" element={<PrivateRoute><AdminMembersPage /></PrivateRoute>} />
        <Route path="/admin/member-requests/match" element={<PrivateRoute><MatchmakingPage /></PrivateRoute>} />
        <Route path="/admin/members/:id/edit" element={<PrivateRoute><AdminMembersEditPage /></PrivateRoute>} />
        <Route path="/admin/members/:id" element={<PrivateRoute><MemberDetailPage /></PrivateRoute>} />
        <Route path="/admin/trainers" element={<PrivateRoute feature="pt.moduleEnabled"><AdminTrainersPage /></PrivateRoute>} />
        <Route path="/admin/trainers/create" element={<PrivateRoute feature="pt.moduleEnabled"><AdminTrainersCreatePage /></PrivateRoute>} />
        <Route path="/admin/trainers/:id/edit" element={<PrivateRoute feature="pt.moduleEnabled"><AdminTrainersEditPage /></PrivateRoute>} />
        <Route path="/admin/trainers/:id" element={<PrivateRoute feature="pt.moduleEnabled"><TrainerDetailPage /></PrivateRoute>} />
        <Route path="/admin/pts" element={<Navigate to="/admin/trainers" replace />} />
        <Route path="/admin/reports" element={<PrivateRoute feature="reports.revenueChartEnabled"><AdminReports /></PrivateRoute>} />
        <Route path="/admin/checkin" element={<PrivateRoute><AdminCheckinPage /></PrivateRoute>} />
        <Route path="/admin/checkin-history" element={<Navigate to="/admin/checkin?tab=history" replace />} />
        <Route path="/admin/daily-qr" element={<Navigate to="/admin/checkin?tab=qr" replace />} />
        <Route path="/admin/system-settings" element={<PrivateRoute><SystemSettingsPage /></PrivateRoute>} />
        <Route path="/admin/faqs/create" element={<PrivateRoute><FAQCreatePage /></PrivateRoute>} />
        <Route path="/admin/faqs/:faqId/edit" element={<PrivateRoute><FAQCreatePage /></PrivateRoute>} />
        <Route path="/admin/faqs" element={<PrivateRoute><FAQManagerPage /></PrivateRoute>} />
        <Route path="/admin/feedback" element={<PrivateRoute><FeedbackManagerPage /></PrivateRoute>} />
        <Route path="/admin/training-classes" element={<PrivateRoute><AdminTrainingClassesPage /></PrivateRoute>} />
        <Route path="/admin/floors-zones" element={<PrivateRoute><AdminFloorsZonesPage /></PrivateRoute>} />
        <Route path="/admin/trainer-schedules" element={<PrivateRoute feature="pt.scheduleEnabled"><AdminTrainerSchedulesPage /></PrivateRoute>} />
        <Route path="/admin/replacement-requests" element={<PrivateRoute feature="pt.scheduleEnabled"><AdminReplacementRequestsPage /></PrivateRoute>} />
        <Route path="/admin/policies/create" element={<PrivateRoute><PolicyCreatePage /></PrivateRoute>} />
        <Route path="/admin/policies/:policyId/edit" element={<PrivateRoute><PolicyCreatePage /></PrivateRoute>} />
        <Route path="/admin/policies" element={<PrivateRoute><PolicyManagerPage /></PrivateRoute>} />
        <Route path="/admin/workout-reports" element={<PrivateRoute feature="pt.moduleEnabled"><AdminWorkoutReportsPage /></PrivateRoute>} />
        <Route path="/admin/pt-assignment-end-requests" element={<PrivateRoute><AdminPTAssignmentEndRequestsPage /></PrivateRoute>} />
        <Route path="/admin/trainer-end-requests" element={<PrivateRoute><AdminPTAssignmentEndRequestsPage /></PrivateRoute>} />
        <Route path="/admin/notifications" element={<PrivateRoute><AdminNotificationsPage /></PrivateRoute>} />
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
        <Route path="/staff/members/new" element={<PrivateRoute><StaffMemberNewPage /></PrivateRoute>} />
        <Route path="/staff/members/:memberId/register-plan" element={<PrivateRoute><StaffPlanCounterPage mode="register" /></PrivateRoute>} />
        <Route path="/staff/members/:memberId/renew-plan" element={<PrivateRoute><StaffPlanCounterPage mode="renew" /></PrivateRoute>} />
        <Route path="/staff/payments" element={<PrivateRoute><StaffPaymentsPage /></PrivateRoute>} />
        <Route path="/staff/notifications" element={<PrivateRoute><StaffNotificationsPage /></PrivateRoute>} />

        {/* PT */}
        <Route path="/pt" element={<Navigate to="/pt/schedule" replace />} />
        <Route path="/pt/schedule" element={<PrivateRoute feature="pt.scheduleEnabled"><PTSchedulePage /></PrivateRoute>} />


        <Route path="/pt/clients" element={<PrivateRoute feature="pt.moduleEnabled"><PTClientsPage /></PrivateRoute>} />
        <Route path="/pt/clients/:memberId/create-schedule" element={<PrivateRoute feature="pt.moduleEnabled"><CreateSchedulePage /></PrivateRoute>} />
        <Route path="/pt/clients/:memberId/progress" element={<PrivateRoute feature="pt.moduleEnabled"><PTWorkoutProgressPage /></PrivateRoute>} />
        <Route path="/pt/student" element={<Navigate to="/pt/clients" replace />} />
        <Route path="/pt/workouts" element={<PrivateRoute feature="pt.moduleEnabled"><PTWorkoutsPage /></PrivateRoute>} />
        <Route path="/pt/workouts/create" element={<PrivateRoute feature="pt.moduleEnabled"><PTWorkoutFormPage /></PrivateRoute>} />
        <Route path="/pt/workouts/edit/:id" element={<PrivateRoute feature="pt.moduleEnabled"><PTWorkoutFormPage /></PrivateRoute>} />
        <Route path="/pt/workouts/view/:id" element={<PrivateRoute feature="pt.moduleEnabled"><PTWorkoutViewPage /></PrivateRoute>} />
        <Route path="/pt/notifications" element={<PrivateRoute><PTNotificationsPage /></PrivateRoute>} />

        {/* ACCOUNT */}
        <Route path="/account/profile" element={<PrivateRoute><AccountProfilePage /></PrivateRoute>} />

        {/* MEMBER */}
        <Route path="/" element={<HomeRoute />} />
        <Route path="/dashboard" element={<PrivateRoute><MemberDashboard /></PrivateRoute>} />
        <Route path="/deposit" element={<PrivateRoute feature="billing.qrPaymentEnabled"><DepositPage /></PrivateRoute>} />
        <Route path="/checkout" element={<PrivateRoute feature="shop.cartEnabled"><CheckoutPage /></PrivateRoute>} />
        <Route path="/orders" element={<PrivateRoute><OrderHistoryPage /></PrivateRoute>} />
        <Route path="/track/:id" element={<PrivateRoute><OrderTrackingPage /></PrivateRoute>} />
        <Route path="/store" element={<PrivateRoute feature="shop.productStoreEnabled"><MemberStorePage /></PrivateRoute>} />
        <Route path="/plans" element={<PrivateRoute feature="billing.allowPlanPurchase"><PlansPage /></PrivateRoute>} />
        <Route path="/my-membership" element={<PrivateRoute feature="billing.allowPlanPurchase"><MyMembershipPage /></PrivateRoute>} />
        <Route path="/my-membership/cancel-request" element={<PrivateRoute feature="billing.allowPlanPurchase"><CancelMembershipPage /></PrivateRoute>} />
        <Route path="/my-membership/renew" element={<PrivateRoute feature="billing.allowPlanPurchase"><RenewMembershipPage /></PrivateRoute>} />
        <Route path="/store/:storeId" element={<PrivateRoute feature="shop.productStoreEnabled"><MemberStorePage /></PrivateRoute>} />
        <Route path="/cart" element={<PrivateRoute feature="shop.cartEnabled"><CartPage /></PrivateRoute>} />
        <Route path="/product/:id" element={<PrivateRoute feature={['shop.productStoreEnabled', 'shop.productDetailPageEnabled']}><ProductDetailPage /></PrivateRoute>} />
        <Route path="/booking" element={<PrivateRoute feature="pt.memberBookingEnabled"><BookingPage /></PrivateRoute>} />
        <Route path="/booking/:ptId" element={<BookingDetailPage />} />
        <Route path="/workout" element={<PrivateRoute feature="workout.workoutPlanEnabled"><WorkoutPage /></PrivateRoute>} />
        <Route path="/checkin" element={<PrivateRoute feature="checkin.qrCheckinEnabled"><MemberCheckinPage /></PrivateRoute>} />
        <Route path="/checkin/scan" element={<PrivateRoute><MemberScanPage /></PrivateRoute>} />
        <Route path="/checkin/sessions" element={<PrivateRoute><MemberSessionSelectPage /></PrivateRoute>} />
        <Route path="/notifications" element={<PrivateRoute><MemberNotificationsPage /></PrivateRoute>} />
        <Route path="/feedback" element={<PrivateRoute><MyFeedbackPage /></PrivateRoute>} />
        <Route path="/my-feedback" element={<PrivateRoute><MyFeedbackPage /></PrivateRoute>} />
        <Route path="/my-activity" element={<PrivateRoute><MyActivityPage /></PrivateRoute>} />
        </Routes>
      </AntdApp>
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
