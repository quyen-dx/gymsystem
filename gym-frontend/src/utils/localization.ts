/**
 * Safe localization helper
 * Converts { vi, en } objects or strings to the correct language
 * Never returns an object that can't be rendered
 */
export function getLocalizedText(
    value: any,
    language: string = 'vi',
    fallback: string = ''
): string {
    // Handle null/undefined
    if (value === null || value === undefined) {
        return fallback
    }

    // Handle string
    if (typeof value === 'string') {
        return value || fallback
    }

    // Handle object with language keys
    if (typeof value === 'object' && !Array.isArray(value)) {
        const normalized = value as Record<string, string>
        const lang = language?.startsWith('en') ? 'en' : 'vi'
        return normalized[lang] || normalized.vi || normalized.en || fallback
    }

    // Fallback for any other type
    try {
        return String(value) || fallback
    } catch {
        return fallback
    }
}

/**
 * Normalize data for rendering - ensures no objects are passed to JSX
 */
export function normalizeForRender(data: any, language: string = 'vi'): string {
    return getLocalizedText(data, language, '')
}

/**
 * Normalize an object's text fields before saving
 * Ensures strings are converted to { vi, en } format
 */
export function normalizeForStorage(value: any): { vi: string; en: string } {
    if (!value) return { vi: '', en: '' }
    if (typeof value === 'string') {
        return { vi: value, en: '' }
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
        return {
            vi: String(value.vi ?? value.en ?? ''),
            en: String(value.en ?? ''),
        }
    }
    return { vi: String(value), en: '' }
}

const LOCALIZED_LANDING_KEYS = [
    'heroTitle', 'heroSubtitle', 'heroBadgeText', 'ctaText', 'secondaryCtaText',
    'servicesEyebrow', 'servicesTitle', 'testimonialsEyebrow', 'testimonialsTitle',
    'finalCtaTitle', 'finalCtaSubtitle', 'finalCtaPrimaryText', 'finalCtaSecondaryText',
    'aboutTitle', 'aboutContent',
] as const

/**
 * Ensure landing CMS data has a stable schema after load (strings -> { vi, en })
 */
export function normalizeLandingData(data: any = {}) {
    const next: any = { ...data }
    LOCALIZED_LANDING_KEYS.forEach((key) => {
        if (next[key] !== undefined) next[key] = normalizeForStorage(next[key])
    })
    next.stats = Array.isArray(next.stats)
        ? next.stats.map((item: any) => ({
            value: typeof item?.value === 'object' && item?.value !== null
                ? getLocalizedText(item.value, 'vi', '')
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

/**
 * Normalize landing CMS data before persisting to API
 */
export function normalizeLandingForStorage(data: any = {}) {
    return normalizeLandingData(data)
}
