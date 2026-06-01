import { Button, theme } from 'antd'
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSystemSettings } from '../../context/SystemSettingsContext'
import { getLocalizedText, normalizeLandingData } from '../../utils/localization'
import TypewriterSlogans from './TypewriterSlogans'

const pickLocalized = (value: any, language: string, fallback = '') => {
  return getLocalizedText(value, language, fallback)
}

const pickLocalizedSlogans = (slogans: Array<{ vi?: string; en?: string }> = [], language: string) => {
  return slogans
    .map((item) => pickLocalized(item, language, ''))
    .filter(Boolean)
}

type HomeLandingSectionProps = {
  landing?: any
  firstName?: string
  preview?: boolean
  mode?: 'page' | 'preview'
  previewVariant?: 'compact' | 'full'
  language?: string
  onNavigate?: (path: string) => void
  editable?: boolean
  onSettingsChange?: (settings: any) => void
}

type HomeHeroProps = {
  mode?: 'page' | 'preview'
  heroBadge: string
  heroSubtitle: string
  slogans: string[]
  language?: string
  primaryText: string
  secondaryText: string
  stats: Array<{ value: string; label: string }>
  showStats?: boolean
  showPrimaryCta?: boolean
  showSecondaryCta?: boolean
  landing?: any
  previewVariant?: 'compact' | 'full'
  onNavigate?: (path: string) => void
  editable?: boolean
  onSettingsChange?: (settings: any) => void
}

