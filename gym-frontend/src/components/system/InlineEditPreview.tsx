import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, theme } from 'antd'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { getLocalizedText, normalizeLandingData } from '../../utils/localization'
import type { EditTarget } from './InlineEditModal'
import TypewriterSlogans from './TypewriterSlogans'

const pickL = (value: any, lang: string, fallback = '') => getLocalizedText(value, lang, fallback)

function EditWrap({
  onClick,
  children,
  className = '',
  block = false,
}: {
  onClick: () => void
  children: React.ReactNode
  className?: string
  block?: boolean
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      className={`inline-edit-wrap group relative cursor-pointer rounded-lg transition-all ${block ? 'block w-full' : 'inline-flex'} ${className}`}
    >
      {children}
      <span className="inline-edit-wrap__icon" aria-hidden>
        <EditOutlined />
      </span>
    </span>
  )
}

function ItemControls({
  onMoveUp,
  onMoveDown,
  onDelete,
  canMoveUp,
  canMoveDown,
  canDelete,
}: {
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  canDelete: boolean
}) {
  return (
    <div className="inline-edit-item-controls" onClick={(e) => e.stopPropagation()}>
      <Button type="text" size="small" icon={<ArrowUpOutlined />} disabled={!canMoveUp} onClick={onMoveUp} />
      <Button type="text" size="small" icon={<ArrowDownOutlined />} disabled={!canMoveDown} onClick={onMoveDown} />
      <Button type="text" size="small" danger icon={<DeleteOutlined />} disabled={!canDelete} onClick={onDelete} />
    </div>
  )
}

type Props = {
  landing: any
  settings: any
  language: string
  firstName?: string
  onEdit: (target: EditTarget) => void
  onAdd?: (field: 'stats' | 'services' | 'testimonials') => void
  onDelete?: (field: 'stats' | 'services' | 'testimonials', index: number) => void
  onMove?: (field: 'stats' | 'services' | 'testimonials', index: number, direction: 'up' | 'down') => void
}

