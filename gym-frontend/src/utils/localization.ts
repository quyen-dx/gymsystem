export function getLocalizedText(
    value: any,
    _language: string = 'vi',
    fallback: string = ''
): string {
    if (value === null || value === undefined) return fallback
    if (typeof value === 'string') return value || fallback
    if (typeof value === 'object' && !Array.isArray(value)) {
        return value.vi || value.en || fallback
    }
    try { return String(value) || fallback }
    catch { return fallback }
}

export function normalizeForRender(data: any, language: string = 'vi'): string {
    return getLocalizedText(data, language, '')
}

export function normalizeForStorage(value: any): string {
    if (!value) return ''
    if (typeof value === 'string') return value
    if (typeof value === 'object' && !Array.isArray(value)) return value.vi || value.en || ''
    return String(value)
}

const LOCALIZED_LANDING_KEYS = [
    'heroTitle', 'heroSubtitle', 'heroBadgeText', 'ctaText', 'secondaryCtaText',
    'servicesEyebrow', 'servicesTitle', 'testimonialsEyebrow', 'testimonialsTitle',
    'finalCtaTitle', 'finalCtaSubtitle', 'finalCtaPrimaryText', 'finalCtaSecondaryText',
    'aboutTitle', 'aboutContent',
] as const

export function normalizeLandingData(data: any = {}) {
    const next: any = { ...data }
    LOCALIZED_LANDING_KEYS.forEach((key) => {
        if (next[key] !== undefined) next[key] = normalizeForStorage(next[key])
    })
    next.stats = Array.isArray(next.stats)
        ? next.stats.map((item: any) => ({
            value: typeof item?.value === 'object' && item?.value !== null
                ? item.value.vi || item.value.en || ''
                : String(item?.value ?? ''),
            label: normalizeForStorage(item?.label),
            order: item?.order ?? 0,
        }))
        : []
    next.services = Array.isArray(next.services)
        ? next.services.map((item: any) => ({
            ...item,
            title: normalizeForStorage(item?.title),
            description: normalizeForStorage(item?.description ?? item?.desc),
            desc: normalizeForStorage(item?.description ?? item?.desc),
            link: item?.link ?? item?.path ?? '',
            path: item?.link ?? item?.path ?? '',
        }))
        : []
    next.testimonials = Array.isArray(next.testimonials)
        ? next.testimonials.map((item: any) => ({
            ...item,
            content: normalizeForStorage(item?.content ?? item?.quote),
            quote: normalizeForStorage(item?.content ?? item?.quote),
            userName: item?.userName ?? item?.name ?? '',
            name: item?.userName ?? item?.name ?? '',
            userSubtitle: normalizeForStorage(item?.userSubtitle ?? item?.duration),
            duration: normalizeForStorage(item?.userSubtitle ?? item?.duration),
        }))
        : []
    next.sections = Array.isArray(next.sections)
        ? next.sections.map((section: any) => ({
            ...section,
            title: normalizeForStorage(section?.title),
            content: normalizeForStorage(section?.content),
        }))
        : []
    return next
}

export function normalizeLandingForStorage(data: any = {}) {
    return normalizeLandingData(data)
}
