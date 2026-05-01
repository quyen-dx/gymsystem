import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './hook/useAuth'
{/* AUTH */}
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import LoginPage from './pages/auth/LoginPage'
import OauthSuccessPage from './pages/auth/OauthSuccessPage'
import RegisterPage from './pages/auth/Registerpage'

{/* PROFILE */}
import ProfilePage from './pages/auth/ProfilePage'

{/* ADMIN */}
import AdminPlansPage from './pages/admin/AdminPlansPage'
import AdminShopPage from './pages/admin/AdminShopPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminDashboard from './pages/dashboard/AdminDashboard'

{/*Dashboard*/}
import MemberDashboard from './pages/dashboard/MemberDashboard'
import PTDashboard from './pages/dashboard/PTDashboard'
import StaffDashboard from './pages/dashboard/StaffDashboard'

 {/* MEMBER */}
import CartPage from './pages/member/CartPage'
import MemberStorePage from './pages/member/MemberStorePage'
import ProductDetailPage from './pages/member/ProductDetailPage'
import SellerProductsPage from './pages/seller/SellerProductsPage'

import ThemeProvider from './context/ThemeProvider'
import AdminMembersPage from './pages/admin/AdminMembersPage'
import AdminTrainersPage from './pages/admin/AdminTrainersPage'

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

        {/* PROFILE */}
        <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />

        {/* ADMIN */}
        <Route path="/dashboard/admin" element={<PrivateRoute><AdminDashboard /></PrivateRoute>} />
        <Route path="/dashboard/admin/plans" element={<PrivateRoute><AdminPlansPage /></PrivateRoute>} />
        <Route path="/dashboard/admin/shop" element={<PrivateRoute><AdminShopPage /></PrivateRoute>} />
        <Route path="/dashboard/admin/users" element={<PrivateRoute><AdminUsersPage /></PrivateRoute>} />
        <Route path="/dashboard/admin/members" element={<PrivateRoute><AdminMembersPage /></PrivateRoute>} />
        <Route path="/dashboard/admin/pts" element={<PrivateRoute><AdminTrainersPage /></PrivateRoute>} />
        {/* SELLER */}
        <Route path="/dashboard/seller/products" element={<PrivateRoute><SellerProductsPage /></PrivateRoute>} />
        {/* STAFF */}
        <Route path="/dashboard/staff" element={<PrivateRoute><StaffDashboard /></PrivateRoute>} />

        {/* PT */}
        <Route path="/dashboard/pt" element={<PrivateRoute><PTDashboard /></PrivateRoute>} />

        {/* MEMBER */}
        <Route path="/dashboard/member" element={<PrivateRoute><MemberDashboard /></PrivateRoute>} />
        <Route path="/dashboard/member/store" element={<PrivateRoute><MemberStorePage /></PrivateRoute>} />
        <Route path="/dashboard/member/shop/:shopId" element={<PrivateRoute><MemberStorePage /></PrivateRoute>} />
        <Route path="/dashboard/member/cart" element={<PrivateRoute><CartPage /></PrivateRoute>} />
        <Route path="/dashboard/member/store/:id" element={<PrivateRoute><ProductDetailPage /></PrivateRoute>} />
        {/* DEFAULT */}
        <Route path="/" element={<Navigate to="/login" />} />

      </Routes>
    </ThemeProvider>
  )
}
