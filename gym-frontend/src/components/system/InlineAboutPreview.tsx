import { EditOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, theme } from 'antd'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { getLocalizedText, normalizeLandingData } from '../../utils/localization'
import type { EditTarget } from './InlineEditModal'

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

type Props = {
  landing: any
  settings: any
  language: string
  onEdit: (target: EditTarget) => void
  onSectionAdd?: () => void
  onSectionDelete?: (index: number) => void
  onSectionMove?: (index: number, direction: 'up' | 'down') => void
}

export default function InlineAboutPreview({
  landing,
  settings,
  language,
  onEdit,
  onSectionAdd,
  onSectionDelete,
  onSectionMove,
}: Props) {
  const { t, i18n } = useTranslation()
  const { token } = theme.useToken()
  const lang = language || i18n.language
  const safeLanding = useMemo(() => normalizeLandingData(landing || {}), [landing])

  const sections = useMemo(() => (
    [...(safeLanding?.sections || [])]
      .filter((item: any) => item?.title || item?.content || item?.imageUrl)
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
  ), [safeLanding?.sections])

  const gymName = settings?.gymName || 'GymPro'
  const heroBadge = pickL(safeLanding.heroBadgeText, lang, t('dashboard.badge'))
  const heroTitle = pickL(safeLanding.heroTitle, lang, gymName)
  const heroSubtitle = pickL(safeLanding.heroSubtitle, lang, t('dashboard.subtitle'))
  const aboutTitle = pickL(safeLanding.aboutTitle, lang, t('system_experience.about.preview_about_fallback', 'Về GymPro'))
  const aboutContent = pickL(safeLanding.aboutContent, lang, '')
  const ctaText = pickL(safeLanding.ctaText, lang, t('system_experience.about.cta_fallback'))
  const secondaryCtaText = pickL(safeLanding.secondaryCtaText, lang)
  const heroImage = safeLanding?.heroImageUrl || settings?.bannerUrl || ''

  return (
    <main
      className="min-h-full overflow-hidden bg-[length:40px_40px] "
      style={{
        backgroundColor: token.colorBgLayout,
        backgroundImage: 'linear-gradient(rgba(128,128,128,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,0.08) 1px, transparent 1px)',
        color: token.colorText,
      }}
    >
      <section className="px-5 py-8 relative overflow-hidden">
        <div className="-right-20 -top-24 h-[240px] w-[240px] pointer-events-none absolute rounded-full bg-[radial-gradient(circle,var(--theme-accent-muted)_0%,transparent_70%)] blur-xl" />
        <div className="relative z-[1] mx-auto w-full max-w-none">
          <div className="grid items-center gap-9">
            <div>
              <div
                className="inline-flex items-center gap-3 rounded-full border px-3.5 py-2 text-[13px] font-bold"
                style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder, color: token.colorTextSecondary }}
              >
                {settings?.logoUrl ? (
                  <img src={settings.logoUrl} alt={gymName} className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--theme-accent)] text-[10px] text-[var(--theme-button-text)]">GP</span>
                )}
                <span>{gymName}</span>
              </div>

              <EditWrap onClick={() => onEdit({ field: 'heroBadgeText' })}>
                <p className="mt-6 max-w-full text-xs font-black uppercase tracking-[0.28em] text-[var(--theme-accent)] [overflow-wrap:break-word]">{heroBadge}</p>
              </EditWrap>
              <EditWrap block onClick={() => onEdit({ field: 'heroTitle' })}>
                <h1 className="mt-4 max-w-[900px] text-[42px] font-black leading-[0.95] tracking-[1px]">
                  {heroTitle}
                </h1>
              </EditWrap>
              <EditWrap block onClick={() => onEdit({ field: 'heroSubtitle' })}>
                <p className="mt-3 text-sm max-w-2xl leading-7" style={{ color: token.colorTextSecondary }}>
                  {heroSubtitle}
                </p>
              </EditWrap>
              <div className="mt-7 flex flex-wrap gap-3">
                <EditWrap onClick={() => onEdit({ field: 'ctaText', sub: 'button' })}>
                  <Button size="middle" className="pointer-events-none !rounded-full !px-7 !font-bold" type="primary">
                    {ctaText}
                  </Button>
                </EditWrap>
                {secondaryCtaText && (
                  <EditWrap onClick={() => onEdit({ field: 'secondaryCtaText', sub: 'button' })}>
                    <Button size="middle" className="pointer-events-none !rounded-full !bg-transparent !px-7 !font-bold"
                      style={{ borderColor: 'var(--theme-accent)', color: 'var(--theme-accent)' }}
                    >
                      {secondaryCtaText}
                    </Button>
                  </EditWrap>
                )}
              </div>
            </div>

            {heroImage ? (
              <EditWrap block onClick={() => onEdit({ field: 'heroImageUrl' })}>
                <div className="relative">
                  <div className="absolute -inset-3 rounded-[34px] bg-[var(--theme-accent-muted)] blur-xl" />
                  <img src={heroImage} alt={heroTitle} className="h-[260px] relative w-full rounded-[28px] object-cover shadow-2xl" />
                </div>
              </EditWrap>
            ) : (
              <EditWrap block onClick={() => onEdit({ field: 'heroImageUrl' })}>
                <div className="h-[260px] relative overflow-hidden rounded-[28px] border border-[var(--theme-border)] bg-[linear-gradient(135deg,var(--theme-accent-muted),rgba(255,255,255,0.04))] shadow-2xl">
                  <div className="absolute inset-8 rounded-[24px] border border-[var(--theme-border)] bg-[var(--theme-card)]/70" />
                  <div className="absolute bottom-8 left-8 right-8 grid gap-3">
                    <div className="h-4 w-2/3 rounded-full bg-[var(--theme-accent)]/70" />
                    <div className="h-20 rounded-2xl bg-black/20" />
                    <div className="grid grid-cols-3 gap-3">
                      <div className="h-16 rounded-2xl bg-white/10" />
                      <div className="h-16 rounded-2xl bg-white/10" />
                      <div className="h-16 rounded-2xl bg-white/10" />
                    </div>
                  </div>
                </div>
              </EditWrap>
            )}
          </div>
        </div>
      </section>

      <section className="px-5 pb-8">
        <div className="mx-auto grid w-full gap-6 max-w-none">
          <div className="rounded-[28px] border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--theme-accent)]">{t('system_experience.about.sections_title')}</p>
            <EditWrap block onClick={() => onEdit({ field: 'aboutTitle' })}>
              <h2 className="text-2xl mt-3 font-extrabold">{aboutTitle}</h2>
            </EditWrap>
            <EditWrap block onClick={() => onEdit({ field: 'aboutContent' })}>
              <p className="mt-4 max-w-4xl whitespace-pre-wrap text-base leading-8 text-[var(--theme-muted)]">{aboutContent}</p>
            </EditWrap>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--theme-muted)]">Các mục giới thiệu</span>
            <Button type="dashed" size="small" icon={<PlusOutlined />} className="inline-edit-section-add" onClick={() => onSectionAdd?.()}>
              Thêm mục
            </Button>
          </div>

          {sections.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {sections.map((section: any, index: number) => (
                <div key={section._id || index} className="relative">
                  <EditWrap block onClick={() => onEdit({ field: 'sections', index })}>
                    <article className="overflow-hidden rounded-[24px] border border-[var(--theme-border)] bg-[var(--theme-card)]">
                      {section.imageUrl ? (
                        <img src={section.imageUrl} alt={pickL(section.title, lang)} className="h-44 w-full object-cover" />
                      ) : (
                        <div className="h-32 bg-[linear-gradient(135deg,var(--theme-accent-muted),rgba(255,255,255,0.03))]" />
                      )}
                      <div className="p-5">
                        <h3 className="text-xl font-bold">{pickL(section.title, lang, `${t('system_experience.admin.section')} ${index + 1}`)}</h3>
                        <p className="mt-3 whitespace-pre-wrap leading-7 text-[var(--theme-muted)]">{pickL(section.content, lang, '')}</p>
                      </div>
                    </article>
                  </EditWrap>
                  <div className="inline-edit-item-controls" onClick={(e) => e.stopPropagation()}>
                    <Button type="text" size="small" icon={<span>↑</span>} disabled={index === 0} onClick={() => onSectionMove?.(index, 'up')} />
                    <Button type="text" size="small" icon={<span>↓</span>} disabled={index === sections.length - 1} onClick={() => onSectionMove?.(index, 'down')} />
                    <Button type="text" size="small" danger icon={<span>✕</span>} disabled={sections.length <= 1} onClick={() => onSectionDelete?.(index)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
