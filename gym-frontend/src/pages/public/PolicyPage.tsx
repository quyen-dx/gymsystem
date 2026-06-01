import { Card, Collapse, Empty, Input, Spin } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const titleField = lang === 'en' ? 'titleEn' : 'titleVi'
  const contentField = lang === 'en' ? 'contentEn' : 'contentVi'
  const categoryField = lang === 'en' ? 'categoryEn' : 'categoryVi'

  useEffect(() => {
    setLoading(true)
    setSearch('')
    setActiveCategory(null)
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

  return (
    <MemberLayout>
      <div className="member-page grid gap-5">
        <Card className="no-select rounded-[28px] border border-[var(--gs-border)] bg-[var(--theme-card)]">
          <div className="grid gap-4">
            <div className="flex items-start gap-4 max-[520px]:gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--theme-accent-muted)] text-2xl">📜</div>
              <div>
                <h1 className="m-0 text-3xl font-semibold text-[var(--theme-text)] max-[520px]:text-2xl">{t('system_experience.policy.title')}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--theme-muted)] sm:text-base">
                  {t('system_experience.policy.description')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                className={`tap-transparent no-select rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  !activeCategory
                    ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)] text-[var(--theme-button-text)]'
                    : 'border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-text)] hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)]'
                }`}
              >
                {t('system_experience.policy.filter_all')} ({items.length})
              </button>
              {categories.map(({ display, count }) => (
                <button
                  key={display}
                  type="button"
                  onClick={() => setActiveCategory(display)}
                  className={`tap-transparent no-select rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                    activeCategory === display
                      ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)] text-[var(--theme-button-text)]'
                      : 'border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-text)] hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent)]'
                  }`}
                >
                  {display} ({count})
                </button>
              ))}
            </div>

            <Input.Search
              allowClear
              size="large"
              placeholder={t('system_experience.policy.search_placeholder')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </Card>

        {loading ? (
          <Spin />
        ) : filtered.length === 0 ? (
          <Empty description={t('system_experience.policy.empty')} />
        ) : (
          <Collapse
            className="policy-center-collapse"
            items={filtered.map((item) => {
              const title = item[titleField] || item.titleVi || item.titleEn
              const content = item[contentField] || item.contentVi || item.contentEn
              const updated = formatDate(item.updatedAt)
              return {
                key: item._id || item.slug,
                label: <span className="no-select tap-transparent font-semibold text-[var(--theme-text)]">{title}</span>,
                children: (
                  <div className="grid gap-3">
                    {updated && <div className="no-select text-sm text-[var(--theme-muted)]">{t('system_experience.policy.updated_label')}: {updated}</div>}
                    <div className="select-text whitespace-pre-wrap leading-7 text-[var(--theme-text)]">{content}</div>
                  </div>
                ),
              }
            })}
          />
        )}
      </div>
    </MemberLayout>
  )
}
