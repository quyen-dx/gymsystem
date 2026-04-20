import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hook/useAuth'
import { authService } from '../../services/authService'

const getDashboardPath = (role?: string) => {
  if (role === 'admin') return '/dashboard/admin'
  if (role === 'staff') return '/dashboard/staff'
  if (role === 'pt') return '/dashboard/pt'
  return '/dashboard/member'
}

export default function OauthSuccessPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { updateUser } = useAuth()
  const [error, setError] = useState('')

  useEffect(() => {
    const syncOAuthLogin = async () => {
      const token = searchParams.get('token')

      if (!token) {
        navigate('/login?error=google_oauth_failed', { replace: true })
        return
      }

      localStorage.setItem('token', token)

      try {
        const { data } = await authService.getProfile()
        updateUser(data.user)
        navigate(getDashboardPath(data.user?.role), { replace: true })
      } catch {
        localStorage.removeItem('token')
        setError('Không thể hoàn tất đăng nhập Google. Vui lòng thử lại.')
      }
    }

    syncOAuthLogin()
  }, [navigate, searchParams, updateUser])

  return (
    <div className="flex min-h-screen items-center justify-center px-4 text-[var(--gs-text)]">
      <div className="rounded-[28px] border border-[var(--gs-border)] bg-[var(--gs-panel)] px-8 py-10 text-center shadow-[var(--gs-shadow)]">
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--gs-text-soft)]">Google OAuth</p>
        <h1 className="mt-3 text-3xl font-semibold">
          {error ? 'Đăng nhập thất bại' : 'Đăng nhập thành công'}
        </h1>
        <p className="mt-3 text-sm text-[var(--gs-text-muted)]">
          {error || 'Đang đồng bộ phiên đăng nhập và chuyển bạn tới dashboard...'}
        </p>
      </div>
    </div>
  )
}
