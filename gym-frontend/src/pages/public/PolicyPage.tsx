import { Spin } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, FileText, Search, ChevronDown, Info } from 'lucide-react'
import MemberLayout from '../../components/layout/header/MemberLayout'
import { systemExperienceService } from '../../services/systemExperienceService'

const normalizeCategory = (cat: string) => cat.trim().replace(/\s+/g, ' ')

const formatDate = (value: string | Date | undefined) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('vi-VN')
}

export default function PolicyPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.startsWith('en') ? 'en' : 'vi'
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const titleField = lang === 'en' ? 'titleEn' : 'titleVi'
  const contentField = lang === 'en' ? 'contentEn' : 'contentVi'
  const categoryField = lang === 'en' ? 'categoryEn' : 'categoryVi'

  useEffect(() => {
    setLoading(true)
    setSearch('')
    setActiveCategory(null)
    setOpenId(null)
    systemExperienceService.getPolicies({ lang }).then((res) => setItems(res.data.policies || [])).finally(() => setLoading(false))
  }, [lang])

  const categories = useMemo(() => {
    const map = new Map<string, { display: string; count: number }>()
    items.forEach((item) => {
      const cat = item[categoryField]
      if (!cat) return
      const normalized = normalizeCategory(cat)
      const key = normalized.toLowerCase()
      if (map.has(key)) {
        map.get(key)!.count += 1
      } else {
        map.set(key, { display: normalized, count: 1 })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.display.localeCompare(b.display))
  }, [items, categoryField])

  const totalCount = items.length

  const latestDate = useMemo(() => {
    if (items.length === 0) return ''
    const dates = items.map((i) => new Date(i.updatedAt || i.createdAt).getTime()).filter((d) => !Number.isNaN(d))
    if (dates.length === 0) return ''
    return formatDate(new Date(Math.max(...dates)).toISOString())
  }, [items])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      const title = item[titleField] || item.titleVi || item.titleEn || ''
      const content = item[contentField] || item.contentVi || item.contentEn || ''
      const category = item[categoryField] || item.categoryVi || item.categoryEn || ''
      const matchesSearch = !q || [title, content, category].join(' ').toLowerCase().includes(q)
      const itemCat = category ? normalizeCategory(category).toLowerCase() : ''
      const matchesCategory = !activeCategory || itemCat === activeCategory.toLowerCase()
      return matchesSearch && matchesCategory
    })
  }, [items, search, activeCategory, titleField, contentField, categoryField])

  const toggleCard = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id))
  }

  return (
    <MemberLayout>
      <div className="support-page">
        {/* Hero */}
        <div className="support-hero">
          <div className="support-hero-left">
            <span className="support-kicker">
              <ShieldCheck size={14} />
              {t('system_experience.policy.kicker')}
            </span>
            <h1>{t('system_experience.policy.title')}</h1>
            <p>{t('system_experience.policy.description')}</p>
          </div>
          <div className="support-stats">
            <div className="support-stats-item">
              <strong>{totalCount}</strong>
              <span>{t('system_experience.policy.stats_total')}</span>
            </div>
            {latestDate && (
              <div className="support-stats-item">
                <strong style={{ fontSize: 14, fontWeight: 600 }}>{latestDate}</strong>
                <span>{t('system_experience.policy.stats_updated')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Notice */}
        <div className="support-notice">
          <Info />
          {t('system_experience.policy.notice')}
        </div>

        {/* Toolbar */}
        <div className="support-toolbar">
          {/* Pill Tabs */}
          <div className="support-pills support-pills-scroll">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={`support-pill ${!activeCategory ? 'active' : ''}`}
            >
              {t('system_experience.policy.filter_all')} ({totalCount})
            </button>
            {categories.map(({ display, count }) => (
              <button
                key={display}
                type="button"
                onClick={() => setActiveCategory(display)}
                className={`support-pill ${activeCategory === display ? 'active' : ''}`}
              >
                <FileText size={15} />
                {display} ({count})
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="support-search">
            <input
              type="text"
              placeholder={t('system_experience.policy.search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search ? (
              <button
                type="button"
                className="support-search-clear"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            ) : (
              <Search className="support-search-icon" />
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="support-loading">
            <Spin />
          </div>
        ) : filtered.length === 0 ? (
          <div className="support-empty">
            <Search />
            <p>{t('system_experience.policy.empty')}</p>
            <span>{t('system_experience.policy.empty_suggestion')}</span>
          </div>
        ) : (
          <div className="support-list">
            {filtered.map((item) => {
              const id = item._id || item.slug
              const isOpen = openId === id
              const title = item[titleField] || item.titleVi || item.titleEn || ''
              const content = item[contentField] || item.contentVi || item.contentEn || ''
              const category = item[categoryField] || item.categoryVi || item.categoryEn || ''
              const updated = formatDate(item.updatedAt)
              return (
                <div key={id} className={`support-card ${isOpen ? 'open' : ''}`}>
                  <div className="support-card-header" onClick={() => toggleCard(id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCard(id) } }}>
                    <div className="support-card-title-area">
                      <div className="support-card-title">{title}</div>
                      <div className="support-card-meta">
                        <span className="support-card-category">{category}</span>
                        {updated && <span className="support-card-date">{t('system_experience.policy.updated_label')}: {updated}</span>}
                      </div>
                    </div>
                    <ChevronDown className="support-card-arrow" />
                  </div>
                  <div className="support-card-body">
                    <div className="support-card-body-inner">{content}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </MemberLayout>
  )
}
