import type { LucideIcon } from 'lucide-react'
import {
  BadgeCheck,
  BarChart3,
  ClipboardList,
  FileText,
  Flag,
  Headphones,
  LifeBuoy,
  LockKeyhole,
  Package,
  RotateCcw,
  ScrollText,
  ShieldCheck,
  Store,
  Truck,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
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

const socialLogos = {
  facebook: '/facebook.png',
  zalo: '/zalo.png',
  instagram: '/instagram.png',
}

function SellerFooter() {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()
  const { dark } = useTheme()

  const commitments: Commitment[] = [
    { label: t('footer.seller.commitments.authentic'), icon: ShieldCheck },
    { label: t('footer.seller.commitments.delivery'), icon: Truck },
    { label: t('footer.seller.commitments.payment'), icon: LockKeyhole },
    { label: t('footer.seller.commitments.returns'), icon: RotateCcw },
  ]

  const sellerLinks: FooterLink[] = [
    { label: t('footer.seller.links.products'), href: '/seller/products', icon: Package },
    { label: t('footer.seller.links.orders'), href: '/seller/orders', icon: ClipboardList },
    { label: t('footer.seller.links.revenue'), href: '/seller/revenue', icon: BarChart3 },
    { label: t('footer.seller.links.policy'), href: '/seller/policy', icon: ScrollText },
  ]

  const supportLinks: FooterLink[] = [
    { label: t('footer.seller.support.help_center'), href: '/support/help-center', icon: LifeBuoy },
    { label: t('footer.seller.support.contact'), href: '/support/contact', icon: Headphones },
    { label: t('footer.seller.support.report'), href: '/support/report', icon: Flag },
    { label: t('footer.seller.support.terms'), href: '/terms', icon: FileText },
  ]

  const renderLink = (item: FooterLink) => {
    const Icon = item.icon

    return (
      <a
        key={item.label}
        href={item.href}
        className={[
          'group flex items-center gap-2 text-sm transition-colors',
          dark ? 'text-zinc-300 hover:text-white' : 'text-[rgba(237,235,230,0.65)] hover:text-[#edebe6]',
        ].join(' ')}
        style={{ color: 'var(--theme-text)' }}
      >
        <Icon className={['h-4 w-4 shrink-0 transition-colors', dark ? 'text-zinc-500 group-hover:text-white' : 'text-[rgba(237,235,230,0.5)] group-hover:text-[#edebe6]'].join(' ')} style={{ color: 'var(--theme-muted)' }} />
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
          : 'border-[#5a5a5a] bg-[#3e3e3e] text-[#edebe6]',
      ].join(' ')}
      style={{ background: 'var(--theme-card)', color: 'var(--theme-text)', borderColor: 'var(--theme-border)' }}
    >
      <section
        className={['border-b px-5 py-7 md:px-8', dark ? 'border-zinc-800 bg-zinc-950 text-white' : 'border-[#5a5a5a] bg-[#3e3e3e] text-[#edebe6]'].join(' ')}
        style={{ background: 'var(--theme-card)', color: 'var(--theme-text)', borderColor: 'var(--theme-border)' }}
      >
        <div className="w-full">
          <h2 className="text-center text-xl font-extrabold md:text-2xl">
            {t('footer.seller.heading')}
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {commitments.map((item) => {
              const Icon = item.icon

              return (
                <div
                  key={item.label}
                  className={['flex min-h-20 items-center gap-3 rounded-2xl border p-4 shadow-sm backdrop-blur', dark ? 'border-zinc-800 bg-zinc-900 text-white' : 'border-[#5a5a5a] bg-[#484848] text-[#edebe6]'].join(' ')}
                  style={{ background: 'var(--theme-elevated)', color: 'var(--theme-text)', borderColor: 'var(--theme-border)' }}
                >
                  <span
                    className={['flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', dark ? 'bg-[#484848] text-[#edebe6]' : 'bg-[#484848] text-[#edebe6]'].join(' ')}
                    style={{ background: 'var(--theme-accent)', color: 'var(--theme-button-text)' }}
                  >
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
              <span
                className={['flex h-12 w-12 items-center justify-center rounded-2xl', dark ? 'bg-[#484848] text-[#edebe6]' : 'bg-[#484848] text-[#edebe6]'].join(' ')}
                style={{ background: 'var(--theme-accent)', color: 'var(--theme-button-text)' }}
              >
                <Store className="h-6 w-6" />
              </span>
              <div>
                <p className="text-lg font-extrabold leading-tight" style={{ color: 'var(--theme-accent)' }}>GymPro Seller</p>
                <p className={['text-sm', dark ? 'text-zinc-400' : 'text-[rgba(237,235,230,0.65)]'].join(' ')}>
                  {t('footer.seller.tagline')}
                </p>
              </div>
            </div>
            <p className={['mt-5 text-sm leading-6', dark ? 'text-zinc-300' : 'text-[rgba(237,235,230,0.65)]'].join(' ')}>
              {t('footer.seller.description')}
            </p>
          </div>

          <div>
            <h3 className={['text-sm font-bold uppercase tracking-[0.2em]', dark ? 'text-white' : 'text-[#edebe6]'].join(' ')}>
              {t('footer.seller.section.for_seller')}
            </h3>
            <div className="mt-5 space-y-3">{sellerLinks.map(renderLink)}</div>
          </div>

          <div>
            <h3 className={['text-sm font-bold uppercase tracking-[0.2em]', dark ? 'text-white' : 'text-[#edebe6]'].join(' ')}>
              {t('footer.seller.section.support')}
            </h3>
            <div className="mt-5 space-y-3">{supportLinks.map(renderLink)}</div>
          </div>

          <div>
            <h3 className={['text-sm font-bold uppercase tracking-[0.2em]', dark ? 'text-white' : 'text-[#edebe6]'].join(' ')}>
              {t('footer.seller.section.connect')}
            </h3>
            <div className="mt-5 flex items-center gap-3">
              <a
                href="https://facebook.com"
                aria-label="Facebook"
                target="_blank"
                rel="noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-transparent transition-transform duration-150 hover:scale-110"
                style={{ color: '#1877f2' }}
              >
                <img src={socialLogos.facebook} alt="" className="h-8 w-8 object-contain" />
              </a>
              <a
                href="https://zalo.me"
                aria-label="Zalo"
                target="_blank"
                rel="noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-transparent transition-transform duration-150 hover:scale-110"
                style={{ color: '#0068ff' }}
              >
                <img src={socialLogos.zalo} alt="" className="h-9 w-9 object-contain" />
              </a>
              <a
                href="https://instagram.com"
                aria-label="Instagram"
                target="_blank"
                rel="noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-transparent transition-transform duration-150 hover:scale-110"
                style={{ color: '#e4405f' }}
              >
                <img src={socialLogos.instagram} alt="" className="h-8 w-8 object-contain" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <div
        className={['border-t px-5 py-5 md:px-8', dark ? 'border-zinc-800' : 'border-[#5a5a5a]'].join(' ')}
        style={{ borderColor: 'var(--theme-border)' }}
      >
        <div className={['flex w-full flex-col gap-2 text-sm md:flex-row md:items-center md:justify-between', dark ? 'text-zinc-400' : 'text-[rgba(237,235,230,0.65)]'].join(' ')}>
          <p>{t('footer.seller.copyright', { year: currentYear })}</p>
          <p className={['flex items-center gap-2 font-semibold', dark ? 'text-white' : 'text-[#edebe6]'].join(' ')}>
            <BadgeCheck className="h-4 w-4" style={{ color: 'var(--theme-accent)' }} />
            {t('footer.seller.trust')}
          </p>
        </div>
      </div>
    </footer>
  )
}

export default SellerFooter