export default function InlineEditPreview({
  landing,
  settings,
  language,
  firstName = '',
  onEdit,
  onAdd,
  onDelete,
  onMove,
}: Props) {
  const { t, i18n } = useTranslation()
  const { token } = theme.useToken()
  const lang = language || i18n.language
  const safeLanding = useMemo(() => normalizeLandingData(landing || {}), [landing])

  const stats = (safeLanding.stats || []).map((item: any) => ({
    value: pickL(item.value, lang, String(item.value ?? '')),
    label: pickL(item.label, lang, ''),
    _raw: item,
  }))

  const services = (safeLanding.services || []).map((item: any) => ({
    ...item,
    title: pickL(item.title, lang, ''),
    description: pickL(item.description, lang, ''),
    _raw: item,
  }))

  const testimonials = (safeLanding.testimonials || []).map((item: any) => ({
    ...item,
    content: pickL(item.content, lang, ''),
    userSubtitle: pickL(item.userSubtitle, lang, ''),
    _raw: item,
  }))

  const slogans = useMemo(() => {
    const items = Array.isArray(settings?.slogans) ? settings.slogans : []
    const picked = items.map((item: any) => pickL(item, lang)).filter(Boolean)
    if (picked.length > 0) return picked
    if (settings?.slogan) return [settings.slogan]
    return [t('dashboard.slogan1'), t('dashboard.slogan2')]
  }, [settings?.slogans, settings?.slogan, lang, t])

  const heroSubtitle = pickL(safeLanding.heroSubtitle, lang, t('dashboard.subtitle'))
  const heroBadge = pickL(safeLanding.heroBadgeText, lang, t('dashboard.badge'))
  const primaryText = pickL(safeLanding.ctaText, lang, t('dashboard.cta_booking'))
  const secondaryText = pickL(safeLanding.secondaryCtaText, lang, t('dashboard.cta_checkin'))
  const servicesEyebrow = pickL(safeLanding.servicesEyebrow, lang, t('dashboard.services.overline'))
  const servicesTitle = pickL(safeLanding.servicesTitle, lang, t('dashboard.services.heading'))
  const testimonialsEyebrow = pickL(safeLanding.testimonialsEyebrow, lang, t('dashboard.testimonials.overline'))
  const testimonialsTitle = pickL(safeLanding.testimonialsTitle, lang, t('dashboard.testimonials.heading'))
  const finalTitle = pickL(safeLanding.finalCtaTitle, lang, `${t('dashboard.cta.heading1')}\n${t('dashboard.cta.heading2')}`)
  const finalSubtitle = pickL(safeLanding.finalCtaSubtitle, lang, t('dashboard.cta.subtitle', { firstName }))
  const finalPrimaryText = pickL(safeLanding.finalCtaPrimaryText, lang, t('dashboard.cta.book_pt'))
  const finalSecondaryText = pickL(safeLanding.finalCtaSecondaryText, lang, t('dashboard.cta.view_health'))

  return (
    <main className="min-h-screen w-full " style={{ backgroundColor: token.colorBgLayout, color: token.colorText }}>
      {/* Hero */}
      <section
        className="relative overflow-hidden bg-[length:40px_40px] px-5 py-16 md:px-8 md:pb-14 md:pt-[88px]"
        style={{ backgroundColor: token.colorBgLayout, backgroundImage: 'linear-gradient(rgba(128,128,128,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,0.08) 1px, transparent 1px)' }}
      >
        <div className="absolute -right-36 -top-40 h-[420px] w-[420px] rounded-full blur-xl" style={{ background: 'radial-gradient(circle, var(--theme-accent-muted) 0%, transparent 70%)' }} />
        <div className="relative z-[1] mx-auto w-full max-w-6xl">
          <div className="inline-flex max-w-full items-center gap-2.5 rounded-full border px-3.5 py-2 text-[13px] font-bold" style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder, color: token.colorTextSecondary }}>
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--theme-accent)]" />
            <EditWrap onClick={() => onEdit({ field: 'heroBadgeText' })}>
              <span className="min-w-0 break-words">{heroBadge}</span>
            </EditWrap>
          </div>

          <h1 className="mt-7 max-w-[920px] text-[clamp(32px,4vw,48px)] font-extrabold leading-[1.05] tracking-[-0.03em] text-[var(--theme-text)] md:text-[clamp(40px,5vw,72px)] lg:text-[clamp(56px,6vw,96px)]">
            <EditWrap block onClick={() => onEdit({ field: 'slogans' })} className="w-full">
              <TypewriterSlogans slogans={slogans} language={lang} />
            </EditWrap>
          </h1>

          <EditWrap block onClick={() => onEdit({ field: 'heroSubtitle' })} className="mt-5 max-w-[720px]">
            <p className="text-[15px] leading-7 md:text-[17px]" style={{ color: token.colorTextSecondary }}>{heroSubtitle}</p>
          </EditWrap>

          <div className="mt-8 flex flex-col flex-wrap gap-3 min-[421px]:flex-row">
            <EditWrap onClick={() => onEdit({ field: 'ctaText', sub: 'button' })}>
              <Button size="large" className="pointer-events-none !h-[46px] !rounded-full !px-6 !font-extrabold" type="primary">{primaryText}</Button>
            </EditWrap>
            <EditWrap onClick={() => onEdit({ field: 'secondaryCtaText', sub: 'button' })}>
              <Button size="large" className="pointer-events-none !h-[46px] !rounded-full !bg-transparent !px-6 !font-extrabold" style={{ borderColor: 'var(--theme-accent)', color: 'var(--theme-accent)' }}>{secondaryText}</Button>
            </EditWrap>
          </div>

          <div className="mt-10">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--theme-muted)]">Thống kê</span>
              <Button type="dashed" size="small" icon={<PlusOutlined />} className="inline-edit-section-add" onClick={() => onAdd?.('stats')}>
                Thêm thống kê
              </Button>
            </div>
            <div className="grid grid-cols-1 min-[421px]:grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden rounded-lg border" style={{ backgroundColor: token.colorBorder, borderColor: token.colorBorder }}>
              {stats.map((item: any, idx: number) => (
                <div key={idx} className="relative" style={{ backgroundColor: token.colorBgContainer }}>
                  <EditWrap block onClick={() => onEdit({ field: 'stats', index: idx })} className="min-h-[88px] p-4">
                    <strong className="block text-2xl leading-none">{item.value}</strong>
                    <span className="mt-2 block break-words text-[13px]" style={{ color: token.colorTextSecondary }}>{item.label}</span>
                  </EditWrap>
                  <ItemControls
                    onMoveUp={() => onMove?.('stats', idx, 'up')}
                    onMoveDown={() => onMove?.('stats', idx, 'down')}
                    onDelete={() => onDelete?.('stats', idx)}
                    canMoveUp={idx > 0}
                    canMoveDown={idx < stats.length - 1}
                    canDelete={stats.length > 1}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto w-[calc(100%-40px)] max-w-6xl pt-14 md:w-[calc(100%-64px)] md:pt-[74px]">
        <EditWrap onClick={() => onEdit({ field: 'servicesEyebrow' })}>
          <p className="mb-2.5 text-xs font-black uppercase tracking-[0.14em] text-[var(--theme-accent)]">{servicesEyebrow}</p>
        </EditWrap>
        <EditWrap onClick={() => onEdit({ field: 'servicesTitle' })}>
          <h2 className="text-[44px] font-extrabold leading-none">{servicesTitle}</h2>
        </EditWrap>
        <div className="mt-4">
          <Button type="dashed" icon={<PlusOutlined />} className="inline-edit-section-add" onClick={() => onAdd?.('services')}>
            Thêm dịch vụ
          </Button>
        </div>
        <div className="mt-7 grid grid-cols-1 gap-4 min-[421px]:grid-cols-2 md:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
          {services.map((service: any, idx: number) => (
            <div key={idx} className="relative">
              <EditWrap block onClick={() => onEdit({ field: 'services', index: idx })}>
                <div className="min-h-[168px] rounded-lg border p-[18px] text-left md:min-h-[178px] md:p-[22px]" style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder, color: token.colorText }}>
                  <span className="grid h-[42px] w-[42px] place-items-center rounded-full border text-[22px] font-black" style={{ color: service.color || '#e05a30' }}>{service.icon || '•'}</span>
                  <span className="mt-5 block text-base font-black md:mt-[22px]">{service.title}</span>
                  <span className="mt-2 block text-[13px] leading-relaxed" style={{ color: token.colorTextSecondary }}>{service.description}</span>
                </div>
              </EditWrap>
              <ItemControls
                onMoveUp={() => onMove?.('services', idx, 'up')}
                onMoveDown={() => onMove?.('services', idx, 'down')}
                onDelete={() => onDelete?.('services', idx)}
                canMoveUp={idx > 0}
                canMoveDown={idx < services.length - 1}
                canDelete={services.length > 1}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto w-[calc(100%-40px)] max-w-6xl pt-14 md:w-[calc(100%-64px)] md:pt-[74px]">
        <EditWrap onClick={() => onEdit({ field: 'testimonialsEyebrow' })}>
          <p className="mb-2.5 text-xs font-black uppercase tracking-[0.14em] text-[var(--theme-accent)]">{testimonialsEyebrow}</p>
        </EditWrap>
        <EditWrap onClick={() => onEdit({ field: 'testimonialsTitle' })}>
          <h2 className="text-[44px] font-extrabold leading-none">{testimonialsTitle}</h2>
        </EditWrap>
        <div className="mt-4">
          <Button type="dashed" icon={<PlusOutlined />} className="inline-edit-section-add" onClick={() => onAdd?.('testimonials')}>
            Thêm đánh giá
          </Button>
        </div>
        <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-3 items-start">
          {testimonials.map((item: any, idx: number) => (
            <div key={idx} className="relative">
              <EditWrap block onClick={() => onEdit({ field: 'testimonials', index: idx })}>
                <article className="rounded-lg border p-6" style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder }}>
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
              </EditWrap>
              <ItemControls
                onMoveUp={() => onMove?.('testimonials', idx, 'up')}
                onMoveDown={() => onMove?.('testimonials', idx, 'down')}
                onDelete={() => onDelete?.('testimonials', idx)}
                canMoveUp={idx > 0}
                canMoveDown={idx < testimonials.length - 1}
                canDelete={testimonials.length > 1}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto w-[calc(100%-40px)] max-w-[900px] py-[74px] text-center md:w-[calc(100%-64px)] md:pt-[88px]">
        <EditWrap block onClick={() => onEdit({ field: 'finalCtaTitle' })}>
          <h2 className="grid whitespace-pre-line text-5xl font-black leading-[0.95] md:text-[64px]">{finalTitle}</h2>
        </EditWrap>
        <EditWrap block onClick={() => onEdit({ field: 'finalCtaSubtitle' })} className="mx-auto mt-[18px] max-w-[560px]">
          <p className="text-base leading-7" style={{ color: token.colorTextSecondary }}>{finalSubtitle.replace('{{firstName}}', firstName)}</p>
        </EditWrap>
        <div className="mt-8 flex flex-col flex-wrap justify-center gap-3 min-[421px]:flex-row">
          <EditWrap onClick={() => onEdit({ field: 'finalCtaPrimaryText', sub: 'button' })}>
            <Button size="large" className="pointer-events-none !h-[46px] !rounded-full !px-6 !font-extrabold" type="primary">{finalPrimaryText}</Button>
          </EditWrap>
          <EditWrap onClick={() => onEdit({ field: 'finalCtaSecondaryText', sub: 'button' })}>
            <Button size="large" className="pointer-events-none !h-[46px] !rounded-full !bg-transparent !px-6 !font-extrabold" style={{ borderColor: 'var(--theme-accent)', color: 'var(--theme-accent)' }}>{finalSecondaryText}</Button>
          </EditWrap>
        </div>
      </section>
    </main>
  )
}
