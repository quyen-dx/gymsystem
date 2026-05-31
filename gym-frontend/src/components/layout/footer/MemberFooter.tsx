import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  CalendarDays,
  Clock3,
  Dumbbell,
  LogOut,
  Mail,
  MonitorDown,
  Phone,
  PlayCircle,
  ShoppingBag,
  Smartphone,
  Store,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../hooks/useAuth'

type FooterLink = {
  label: string
  to: string
  icon?: LucideIcon
  match?: string[]
  end?: boolean
}

const socialLogos = {
  facebook: '/facebook.png',
  zalo: '/zalo.png',
  instagram: '/instagram.png',
}

const isRouteActive = (pathname: string, item: FooterLink, isActive: boolean) => {
  if (item.end) return pathname === item.to || isActive
  const paths = [item.to, ...(item.match || [])]
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`)) || isActive
}

function MemberFooter() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()

  const serviceLinks: FooterLink[] = [
    { label: t('footer.member.services.packages'), to: '/health', icon: Dumbbell },
    { label: t('footer.member.services.pt_list'), to: '/booking', icon: UsersRound },
    { label: t('footer.member.services.group_classes'), to: '/workout', icon: CalendarDays },
    { label: t('footer.member.services.store'), to: '/store', icon: Store },
  ]

  const accountLinks: FooterLink[] = [
    { label: t('footer.member.account.profile'), to: '/profile', icon: UserRound },
    { label: t('footer.member.account.orders'), to: '/orders', icon: ShoppingBag },
    { label: t('footer.member.account.notifications'), to: '/notifications', icon: Bell },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const renderDesktopLink = (item: FooterLink) => {
    const Icon = item.icon
    return (
      <NavLink
        key={item.label}
        to={item.to}
        className={({ isActive }) =>
          [
            'group flex items-center gap-2 text-sm transition-colors',
            isRouteActive(location.pathname, item, isActive) ? 'font-semibold' : '',
          ].join(' ')
        }
        style={{ color: 'var(--gs-text)' }}
      >
        {Icon ? (
          <Icon className="h-4 w-4 shrink-0 transition-colors group-hover:text-[var(--gs-text)]" style={{ color: 'var(--gs-muted)' }} />
        ) : null}
        <span>{item.label}</span>
      </NavLink>
    )
  }

  return (
    <>
      <footer
        className="border-t"
        style={{ background: 'var(--theme-card)', color: 'var(--theme-text)', borderColor: 'var(--theme-border)' }}
      >
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 sm:px-6 sm:gap-8 md:px-8 md:py-10 lg:grid-cols-4 lg:gap-10 lg:py-12">
          <div className="col-span-2 lg:col-span-1">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center gap-3 text-left"
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-lg text-sm font-black"
                style={{ background: 'var(--theme-button-bg)', color: 'var(--theme-button-text)' }}
              >
                GP
              </span>
              <span>
                <span className="block text-lg font-bold leading-tight" style={{ color: 'var(--theme-accent)' }}>GymPro</span>
                <span className="block text-sm" style={{ color: 'var(--gs-muted)' }}>
                  {t('footer.member.tagline')}
                </span>
              </span>
            </button>
            <p className="mt-5 max-w-full text-sm leading-6 lg:max-w-xs" style={{ color: 'var(--gs-muted)' }}>
              {t('footer.member.description')}
            </p>
            <div className="mt-5 flex items-start gap-2 text-sm" style={{ color: 'var(--gs-muted)' }}>
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--gs-muted)' }} />
              <span>
                {t('footer.member.hours_label')}
                <span className="block font-medium" style={{ color: 'var(--gs-text)' }}>
                  {t('footer.member.hours_value')}
                </span>
              </span>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--gs-text)' }}>
              {t('footer.member.section.services')}
            </h2>
            <div className="mt-5 space-y-3">{serviceLinks.map(renderDesktopLink)}</div>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--gs-text)' }}>
              {t('footer.member.section.account')}
            </h2>
            <div className="mt-5 space-y-3">
              {accountLinks.map(renderDesktopLink)}
              <button
                type="button"
                onClick={handleLogout}
                className="group flex items-center gap-2 text-sm transition-colors hover:text-[var(--gs-text)]"
                style={{ color: 'var(--gs-muted)' }}
              >
                <LogOut className="h-4 w-4 transition-colors group-hover:text-[var(--gs-text)]" style={{ color: 'var(--gs-muted)' }} />
                <span>{t('footer.member.logout')}</span>
              </button>
            </div>
          </div>

          <div className="col-span-2 lg:col-span-1">
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--gs-text)' }}>
              {t('footer.member.section.contact')}
            </h2>
            <div className="mt-5 space-y-3 text-sm" style={{ color: 'var(--gs-muted)' }}>
              <a
                href="tel:19006868"
                className="flex items-center gap-2 transition-colors hover:text-[var(--gs-text)]"
              >
                <Phone className="h-4 w-4" style={{ color: 'var(--gs-muted)' }} />
                <span>1900 6868</span>
              </a>
              <a
                href="mailto:support@gympro.vn"
                className="flex items-center gap-2 transition-colors hover:text-[var(--gs-text)]"
              >
                <Mail className="h-4 w-4" style={{ color: 'var(--gs-muted)' }} />
                <span>support@gympro.vn</span>
              </a>
              <div className="flex items-center gap-3 pt-2">
                <a
                  href="https://facebook.com"
                  aria-label="Facebook"
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-transparent transition-transform duration-150 hover:scale-110"
                  style={{
                    color: '#1877f2',
                  }}
                >
                  <img src={socialLogos.facebook} alt="" className="h-7 w-7 object-contain" />
                </a>
                <a
                  href="https://zalo.me"
                  aria-label="Zalo"
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-transparent transition-transform duration-150 hover:scale-110"
                  style={{
                    color: '#0068ff',
                  }}
                >
                  <img src={socialLogos.zalo} alt="" className="h-8 w-8 object-contain" />
                </a>
                <a
                  href="https://instagram.com"
                  aria-label="Instagram"
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-transparent transition-transform duration-150 hover:scale-110"
                  style={{
                    color: '#e4405f',
                  }}
                >
                  <img src={socialLogos.instagram} alt="" className="h-7 w-7 object-contain" />
                </a>
              </div>
              <div className="mt-4 space-y-2 lg:hidden">
                <a
                  href="#"
                  className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors"
                  style={{ background: 'var(--theme-elevated)', color: 'var(--theme-text)' }}
                >
                  <Smartphone className="h-5 w-5" style={{ color: 'var(--gs-muted)' }} />
                  <span>
                    <span className="block text-[10px]" style={{ color: 'var(--gs-muted)' }}>{t('footer.member.download.download_on')}</span>
                    <span className="block text-sm font-semibold" style={{ color: 'var(--gs-text)' }}>
                      {t('footer.member.download.app_store')}
                    </span>
                  </span>
                </a>
                <a
                  href="#"
                  className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors"
                  style={{ background: 'var(--theme-elevated)', color: 'var(--theme-text)' }}
                >
                  <PlayCircle className="h-5 w-5" style={{ color: 'var(--gs-muted)' }} />
                  <span>
                    <span className="block text-[10px]" style={{ color: 'var(--gs-muted)' }}>{t('footer.member.download.download_on')}</span>
                    <span className="block text-sm font-semibold" style={{ color: 'var(--gs-text)' }}>
                      {t('footer.member.download.ch_play')}
                    </span>
                  </span>
                </a>
              </div>
              <div className="mt-4 hidden lg:block">
                <a
                  href="https://github.com/quyen-dx/gymsystem/releases/latest/download/GymSystem-1.0.11-win-x64.exe"
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className={[
                    'group flex w-fit min-w-[170px] items-center gap-3 rounded-xl px-3 py-2 no-underline shadow-sm transition-opacity duration-200 hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-accent)]',
                    'bg-[var(--theme-button-bg)] text-[var(--theme-button-text)] shadow-[0_10px_24px_rgba(0,0,0,0.18)] hover:bg-[var(--theme-accent-hover)]',
                  ].join(' ')}
                  style={{
                    background: 'var(--theme-button-bg)',
                    borderColor: 'var(--theme-button-border)',
                    color: 'var(--theme-button-text)',
                  }}
                >
                  <MonitorDown className="h-5 w-5 shrink-0" />
                  <span className="text-sm font-semibold leading-5">{t('footer.member.download.desktop')}</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div
          className="border-t px-4 py-4 sm:px-6 md:px-8"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <p className="mx-auto max-w-7xl text-sm" style={{ color: 'var(--gs-muted)' }}>
            {t('footer.member.copyright', { year: new Date().getFullYear() })}
          </p>
        </div>
      </footer>
    </>
  )
}

export default MemberFooter
