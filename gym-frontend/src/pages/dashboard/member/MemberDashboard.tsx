import { Button, theme } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { useAuth } from '../../../hooks/useAuth'

export default function MemberDashboard() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const { token } = theme.useToken()
  const navigate = useNavigate()
  const firstName = user?.name?.split(' ').pop() || t('dashboard.greeting_fallback')
  const slogan1 = t('dashboard.slogan1')
  const slogan2 = t('dashboard.slogan2')
  const slogans = [slogan1, slogan2]
  const [displayText, setDisplayText] = useState('')

  const stats = [
    { value: '500+', label: t('dashboard.stats.members') },
    { value: '20+', label: t('dashboard.stats.trainers') },
    { value: '4', label: t('dashboard.stats.branches') },
    { value: '98%', label: t('dashboard.stats.satisfaction') },
  ]

  const services = [
    {
      icon: '▣',
      title: t('dashboard.services.qr_checkin'),
      desc: t('dashboard.services.qr_checkin_desc'),
      color: '#e05a30',
      path: '/checkin',
    },
    {
      icon: '◴',
      title: t('dashboard.services.book_pt'),
      desc: t('dashboard.services.book_pt_desc'),
      color: '#3d9dd0',
      path: '/booking',
    },
    {
      icon: '↗',
      title: t('dashboard.services.workout'),
      desc: t('dashboard.services.workout_desc'),
      color: '#5cb85c',
      path: '/workout',
    },
    {
      icon: '♡',
      title: t('dashboard.services.health'),
      desc: t('dashboard.services.health_desc'),
      color: '#e6a317',
      path: '/health',
    },
    {
      icon: '◎',
      title: t('dashboard.services.group_class'),
      desc: t('dashboard.services.group_class_desc'),
      color: '#b464c8',
    },
    {
      icon: '!',
      title: t('dashboard.services.notification'),
      desc: t('dashboard.services.notification_desc'),
      color: '#e05a30',
    },
  ]

  const testimonials = [
    {
      name: t('dashboard.testimonials.item_0_name'),
      duration: t('dashboard.testimonials.item_0_duration'),
      quote: t('dashboard.testimonials.item_0_quote'),
    },
    {
      name: t('dashboard.testimonials.item_1_name'),
      duration: t('dashboard.testimonials.item_1_duration'),
      quote: t('dashboard.testimonials.item_1_quote'),
    },
    {
      name: t('dashboard.testimonials.item_2_name'),
      duration: t('dashboard.testimonials.item_2_duration'),
      quote: t('dashboard.testimonials.item_2_quote'),
    },
  ]

  useEffect(() => {
    let cancelled = false
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    const runTypewriter = async () => {
      let currentIndex = 0

      while (!cancelled) {
        const slogan = slogans[currentIndex]

        for (let i = 1; i <= slogan.length; i += 1) {
          if (cancelled) return
          setDisplayText(slogan.slice(0, i))
          await wait(80)
        }

        await wait(1500)

        for (let i = slogan.length - 1; i >= 0; i -= 1) {
          if (cancelled) return
          setDisplayText(slogan.slice(0, i))
          await wait(40)
        }

        await wait(400)
        currentIndex = (currentIndex + 1) % slogans.length
      }
    }

    runTypewriter()

    return () => {
      cancelled = true
    }
  }, [i18n.language])

  return (
    <MemberLayout>
      <main
        className="min-h-screen font-['Plus_Jakarta_Sans']"
        style={{ backgroundColor: token.colorBgLayout, color: token.colorText }}
      >
        <style>
          {`
            .cursor {
              color: var(--theme-accent);
              animation: blink-cursor 0.7s step-end infinite;
            }

            @keyframes blink-cursor {
              0%, 100% { opacity: 1; }
              50% { opacity: 0; }
            }
          `}
        </style>
        <section
          className="relative overflow-hidden bg-[length:40px_40px] px-5 py-16 md:px-8 md:pb-14 md:pt-[88px]"
          style={{
            backgroundColor: token.colorBgLayout,
            backgroundImage:
              'linear-gradient(rgba(128,128,128,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,0.08) 1px, transparent 1px)',
          }}
        >
          <div
            className="absolute -right-36 -top-40 h-[420px] w-[420px] rounded-full blur-xl"
            style={{
              background: 'radial-gradient(circle, var(--theme-accent-muted) 0%, transparent 70%)',
            }}
          />

          <div className="relative z-[1] mx-auto w-full max-w-6xl">
            <div
              className="inline-flex items-center gap-2.5 rounded-full border px-3.5 py-2 text-[13px] font-bold"
              style={{
                backgroundColor: token.colorBgContainer,
                borderColor: token.colorBorder,
                color: token.colorTextSecondary,
              }}
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--theme-accent)]" />
              {t('dashboard.badge')}
            </div>

            <h1
              className="mt-7 max-w-[920px]"
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 80,
                lineHeight: 0.92,
                letterSpacing: 1,
                fontWeight: 400,
                color: 'var(--theme-text)',
              }}
            >
              {displayText}
              <span className="cursor">|</span>
            </h1>

            <p className="mt-5 max-w-[720px] text-[15px] leading-7 md:text-[17px]" style={{ color: token.colorTextSecondary }}>
              {t('dashboard.subtitle')}
            </p>

            <div className="mt-8 flex flex-col flex-wrap gap-3 min-[421px]:flex-row">
              <Button
                size="large"
                className="!h-[46px] !rounded-full !px-5 !font-extrabold !shadow-none min-[421px]:!px-6"
                style={{
                  background: 'var(--theme-accent)',
                  borderColor: 'var(--theme-accent)',
                  color: 'var(--theme-button-text)',
                }}
                onClick={() => navigate('/booking')}
              >
                {t('dashboard.cta_booking')}
              </Button>
              <Button
                size="large"
                className="!h-[46px] !rounded-full !bg-transparent !px-5 !font-extrabold !shadow-none min-[421px]:!px-6"
                style={{
                  background: 'transparent',
                  borderColor: 'var(--theme-accent)',
                  color: 'var(--theme-accent)',
                }}
                onClick={() => navigate('/checkin')}
              >
                {t('dashboard.cta_checkin')}
              </Button>
            </div>

            <div
              className="mt-10 grid max-w-[760px] grid-cols-2 gap-px overflow-hidden rounded-lg border md:grid-cols-4"
              aria-label="Gym statistics"
              style={{ backgroundColor: token.colorBorder, borderColor: token.colorBorder }}
            >
              {stats.map((item) => (
                <div className="p-4 md:p-[18px]" key={item.label} style={{ backgroundColor: token.colorBgContainer }}>
                  <strong className="block text-2xl leading-none" style={{ color: token.colorText }}>{item.value}</strong>
                  <span className="mt-2 block text-[13px]" style={{ color: token.colorTextSecondary }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-[calc(100%-40px)] max-w-6xl pt-14 md:w-[calc(100%-64px)] md:pt-[74px]">
          <p className="mb-2.5 text-xs font-black uppercase tracking-[0.14em] text-[var(--theme-accent)]">{t('dashboard.services.overline')}</p>
          <h2 className="font-['Bebas_Neue'] text-[44px] font-normal leading-none tracking-normal" style={{ color: token.colorText }}>
            {t('dashboard.services.heading')}
          </h2>

          <div className="mt-7 grid grid-cols-1 gap-4 min-[421px]:grid-cols-2 md:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
            {services.map((service) => (
              <button
                type="button"
                className={`min-h-[168px] rounded-lg border p-[18px] text-left transition duration-200 md:min-h-[178px] md:p-[22px] ${service.path
                    ? 'cursor-pointer hover:-translate-y-0.5'
                    : 'cursor-default'
                  }`}
                key={service.title}
                onClick={() => service.path && navigate(service.path)}
                disabled={!service.path}
                style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder, color: token.colorText }}
              >
                <span
                  className="grid h-[42px] w-[42px] place-items-center rounded-full border text-[22px] font-black"
                  style={{ color: service.color }}
                >
                  {service.icon}
                </span>
                <span className="mt-5 block text-base font-black md:mt-[22px]">{service.title}</span>
                <span className="mt-2 block text-[13px] leading-relaxed" style={{ color: token.colorTextSecondary }}>{service.desc}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mx-auto w-[calc(100%-40px)] max-w-6xl pt-14 md:w-[calc(100%-64px)] md:pt-[74px]">
          <p className="mb-2.5 text-xs font-black uppercase tracking-[0.14em] text-[var(--theme-accent)]">{t('dashboard.testimonials.overline')}</p>
          <h2 className="font-['Bebas_Neue'] text-[44px] font-normal leading-none tracking-normal" style={{ color: token.colorText }}>
            {t('dashboard.testimonials.heading')}
          </h2>

          <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-3">
            {testimonials.map((item) => (
              <article className="rounded-lg border p-6" key={item.name} style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder }}>
                <div className="text-sm tracking-normal text-[#e6a317]">★★★★★</div>
                <p className="my-[18px] min-h-0 text-[15px] italic leading-7 md:min-h-[92px]" style={{ color: token.colorTextSecondary }}>
                  &ldquo;{item.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <span className="grid h-[42px] w-[42px] place-items-center rounded-full font-black" style={{ background: 'var(--theme-elevated)', color: 'var(--theme-text)' }}>
                    {item.name.charAt(0)}
                  </span>
                  <span>
                    <strong className="block">{item.name}</strong>
                    <small className="mt-1 block text-xs" style={{ color: token.colorTextSecondary }}>{item.duration}</small>
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto w-[calc(100%-40px)] max-w-[900px] py-[74px] text-center md:w-[calc(100%-64px)] md:pt-[88px]">
          <h2 className="grid font-['Bebas_Neue'] text-5xl font-normal leading-[0.95] tracking-normal md:text-[64px]" style={{ color: token.colorText }}>
            {t('dashboard.cta.heading1')}
            <span>{t('dashboard.cta.heading2')}</span>
          </h2>
          <p className="mx-auto mt-[18px] max-w-[560px] text-base leading-7" style={{ color: token.colorTextSecondary }}>
            {t('dashboard.cta.subtitle', { firstName })}
          </p>
          <div className="mt-8 flex flex-col flex-wrap justify-center gap-3 min-[421px]:flex-row">
            <Button
              size="large"
              className="!h-[46px] !rounded-full !px-5 !font-extrabold !shadow-none min-[421px]:!px-6"
              style={{ backgroundColor: 'var(--theme-accent)', borderColor: 'var(--theme-accent)', color: 'var(--theme-button-text)' }}
              onClick={() => navigate('/booking')}
            >
              {t('dashboard.cta.book_pt')}
            </Button>
            <Button
              size="large"
              className="!h-[46px] !rounded-full !bg-transparent !px-5 !font-extrabold !shadow-none min-[421px]:!px-6"
              style={{ borderColor: token.colorBorder, color: token.colorText }}
              onClick={() => navigate('/health')}
            >
              {t('dashboard.cta.view_health')}
            </Button>
          </div>
        </section>

      </main>
    </MemberLayout>
  )
}
