import { Button, Checkbox, Spin, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ShieldCheck, FileText, Search, ChevronDown, Info } from 'lucide-react'
import MemberLayout from '../../components/layout/header/MemberLayout'
import { systemExperienceService } from '../../services/systemExperienceService'
import { acceptMultiplePolicyConsent, markPolicyViewed } from '../../utils/policyConsent'

const normalizeCategory = (cat: string) => cat.trim().replace(/\s+/g, ' ')

const formatDate = (value: string | Date | undefined) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('vi-VN')
}

const RETURN_TYPE_MAP: Record<string, { types: string[]; viewedType: 'deposit' | 'membership' | 'refund' }> = {
  '/deposit': { types: ['payment', 'refund'], viewedType: 'deposit' },
  '/plans': { types: ['membership', 'terms'], viewedType: 'membership' },
  '/my-membership/cancel-request': { types: ['refund', 'membership'], viewedType: 'refund' },
}

const CATEGORY_TYPE_MAP: Record<string, { types: string[]; viewedType: 'deposit' | 'membership' | 'refund' }> = {
  payment: { types: ['payment', 'refund'], viewedType: 'deposit' },
  membership: { types: ['membership', 'terms'], viewedType: 'membership' },
  refund: { types: ['refund', 'membership'], viewedType: 'refund' },
  terms: { types: ['terms', 'membership'], viewedType: 'membership' },
}

