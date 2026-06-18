import { useEffect, useState } from 'react'
import { Button } from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { clearAuthSession, setAuthToken } from '../../services/api'
import { authService } from '../../services/authService'
import MaintenancePage from '../public/MaintenancePage'

const oauthErrorKeyMap: Record<string, string> = {
  ACCOUNT_LOCKED: 'auth.accountLocked',
  GOOGLE_AUTH_FAILED: 'auth.googleOAuthFailed',
  INVALID_TOKEN: 'auth.invalidToken',
  SERVER_ERROR: 'auth.serverError',
}

const getDashboardPath = (role?: string) => {
  if (role === 'super_admin' || role === 'admin') return '/admin'
  if (role === 'seller') return '/seller'
  if (role === 'staff') return '/staff'
  if (role === 'pt') return '/pt'
  return '/'
}

export default function OauthSuccessPage() {
  const { t } = useTranslation()
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
        setError(t(oauthErrorKeyMap[errorCode] || 'auth.googleOAuthFailed'))
        return
      }

      if (!token) {
        setError(t('auth.invalidToken'))
        return
      }

      setAuthToken(token)

      try {
        const { data } = await authService.getProfile()
        updateUser(data.user)
        navigate(getDashboardPath(data.user?.role), { replace: true })
      } catch {
        clearAuthSession()
        setError(t('auth.invalidToken'))
      }
    }

    syncOAuthLogin()
  }, [navigate, searchParams, t, updateUser])

  if (searchParams.get('error') === 'MAINTENANCE_MODE') {
    return <MaintenancePage />
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 text-[var(--gs-text)]">
      <div className="rounded-[28px] border border-[var(--gs-border)] bg-[var(--gs-panel)] px-8 py-10 text-center shadow-[var(--gs-shadow)]">
        <p className="text-xs uppercase tracking-[0.28em] text-[var(--gs-text-soft)]">{t('auth.googleOAuthTitle')}</p>
        <h1 className="mt-3 text-3xl font-semibold">
          {error ? t('auth.oauthLoginFailed') : t('auth.oauthLoginSuccess')}
        </h1>
        <p className="mt-3 text-sm text-[var(--gs-text-muted)]">
          {error || t('auth.syncingSession')}
        </p>
        {error && (
          <Button className="mt-6" type="primary" onClick={() => navigate('/login', { replace: true })}>
            {t('auth.backToLogin')}
          </Button>
        )}
      </div>
    </div>
  )
}