function HomeHero({
  mode = 'page',
  heroBadge,
  heroSubtitle,
  slogans,
  language,
  primaryText,
  secondaryText,
  stats,
  showStats = true,
  showPrimaryCta = true,
  showSecondaryCta = true,
  landing,
  previewVariant = 'compact',
  onNavigate,
}: HomeHeroProps) {
  const { token } = theme.useToken()
  const isPreview = mode === 'preview'
  const isCompactPreview = isPreview && previewVariant === 'compact'
  const heroTitleClass = isPreview
    ? "block max-w-full whitespace-normal font-extrabold leading-[1.25] tracking-[-0.03em]"
    : "max-w-[920px] font-extrabold leading-[1.25] tracking-[-0.03em] text-[clamp(32px,4vw,48px)] md:text-[clamp(40px,5vw,72px)] lg:text-[clamp(56px,6vw,96px)]"

  const statsGridClass = isPreview
    ? 'mt-10 grid grid-cols-1 min-[421px]:grid-cols-2 gap-px overflow-hidden rounded-lg border'
    : 'mt-10 grid grid-cols-1 min-[421px]:grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden rounded-lg border'

  return (
    <section
      className={`${isPreview ? 'overflow-visible px-7 py-12' : 'overflow-hidden px-5 py-16 md:px-8 md:pb-14 md:pt-[88px]'} relative bg-[length:40px_40px]`}
      style={{ backgroundColor: token.colorBgLayout, backgroundImage: 'linear-gradient(rgba(128,128,128,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,0.08) 1px, transparent 1px)' }}
    >
      <div className="absolute -right-36 -top-40 h-[420px] w-[420px] rounded-full blur-xl" style={{ background: 'radial-gradient(circle, var(--theme-accent-muted) 0%, transparent 70%)' }} />
      <div className={`${isPreview ? 'max-w-full' : 'max-w-6xl'} relative z-[1] mx-auto w-full`}>
        <div className="inline-flex max-w-full items-center gap-2.5 rounded-full border px-3.5 py-2 text-[13px] font-bold" style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder, color: token.colorTextSecondary }}>
          <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--theme-accent)]" />
          <span className="min-w-0 break-words">{heroBadge}</span>
        </div>
        <h1
          className={`${heroTitleClass} mt-7 min-h-[1.25em]`}
          style={{
            color: 'var(--hero-text)',
            ...(isPreview ? {
              fontSize: isCompactPreview ? 'clamp(28px, 3vw, 48px)' : 'clamp(36px, 4vw, 56px)',
              whiteSpace: 'normal',
              overflow: 'visible',
              textOverflow: 'unset',
              display: 'block',
              maxWidth: '100%',
              wordBreak: 'keep-all',
              overflowWrap: 'break-word',
            } : {}),
          }}
        >
          <TypewriterSlogans slogans={slogans} language={language} />
        </h1>
        <p className={`${isPreview ? 'max-w-full text-[15px]' : 'max-w-[720px] text-[15px] md:text-[17px]'} mt-5 leading-7`} style={{ color: 'var(--hero-muted)' }}>{heroSubtitle}</p>
        {(showPrimaryCta || showSecondaryCta) && (
          <div className="mt-8 flex flex-col flex-wrap gap-3 min-[421px]:flex-row">
            {showPrimaryCta && <Button size="large" className="!h-[46px] !rounded-full !px-6 !font-extrabold" type="primary" onClick={() => onNavigate?.(landing?.ctaLink || '/booking')}>{primaryText}</Button>}
            {showSecondaryCta && <Button size="large" className="!h-[46px] !rounded-full !bg-transparent !px-6 !font-extrabold hover:!bg-[var(--hero-outline-hover-bg)]" style={{ borderColor: 'var(--hero-outline-border)', color: 'var(--hero-text)' }} onClick={() => onNavigate?.(landing?.secondaryCtaLink || '/checkin')}>{secondaryText}</Button>}
          </div>
        )}
        {showStats && (
          <div
            className={statsGridClass}
            style={{ borderColor: token.colorBorder, backgroundColor: token.colorBorder }}
          >
            {stats.map((item, idx) => (
              <div
                key={`stat-${idx}`}
                className="flex min-h-[88px] min-w-0 flex-col justify-center p-4"
                style={{ backgroundColor: token.colorBgContainer }}
              >
                <strong className="mb-2 block text-2xl leading-none">{item.value}</strong>
                <span className="block break-words text-[13px]" style={{ color: token.colorTextSecondary }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function HomeLandingSectionInner({
  landing,
  firstName = '',
  preview = false,
  mode,
  previewVariant = 'compact',
  language,
  onNavigate,
  editable = false,
  onSettingsChange,
}: HomeLandingSectionProps) {
  const { t, i18n } = useTranslation()
  const { settings: systemSettings } = useSystemSettings()
  const { token } = theme.useToken()
  const lang = language || i18n.language
  const renderMode = mode ?? (preview ? 'preview' : 'page')
  const safeLanding = useMemo(() => normalizeLandingData(landing || {}), [landing])
  const fallbackStats = [
    { value: '500+', label: t('dashboard.stats.members') },
    { value: '20+', label: t('dashboard.stats.trainers') },
    { value: '4', label: t('dashboard.stats.branches') },
    { value: '98%', label: t('dashboard.stats.satisfaction') },
  ]
  const stats = (safeLanding.stats?.length ? safeLanding.stats : fallbackStats).map((item: any) => ({
    value: pickLocalized(item.value, lang, String(item.value ?? '')),
    label: pickLocalized(item.label, lang, ''),
  }))

  const services = (safeLanding.services?.length ? safeLanding.services : [
    { icon: '▣', title: t('dashboard.services.qr_checkin'), description: t('dashboard.services.qr_checkin_desc'), color: '#e05a30', link: '/checkin' },
    { icon: '◴', title: t('dashboard.services.book_pt'), description: t('dashboard.services.book_pt_desc'), color: '#3d9dd0', link: '/booking' },
    { icon: '↗', title: t('dashboard.services.workout'), description: t('dashboard.services.workout_desc'), color: '#5cb85c', link: '/workout' },
    { icon: '♡', title: t('dashboard.services.health'), description: t('dashboard.services.health_desc'), color: '#e6a317', link: '/health' },
  ]).map((item: any) => ({
    ...item,
    title: pickLocalized(item.title, lang, ''),
    description: pickLocalized(item.description, lang, ''),
  }))

  const testimonials = (safeLanding.testimonials?.length ? safeLanding.testimonials : [
    { rating: 5, content: t('dashboard.testimonials.item_0_quote'), userName: t('dashboard.testimonials.item_0_name'), userSubtitle: t('dashboard.testimonials.item_0_duration') },
    { rating: 5, content: t('dashboard.testimonials.item_1_quote'), userName: t('dashboard.testimonials.item_1_name'), userSubtitle: t('dashboard.testimonials.item_1_duration') },
    { rating: 5, content: t('dashboard.testimonials.item_2_quote'), userName: t('dashboard.testimonials.item_2_name'), userSubtitle: t('dashboard.testimonials.item_2_duration') },
  ]).map((item: any) => ({
    ...item,
    content: pickLocalized(item.content, lang, ''),
    userSubtitle: pickLocalized(item.userSubtitle, lang, ''),
  }))

  const slogans = useMemo(() => {
    return pickLocalizedSlogans(systemSettings.general.slogans, lang)
  }, [lang, systemSettings.general.slogans])

  const heroSubtitle = pickLocalized(safeLanding.heroSubtitle, lang, t('dashboard.subtitle'))
  const heroBadge = systemSettings.general.siteName
  const primaryText = pickLocalized(safeLanding.ctaText, lang, t('dashboard.cta_booking'))
  const secondaryText = pickLocalized(safeLanding.secondaryCtaText, lang, t('dashboard.cta_checkin'))
  const servicesEyebrow = pickLocalized(safeLanding.servicesEyebrow, lang, t('dashboard.services.overline'))
  const servicesTitle = pickLocalized(safeLanding.servicesTitle, lang, t('dashboard.services.heading'))
  const testimonialsEyebrow = pickLocalized(safeLanding.testimonialsEyebrow, lang, t('dashboard.testimonials.overline'))
  const testimonialsTitle = pickLocalized(safeLanding.testimonialsTitle, lang, t('dashboard.testimonials.heading'))
  const finalTitle = pickLocalized(safeLanding.finalCtaTitle, lang, `${t('dashboard.cta.heading1')}\n${t('dashboard.cta.heading2')}`)
  const finalSubtitle = pickLocalized(safeLanding.finalCtaSubtitle, lang, t('dashboard.cta.subtitle', { firstName }))
  const finalPrimaryText = pickLocalized(safeLanding.finalCtaPrimaryText, lang, t('dashboard.cta.book_pt'))
  const finalSecondaryText = pickLocalized(safeLanding.finalCtaSecondaryText, lang, t('dashboard.cta.view_health'))
  const widthClass = preview ? 'w-full' : 'w-[calc(100%-40px)] md:w-[calc(100%-64px)]'
  const landingFlags = systemSettings.landing

  return (
    <main className="min-h-dvh " style={{ backgroundColor: token.colorBgLayout, color: token.colorText }}>
      <HomeHero
        mode={renderMode}
        previewVariant={previewVariant}
        heroBadge={heroBadge}
        heroSubtitle={heroSubtitle}
        slogans={slogans}
        language={lang}
        primaryText={primaryText}
        secondaryText={secondaryText}
        stats={stats}
        showStats={landingFlags.statsSectionEnabled}
        showPrimaryCta={landingFlags.startNowButtonEnabled}
        showSecondaryCta={landingFlags.checkinNowButtonEnabled}
        landing={safeLanding}
        onNavigate={onNavigate}
        editable={editable}
        onSettingsChange={onSettingsChange}
      />
      {landingFlags.servicesSectionEnabled && <section className={`mx-auto ${widthClass} max-w-6xl pt-14 md:pt-[74px]`}>
        <p className="mb-2.5 text-xs font-black uppercase tracking-[0.14em] text-[var(--theme-accent)]">{servicesEyebrow}</p>
        <h2 className="text-[44px] font-extrabold leading-none">{servicesTitle}</h2>
        <div className="mt-7 grid grid-cols-1 gap-4 min-[421px]:grid-cols-2 md:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
          {services.map((service: any, index: number) => (
            <button
              type="button"
              className="min-h-[168px] rounded-lg border p-[18px] text-left transition duration-200 md:min-h-[178px] md:p-[22px]"
              key={`${service.title}-${index}`}
              onClick={() => service.link && onNavigate?.(service.link)}
              style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder, color: token.colorText }}
            >
              <span className="grid h-[42px] w-[42px] place-items-center rounded-full border text-[22px] font-black" style={{ color: service.color || '#e05a30' }}>{service.icon || '•'}</span>
              <span className="mt-5 block text-base font-black md:mt-[22px]">{service.title}</span>
              <span className="mt-2 block text-[13px] leading-relaxed" style={{ color: token.colorTextSecondary }}>{service.description}</span>
            </button>
          ))}
        </div>
      </section>}
      {landingFlags.feedbackSectionEnabled && <section className={`mx-auto ${widthClass} max-w-6xl pt-14 md:pt-[74px]`}>
        <p className="mb-2.5 text-xs font-black uppercase tracking-[0.14em] text-[var(--theme-accent)]">{testimonialsEyebrow}</p>
        <h2 className="text-[44px] font-extrabold leading-none">{testimonialsTitle}</h2>
        <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-3 items-start">
          {testimonials.map((item: any, index: number) => (
            <article className="rounded-lg border p-6" key={`${item.userName}-${index}`} style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder }}>
              <div className="text-sm text-[#e6a317]">{'★'.repeat(item.rating || 5)}</div>
              <p className="my-[18px] text-[15px] italic leading-7" style={{ color: token.colorTextSecondary }}>&ldquo;{item.content}&rdquo;</p>
              <div className="flex items-center gap-3">
                <span className="grid h-[42px] w-[42px] place-items-center overflow-hidden rounded-full font-black" style={{ background: 'var(--theme-elevated)' }}>
                  {item.avatar ? <img src={item.avatar} className="h-full w-full object-cover" alt="" /> : (item.userName || '?').charAt(0)}
                </span>
                <span>
                  <strong className="block">{item.userName}</strong>
                  <small className="mt-1 block text-xs" style={{ color: token.colorTextSecondary }}>{item.userSubtitle}</small>
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>}
      <section className={`mx-auto ${widthClass} max-w-[900px] py-[74px] text-center md:pt-[88px]`}>
        <h2 className="grid whitespace-pre-line text-5xl font-black leading-[0.95] md:text-[64px]">{finalTitle}</h2>
        <p className="mx-auto mt-[18px] max-w-[560px] text-base leading-7" style={{ color: token.colorTextSecondary }}>{finalSubtitle.replace('{{firstName}}', firstName)}</p>
        <div className="mt-8 flex flex-col flex-wrap justify-center gap-3 min-[421px]:flex-row">
          {landingFlags.startNowButtonEnabled && <Button size="large" className="!h-[46px] !rounded-full !px-6 !font-extrabold" type="primary" onClick={() => onNavigate?.(safeLanding.finalCtaPrimaryLink || '/booking')}>{finalPrimaryText}</Button>}
          {landingFlags.checkinNowButtonEnabled && <Button size="large" className="!h-[46px] !rounded-full !bg-transparent !px-6 !font-extrabold hover:!bg-[var(--hero-outline-hover-bg)]" style={{ borderColor: 'var(--hero-outline-border)', color: 'var(--hero-text)' }} onClick={() => onNavigate?.(safeLanding.finalCtaSecondaryLink || '/health')}>{finalSecondaryText}</Button>}
        </div>
      </section>
    </main>
  )
}

class HomeLandingErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('HomeLandingSection render error:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-[420px] items-center justify-center p-8 text-center">
          <div>
            <h2 className="text-xl font-bold">Không thể hiển thị trang chủ</h2>
            <p className="mt-2 text-[var(--theme-muted)]">Dữ liệu thiết kế không hợp lệ. Vui lòng tải lại trang.</p>
          </div>
        </main>
      )
    }
    return this.props.children
  }
}

export default function HomeLandingSection(props: HomeLandingSectionProps) {
  return (
    <HomeLandingErrorBoundary>
      <HomeLandingSectionInner {...props} />
    </HomeLandingErrorBoundary>
  )
}
