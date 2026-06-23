import { Result, Spin } from 'antd'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import HomeLandingSection from '../../../components/system/HomeLandingSection'
import { useAuth } from '../../../hooks/useAuth'
import { systemExperienceService } from '../../../services/systemExperienceService'
import { normalizeLandingData } from '../../../utils/localization'
import { getUserFirstName } from '../../../utils/userDisplay'

/**
 * Error Boundary for safe rendering
 */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: any) {
    console.error('HomeLandingSection error:', error)
  }

  render() {
    if (this.state.hasError) {
      return <Result status="500" title="Có lỗi khi tải trang" subTitle="Vui lòng tải lại trang" />
    }
    return this.props.children
  }
}

export default function MemberDashboard() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [landing, setLanding] = useState<any>(null)
  const langRef = useRef(i18n.language)
  const firstName = getUserFirstName(user, t('dashboard.greeting_fallback'))

  useEffect(() => {
    langRef.current = i18n.language
  }, [i18n.language])

  useEffect(() => {
    Promise.allSettled([
      systemExperienceService.getCmsPage('home'),
    ])
      .then(([landingRes]) => {
        if (landingRes.status === 'fulfilled' && landingRes.value.data?.landing) {
          setLanding(normalizeLandingData(landingRes.value.data.landing))
        } else {
          setLanding({})
        }
      })
      .catch((err) => {
        console.error('Failed to load landing data:', err)
        setLanding({})
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <MemberLayout>
      {loading ? (
        <div className="flex min-h-[420px] items-center justify-center"><Spin /></div>
      ) : (
        <ErrorBoundary>
          <HomeLandingSection
            landing={landing || {}}
            firstName={firstName}
            onNavigate={(path) => navigate(path)}
          />
        </ErrorBoundary>
      )}
    </MemberLayout>
  )
}
