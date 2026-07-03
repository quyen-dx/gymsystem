import { useEffect, useState } from 'react'
import { Button } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { clearAuthSession, setAuthToken } from '../../services/api'
import { authService } from '../../services/authService'
import MaintenancePage from '../public/MaintenancePage'

const oauthErrorMessages: Record<string, string> = {
  ACCOUNT_LOCKED: 'Tài khoản đã bị khóa',
  GOOGLE_AUTH_FAILED: 'Đăng nhập Google thất bại',
  INVALID_TOKEN: 'Token không hợp lệ',
  SERVER_ERROR: 'Lỗi máy chủ',
}

const getDashboardPath = (role?: string) => {
  if (role === 'super_admin' || role === 'admin') return '/admin'
  if (role === 'seller') return '/seller'
  if (role === 'staff') return '/staff'
  if (role === 'pt') return '/pt'
  return '/'
}

export default function OauthSuccessPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { updateUser } = useAuth()
  const [error, setError] = useState('')

  useEffect(() => {
    const syncOAuthLogin = async () => {
      const token = searchParams.get('token')
      const errorCode = searchParams.get('error')

      if (errorCode === 'MAINTENANCE_MODE') {
        return
      }

      if (errorCode) {
        setError(oauthErrorMessages[errorCode] || 'Đăng nhập Google thất bại')
        return
      }

      if (!token) {
        setError('Token không hợp lệ')
        return
      }

      setAuthToken(token)

      try {
        const { data } = await authService.getProfile()
        updateUser(data.user)
        navigate(getDashboardPath(data.user?.role), { replace: true })
      } catch {
        clearAuthSession()
        setError('Token không hợp lệ')
      }
    }

    syncOAuthLogin()
  }, [navigate, searchParams, updateUser])

  if (searchParams.get('error') === 'MAINTENANCE_MODE') {
    return <MaintenancePage />
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 text-[var(--gs-text)]">
      <div className="rounded-[28px] border border-[var(--gs-border)] bg-[var(--gs-panel)] px-8 py-10 text-center shadow-[var(--gs-shadow)]">
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--gs-text-soft)]">{'Đăng nhập Google'}</p>
        <h1 className="mt-3 text-3xl font-semibold">
          {error ? 'Đăng nhập thất bại' : 'Đăng nhập thành công'}
        </h1>
        <p className="mt-3 text-sm text-[var(--gs-text-muted)]">
          {error || 'Đang đồng bộ phiên đăng nhập...'}
        </p>
        {error && (
          <Button className="mt-6" type="primary" onClick={() => navigate('/login', { replace: true })}>
            {'Quay lại đăng nhập'}
          </Button>
        )}
      </div>
    </div>
  )
}
