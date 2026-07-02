import { Spin } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { HelpCircle, LifeBuoy, Search, ChevronDown, Users, Calendar, CreditCard, Dumbbell } from 'lucide-react'
import MemberLayout from '../../components/layout/header/MemberLayout'
import { systemExperienceService } from '../../services/systemExperienceService'

const normalizeCategory = (cat: string) => cat.trim().replace(/\s+/g, ' ')

const topicIcons: Record<string, React.ReactNode> = {
  'Tài khoản': <Users size={16} />,
  'Account': <Users size={16} />,
  'Đặt lịch': <Calendar size={16} />,
  'Booking': <Calendar size={16} />,
  'Gói tập': <Dumbbell size={16} />,
  'Membership': <Dumbbell size={16} />,
  'Thanh toán': <CreditCard size={16} />,
  'Payment': <CreditCard size={16} />,
}

export default function HelpCenterPage() {
  const lang = 'vi'
  const [items, setItems] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setSearch('')
    setActiveCategory(null)
    setOpenId(null)
    systemExperienceService.getFaqs({ lang }).then((res) => setItems(res.data.faqs || [])).finally(() => setLoading(false))
  }, [lang])

  const qField = 'questionVi'
  const aField = 'answerVi'
  const cField = 'categoryVi'

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
              <LifeBuoy size={14} />
              {'Trung tâm trợ giúp'}
            </span>
            <h1>{'Câu hỏi thường gặp'}</h1>
            <p>{'Tra cứu các câu hỏi thường gặp và câu trả lời'}</p>
          </div>
          <div className="support-stats">
            <div className="support-stats-item">
              <strong>{totalCount}</strong>
              <span>{'Câu hỏi'}</span>
            </div>
            <div className="support-stats-item">
              <strong>{categories.length}</strong>
              <span>{'Danh mục'}</span>
            </div>
          </div>
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
              {'Tất cả'} ({totalCount})
            </button>
            {categories.map(({ display, count }) => (
              <button
                key={display}
                type="button"
                onClick={() => setActiveCategory(display)}
                className={`support-pill ${activeCategory === display ? 'active' : ''}`}
              >
                {topicIcons[display] || <HelpCircle size={15} />}
                {display} ({count})
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="support-search">
            <input
              type="text"
              placeholder={'Tìm kiếm câu hỏi...'}
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
            <p>{'Không tìm thấy câu hỏi nào'}</p>
            <span>{'Thử thay đổi từ khóa tìm kiếm hoặc danh mục'}</span>
          </div>
        ) : (
          <div className="support-list">
            {filtered.map((item) => {
              const id = item._id
              const isOpen = openId === id
              return (
                <div key={id} className={`support-card ${isOpen ? 'open' : ''}`}>
                  <div className="support-card-header" onClick={() => toggleCard(id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCard(id) } }}>
                    <div className="support-card-title-area">
                      <div className="support-card-title">{item[qField]}</div>
                      <div className="support-card-meta">
                        <span className="support-card-category">{item[cField]}</span>
                      </div>
                    </div>
                    <ChevronDown className="support-card-arrow" />
                  </div>
                  <div className="support-card-body">
                    <div className="support-card-body-inner">{item[aField]}</div>
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
