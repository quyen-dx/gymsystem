import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './hook/useAuth'

import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import LoginPage from './pages/auth/LoginPage'
import OauthSuccessPage from './pages/auth/OauthSuccessPage'
import ProfilePage from './pages/auth/ProfilePage'
import RegisterPage from './pages/auth/Registerpage'

import AdminPlansPage from './pages/admin/AdminPlansPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminDashboard from './pages/dashboard/AdminDashboard'

import MemberDashboard from './pages/dashboard/MemberDashboard'
import PTDashboard from './pages/dashboard/PTDashboard'
import StaffDashboard from './pages/dashboard/StaffDashboard'

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

        {/* PROFILE */}
        <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />

        {/* ADMIN */}
        <Route path="/dashboard/admin" element={<PrivateRoute><AdminDashboard /></PrivateRoute>} />
        <Route path="/dashboard/admin/plans" element={<PrivateRoute><AdminPlansPage /></PrivateRoute>} />
        <Route path="/dashboard/admin/users" element={<PrivateRoute><AdminUsersPage /></PrivateRoute>} />
        {/* STAFF */}
        <Route path="/dashboard/staff" element={<PrivateRoute><StaffDashboard /></PrivateRoute>} />

        {/* PT */}
        <Route path="/dashboard/pt" element={<PrivateRoute><PTDashboard /></PrivateRoute>} />

        {/* MEMBER */}
        <Route path="/dashboard/member" element={<PrivateRoute><MemberDashboard /></PrivateRoute>} />

        {/* DEFAULT */}
        <Route path="/" element={<Navigate to="/login" />} />

      </Routes>
    </ThemeProvider>
  )
}