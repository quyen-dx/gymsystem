import { Spin } from 'antd'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import AboutLandingSection from '../../components/system/AboutLandingSection'
import { systemExperienceService } from '../../services/systemExperienceService'
import { normalizeLandingData } from '../../utils/localization'

class AboutErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('AboutPage render error:', error)
  }

  render() {
    if (this.state.hasError) {
      return <AboutLandingSection landing={normalizeLandingData({})} settings={{}} />
    }
    return this.props.children
  }
}

export default function AboutPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [landing, setLanding] = useState<any>(null)
  const [settings, setSettings] = useState<any>(null)

  useEffect(() => {
    Promise.all([
      systemExperienceService.getCmsPage('about'),
      systemExperienceService.getSettings(),
    ])
      .then(([landingRes, settingsRes]) => {
        console.log('GET /api/cms/page/about response:', landingRes.data)
        try {
          setLanding(normalizeLandingData(landingRes.data?.landing || {}))
          setSettings(settingsRes.data?.settings || {})
        } catch (error) {
          console.error('Invalid about CMS payload:', error, landingRes.data)
          setLanding(normalizeLandingData({}))
          setSettings({})
        }
      })
      .catch((error) => {
        console.error('Failed to load about CMS, rendering fallback:', error)
        setLanding(normalizeLandingData({}))
        setSettings({})
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--theme-bg)]">
        <Spin tip={t('system_experience.about.loading')} />
      </div>
    )
  }

  return (
    <AboutErrorBoundary>
      <AboutLandingSection landing={landing || normalizeLandingData({})} settings={settings || {}} onCtaClick={(link) => navigate(link)} />
    </AboutErrorBoundary>
  )
}
