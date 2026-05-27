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
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '../../../context/ThemeProvider'
import { useAuth } from '../../../hooks/useAuth'

type FooterLink = {
  label: string
  to: string
  icon?: LucideIcon
  match?: string[]
  end?: boolean
}

const serviceLinks: FooterLink[] = [
  { label: 'Gói tập', to: '/dashboard/member/health', icon: Dumbbell },
  { label: 'Danh sách PT', to: '/dashboard/member/booking', icon: UsersRound },
  { label: 'Lớp tập nhóm', to: '/dashboard/member/workout', icon: CalendarDays },
  { label: 'Cửa hàng', to: '/dashboard/member/store', icon: Store },
]

const accountLinks: FooterLink[] = [
  { label: 'Thông tin cá nhân', to: '/dashboard/member/profile', icon: UserRound },
  { label: 'Lịch sử gói tập', to: '/dashboard/member/orders', icon: ShoppingBag },
  { label: 'Thông báo', to: '/dashboard/member/notifications', icon: Bell },
]

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
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { dark } = useTheme()

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
            isRouteActive(location.pathname, item, isActive)
              ? dark
                ? 'text-white'
                : 'text-[#edebe6]'
              : dark
                ? 'text-zinc-300 hover:text-white'
                : 'text-[rgba(237,235,230,0.65)] hover:text-[#edebe6]',
          ].join(' ')
        }
        style={{ color: 'var(--theme-text)' }}
      >
        {Icon ? (
          <Icon className={['h-4 w-4 shrink-0 transition-colors', dark ? 'text-zinc-500 group-hover:text-white' : 'text-[rgba(237,235,230,0.5)] group-hover:text-[#edebe6]'].join(' ')} style={{ color: 'var(--theme-muted)' }} />
        ) : null}
        <span>{item.label}</span>
      </NavLink>
    )
  }

  return (
    <>
      {/* Desktop footer */}
      <footer
        className={[
          'border-t',
          dark
            ? 'border-zinc-800 bg-zinc-950 text-white'
            : 'border-[#5a5a5a] bg-[#3e3e3e] text-[#edebe6]',
        ].join(' ')}
        style={{ background: 'var(--theme-card)', color: 'var(--theme-text)', borderColor: 'var(--theme-border)' }}
      >
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 sm:px-6 sm:gap-8 md:px-8 md:py-10 lg:grid-cols-4 lg:gap-10 lg:py-12">
          {/* Cột 1 - Logo */}
          <div className="col-span-2 lg:col-span-1">
            <button
              type="button"
              onClick={() => navigate('/dashboard/member')}
              className="flex items-center gap-3 text-left"
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-lg text-sm font-black"
                style={{ background: 'var(--theme-accent)', color: 'var(--theme-button-text)' }}
              >
                GP
              </span>
              <span>
                <span className="block text-lg font-bold leading-tight" style={{ color: 'var(--theme-accent)' }}>GymPro</span>
                <span className={['block text-sm', dark ? 'text-zinc-400' : 'text-[rgba(237,235,230,0.65)]'].join(' ')}>
                  Train smarter every day
                </span>
              </span>
            </button>
            <p className={['mt-5 max-w-full text-sm leading-6 lg:max-w-xs', dark ? 'text-zinc-300' : 'text-[rgba(237,235,230,0.65)]'].join(' ')}>
              Không gian luyện tập hiện đại, lịch trình rõ ràng và lộ trình cá nhân hóa cho hội viên.
            </p>
            <div className={['mt-5 flex items-start gap-2 text-sm', dark ? 'text-zinc-300' : 'text-[rgba(237,235,230,0.65)]'].join(' ')}>
              <Clock3 className={['mt-0.5 h-4 w-4 shrink-0', dark ? 'text-white' : 'text-[#edebe6]'].join(' ')} />
              <span>
                Giờ mở cửa
                <span className={['block font-medium', dark ? 'text-white' : 'text-[#edebe6]'].join(' ')}>
                  05:30 - 22:00 hằng ngày
                </span>
              </span>
            </div>
          </div>

          {/* Cột 2 - Dịch vụ */}
          <div>
            <h2 className={['text-sm font-semibold uppercase tracking-wide', dark ? 'text-zinc-100' : 'text-[#edebe6]'].join(' ')}>
              Dịch vụ
            </h2>
            <div className="mt-5 space-y-3">{serviceLinks.map(renderDesktopLink)}</div>
          </div>

          {/* Cột 3 - Tài khoản */}
          <div>
            <h2 className={['text-sm font-semibold uppercase tracking-wide', dark ? 'text-zinc-100' : 'text-[#edebe6]'].join(' ')}>
              Tài khoản
            </h2>
            <div className="mt-5 space-y-3">
              {accountLinks.map(renderDesktopLink)}
              <button
                type="button"
                onClick={handleLogout}
                className={['group flex items-center gap-2 text-sm transition-colors', dark ? 'text-zinc-300 hover:text-white' : 'text-[rgba(237,235,230,0.65)] hover:text-[#edebe6]'].join(' ')}
              >
                <LogOut className={['h-4 w-4 transition-colors', dark ? 'text-zinc-500 group-hover:text-white' : 'text-[rgba(237,235,230,0.5)] group-hover:text-[#edebe6]'].join(' ')} />
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>

          {/* Cột 4 - Liên hệ */}
          <div className="col-span-2 lg:col-span-1">
            <h2 className={['text-sm font-semibold uppercase tracking-wide', dark ? 'text-zinc-100' : 'text-[#edebe6]'].join(' ')}>
              Liên hệ
            </h2>
            <div className={['mt-5 space-y-3 text-sm', dark ? 'text-zinc-300' : 'text-[rgba(237,235,230,0.65)]'].join(' ')}>
              <a
                href="tel:19006868"
                className={['flex items-center gap-2 transition-colors', dark ? 'hover:text-white' : 'hover:text-[#edebe6]'].join(' ')}
              >
                <Phone className={['h-4 w-4', dark ? 'text-white' : 'text-[#edebe6]'].join(' ')} />
                <span>1900 6868</span>
              </a>
              <a
                href="mailto:support@gympro.vn"
                className={['flex items-center gap-2 transition-colors', dark ? 'hover:text-white' : 'hover:text-[#edebe6]'].join(' ')}
              >
                <Mail className={['h-4 w-4', dark ? 'text-white' : 'text-[#edebe6]'].join(' ')} />
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
                  className={['flex items-center gap-3 rounded-lg px-3 py-2 transition-colors', dark ? 'bg-zinc-900 hover:bg-zinc-800' : 'bg-[#484848] hover:bg-[#525252]'].join(' ')}
                  style={{ background: 'var(--theme-elevated)', color: 'var(--theme-text)' }}
                >
                  <Smartphone className={['h-5 w-5', dark ? 'text-white' : 'text-[#edebe6]'].join(' ')} />
                  <span>
                    <span className="block text-[10px] text-zinc-400">Tải trên</span>
                    <span className={['block text-sm font-semibold', dark ? 'text-white' : 'text-[#edebe6]'].join(' ')}>
                      App Store
                    </span>
                  </span>
                </a>
                <a
                  href="#"
                  className={['flex items-center gap-3 rounded-lg px-3 py-2 transition-colors', dark ? 'bg-zinc-900 hover:bg-zinc-800' : 'bg-[#484848] hover:bg-[#525252]'].join(' ')}
                  style={{ background: 'var(--theme-elevated)', color: 'var(--theme-text)' }}
                >
                  <PlayCircle className={['h-5 w-5', dark ? 'text-white' : 'text-[#edebe6]'].join(' ')} />
                  <span>
                    <span className="block text-[10px] text-zinc-400">Tải trên</span>
                    <span className={['block text-sm font-semibold', dark ? 'text-white' : 'text-[#edebe6]'].join(' ')}>
                      CH Play
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
                    'group flex w-fit min-w-[170px] items-center gap-3 rounded-xl px-3 py-2 no-underline shadow-sm transition-opacity duration-200 hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e05a30]',
                    'bg-[#e05a30] text-white shadow-[0_10px_24px_rgba(224,90,48,0.22)] hover:bg-[#c94d26]',
                  ].join(' ')}
                  style={{
                    background: 'var(--theme-accent)',
                    borderColor: 'var(--theme-accent)',
                    color: 'var(--theme-button-text)',
                  }}
                >
                  <MonitorDown className="h-5 w-5 shrink-0" />
                  <span className="text-sm font-semibold leading-5">Tải xuống Windows</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div
          className={['border-t px-4 py-4 sm:px-6 md:px-8', dark ? 'border-zinc-800' : 'border-[#5a5a5a]'].join(' ')}
          style={{ borderColor: 'var(--theme-border)' }}
        >
          <p className={['mx-auto max-w-7xl text-sm', dark ? 'text-zinc-500' : 'text-[rgba(237,235,230,0.65)]'].join(' ')}>
            Copyright © {new Date().getFullYear()} GymPro. All rights reserved.
          </p>
        </div>
      </footer>
    </>
  )
}

export default MemberFooter
