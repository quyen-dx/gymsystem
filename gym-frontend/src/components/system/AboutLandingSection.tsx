import {
  LeftOutlined,
  LoginOutlined,
  RightOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import { Button } from 'antd'
import { Mail, MapPin, Phone } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSystemSettings } from '../../context/SystemSettingsContext'
import { useTheme } from '../../context/ThemeContext'
import useScrollReveal from '../../hooks/useScrollReveal'
import { getShops } from '../../services/shopService'
import { getLocalizedText } from '../../utils/localization'
import LanguageSelect from '../common/LanguageSelect'

const heroSlides = [
  {
    image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1900&q=88',
    titleKey: 'about.hero.slide1.title',
    subtitleKey: 'about.hero.slide1.subtitle',
    ctaKey: 'about.hero.slide1.cta',
    link: '/register',
  },
  {
    image: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=1900&q=88',
    titleKey: 'about.hero.slide2.title',
    subtitleKey: 'about.hero.slide2.subtitle',
    ctaKey: 'about.hero.slide2.cta',
    link: '#features',
  },
  {
    image: 'https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=1900&q=88',
    titleKey: 'about.hero.slide3.title',
    subtitleKey: 'about.hero.slide3.subtitle',
    ctaKey: 'about.hero.slide3.cta',
    link: '/booking',
  },
]

const featureItems = [
  { icon: '🏆', titleKey: 'about.features.modernTech.title', descKey: 'about.features.modernTech.desc' },
  { icon: '👨‍💼', titleKey: 'about.features.certifiedPt.title', descKey: 'about.features.certifiedPt.desc' },
  { icon: '📊', titleKey: 'about.features.personalData.title', descKey: 'about.features.personalData.desc' },
  { icon: '🔒', titleKey: 'about.features.safe.title', descKey: 'about.features.safe.desc' },
  { icon: '🌟', titleKey: 'about.features.community.title', descKey: 'about.features.community.desc' },
  { icon: '📱', titleKey: 'about.features.anywhere.title', descKey: 'about.features.anywhere.desc' },
]

const stats = [
  { value: '500+', labelKey: 'about.stats.members' },
  { value: '20+', labelKey: 'about.stats.trainers' },
  { value: '4', labelKey: 'about.stats.branches' },
  { value: '98%', labelKey: 'about.stats.satisfaction' },
]

