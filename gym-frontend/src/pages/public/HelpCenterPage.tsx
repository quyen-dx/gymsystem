import { Card, Collapse, Empty, Input, Spin, Tag } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MemberLayout from '../../components/layout/header/MemberLayout'
import { systemExperienceService } from '../../services/systemExperienceService'

const normalizeCategory = (cat: string) => cat.trim().replace(/\s+/g, ' ')

export default function HelpCenterPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.startsWith('en') ? 'en' : 'vi'
  const [items, setItems] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setSearch('')
    setActiveCategory(null)
    systemExperienceService.getFaqs({ lang }).then((res) => setItems(res.data.faqs || [])).finally(() => setLoading(false))
  }, [lang])

  const qField = lang === 'en' ? 'questionEn' : 'questionVi'
  const aField = lang === 'en' ? 'answerEn' : 'answerVi'
  const cField = lang === 'en' ? 'categoryEn' : 'categoryVi'

  const categories = useMemo(() => {
    const map = new Map<string, { display: string; count: number }>()
    items.forEach((item) => {
      const cat = item[cField]
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
  }, [items, cField])

  const totalCount = items.length

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      const text = [item[qField], item[aField], item[cField]].join(' ').toLowerCase()
      const matchesSearch = !q || text.includes(q)
      const itemCat = item[cField] ? normalizeCategory(item[cField]).toLowerCase() : ''
      const matchesCategory = !activeCategory || itemCat === activeCategory.toLowerCase()
      return matchesSearch && matchesCategory
    })
  }, [items, search, activeCategory, qField, aField, cField])

  return (
    <MemberLayout>
      <div className="member-page grid gap-5">
        <Card className="no-select rounded-[28px] border border-[var(--gs-border)] bg-[var(--theme-card)]">
          <div className="grid gap-4">
            <div className="flex items-start gap-4 max-[520px]:gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--theme-accent-muted)] text-2xl">❓</div>
              <div>
                <h1 className="m-0 text-3xl font-semibold text-[var(--theme-text)] max-[520px]:text-2xl">{t('system_experience.help.title')}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--theme-muted)] sm:text-base">
                  {t('system_experience.help.description')}
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
                {t('system_experience.help.filter_all')} ({totalCount})
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

            <Input.Search allowClear size="large" placeholder={t('system_experience.help.search_placeholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </Card>

        {loading ? (
          <Spin />
        ) : filtered.length === 0 ? (
          <Empty description={t('system_experience.help.empty')} />
        ) : (
          <Collapse className="policy-center-collapse" items={filtered.map((item) => ({
            key: item._id,
            label: <span className="no-select tap-transparent font-semibold text-[var(--theme-text)]">{item[qField]} <Tag className="no-select">{item[cField]}</Tag></span>,
            children: <p className="select-text m-0 whitespace-pre-wrap leading-7 text-[var(--theme-text)]">{item[aField]}</p>,
          }))} />
        )}
      </div>
    </MemberLayout>
  )
}
