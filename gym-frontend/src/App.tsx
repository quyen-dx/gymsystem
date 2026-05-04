import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './hook/useAuth'
import AdminPlansPage from './pages/admin/AdminPlansPage'
import AdminShopPage from './pages/admin/AdminShopPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminMembersPage from './pages/admin/AdminMembersPage'
import AdminReports from './pages/admin/AdminReports'
import AdminTrainersPage from './pages/admin/AdminTrainersPage'

import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import LoginPage from './pages/auth/LoginPage'
import OauthSuccessPage from './pages/auth/OauthSuccessPage'
import RegisterPage from './pages/auth/Registerpage'

import AdminDashboard from './pages/dashboard/adminDB/AdminDashboard'
import MemberDashboard from './pages/dashboard/memberDB/MemberDashboard'
import PTDashboard from './pages/dashboard/ptDB/PTDashboard'
import PTMemberPage from './pages/dashboard/ptDB/PTMemberPage'
import StaffDashboard from './pages/dashboard/staffDB/StaffDashboard'
import StaffMemberPage from './pages/dashboard/staffDB/StaffMemberPage'

import CartPage from './pages/member/CartPage'
import CheckoutPage from './pages/member/CheckoutPage'
import DepositPage from './pages/member/DepositPage'
import MemberStorePage from './pages/member/MemberStorePage'
import OrderHistoryPage from './pages/member/OrderHistoryPage'
import OrderTrackingPage from './pages/member/OrderTrackingPage'
import ProductDetailPage from './pages/member/ProductDetailPage'
import TransferPage from './pages/member/TransferPage'
import WalletPage from './pages/member/WalletPage'
import BookingPage from './pages/member/BookingPage'
import HealthPage from './pages/member/HealthPage'
import WorkoutPage from './pages/member/WorkoutPage'

import SellerOrdersPage from './pages/seller/SellerOrdersPage'
import SellerProductsPage from './pages/seller/SellerProductsPage'

import ThemeProvider from './context/ThemeProvider'



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

export default function App() {
  return (
    <ThemeProvider>
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
        <Route path="/dashboard/admin/reports" element={<PrivateRoute><AdminReports /></PrivateRoute>} />
        {/* SELLER */}
        <Route path="/dashboard/seller/products" element={<PrivateRoute><SellerProductsPage /></PrivateRoute>} />
        <Route path="/dashboard/seller/orders" element={<PrivateRoute><SellerOrdersPage /></PrivateRoute>} />
        {/* STAFF */}
        <Route path="/dashboard/staff" element={<PrivateRoute><StaffDashboard /></PrivateRoute>} />
        <Route path="/dashboard/staff/members" element={<PrivateRoute><StaffMemberPage /></PrivateRoute>} />

        {/* PT */}
        <Route path="/dashboard/pt" element={<PrivateRoute><PTDashboard /></PrivateRoute>} />
        <Route path="/dashboard/pt/members" element={<PrivateRoute><PTMemberPage /></PrivateRoute>} />

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
        {/* DEFAULT */}
        <Route path="/" element={<Navigate to="/login" />} />

      </Routes>
    </ThemeProvider>
  )
}