export default function PolicyPage() {
  const lang = 'vi'
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const categoryParam = searchParams.get('category')
  const returnTo = searchParams.get('returnTo')
  const requireConsent = searchParams.get('requireConsent') === 'true'
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [consentVersions, setConsentVersions] = useState<Record<string, any> | null>(null)
  const [consentLoading, setConsentLoading] = useState(false)
  const [consentError, setConsentError] = useState<string | null>(null)
  const titleField = 'titleVi'
  const contentField = 'contentVi'
  const categoryField = 'categoryVi'

  const categoryInfo = categoryParam ? CATEGORY_TYPE_MAP[categoryParam.toLowerCase()] : null
  const returnInfo = (returnTo ? RETURN_TYPE_MAP[returnTo] : null) || categoryInfo

  useEffect(() => {
    if (returnInfo) {
      markPolicyViewed(returnInfo.viewedType)
    }
  }, [returnTo, returnInfo])

  useEffect(() => {
    setLoading(true)
    setSearch('')
    setActiveCategory(null)
    setOpenId(null)
    systemExperienceService.getPolicies({ lang }).then((res) => setItems(res.data.policies || [])).finally(() => setLoading(false))
  }, [lang])

  useEffect(() => {
    if (!categoryParam || items.length === 0) return
    const category = categoryParam.toLowerCase()
    const matched = items.find((item) => {
      if (String(item.type || '').toLowerCase() === category) return true
      const cat = item[categoryField]
      if (!cat) return false
      return normalizeCategory(cat).toLowerCase() === category
    })
    if (matched) {
      const cat = matched[categoryField]
      setActiveCategory(normalizeCategory(cat))
      const id = matched._id || matched.slug
      setOpenId(id)
    }
  }, [categoryParam, items, categoryField])

  useEffect(() => {
    if (!returnInfo) return
    setConsentLoading(true)
    setConsentError(null)
    systemExperienceService.getConsentStatus(returnInfo.types.join(','))
      .then((res) => setConsentVersions(res.data))
      .catch(() => {
        setConsentVersions(null)
        setConsentError('Không thể tải phiên bản chính sách từ máy chủ.')
      })
      .finally(() => setConsentLoading(false))
  }, [returnInfo])

  useEffect(() => {
    if (requireConsent && returnInfo && items.length > 0) {
      window.setTimeout(() => {
        const el = document.getElementById('policy-consent-section')
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 500)
    }
  }, [requireConsent, returnInfo, items])

  const consentPolicies = useMemo(() => {
    if (!returnInfo) return []
    const typeLabelMap: Record<string, string> = {
      payment: 'Chính sách thanh toán',
      refund: 'Chính sách hoàn tiền',
      wallet: 'Chính sách ví',
      membership: 'Chính sách hội viên',
      terms: 'Điều khoản sử dụng',
    }
    return returnInfo.types.map((type) => {
      const fromItems = items.find((item) =>
        item.type === type ||
        (item.categoryEn || '').toLowerCase() === type ||
        (item.categoryEn || '').toLowerCase().includes(type)
      )
      const apiVersion = consentVersions?.[type]?.currentVersion
      const itemVersion = fromItems?.version
      const version = apiVersion && apiVersion !== '' ? apiVersion : (itemVersion || '1')
      return {
        type,
        title: fromItems?.[titleField] || fromItems?.titleVi || fromItems?.titleEn || typeLabelMap[type] || type,
        version,
        _id: fromItems?._id,
      }
    })
  }, [items, returnInfo, consentVersions, titleField])

  const consentReady = !!returnInfo && !loading && !consentLoading

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

  const handleAcceptAndReturn = async () => {
    if (!returnInfo || !returnTo || !consentReady) {
      message.warning('Dữ liệu chính sách chưa sẵn sàng, vui lòng đợi...')
      return
    }
    setSubmitting(true)
    try {
      const payload = consentPolicies.map((policy) => ({
        policyType: policy.type,
        policyVersion: policy.version,
        policyId: policy._id,
      }))
      await acceptMultiplePolicyConsent(payload)
      message.success('Đã xác nhận chính sách.')
      navigate(returnTo)
    } catch (error: any) {
      const errMsg = error?.response?.data?.message || error?.message || 'Xác nhận thất bại'
      message.error(errMsg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <MemberLayout>
      <div className="support-page">
        {/* Hero */}
        <div className="support-hero">
          <div className="support-hero-left">
            <span className="support-kicker">
              <ShieldCheck size={14} />
              {'Chính sách'}
            </span>
            <h1>{'Chính sách & Điều khoản'}</h1>
            <p>{'Tra cứu các chính sách và điều khoản của trung tâm'}</p>
          </div>
          <div className="support-stats">
            <div className="support-stats-item">
              <strong>{totalCount}</strong>
              <span>{'Tổng số chính sách'}</span>
            </div>
            {latestDate && (
              <div className="support-stats-item">
                <strong style={{ fontSize: 14, fontWeight: 600 }}>{latestDate}</strong>
                <span>{'Cập nhật gần đây'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Notice */}
        {!returnInfo && (
          <div className="support-notice">
            <Info />
            {'Các chính sách được cập nhật định kỳ. Vui lòng kiểm tra thường xuyên để nắm thông tin mới nhất.'}
          </div>
        )}

        {returnInfo && (
          <div className="mb-4 rounded-lg border border-[var(--theme-accent-border)] bg-[var(--theme-accent-muted)] px-4 py-3 text-sm text-[var(--theme-accent)]">
            <Info size={16} className="mr-2 inline-block" />
            {'Vui lòng đọc và xác nhận chính sách để tiếp tục giao dịch.'}
          </div>
        )}

        {/* Toolbar */}
        <div className="support-toolbar">
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
                <FileText size={15} />
                {display} ({count})
              </button>
            ))}
          </div>

          <div className="support-search">
            <input
              type="text"
              placeholder={'Tìm kiếm chính sách...'}
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
            <p>{'Không tìm thấy chính sách nào'}</p>
            <span>{'Thử thay đổi từ khóa tìm kiếm hoặc danh mục'}</span>
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
                        {item.version && <span className="support-card-version">v{item.version}</span>}
                        {updated &&                         <span className="support-card-date">{'Cập nhật'}: {updated}</span>}
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

        {returnInfo && requireConsent && (
          <div id="policy-consent-section" className="mt-8 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-elevated)] p-6">
            <h3 className="mb-2 text-base font-semibold text-[var(--theme-text)]">
              {'Xác nhận chính sách'}
            </h3>
            <ul className="mb-4 space-y-1 text-sm text-[var(--theme-muted)]">
              {consentError ? (
                <li className="text-[#ef4444]">{consentError}</li>
              ) : consentLoading || loading ? (
                <li>Đang tải phiên bản chính sách...</li>
              ) : (
                consentPolicies.map((p) => (
                  <li key={p.type}>
                    - {p.title} (v{p.version})
                  </li>
                ))
              )}
            </ul>
            <Checkbox checked={accepted} onChange={(e) => setAccepted(e.target.checked)}>
              <span className="text-sm text-[var(--theme-text)]">
                {'Tôi đã đọc và đồng ý với phiên bản hiện tại của các chính sách liên quan.'}
              </span>
            </Checkbox>
            <div className="mt-4 flex gap-3">
              <Button onClick={() => navigate(returnTo!)}>
                {'Quay lại'}
              </Button>
              <Button type="primary" disabled={!accepted || !consentReady || !!consentError} loading={submitting} onClick={handleAcceptAndReturn}>
                {'Đồng ý và quay lại giao dịch'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </MemberLayout>
  )
}