const ptItems = [
  { name: 'Minh Khang', specialtyKey: 'about.pts.specialties.strength', rating: '4.9', image: 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?auto=format&fit=crop&w=600&q=85' },
  { name: 'Hoang Linh', specialtyKey: 'about.pts.specialties.fatLoss', rating: '4.8', image: 'https://images.unsplash.com/photo-1609899537878-88d5ba429bdb?auto=format&fit=crop&w=600&q=85' },
  { name: 'An Tran', specialtyKey: 'about.pts.specialties.mobility', rating: '5.0', image: 'https://images.unsplash.com/photo-1594737625785-a6cbdabd333c?auto=format&fit=crop&w=600&q=85' },
  { name: 'Bao Nguyen', specialtyKey: 'about.pts.specialties.hiit', rating: '4.9', image: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=600&q=85' },
]

const testimonialItems = [
  { name: 'Minh Anh', durationKey: 'about.testimonials.items.minhAnh.duration', quoteKey: 'about.testimonials.items.minhAnh.quote' },
  { name: 'Quoc Huy', durationKey: 'about.testimonials.items.quocHuy.duration', quoteKey: 'about.testimonials.items.quocHuy.quote' },
  { name: 'Linh Chi', durationKey: 'about.testimonials.items.linhChi.duration', quoteKey: 'about.testimonials.items.linhChi.quote' },
]

const galleryImages = [
  'https://images.unsplash.com/photo-1558611848-73f7eb4001a1?auto=format&fit=crop&w=900&q=86',
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=86',
  'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?auto=format&fit=crop&w=900&q=86',
  'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=900&q=86',
]

type AboutLandingSectionProps = {
  landing?: any
  onCtaClick?: (link: string) => void
}

const pick = (value: any, lang: string, fallback = '') => getLocalizedText(value, lang, fallback)

export default function AboutLandingSection({ landing, onCtaClick }: AboutLandingSectionProps) {
  const { t, i18n } = useTranslation()
  const { settings: systemSettings } = useSystemSettings()
  const lang = i18n.language
  const [activeSlide, setActiveSlide] = useState(0)
  const [navSolid, setNavSolid] = useState(false)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [shops, setShops] = useState<any[]>([])
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const gymName = systemSettings.general.siteName
  const logoUrl = systemSettings.general.logoUrl
  const aboutTitle = pick(landing?.aboutTitle, lang, t('about.intro.titleFallback'))
  const aboutContent = pick(
    landing?.aboutContent,
    lang,
    t('about.intro.contentFallback'),
  )
  const landingFlags = systemSettings.landing
  const { dark } = useTheme()
  const heroOverlay = dark
    ? 'linear-gradient(90deg, rgba(0,0,0,0.78), rgba(0,0,0,0.28), rgba(0,0,0,0.72))'
    : 'linear-gradient(90deg, rgba(255,255,255,0.88), rgba(255,255,255,0.52), rgba(255,255,255,0.82))'

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length)
    }, 4000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const onScroll = () => setNavSolid(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!isMenuOpen) return

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!mobileMenuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [isMenuOpen])

  useEffect(() => {
    getShops()
      .then((res) => setShops(res.data?.shops || res.data || []))
      .catch(() => { })
  }, [])

  const statsReveal = useScrollReveal()
  const brandsReveal = useScrollReveal()
  const introReveal = useScrollReveal()
  const featuresReveal = useScrollReveal()
  const ptReveal = useScrollReveal()
  const facilitiesReveal = useScrollReveal()
  const testimonialsReveal = useScrollReveal()
  const ctaReveal = useScrollReveal()

  const goTo = (link: string) => {
    if (link.startsWith('#')) {
      document.querySelector(link)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    onCtaClick?.(link)
  }

  const nextSlide = () => {
    setActiveSlide((current) => (current + 1) % heroSlides.length)
  }

  const prevSlide = () => {
    setActiveSlide((current) => (current - 1 + heroSlides.length) % heroSlides.length)
  }

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    setTouchStart(event.touches[0].clientX)
  }

  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    if (touchStart == null) return
    const diff = touchStart - event.changedTouches[0].clientX
    if (diff > 50) nextSlide()
    if (diff < -50) prevSlide()
    setTouchStart(null)
  }

  return (
    <main className="about-page min-h-dvh bg-[var(--gs-bg)] text-[var(--gs-text)]">
      <header
        className={`fixed left-0 right-0 top-0 z-50 transition duration-300 ${navSolid ? 'border-b border-[var(--gs-border)] shadow-2xl backdrop-blur-xl' : 'backdrop-blur-sm'}`}
        style={{ background: navSolid ? 'color-mix(in srgb, var(--gs-card) 94%, transparent)' : 'color-mix(in srgb, var(--gs-card) 72%, transparent)' }}
      >
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <button type="button" className="flex items-center gap-3" onClick={() => goTo('/about')}>
            {logoUrl ? <img src={logoUrl} alt={gymName} className="h-10 w-10 rounded-lg object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--theme-button-bg)] font-black text-[var(--theme-button-text)]">GP</span>}
            <span className="text-lg font-black tracking-wide">{gymName}</span>
          </button>
          <nav className="hidden md:flex items-center gap-6">
            <button onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-sm font-medium text-[var(--gs-text)] hover:text-[var(--theme-accent)] transition">
              {t('nav.about')}
            </button>
            <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-sm font-medium text-[var(--gs-text)] hover:text-[var(--theme-accent)] transition">
              {t('nav.features')}
            </button>
            <button onClick={() => document.getElementById('trainers')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-sm font-medium text-[var(--gs-text)] hover:text-[var(--theme-accent)] transition">
              {t('nav.trainers')}
            </button>
            <button onClick={() => document.getElementById('footer')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-sm font-medium text-[var(--gs-text)] hover:text-[var(--theme-accent)] transition">
              {t('nav.contact')}
            </button>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <div className="flex">
              <Button className="!rounded-full !border-[var(--gs-border)] !bg-[var(--gs-card)] !px-5 !text-[var(--gs-text)] hover:!border-[var(--theme-accent)]" icon={<LoginOutlined />} onClick={() => goTo('/login')}>
                {t('about.nav.login')}
              </Button>
            </div>
            {systemSettings.auth.allowRegistration && (
              <Button type="primary" className="!rounded-full !px-5 !font-bold" icon={<UserAddOutlined />} onClick={() => goTo('/register')}>
                {t('about.nav.register')}
              </Button>
            )}
            <LanguageSelect />
          </div>
          <div ref={mobileMenuRef} className="relative md:hidden">
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card)] text-2xl font-black text-[var(--gs-text)] backdrop-blur"
              onClick={() => setIsMenuOpen((open) => !open)}
              aria-label="Toggle mobile menu"
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? '×' : '☰'}
            </button>
            <div
              className={`absolute right-0 top-12 w-56 overflow-hidden rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] shadow-2xl backdrop-blur-xl transition-all duration-300 ${isMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}
            >
              <div className="p-2">
                <button
                  type="button"
                  className="block w-full rounded-lg px-4 py-3 text-left text-sm text-[var(--gs-muted)] transition hover:bg-[var(--theme-accent-muted)] hover:text-[var(--gs-text)]"
                  onClick={() => {
                    document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })
                    setIsMenuOpen(false)
                  }}
                >
                  {t('nav.about')}
                </button>
                <button
                  type="button"
                  className="block w-full rounded-lg px-4 py-3 text-left text-sm text-[var(--gs-muted)] transition hover:bg-[var(--theme-accent-muted)] hover:text-[var(--gs-text)]"
                  onClick={() => {
                    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
                    setIsMenuOpen(false)
                  }}
                >
                  {t('nav.features')}
                </button>
                <button
                  type="button"
                  className="block w-full rounded-lg px-4 py-3 text-left text-sm text-[var(--gs-muted)] transition hover:bg-[var(--theme-accent-muted)] hover:text-[var(--gs-text)]"
                  onClick={() => {
                    document.getElementById('trainers')?.scrollIntoView({ behavior: 'smooth' })
                    setIsMenuOpen(false)
                  }}
                >
                  {t('nav.trainers')}
                </button>
                <button
                  type="button"
                  className="block w-full rounded-lg px-4 py-3 text-left text-sm text-[var(--gs-muted)] transition hover:bg-[var(--theme-accent-muted)] hover:text-[var(--gs-text)]"
                  onClick={() => {
                    document.getElementById('footer')?.scrollIntoView({ behavior: 'smooth' })
                    setIsMenuOpen(false)
                  }}
                >
                  {t('nav.contact')}
                </button>
                <div className="my-1 border-t border-[var(--gs-border)]" />
                <button
                  type="button"
                  className="block w-full rounded-lg px-4 py-3 text-left text-sm text-[var(--gs-muted)] transition hover:bg-[var(--theme-accent-muted)] hover:text-[var(--gs-text)]"
                  onClick={() => {
                    setIsMenuOpen(false)
                    goTo('/login')
                  }}
                >
                  {t('about.nav.login')}
                </button>
                {systemSettings.auth.allowRegistration && (
                  <button
                    type="button"
                    className="block w-full rounded-lg px-4 py-3 text-left text-sm font-bold text-[var(--gs-text)] transition hover:bg-[var(--theme-accent-muted)]"
                    onClick={() => {
                      setIsMenuOpen(false)
                      goTo('/register')
                    }}
                  >
                    {t('about.nav.register')}
                  </button>
                )}
                <div className="flex flex-row gap-3 border-t border-[var(--gs-border)] pt-2">
                  <button
                    type="button"
                    onClick={() => i18n.changeLanguage('vi')}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${i18n.language === 'vi' ? 'bg-[var(--theme-active-bg)] text-[var(--theme-active-text)]' : 'opacity-60'
                      }`}
                  >
                    <img src="https://flagcdn.com/20x15/vn.png" alt="" className="h-3.5 w-5 rounded-sm object-cover" /> VN
                  </button>
                  <button
                    type="button"
                    onClick={() => i18n.changeLanguage('en')}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${i18n.language === 'en' ? 'bg-[var(--theme-active-bg)] text-[var(--theme-active-text)]' : 'opacity-60'
                      }`}
                  >
                    <img src="https://flagcdn.com/20x15/us.png" alt="" className="h-3.5 w-5 rounded-sm object-cover" /> US
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section
        className="relative mt-18 h-[calc(100svh-72px)] min-h-[560px] overflow-hidden md:mt-0 md:h-screen md:min-h-[720px]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}>
        {heroSlides.map((slide, index) => (
          <div
            key={slide.image}
            className={`absolute inset-0 overflow-hidden bg-cover bg-center transition-opacity duration-700 ${index === activeSlide ? 'opacity-100' : 'opacity-0'}`}
            style={{
              backgroundImage: `url(${slide.image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
            aria-hidden={index !== activeSlide}
          >
            <img src={slide.image} alt="" className="absolute inset-0 hidden h-full w-full object-cover object-center md:block" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/55 to-black/80 md:hidden" />
            <div className="absolute inset-0 hidden md:block" style={{ background: heroOverlay }} />
          </div>
        ))}

        <div className="absolute inset-0 z-10 flex items-end px-5 pb-32 pt-28 md:items-center md:px-8 md:pb-0 md:pt-0 lg:px-16">
          <div className="mx-auto w-full max-w-7xl">
            <div className="w-full max-w-[340px] md:max-w-4xl md:pt-20">
              <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.22em] text-[var(--theme-accent)] md:mb-5 md:text-lg">{gymName}</p>
              <h1 className="max-w-full break-words text-[clamp(28px,8vw,38px)] font-black leading-[1.08] text-white drop-shadow-[0_3px_16px_rgba(0,0,0,0.8)] md:text-5xl md:text-[var(--hero-text)] md:drop-shadow-none lg:text-7xl">
                {t(heroSlides[activeSlide].titleKey)}
              </h1>
              <p className="mt-4 text-[15px] leading-7 text-white/90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)] md:mt-6 md:max-w-2xl md:text-xl md:text-[var(--hero-muted)] md:drop-shadow-none">
                {t(heroSlides[activeSlide].subtitleKey)}
              </p>
              {landingFlags.startNowButtonEnabled && (
                <Button type="primary" className="mt-6 !h-[44px] !rounded-full !px-5 !text-sm !font-extrabold md:mt-8 md:!h-[52px] md:!px-8 md:!text-base" onClick={() => goTo(heroSlides[activeSlide].link)}>
                  {t(heroSlides[activeSlide].ctaKey)}
                </Button>
              )}
            </div>
          </div>
        </div>

        <button type="button" aria-label="Previous slide" className="slider-nav slider-nav-prev flex h-[34px] w-[34px] place-items-center rounded-full border border-white/25 bg-black/35 text-white backdrop-blur hover:border-[var(--theme-accent)] max-md:hidden md:h-10 md:w-10 md:border-[var(--gs-border)] md:bg-[var(--gs-card)]/70 md:text-[var(--hero-text)]" onClick={prevSlide}>
          <LeftOutlined />
        </button>
        <button type="button" aria-label="Next slide" className="slider-nav slider-nav-next flex h-[34px] w-[34px] place-items-center rounded-full border border-white/25 bg-black/35 text-white backdrop-blur hover:border-[var(--theme-accent)] max-md:hidden md:h-10 md:w-10 md:border-[var(--gs-border)] md:bg-[var(--gs-card)]/70 md:text-[var(--hero-text)]" onClick={nextSlide}>
          <RightOutlined />
        </button>

        <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 justify-center gap-3 pb-[env(safe-area-inset-bottom)] md:bottom-8 md:pb-0">
          {heroSlides.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Slide ${index + 1}`}
              className={`h-2.5 rounded-full transition-all ${index === activeSlide ? 'w-10 bg-[var(--theme-accent)]' : 'w-2.5 bg-white/50'}`}
              onClick={() => setActiveSlide(index)}
            />
          ))}
        </div>
      </section>

      {landingFlags.statsSectionEnabled && <section {...statsReveal.attr} className="border-y border-[var(--gs-border)] bg-[var(--gs-page)]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-5 py-8 md:grid-cols-4 md:px-8">
          {stats.map((item, i) => (
            <div key={item.value} className={`reveal text-center ${statsReveal.visible ? 'visible' : ''}`} style={{ transitionDelay: `${i * 100}ms` }}>
              <strong className="block text-4xl font-black leading-none text-[var(--theme-accent)] md:text-6xl">{item.value}</strong>
              <span className="mt-2 block text-sm uppercase tracking-[0.16em] text-[var(--gs-muted)]">{t(item.labelKey)}</span>
            </div>
          ))}
        </div>
      </section>}

      {landingFlags.partnersSectionEnabled && shops.length >= 3 && (
        <section {...brandsReveal.attr} id="brands" className="bg-[var(--gs-page)] px-5 py-18 md:px-8 md:py-24">
          <div className="mx-auto max-w-7xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--theme-accent)]">{t('about.partners.title')}</p>
            <div className={`mt-10 ${brandsReveal.visible ? 'visible' : ''}`}>
              <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8">
                {shops.map((shop) => {
                  const name = shop.name || shop.user_id?.name || ''
                  const avatar = shop.user_id?.avatar || shop.avatar
                  return (
                    <div
                      key={shop._id}
                      className="group flex flex-col items-center gap-3 transition-all duration-300"
                    >
                      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--gs-borderStrong)] bg-[var(--gs-card)] p-1 transition-all duration-300 group-hover:scale-110 group-hover:border-[var(--theme-accent)] group-hover:shadow-lg group-hover:shadow-[var(--theme-accent)]/30 md:h-24 md:w-24">
                        {avatar ? (
                          <img
                            src={avatar}
                            alt={name}
                            className="h-full w-full rounded-full object-cover transition-all duration-300"
                          />
                        ) : (
                          <span className="text-lg font-bold text-[var(--gs-muted)]">{name.charAt(0)}</span>
                        )}
                      </div>
                      <span className="max-w-[100px] truncate text-center text-sm font-semibold text-[var(--gs-text)] transition duration-300 group-hover:text-[var(--theme-accent)]">
                        {name}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      <section {...introReveal.attr} id="about" className="mx-auto grid max-w-7xl gap-10 px-5 py-18 md:grid-cols-[1fr_0.9fr] md:px-8 md:py-24">
        <div className={`reveal-left ${introReveal.visible ? 'visible' : ''}`}>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--theme-accent)]">{t('about.intro.eyebrow')}</p>
          <h2 className="mt-4 break-words text-4xl font-black leading-none md:text-[82px]">{aboutTitle}</h2>
          <p className="mt-6 whitespace-pre-wrap text-base leading-8 text-[var(--gs-muted)] md:text-lg">{aboutContent}</p>
        </div>
        <img className={`reveal-right h-[300px] w-full rounded-lg border border-[var(--gs-border)] object-cover md:h-[420px] ${introReveal.visible ? 'visible' : ''}`} src="https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=1200&q=86" alt={aboutTitle} />
      </section>

      {landingFlags.servicesSectionEnabled && <section {...featuresReveal.attr} id="features" className="bg-[var(--gs-page)] px-5 py-18 md:px-8 md:py-24">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--theme-accent)]">{t('about.features.eyebrow')}</p>
          <h2 className="mt-4 text-4xl font-black leading-none md:text-6xl lg:text-7xl" style={{ wordBreak: 'keep-all' }}>{t('about.features.title')}</h2>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {featureItems.map((item, i) => (
              <article key={item.titleKey} className={`reveal rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 transition hover:border-[var(--theme-accent)] ${featuresReveal.visible ? 'visible' : ''}`} style={{ transitionDelay: `${(i % 3) * 100}ms` }}>
                <div className="grid h-12 w-12 place-items-center rounded-full border border-[var(--theme-accent)] text-2xl text-[var(--theme-accent)]">{item.icon}</div>
                <h3 className="mt-5 text-xl font-black">{t(item.titleKey)}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--gs-muted)]">{t(item.descKey)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>}

      <section {...ptReveal.attr} id="trainers" className="mx-auto max-w-7xl px-5 py-18 md:px-8 md:py-24">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--theme-accent)]">{t('about.pts.eyebrow')}</p>
        <h2 className="mt-4 break-words text-4xl font-black leading-none md:text-[82px]">{t('about.pts.title')}</h2>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ptItems.map((pt, i) => (
            <article key={pt.name} className={`reveal rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 text-center ${ptReveal.visible ? 'visible' : ''}`} style={{ transitionDelay: `${i * 100}ms` }}>
              <img src={pt.image} alt={pt.name} className="mx-auto h-28 w-28 rounded-full object-cover ring-2 ring-[var(--theme-accent)]" />
              <h3 className="mt-5 text-xl font-black">{pt.name}</h3>
              <p className="mt-2 text-sm text-[var(--gs-muted)]">{t(pt.specialtyKey)}</p>
              <p className="mt-4 text-sm font-bold text-[var(--theme-accent)]">★★★★★ {pt.rating}</p>
            </article>
          ))}
        </div>
      </section>

      <section {...facilitiesReveal.attr} className="bg-[var(--gs-page)] px-5 py-18 md:px-8 md:py-24">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--theme-accent)]">{t('about.facilities.eyebrow')}</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {galleryImages.map((src, i) => (
              <div key={src} className={`reveal h-[260px] overflow-hidden rounded-lg border border-[var(--gs-border)] md:h-[340px] ${facilitiesReveal.visible ? 'visible' : ''}`} style={{ transitionDelay: `${(i % 2) * 150}ms` }}>
                <img src={src} alt="" className="h-full w-full object-cover transition duration-500 hover:scale-105" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {landingFlags.feedbackSectionEnabled && <section {...testimonialsReveal.attr} className="mx-auto max-w-7xl px-5 py-18 md:px-8 md:py-24">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--theme-accent)]">{t('about.testimonials.eyebrow')}</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {testimonialItems.map((item, i) => (
            <article key={item.name} className={`reveal rounded-lg border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 ${testimonialsReveal.visible ? 'visible' : ''}`} style={{ transitionDelay: `${i * 100}ms` }}>
              <p className="text-lg leading-8 text-[var(--gs-text)]">&ldquo;{t(item.quoteKey)}&rdquo;</p>
              <div className="mt-6 border-t border-[var(--gs-border)] pt-5">
                <strong className="block">{item.name}</strong>
                <span className="text-sm text-[var(--gs-muted)]">{t(item.durationKey)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>}

      {landingFlags.startNowButtonEnabled && <section
        {...ctaReveal.attr}
        className="flex min-h-[240px] items-center justify-center px-5 py-10 text-center md:min-h-[620px] md:px-8 md:py-20"
        style={{ background: 'linear-gradient(rgba(0,0,0,0.72), rgba(0,0,0,0.82)), url(https://images.unsplash.com/photo-1517963879433-6ad2b056d712?auto=format&fit=crop&w=1900&q=88) center/cover' }}
      >
        <div className={`reveal text-white ${ctaReveal.visible ? 'visible' : ''}`}>
          <h2 className="mx-auto max-w-4xl break-words text-4xl font-black leading-[0.95] md:text-[110px] md:leading-[0.9]">{t('about.cta.title')}</h2>
          <Button type="primary" className="mt-9 !h-13 !rounded-full !px-9 !font-extrabold" onClick={() => goTo('/register')}>
            {t('about.cta.register')}
          </Button>
        </div>
      </section>}

      <footer id="footer" className="border-t border-[var(--gs-border)] bg-[var(--gs-page)] px-5 py-6 text-[var(--gs-text)] md:px-8 md:py-16">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-5 gap-y-6 md:gap-x-8 md:gap-y-10 lg:grid-cols-4">
          <div className="col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3">
              {logoUrl ? <img src={logoUrl} alt={gymName} className="h-9 w-9 rounded-lg object-cover md:h-10 md:w-10" /> : <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--theme-button-bg)] font-black text-[var(--theme-button-text)] md:h-10 md:w-10">GP</span>}
              <span className="text-lg font-black md:text-xl">{gymName}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--gs-muted)] md:mt-4 md:text-sm">{t('about.footer.description')}</p>
            <div className="mt-3 flex items-center gap-2 md:mt-6 md:gap-3">
              <a href="#" className="grid h-8 w-8 place-items-center rounded-full border border-[var(--gs-border)] text-xs text-[var(--gs-muted)] transition hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)] md:h-9 md:w-9 md:text-sm" aria-label="Facebook">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:h-4 md:w-4"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
              </a>
              <a href="#" className="grid h-8 w-8 place-items-center rounded-full border border-[var(--gs-border)] text-xs text-[var(--gs-muted)] transition hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)] md:h-9 md:w-9 md:text-sm" aria-label="Instagram">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:h-4 md:w-4"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
              </a>
              <a href="#" className="grid h-8 w-8 place-items-center rounded-full border border-[var(--gs-border)] text-xs text-[var(--gs-muted)] transition hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)] md:h-9 md:w-9 md:text-sm" aria-label="YouTube">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:h-4 md:w-4"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.94 2C5.12 20 12 20 12 20s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" /><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" /></svg>
              </a>
            </div>
          </div>
          <div className="col-span-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent)] md:text-sm">{t('about.footer.features_title')}</h3>
            <ul className="mt-3 space-y-1.5 md:mt-5 md:space-y-3">
              <li><button type="button" className="text-xs leading-relaxed text-[var(--gs-muted)] transition hover:text-[var(--theme-accent)] md:text-sm" onClick={() => goTo('/about')}>{t('nav.checkin')}</button></li>
              <li><button type="button" className="text-xs leading-relaxed text-[var(--gs-muted)] transition hover:text-[var(--theme-accent)] md:text-sm" onClick={() => goTo('/about')}>{t('nav.book_pt')}</button></li>
              <li><button type="button" className="text-xs leading-relaxed text-[var(--gs-muted)] transition hover:text-[var(--theme-accent)] md:text-sm" onClick={() => goTo('/about')}>{t('nav.health')}</button></li>
              <li><button type="button" className="text-xs leading-relaxed text-[var(--gs-muted)] transition hover:text-[var(--theme-accent)] md:text-sm" onClick={() => goTo('/about')}>{t('nav.workout')}</button></li>
            </ul>
          </div>
          <div className="col-span-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent)] md:text-sm">{t('about.footer.support_title')}</h3>
            <ul className="mt-3 space-y-1.5 md:mt-5 md:space-y-3">
              <li><button type="button" className="text-xs leading-relaxed text-[var(--gs-muted)] transition hover:text-[var(--theme-accent)] md:text-sm" onClick={() => goTo('/help')}>{t('nav.help')}</button></li>
              <li><button type="button" className="text-xs leading-relaxed text-[var(--gs-muted)] transition hover:text-[var(--theme-accent)] md:text-sm" onClick={() => goTo('/policies')}>{t('nav.policies')}</button></li>
              <li><button type="button" className="text-xs leading-relaxed text-[var(--gs-muted)] transition hover:text-[var(--theme-accent)] md:text-sm" onClick={() => goTo('/about')}>{t('nav.feedback')}</button></li>
              <li><button type="button" className="text-xs leading-relaxed text-[var(--gs-muted)] transition hover:text-[var(--theme-accent)] md:text-sm" onClick={() => goTo('/about')}>{t('about.footer.about')}</button></li>
            </ul>
          </div>
          <div className="col-span-2 lg:col-span-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-accent)] md:text-sm">{t('about.footer.contact_title')}</h3>
            <ul className="mt-3 space-y-2 md:mt-5 md:space-y-4">
              <li className="flex items-center gap-2 text-xs text-[var(--gs-muted)] md:gap-3 md:text-sm">
                <Mail size={13} className="shrink-0 text-[var(--theme-accent)] md:size-[15px]" />
                <span>{t('about.footer.email')}</span>
              </li>
              <li className="flex items-center gap-2 text-xs text-[var(--gs-muted)] md:gap-3 md:text-sm">
                <Phone size={13} className="shrink-0 text-[var(--theme-accent)] md:size-[15px]" />
                <span>{t('about.footer.phone')}</span>
              </li>
              <li className="flex items-center gap-2 text-xs text-[var(--gs-muted)] md:gap-3 md:text-sm">
                <MapPin size={13} className="shrink-0 text-[var(--theme-accent)] md:size-[15px]" />
                <span>{t('about.footer.address')}</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-6 flex max-w-7xl flex-col items-start gap-2 border-t border-[var(--gs-border)] pt-5 text-xs text-[var(--gs-muted)] md:mt-14 md:flex-row md:items-center md:justify-between md:pt-6 md:text-sm">
          <span>© {new Date().getFullYear()} {gymName}. {t('about.footer.copyright')}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => i18n.changeLanguage('vi')}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${i18n.language === 'vi' ? 'bg-[var(--theme-active-bg)] text-[var(--theme-active-text)]' : 'text-[var(--gs-muted)] hover:text-[var(--theme-accent)]'}`}
            >
              VI
            </button>
            <button
              type="button"
              onClick={() => i18n.changeLanguage('en')}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${i18n.language === 'en' ? 'bg-[var(--theme-active-bg)] text-[var(--theme-active-text)]' : 'text-[var(--gs-muted)] hover:text-[var(--theme-accent)]'}`}
            >
              EN
            </button>
          </div>
        </div>
      </footer>
    </main>
  )
}
