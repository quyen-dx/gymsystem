import type { LucideIcon } from 'lucide-react'
import {
  BadgeCheck,
  BarChart3,
  Camera,
  ClipboardList,
  FileText,
  Flag,
  Headphones,
  LifeBuoy,
  LockKeyhole,
  MessageCircle,
  Package,
  RotateCcw,
  ScrollText,
  Share2,
  ShieldCheck,
  Store,
  Truck,
} from 'lucide-react'
import { useTheme } from '../../../context/ThemeProvider'

type FooterLink = {
  label: string
  href: string
  icon: LucideIcon
}

type Commitment = {
  label: string
  icon: LucideIcon
}

const commitments: Commitment[] = [
  { label: 'Sản phẩm chính hãng, uy tín', icon: ShieldCheck },
  { label: 'Giao hàng nhanh chóng, đúng hẹn', icon: Truck },
  { label: 'Thanh toán an toàn, bảo mật', icon: LockKeyhole },
  { label: 'Đổi trả dễ dàng trong 7 ngày', icon: RotateCcw },
]

const sellerLinks: FooterLink[] = [
  { label: 'Quản lý sản phẩm', href: '/dashboard/seller/products', icon: Package },
  { label: 'Đơn hàng', href: '/dashboard/seller/orders', icon: ClipboardList },
  { label: 'Doanh thu', href: '/dashboard/seller/revenue', icon: BarChart3 },
  { label: 'Chính sách bán hàng', href: '/dashboard/seller/policy', icon: ScrollText },
]

const supportLinks: FooterLink[] = [
  { label: 'Trung tâm trợ giúp', href: '/support/help-center', icon: LifeBuoy },
  { label: 'Liên hệ CSKH', href: '/support/contact', icon: Headphones },
  { label: 'Báo cáo vi phạm', href: '/support/report', icon: Flag },
  { label: 'Điều khoản sử dụng', href: '/terms', icon: FileText },
]

function SellerFooter() {
  const currentYear = new Date().getFullYear()
  const { dark } = useTheme()

  const renderLink = (item: FooterLink) => {
    const Icon = item.icon

    return (
      <a
        key={item.label}
        href={item.href}
        className={[
          'group flex items-center gap-2 text-sm transition-colors',
          dark ? 'text-zinc-300 hover:text-white' : 'text-zinc-600 hover:text-zinc-950',
        ].join(' ')}
      >
        <Icon className={['h-4 w-4 shrink-0 transition-colors', dark ? 'text-zinc-500 group-hover:text-white' : 'text-zinc-500 group-hover:text-zinc-950'].join(' ')} />
        <span>{item.label}</span>
      </a>
    )
  }

  return (
    <footer
      className={[
        'w-full border-t',
        dark
          ? 'border-zinc-800 bg-zinc-950 text-white'
          : 'border-zinc-200 bg-white text-zinc-950',
      ].join(' ')}
    >
      <section className={['border-b px-5 py-7 md:px-8', dark ? 'border-zinc-800 bg-zinc-950 text-white' : 'border-zinc-200 bg-white text-zinc-950'].join(' ')}>
        <div className="w-full">
          <h2 className="text-center text-xl font-extrabold md:text-2xl">
            Cam Kết Của Chúng Tôi
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {commitments.map((item) => {
              const Icon = item.icon

              return (
                <div
                  key={item.label}
                  className={['flex min-h-20 items-center gap-3 rounded-2xl border p-4 shadow-sm backdrop-blur', dark ? 'border-zinc-800 bg-zinc-900 text-white' : 'border-zinc-200 bg-zinc-50 text-zinc-950'].join(' ')}
                >
                  <span className={['flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', dark ? 'bg-white text-zinc-950' : 'bg-zinc-950 text-white'].join(' ')}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-bold leading-5">{item.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="px-5 py-10 md:px-8 md:py-12">
        <div className="grid w-full gap-9 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-3">
              <span className={['flex h-12 w-12 items-center justify-center rounded-2xl', dark ? 'bg-white text-zinc-950' : 'bg-zinc-950 text-white'].join(' ')}>
                <Store className="h-6 w-6" />
              </span>
              <div>
                <p className="text-lg font-extrabold leading-tight">GymSystem Seller</p>
                <p className={['text-sm', dark ? 'text-zinc-400' : 'text-zinc-600'].join(' ')}>
                  Bán hàng dễ hơn mỗi ngày
                </p>
              </div>
            </div>
            <p className={['mt-5 text-sm leading-6', dark ? 'text-zinc-300' : 'text-zinc-600'].join(' ')}>
              Nền tảng giúp Seller tiếp cận hội viên, quản lý sản phẩm và vận hành đơn hàng
              trong cùng một hệ sinh thái GymSystem.
            </p>
          </div>

          <div>
            <h3 className={['text-sm font-bold uppercase tracking-[0.2em]', dark ? 'text-white' : 'text-zinc-950'].join(' ')}>
              Dành cho Seller
            </h3>
            <div className="mt-5 space-y-3">{sellerLinks.map(renderLink)}</div>
          </div>

          <div>
            <h3 className={['text-sm font-bold uppercase tracking-[0.2em]', dark ? 'text-white' : 'text-zinc-950'].join(' ')}>
              Hỗ trợ
            </h3>
            <div className="mt-5 space-y-3">{supportLinks.map(renderLink)}</div>
          </div>

          <div>
            <h3 className={['text-sm font-bold uppercase tracking-[0.2em]', dark ? 'text-white' : 'text-zinc-950'].join(' ')}>
              Kết nối
            </h3>
            <div className="mt-5 flex items-center gap-3">
              <a
                href="https://facebook.com"
                aria-label="Facebook"
                target="_blank"
                rel="noreferrer"
                className={['flex h-10 w-10 items-center justify-center rounded-xl transition-colors', dark ? 'bg-zinc-900 text-zinc-300 hover:bg-white hover:text-zinc-950' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-950 hover:text-white'].join(' ')}
              >
                <Share2 className="h-5 w-5" />
              </a>
              <a
                href="https://zalo.me"
                aria-label="Zalo"
                target="_blank"
                rel="noreferrer"
                className={['flex h-10 w-10 items-center justify-center rounded-xl transition-colors', dark ? 'bg-zinc-900 text-zinc-300 hover:bg-white hover:text-zinc-950' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-950 hover:text-white'].join(' ')}
              >
                <MessageCircle className="h-5 w-5" />
              </a>
              <a
                href="https://instagram.com"
                aria-label="Instagram"
                target="_blank"
                rel="noreferrer"
                className={['flex h-10 w-10 items-center justify-center rounded-xl transition-colors', dark ? 'bg-zinc-900 text-zinc-300 hover:bg-white hover:text-zinc-950' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-950 hover:text-white'].join(' ')}
              >
                <Camera className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className={['border-t px-5 py-5 md:px-8', dark ? 'border-zinc-800' : 'border-zinc-200'].join(' ')}>
        <div className={['flex w-full flex-col gap-2 text-sm md:flex-row md:items-center md:justify-between', dark ? 'text-zinc-400' : 'text-zinc-600'].join(' ')}>
          <p>Copyright © {currentYear} GymSystem Seller. All rights reserved.</p>
          <p className={['flex items-center gap-2 font-semibold', dark ? 'text-white' : 'text-zinc-950'].join(' ')}>
            <BadgeCheck className="h-4 w-4" />
            Nền tảng hợp tác uy tín
          </p>
        </div>
      </div>
    </footer>
  )
}

export default SellerFooter
