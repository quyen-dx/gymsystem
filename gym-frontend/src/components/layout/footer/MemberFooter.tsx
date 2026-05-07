import type { LucideIcon } from 'lucide-react'
import {
  Bell,
  CalendarDays,
  Clock3,
  Dumbbell,
  LogOut,
  Mail,
  Phone,
  PlayCircle,
  ShoppingBag,
  Smartphone,
  Store,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { FaFacebook, FaInstagram } from 'react-icons/fa'
import { SiZalo } from 'react-icons/si'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '../../../context/ThemeProvider'
import { useAuth } from '../../../hook/useAuth'

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
                : 'text-zinc-950'
              : dark
                ? 'text-zinc-300 hover:text-white'
                : 'text-zinc-600 hover:text-zinc-950',
          ].join(' ')
        }
      >
        {Icon ? (
          <Icon className={['h-4 w-4 shrink-0 transition-colors', dark ? 'text-zinc-500 group-hover:text-white' : 'text-zinc-500 group-hover:text-zinc-950'].join(' ')} />
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
            : 'border-zinc-200 bg-white text-zinc-950',
        ].join(' ')}
      >
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 sm:px-6 sm:gap-8 md:px-8 md:py-10 lg:grid-cols-4 lg:gap-10 lg:py-12">
          {/* Cột 1 - Logo */}
          <div className="col-span-2 lg:col-span-1">
            <button
              type="button"
              onClick={() => navigate('/dashboard/member')}
              className="flex items-center gap-3 text-left"
            >
              <span className={['flex h-11 w-11 items-center justify-center rounded-lg text-sm font-black', dark ? 'bg-white text-zinc-950' : 'bg-zinc-950 text-white'].join(' ')}>
                GS
              </span>
              <span>
                <span className="block text-lg font-bold leading-tight">GymSystem</span>
                <span className={['block text-sm', dark ? 'text-zinc-400' : 'text-zinc-600'].join(' ')}>
                  Train smarter every day
                </span>
              </span>
            </button>
            <p className={['mt-5 max-w-full text-sm leading-6 lg:max-w-xs', dark ? 'text-zinc-300' : 'text-zinc-600'].join(' ')}>
              Không gian luyện tập hiện đại, lịch trình rõ ràng và lộ trình cá nhân hóa cho hội viên.
            </p>
            <div className={['mt-5 flex items-start gap-2 text-sm', dark ? 'text-zinc-300' : 'text-zinc-600'].join(' ')}>
              <Clock3 className={['mt-0.5 h-4 w-4 shrink-0', dark ? 'text-white' : 'text-zinc-950'].join(' ')} />
              <span>
                Giờ mở cửa
                <span className={['block font-medium', dark ? 'text-white' : 'text-zinc-950'].join(' ')}>
                  05:30 - 22:00 hằng ngày
                </span>
              </span>
            </div>
          </div>

          {/* Cột 2 - Dịch vụ */}
          <div>
            <h2 className={['text-sm font-semibold uppercase tracking-wide', dark ? 'text-zinc-100' : 'text-zinc-900'].join(' ')}>
              Dịch vụ
            </h2>
            <div className="mt-5 space-y-3">{serviceLinks.map(renderDesktopLink)}</div>
          </div>

          {/* Cột 3 - Tài khoản */}
          <div>
            <h2 className={['text-sm font-semibold uppercase tracking-wide', dark ? 'text-zinc-100' : 'text-zinc-900'].join(' ')}>
              Tài khoản
            </h2>
            <div className="mt-5 space-y-3">
              {accountLinks.map(renderDesktopLink)}
              <button
                type="button"
                onClick={handleLogout}
                className={['group flex items-center gap-2 text-sm transition-colors', dark ? 'text-zinc-300 hover:text-white' : 'text-zinc-600 hover:text-zinc-950'].join(' ')}
              >
                <LogOut className={['h-4 w-4 transition-colors', dark ? 'text-zinc-500 group-hover:text-white' : 'text-zinc-500 group-hover:text-zinc-950'].join(' ')} />
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>

          {/* Cột 4 - Liên hệ */}
          <div className="col-span-2 lg:col-span-1">
            <h2 className={['text-sm font-semibold uppercase tracking-wide', dark ? 'text-zinc-100' : 'text-zinc-900'].join(' ')}>
              Liên hệ
            </h2>
            <div className={['mt-5 space-y-3 text-sm', dark ? 'text-zinc-300' : 'text-zinc-600'].join(' ')}>
              <a
                href="tel:19006868"
                className={['flex items-center gap-2 transition-colors', dark ? 'hover:text-white' : 'hover:text-zinc-950'].join(' ')}
              >
                <Phone className={['h-4 w-4', dark ? 'text-white' : 'text-zinc-950'].join(' ')} />
                <span>1900 6868</span>
              </a>
              <a
                href="mailto:support@gymsystem.vn"
                className={['flex items-center gap-2 transition-colors', dark ? 'hover:text-white' : 'hover:text-zinc-950'].join(' ')}
              >
                <Mail className={['h-4 w-4', dark ? 'text-white' : 'text-zinc-950'].join(' ')} />
                <span>support@gymsystem.vn</span>
              </a>
              <div className="flex items-center gap-3 pt-2">
                <a
                  href="https://facebook.com"
                  aria-label="Facebook"
                  target="_blank"
                  rel="noreferrer"
                  className={['flex h-9 w-9 items-center justify-center rounded-lg transition-colors', dark ? 'bg-zinc-900 text-zinc-300 hover:bg-white hover:text-zinc-950' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-950 hover:text-white'].join(' ')}
                >
                  <FaFacebook className="h-4 w-4" />
                </a>
                <a
                  href="https://zalo.me"
                  aria-label="Zalo"
                  target="_blank"
                  rel="noreferrer"
                  className={['flex h-9 w-9 items-center justify-center rounded-lg transition-colors', dark ? 'bg-zinc-900 text-zinc-300 hover:bg-white hover:text-zinc-950' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-950 hover:text-white'].join(' ')}
                >
                  <SiZalo className="h-6 w-6" />
                </a>
                <a
                  href="https://instagram.com"
                  aria-label="Instagram"
                  target="_blank"
                  rel="noreferrer"
                  className={['flex h-9 w-9 items-center justify-center rounded-lg transition-colors', dark ? 'bg-zinc-900 text-zinc-300 hover:bg-white hover:text-zinc-950' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-950 hover:text-white'].join(' ')}
                >
                  <FaInstagram className="h-4 w-4" />
                </a>
              </div>
              <div className="mt-4 space-y-2">
                <a
                  href="#"
                  className={['flex items-center gap-3 rounded-lg px-3 py-2 transition-colors', dark ? 'bg-zinc-900 hover:bg-zinc-800' : 'bg-zinc-100 hover:bg-zinc-200'].join(' ')}
                >
                  <Smartphone className={['h-5 w-5', dark ? 'text-white' : 'text-zinc-950'].join(' ')} />
                  <span>
                    <span className="block text-[10px] text-zinc-400">Tải trên</span>
                    <span className={['block text-sm font-semibold', dark ? 'text-white' : 'text-zinc-950'].join(' ')}>
                      App Store
                    </span>
                  </span>
                </a>
                <a
                  href="#"
                  className={['flex items-center gap-3 rounded-lg px-3 py-2 transition-colors', dark ? 'bg-zinc-900 hover:bg-zinc-800' : 'bg-zinc-100 hover:bg-zinc-200'].join(' ')}
                >
                  <PlayCircle className={['h-5 w-5', dark ? 'text-white' : 'text-zinc-950'].join(' ')} />
                  <span>
                    <span className="block text-[10px] text-zinc-400">Tải trên</span>
                    <span className={['block text-sm font-semibold', dark ? 'text-white' : 'text-zinc-950'].join(' ')}>
                      Google Play
                    </span>
                  </span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className={['border-t px-4 py-4 sm:px-6 md:px-8', dark ? 'border-zinc-800' : 'border-zinc-200'].join(' ')}>
          <p className={['mx-auto max-w-7xl text-sm', dark ? 'text-zinc-500' : 'text-zinc-600'].join(' ')}>
            Copyright © {new Date().getFullYear()} GymSystem. All rights reserved.
          </p>
        </div>
      </footer>
    </>
  )
}

export default MemberFooter
