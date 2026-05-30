import {
  BellOutlined,
  CalendarOutlined,
  HeartOutlined,
  LeftOutlined,
  LoginOutlined,
  QrcodeOutlined,
  RightOutlined,
  ShopOutlined,
  ThunderboltOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import { Button } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import LanguageSelect from '../common/LanguageSelect'
import { getLocalizedText } from '../../utils/localization'

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
  { icon: <QrcodeOutlined />, titleKey: 'about.features.qr.title', descKey: 'about.features.qr.desc' },
  { icon: <CalendarOutlined />, titleKey: 'about.features.booking.title', descKey: 'about.features.booking.desc' },
  { icon: <HeartOutlined />, titleKey: 'about.features.health.title', descKey: 'about.features.health.desc' },
  { icon: <ThunderboltOutlined />, titleKey: 'about.features.roadmap.title', descKey: 'about.features.roadmap.desc' },
  { icon: <ShopOutlined />, titleKey: 'about.features.store.title', descKey: 'about.features.store.desc' },
  { icon: <BellOutlined />, titleKey: 'about.features.notifications.title', descKey: 'about.features.notifications.desc' },
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
  settings?: any
  onCtaClick?: (link: string) => void
}

const pick = (value: any, lang: string, fallback = '') => getLocalizedText(value, lang, fallback)

