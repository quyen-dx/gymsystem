import type { TFunction } from 'i18next'
import { normalizeForStorage } from '../../utils/localization'

export const normalizeSlogan = (item: any) => {
  if (typeof item === 'string') return { vi: item, en: '' }
  return { vi: item?.vi || item?.en || '', en: item?.en || '' }
}

export const BUTTON_LINK_FIELDS: Record<string, string> = {
  ctaText: 'ctaLink',
  secondaryCtaText: 'secondaryCtaLink',
  finalCtaPrimaryText: 'finalCtaPrimaryLink',
  finalCtaSecondaryText: 'finalCtaSecondaryLink',
}

export const buildDefaultStats = (t: TFunction) => [
  { value: '500+', label: normalizeForStorage(t('dashboard.stats.members')) },
  { value: '20+', label: normalizeForStorage(t('dashboard.stats.trainers')) },
  { value: '4', label: normalizeForStorage(t('dashboard.stats.branches')) },
  { value: '98%', label: normalizeForStorage(t('dashboard.stats.satisfaction')) },
]

export const buildDefaultServices = (t: TFunction) => [
  { icon: '▣', title: normalizeForStorage(t('dashboard.services.qr_checkin')), description: normalizeForStorage(t('dashboard.services.qr_checkin_desc')), color: '#e05a30', link: '/checkin' },
  { icon: '◴', title: normalizeForStorage(t('dashboard.services.book_pt')), description: normalizeForStorage(t('dashboard.services.book_pt_desc')), color: '#3d9dd0', link: '/booking' },
  { icon: '↗', title: normalizeForStorage(t('dashboard.services.workout')), description: normalizeForStorage(t('dashboard.services.workout_desc')), color: '#5cb85c', link: '/workout' },
  { icon: '♡', title: normalizeForStorage(t('dashboard.services.health')), description: normalizeForStorage(t('dashboard.services.health_desc')), color: '#e6a317', link: '/health' },
]

export const buildDefaultTestimonials = (t: TFunction) => [
  { rating: 5, content: normalizeForStorage(t('dashboard.testimonials.item_0_quote')), userName: t('dashboard.testimonials.item_0_name'), userSubtitle: normalizeForStorage(t('dashboard.testimonials.item_0_duration')) },
  { rating: 5, content: normalizeForStorage(t('dashboard.testimonials.item_1_quote')), userName: t('dashboard.testimonials.item_1_name'), userSubtitle: normalizeForStorage(t('dashboard.testimonials.item_1_duration')) },
  { rating: 5, content: normalizeForStorage(t('dashboard.testimonials.item_2_quote')), userName: t('dashboard.testimonials.item_2_name'), userSubtitle: normalizeForStorage(t('dashboard.testimonials.item_2_duration')) },
]

export const buildDefaultSlogans = (t: TFunction) => [
  { vi: t('dashboard.slogan1'), en: '' },
  { vi: t('dashboard.slogan2'), en: '' },
]

export const seedLandingForEditor = (landing: any, t: TFunction) => ({
  ...landing,
  stats: Array.isArray(landing.stats) && landing.stats.length > 0 ? landing.stats : buildDefaultStats(t),
  services: Array.isArray(landing.services) && landing.services.length > 0 ? landing.services : buildDefaultServices(t),
  testimonials: Array.isArray(landing.testimonials) && landing.testimonials.length > 0 ? landing.testimonials : buildDefaultTestimonials(t),
})

export const seedAboutForEditor = (landing: any) => ({
  ...landing,
  sections: Array.isArray(landing.sections) && landing.sections.length > 0 ? landing.sections : [],
})

export const seedSettingsForEditor = (settings: any, t: TFunction) => {
  const slogans = Array.isArray(settings.slogans) && settings.slogans.length > 0
    ? settings.slogans.map(normalizeSlogan)
    : settings.slogan
      ? [{ vi: settings.slogan, en: '' }]
      : buildDefaultSlogans(t)
  return { ...settings, slogans }
}
