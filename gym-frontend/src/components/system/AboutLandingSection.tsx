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
    <main className="about-page min-h-screen bg-[var(--gs-bg)] text-[var(--theme-text)]">
      <header className={`fixed left-0 right-0 top-0 z-50 transition duration-300 ${navSolid ? 'border-b border-[var(--theme-border)] bg-[rgba(255,255,255,0.9)]/95 shadow-2xl backdrop-blur-xl dark:bg-[rgba(20,20,20,0.9)]/95' : 'bg-[rgba(255,255,255,0.18)] backdrop-blur-sm dark:bg-[rgba(0,0,0,0.18)]'}`}>
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <button type="button" className="flex items-center gap-3" onClick={() => goTo('/about')}>
            {logoUrl ? <img src={logoUrl} alt={gymName} className="h-10 w-10 rounded-lg object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--theme-button-bg)] font-black text-[var(--theme-button-text)]">GP</span>}
            <span className="text-lg font-black tracking-wide">{gymName}</span>
          </button>
          <nav className="hidden md:flex items-center gap-6">
            <button onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-sm font-medium text-[var(--theme-text)] hover:text-[var(--theme-accent)] transition">
              {t('nav.about')}
            </button>
            <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-sm font-medium text-[var(--theme-text)] hover:text-[var(--theme-accent)] transition">
              {t('nav.features')}
            </button>
            <button onClick={() => document.getElementById('trainers')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-sm font-medium text-[var(--theme-text)] hover:text-[var(--theme-accent)] transition">
              {t('nav.trainers')}
            </button>
            <button onClick={() => document.getElementById('footer')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-sm font-medium text-[var(--theme-text)] hover:text-[var(--theme-accent)] transition">
              {t('nav.contact')}
            </button>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <div className="flex">
              <Button className="!rounded-full !border-[var(--theme-border)] !bg-[var(--gs-card)] !px-5 !text-[var(--theme-text)] hover:!border-[var(--theme-accent)]" icon={<LoginOutlined />} onClick={() => goTo('/login')}>
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
              className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--theme-border)] bg-[var(--gs-card)] text-2xl font-black text-[var(--theme-text)] backdrop-blur"
              onClick={() => setIsMenuOpen((open) => !open)}
              aria-label="Toggle mobile menu"
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? '×' : '☰'}
            </button>
            <div
              className={`absolute right-0 top-12 w-56 overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--gs-card)]/95 shadow-2xl backdrop-blur-xl transition-all duration-300 ${isMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}
            >
              <div className="p-2">
                <button
                  type="button"
                  className="block w-full rounded-lg px-4 py-3 text-left text-sm text-[var(--theme-text-secondary)] transition hover:bg-[var(--theme-accent-muted)]"
                  onClick={() => {
                    document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })
                    setIsMenuOpen(false)
                  }}
                >
                  {t('nav.about')}
                </button>
                <button
                  type="button"
                  className="block w-full rounded-lg px-4 py-3 text-left text-sm text-[var(--theme-text-secondary)] transition hover:bg-[var(--theme-accent-muted)]"
                  onClick={() => {
                    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
                    setIsMenuOpen(false)
                  }}
                >
                  {t('nav.features')}
                </button>
                <button
                  type="button"
                  className="block w-full rounded-lg px-4 py-3 text-left text-sm text-[var(--theme-text-secondary)] transition hover:bg-[var(--theme-accent-muted)]"
                  onClick={() => {
                    document.getElementById('trainers')?.scrollIntoView({ behavior: 'smooth' })
                    setIsMenuOpen(false)
                  }}
                >
                  {t('nav.trainers')}
                </button>
                <button
                  type="button"
                  className="block w-full rounded-lg px-4 py-3 text-left text-sm text-[var(--theme-text-secondary)] transition hover:bg-[var(--theme-accent-muted)]"
                  onClick={() => {
                    document.getElementById('footer')?.scrollIntoView({ behavior: 'smooth' })
                    setIsMenuOpen(false)
                  }}
                >
                  {t('nav.contact')}
                </button>
                <div className="my-1 border-t border-white/10" />
                <button
                  type="button"
                  className="block w-full rounded-lg px-4 py-3 text-left text-sm text-[var(--theme-text-secondary)] transition hover:bg-[var(--theme-accent-muted)]"
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
                    className="block w-full rounded-lg px-4 py-3 text-left text-sm font-bold text-[var(--theme-text)] transition hover:bg-[var(--theme-accent-muted)]"
                    onClick={() => {
                      setIsMenuOpen(false)
                      goTo('/register')
                    }}
                  >
                    {t('about.nav.register')}
                  </button>
                )}
                <div className="flex flex-row gap-3 border-t border-white/10 pt-2">
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

      <section className="relative h-screen min-h-[620px] overflow-hidden" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {heroSlides.map((slide, index) => (
          <div
            key={slide.image}
            className={`absolute inset-0 transition-opacity duration-700 ${index === activeSlide ? 'opacity-100' : 'opacity-0'}`}
            aria-hidden={index !== activeSlide}
          >
            <img src={slide.image} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0" style={{ background: heroOverlay }} />
          </div>
        ))}
        <div className="relative z-10 mx-auto flex h-full max-w-7xl items-center px-4 md:px-8 lg:px-16">
          <div className="max-w-4xl pt-20">
            <p className="mb-5 text-base font-extrabold uppercase tracking-[0.2em] text-[var(--theme-accent)] md:text-lg">{gymName}</p>
            <h1 className="max-w-full break-words text-3xl font-black leading-[1.08] tracking-[1px] text-[var(--hero-text)] md:text-5xl lg:text-7xl">
              {t(heroSlides[activeSlide].titleKey)}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--hero-muted)] md:text-xl">{t(heroSlides[activeSlide].subtitleKey)}</p>
            {landingFlags.startNowButtonEnabled && (
              <Button type="primary" className="mt-8 !h-13 !rounded-full !px-8 !font-extrabold" onClick={() => goTo(heroSlides[activeSlide].link)}>
                {t(heroSlides[activeSlide].ctaKey)}
              </Button>
            )}
          </div>
        </div>
        <button type="button" className="absolute top-1/2 left-2 z-20 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-[var(--theme-border)] bg-[var(--gs-card)]/20 text-[var(--theme-text)] backdrop-blur hover:border-[var(--theme-accent)] md:left-4 md:flex md:h-10 md:w-10" onClick={prevSlide}>
          <LeftOutlined />
        </button>
        <button type="button" className="absolute top-1/2 right-2 z-20 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-[var(--theme-border)] bg-[var(--gs-card)]/20 text-[var(--theme-text)] backdrop-blur hover:border-[var(--theme-accent)] md:right-4 md:flex md:h-10 md:w-10" onClick={nextSlide}>
          <RightOutlined />
        </button>
        <div className="absolute bottom-8 left-0 right-0 z-20 flex justify-center gap-3">
          {heroSlides.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Slide ${index + 1}`}
              className={`h-2.5 rounded-full transition-all ${index === activeSlide ? 'w-10 bg-[var(--theme-accent)]' : 'w-2.5 bg-white/45'}`}
              onClick={() => setActiveSlide(index)}
            />
          ))}
        </div>
      </section>

      {landingFlags.statsSectionEnabled && <section ref={statsReveal.ref} className="border-y border-white/10 bg-[#0d0d0d]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-5 py-8 md:grid-cols-4 md:px-8">
          {stats.map((item, i) => (
            <div key={item.value} className={`reveal text-center ${statsReveal.visible ? 'visible' : ''}`} style={{ transitionDelay: `${i * 100}ms` }}>
              <strong className="block text-6xl font-black leading-none text-[var(--theme-accent)]">{item.value}</strong>
              <span className="mt-2 block text-sm uppercase tracking-[0.16em] text-white/58">{t(item.labelKey)}</span>
            </div>
          ))}
        </div>
      </section>}

      {landingFlags.partnersSectionEnabled && shops.length >= 3 && (
        <section ref={brandsReveal.ref} id="brands" className="bg-[#0d0d0d] px-5 py-18 md:px-8 md:py-24">
          <div className="mx-auto max-w-7xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--theme-accent)]">{t('about.partners.title')}</p>
            <div className={`mt-10 ${brandsReveal.visible ? 'visible' : ''}`}>
              <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8">
                {shops.map((shop) => {
                  const name = shop.name || shop.user_id?.name || ''
                  const avatar = shop.avatar || shop.user_id?.avatar
                  return (
                    <div
                      key={shop._id}
                      className="group flex flex-col items-center gap-3 transition-all duration-300"
                    >
                      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#111] p-1 transition-all duration-300 group-hover:border-[var(--theme-accent)] md:h-24 md:w-24">
                        {avatar ? (
                          <img
                            src={avatar}
                            alt={name}
                            className="h-full w-full rounded-full object-cover grayscale transition-all duration-300 group-hover:grayscale-0"
                          />
                        ) : (
                          <span className="text-lg font-bold text-white/40">{name.charAt(0)}</span>
                        )}
                      </div>
                      <span className="max-w-[100px] truncate text-center text-sm text-white/50 transition duration-300 group-hover:text-white">
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

      <section ref={introReveal.ref} id="about" className="mx-auto grid max-w-7xl gap-10 px-5 py-18 md:grid-cols-[1fr_0.9fr] md:px-8 md:py-24">
        <div className={`reveal-left ${introReveal.visible ? 'visible' : ''}`}>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--theme-accent)]">{t('about.intro.eyebrow')}</p>
          <h2 className="mt-4 text-6xl font-black leading-none md:text-[82px]">{aboutTitle}</h2>
          <p className="mt-6 whitespace-pre-wrap text-base leading-8 text-white/64 md:text-lg">{aboutContent}</p>
        </div>
        <img className={`reveal-right h-[420px] w-full rounded-lg border border-white/10 object-cover ${introReveal.visible ? 'visible' : ''}`} src="https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=1200&q=86" alt={aboutTitle} />
      </section>

      {landingFlags.servicesSectionEnabled && <section ref={featuresReveal.ref} id="features" className="bg-[#0d0d0d] px-5 py-18 md:px-8 md:py-24">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--theme-accent)]">{t('about.features.eyebrow')}</p>
          <h2 className="mt-4 text-4xl font-black leading-none md:text-6xl lg:text-7xl" style={{ wordBreak: 'keep-all' }}>{t('about.features.title')}</h2>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {featureItems.map((item, i) => (
              <article key={item.titleKey} className={`reveal rounded-lg border border-white/10 bg-black/24 p-6 transition hover:border-[var(--theme-accent)] ${featuresReveal.visible ? 'visible' : ''}`} style={{ transitionDelay: `${(i % 3) * 100}ms` }}>
                <div className="grid h-12 w-12 place-items-center rounded-full border border-[var(--theme-accent)] text-2xl text-[var(--theme-accent)]">{item.icon}</div>
                <h3 className="mt-5 text-xl font-black">{t(item.titleKey)}</h3>
                <p className="mt-3 text-sm leading-7 text-white/56">{t(item.descKey)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>}

      <section ref={ptReveal.ref} id="trainers" className="mx-auto max-w-7xl px-5 py-18 md:px-8 md:py-24">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--theme-accent)]">{t('about.pts.eyebrow')}</p>
        <h2 className="mt-4 text-6xl font-black leading-none md:text-[82px]">{t('about.pts.title')}</h2>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ptItems.map((pt, i) => (
            <article key={pt.name} className={`reveal rounded-lg border border-white/10 bg-[#101010] p-6 text-center ${ptReveal.visible ? 'visible' : ''}`} style={{ transitionDelay: `${i * 100}ms` }}>
              <img src={pt.image} alt={pt.name} className="mx-auto h-28 w-28 rounded-full object-cover ring-2 ring-[var(--theme-accent)]" />
              <h3 className="mt-5 text-xl font-black">{pt.name}</h3>
              <p className="mt-2 text-sm text-white/58">{t(pt.specialtyKey)}</p>
              <p className="mt-4 text-sm font-bold text-[var(--theme-accent)]">★★★★★ {pt.rating}</p>
            </article>
          ))}
        </div>
      </section>

      <section ref={facilitiesReveal.ref} className="bg-[#0d0d0d] px-5 py-18 md:px-8 md:py-24">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--theme-accent)]">{t('about.facilities.eyebrow')}</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {galleryImages.map((src, i) => (
              <div key={src} className={`reveal h-[260px] overflow-hidden rounded-lg border border-white/10 md:h-[340px] ${facilitiesReveal.visible ? 'visible' : ''}`} style={{ transitionDelay: `${(i % 2) * 150}ms` }}>
                <img src={src} alt="" className="h-full w-full object-cover transition duration-500 hover:scale-105" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {landingFlags.feedbackSectionEnabled && <section ref={testimonialsReveal.ref} className="mx-auto max-w-7xl px-5 py-18 md:px-8 md:py-24">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--theme-accent)]">{t('about.testimonials.eyebrow')}</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {testimonialItems.map((item, i) => (
            <article key={item.name} className={`reveal rounded-lg border border-white/10 bg-[#101010] p-6 ${testimonialsReveal.visible ? 'visible' : ''}`} style={{ transitionDelay: `${i * 100}ms` }}>
              <p className="text-lg leading-8 text-white/78">&ldquo;{t(item.quoteKey)}&rdquo;</p>
              <div className="mt-6 border-t border-white/10 pt-5">
                <strong className="block">{item.name}</strong>
                <span className="text-sm text-white/50">{t(item.durationKey)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>}

      {landingFlags.startNowButtonEnabled && <section
        ref={ctaReveal.ref}
        className="flex min-h-[620px] items-center justify-center px-5 py-20 text-center md:px-8"
        style={{ background: 'linear-gradient(rgba(0,0,0,0.72), rgba(0,0,0,0.82)), url(https://images.unsplash.com/photo-1517963879433-6ad2b056d712?auto=format&fit=crop&w=1900&q=88) center/cover' }}
      >
        <div className={`reveal ${ctaReveal.visible ? 'visible' : ''}`}>
          <h2 className="mx-auto max-w-4xl text-7xl font-black leading-[0.9] md:text-[110px]">{t('about.cta.title')}</h2>
          <Button type="primary" className="mt-9 !h-13 !rounded-full !px-9 !font-extrabold" onClick={() => goTo('/register')}>
            {t('about.cta.register')}
          </Button>
        </div>
      </section>}

      <footer id="footer" className="border-t border-white/[0.07] bg-[#0a0a0a] px-5 py-16 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-3">
              {logoUrl ? <img src={logoUrl} alt={gymName} className="h-10 w-10 rounded-lg object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--theme-button-bg)] font-black text-[var(--theme-button-text)]">GP</span>}
              <span className="text-xl font-black">{gymName}</span>
            </div>
            <p className="mt-4 text-sm leading-7 text-white/50">{t('about.footer.description')}</p>
            <div className="mt-6 flex items-center gap-3">
              <a href="#" className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-sm text-white/50 transition hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)]" aria-label="Facebook">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
              </a>
              <a href="#" className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-sm text-white/50 transition hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)]" aria-label="Instagram">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
              </a>
              <a href="#" className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-sm text-white/50 transition hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)]" aria-label="YouTube">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.94 2C5.12 20 12 20 12 20s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" /><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" /></svg>
              </a>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--theme-accent)]">{t('about.footer.features_title')}</h3>
            <ul className="mt-5 space-y-3">
              <li><button type="button" className="text-sm text-white/50 transition hover:text-white" onClick={() => goTo('/about')}>{t('nav.checkin')}</button></li>
              <li><button type="button" className="text-sm text-white/50 transition hover:text-white" onClick={() => goTo('/about')}>{t('nav.book_pt')}</button></li>
              <li><button type="button" className="text-sm text-white/50 transition hover:text-white" onClick={() => goTo('/about')}>{t('nav.health')}</button></li>
              <li><button type="button" className="text-sm text-white/50 transition hover:text-white" onClick={() => goTo('/about')}>{t('nav.workout')}</button></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--theme-accent)]">{t('about.footer.support_title')}</h3>
            <ul className="mt-5 space-y-3">
              <li><button type="button" className="text-sm text-white/50 transition hover:text-white" onClick={() => goTo('/help')}>{t('nav.help')}</button></li>
              <li><button type="button" className="text-sm text-white/50 transition hover:text-white" onClick={() => goTo('/policies')}>{t('nav.policies')}</button></li>
              <li><button type="button" className="text-sm text-white/50 transition hover:text-white" onClick={() => goTo('/about')}>{t('nav.feedback')}</button></li>
              <li><button type="button" className="text-sm text-white/50 transition hover:text-white" onClick={() => goTo('/about')}>{t('about.footer.about')}</button></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--theme-accent)]">{t('about.footer.contact_title')}</h3>
            <ul className="mt-5 space-y-4">
              <li className="flex items-center gap-3 text-sm text-white/50">
                <Mail size={15} className="shrink-0 text-[var(--theme-accent)]" />
                <span>{t('about.footer.email')}</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-white/50">
                <Phone size={15} className="shrink-0 text-[var(--theme-accent)]" />
                <span>{t('about.footer.phone')}</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-white/50">
                <MapPin size={15} className="shrink-0 text-[var(--theme-accent)]" />
                <span>{t('about.footer.address')}</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-14 flex max-w-7xl items-center justify-between border-t border-white/[0.07] pt-6 text-sm text-white/40">
          <span>© {new Date().getFullYear()} {gymName}. {t('about.footer.copyright')}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => i18n.changeLanguage('vi')}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${i18n.language === 'vi' ? 'bg-[var(--theme-active-bg)] text-[var(--theme-active-text)]' : 'text-white/40 hover:text-white'}`}
            >
              VI
            </button>
            <button
              type="button"
              onClick={() => i18n.changeLanguage('en')}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${i18n.language === 'en' ? 'bg-[var(--theme-active-bg)] text-[var(--theme-active-text)]' : 'text-white/40 hover:text-white'}`}
            >
              EN
            </button>
          </div>
        </div>
      </footer>
    </main>
  )
}