export default function AboutLandingSection({ landing, settings, onCtaClick }: AboutLandingSectionProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [activeSlide, setActiveSlide] = useState(0)
  const [navSolid, setNavSolid] = useState(false)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const gymName = settings?.gymName || 'GymPro'
  const aboutTitle = pick(landing?.aboutTitle, lang, t('about.intro.titleFallback'))
  const aboutContent = pick(
    landing?.aboutContent,
    lang,
    t('about.intro.contentFallback'),
  )

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
    <main className="min-h-screen bg-[#070707] text-[var(--theme-text)]">
      <header className={`fixed left-0 right-0 top-0 z-50 transition duration-300 ${navSolid ? 'border-b border-white/10 bg-black/70 shadow-2xl backdrop-blur-xl' : 'bg-black/10 backdrop-blur-sm'}`}>
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 py-4 md:px-8">
          <button type="button" className="flex items-center gap-3" onClick={() => goTo('/about')}>
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--theme-accent)] font-black text-[var(--theme-button-text)]">GP</span>
            <span className="text-lg font-black tracking-wide">{gymName}</span>
          </button>
          <div className="hidden items-center gap-3 md:flex">
            <div className="flex">
              <Button className="!rounded-full !border-white/20 !bg-white/5 !px-5 !text-white hover:!border-[var(--theme-accent)]" icon={<LoginOutlined />} onClick={() => goTo('/login')}>
                {t('about.nav.login')}
              </Button>
            </div>
            <Button type="primary" className="!rounded-full !px-5 !font-bold" icon={<UserAddOutlined />} onClick={() => goTo('/register')}>
              {t('about.nav.register')}
            </Button>
            <LanguageSelect />
          </div>
          <div ref={mobileMenuRef} className="relative md:hidden">
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-lg border border-white/15 bg-white/5 text-2xl font-black text-white backdrop-blur"
              onClick={() => setIsMenuOpen((open) => !open)}
              aria-label="Toggle mobile menu"
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? '×' : '☰'}
            </button>
            <div
              className={`absolute right-0 top-12 w-56 overflow-hidden rounded-xl border border-white/10 bg-black/90 shadow-2xl backdrop-blur-xl transition-all duration-300 ${
                isMenuOpen ? 'max-h-72 opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="p-2">
                <button
                  type="button"
                  className="block w-full rounded-lg px-4 py-3 text-left text-sm text-white/78 transition hover:bg-white/10"
                  onClick={() => {
                    setIsMenuOpen(false)
                    goTo('/login')
                  }}
                >
                  {t('about.nav.login')}
                </button>
                <button
                  type="button"
                  className="block w-full rounded-lg px-4 py-3 text-left text-sm font-bold text-white transition hover:bg-white/10"
                  onClick={() => {
                    setIsMenuOpen(false)
                    goTo('/register')
                  }}
                >
                  {t('about.nav.register')}
                </button>
                <div className="flex flex-row gap-3 border-t border-white/10 pt-2">
                  <button
                    type="button"
                    onClick={() => i18n.changeLanguage('vi')}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                      i18n.language === 'vi' ? 'bg-[var(--theme-accent)] text-white' : 'opacity-60'
                    }`}
                  >
                    <img src="https://flagcdn.com/20x15/vn.png" alt="" className="h-3.5 w-5 rounded-sm object-cover" /> VN
                  </button>
                  <button
                    type="button"
                    onClick={() => i18n.changeLanguage('en')}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                      i18n.language === 'en' ? 'bg-[var(--theme-accent)] text-white' : 'opacity-60'
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
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.78),rgba(0,0,0,0.28),rgba(0,0,0,0.72))]" />
          </div>
        ))}
        <div className="relative z-10 mx-auto flex h-full max-w-7xl items-center px-4 md:px-8 lg:px-16">
          <div className="max-w-4xl pt-20">
            <p className="mb-5 text-xs font-black uppercase tracking-[0.3em] text-[var(--theme-accent)]">{gymName}</p>
            <h1 className="max-w-full break-words text-3xl font-black leading-[1.08] tracking-[1px] md:text-5xl lg:text-7xl">
              {t(heroSlides[activeSlide].titleKey)}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-white/78 md:text-xl">{t(heroSlides[activeSlide].subtitleKey)}</p>
            <Button type="primary" className="mt-8 !h-13 !rounded-full !px-8 !font-extrabold" onClick={() => goTo(heroSlides[activeSlide].link)}>
              {t(heroSlides[activeSlide].ctaKey)}
            </Button>
          </div>
        </div>
        <button type="button" className="absolute top-1/2 left-2 z-20 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/30 text-white backdrop-blur hover:border-[var(--theme-accent)] md:left-4 md:flex md:h-10 md:w-10" onClick={prevSlide}>
          <LeftOutlined />
        </button>
        <button type="button" className="absolute top-1/2 right-2 z-20 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/30 text-white backdrop-blur hover:border-[var(--theme-accent)] md:right-4 md:flex md:h-10 md:w-10" onClick={nextSlide}>
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

      <section className="border-y border-white/10 bg-[#0d0d0d]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-5 py-8 md:grid-cols-4 md:px-8">
          {stats.map((item) => (
            <div key={item.value} className="text-center">
              <strong className="block text-6xl font-black leading-none text-[var(--theme-accent)]">{item.value}</strong>
              <span className="mt-2 block text-sm uppercase tracking-[0.16em] text-white/58">{t(item.labelKey)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-18 md:grid-cols-[1fr_0.9fr] md:px-8 md:py-24">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--theme-accent)]">{t('about.intro.eyebrow')}</p>
          <h2 className="mt-4 text-6xl font-black leading-none md:text-[82px]">{aboutTitle}</h2>
          <p className="mt-6 whitespace-pre-wrap text-base leading-8 text-white/64 md:text-lg">{aboutContent}</p>
        </div>
        <img className="h-[420px] w-full rounded-lg border border-white/10 object-cover" src="https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=1200&q=86" alt={aboutTitle} />
      </section>

      <section id="features" className="bg-[#0d0d0d] px-5 py-18 md:px-8 md:py-24">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--theme-accent)]">{t('about.features.eyebrow')}</p>
          <h2 className="mt-4 text-6xl font-black leading-none md:text-[82px]">{t('about.features.title')}</h2>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {featureItems.map((item) => (
              <article key={item.titleKey} className="rounded-lg border border-white/10 bg-black/24 p-6 transition hover:border-[var(--theme-accent)]">
                <div className="grid h-12 w-12 place-items-center rounded-full border border-[var(--theme-accent)] text-2xl text-[var(--theme-accent)]">{item.icon}</div>
                <h3 className="mt-5 text-xl font-black">{t(item.titleKey)}</h3>
                <p className="mt-3 text-sm leading-7 text-white/56">{t(item.descKey)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-18 md:px-8 md:py-24">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--theme-accent)]">{t('about.pts.eyebrow')}</p>
        <h2 className="mt-4 text-6xl font-black leading-none md:text-[82px]">{t('about.pts.title')}</h2>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ptItems.map((pt) => (
            <article key={pt.name} className="rounded-lg border border-white/10 bg-[#101010] p-6 text-center">
              <img src={pt.image} alt={pt.name} className="mx-auto h-28 w-28 rounded-full object-cover ring-2 ring-[var(--theme-accent)]" />
              <h3 className="mt-5 text-xl font-black">{pt.name}</h3>
              <p className="mt-2 text-sm text-white/58">{t(pt.specialtyKey)}</p>
              <p className="mt-4 text-sm font-bold text-[var(--theme-accent)]">★★★★★ {pt.rating}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#0d0d0d] px-5 py-18 md:px-8 md:py-24">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--theme-accent)]">{t('about.facilities.eyebrow')}</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {galleryImages.map((src) => (
              <div key={src} className="h-[260px] overflow-hidden rounded-lg border border-white/10 md:h-[340px]">
                <img src={src} alt="" className="h-full w-full object-cover transition duration-500 hover:scale-105" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-18 md:px-8 md:py-24">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--theme-accent)]">{t('about.testimonials.eyebrow')}</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {testimonialItems.map((item) => (
            <article key={item.name} className="rounded-lg border border-white/10 bg-[#101010] p-6">
              <p className="text-lg leading-8 text-white/78">&ldquo;{t(item.quoteKey)}&rdquo;</p>
              <div className="mt-6 border-t border-white/10 pt-5">
                <strong className="block">{item.name}</strong>
                <span className="text-sm text-white/50">{t(item.durationKey)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        className="flex min-h-[620px] items-center justify-center px-5 py-20 text-center md:px-8"
        style={{ background: 'linear-gradient(rgba(0,0,0,0.72), rgba(0,0,0,0.82)), url(https://images.unsplash.com/photo-1517963879433-6ad2b056d712?auto=format&fit=crop&w=1900&q=88) center/cover' }}
      >
        <div>
          <h2 className="mx-auto max-w-4xl text-7xl font-black leading-[0.9] md:text-[110px]">{t('about.cta.title')}</h2>
          <Button type="primary" className="mt-9 !h-13 !rounded-full !px-9 !font-extrabold" onClick={() => goTo('/register')}>
            {t('about.cta.register')}
          </Button>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-black px-5 py-10 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1fr_auto]">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--theme-accent)] font-black text-[var(--theme-button-text)]">GP</span>
              <span className="text-xl font-black">{gymName}</span>
            </div>
            <p className="mt-4 max-w-md text-sm leading-7 text-white/52">{t('about.footer.description')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-sm text-white/62">
            <button type="button" onClick={() => goTo('/about')}>{t('about.footer.home')}</button>
            <button type="button" onClick={() => goTo('/about')}>{t('about.footer.about')}</button>
            <button type="button" onClick={() => goTo('/help')}>{t('about.footer.contact')}</button>
            <button type="button" onClick={() => goTo('/policies')}>{t('about.footer.policies')}</button>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-7xl border-t border-white/10 pt-6 text-sm text-white/40">
          © {new Date().getFullYear()} {gymName}. {t('about.footer.copyright')}
        </div>
      </footer>
    </main>
  )
}
