import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { AiSource, ChatMessage, PlanPayloadPlan } from '../../types/aichat/aichat'
import { ComboRecommendCard } from './ComboRecommendCard'
import { CompareTwoPlansCard } from './CompareTwoPlansCard'
import PlanCompactList from './PlanCompactList'
import { PlanCompareTable } from './PlanCompareTable'
import { PlanDetailCard } from './PlanDetailCard'
import { PlanRecommendCard } from './PlanRecommendCard'
import { WorkoutAnalyzeCard, WorkoutPlanCard } from './WorkoutAnalyzeCard'
import { stripUnsafeModelOutput } from '../../utils/aiUtils'

interface Props {
  message: ChatMessage
  content?: string
  loadingMessage?: string | null
}

function tryExtractAnswerFromJsonText(input: unknown): string {
  if (input == null) return ''

  if (typeof input !== 'string') {
    if (typeof (input as any)?.answer === 'string') {
      return (input as any).answer
    }
    if (typeof (input as any)?.data?.answer === 'string') {
      return (input as any).data.answer
    }
    if (typeof (input as any)?.message === 'string') {
      return (input as any).message
    }
    return ''
  }

  const text = input.trim()

  if (!text.startsWith('{')) return input

  try {
    const parsed = JSON.parse(text)

    if (typeof parsed?.answer === 'string') {
      return parsed.answer
    }

    if (typeof parsed?.data?.answer === 'string') {
      return parsed.data.answer
    }

    if (typeof parsed?.message === 'string') {
      return parsed.message
    }

    return text.includes('"answer"') ? '' : input
  } catch {
    const match = text.match(/"answer"\s*:\s*"([\s\S]*?)"\s*,\s*"(conclusion|reason|recommendedPlanId|alternativePlanIds|cardIds|toolsNeeded|action)"/)

    if (match?.[1]) {
      return match[1]
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
    }

    return text.includes('"answer"') ? '' : input
  }
}

export function AssistantMessageBubble({ message, content, loadingMessage }: Props) {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const lang = message.metadata?.answerLanguage === 'en'
    ? 'en'
    : message.metadata?.answerLanguage === 'vi'
      ? 'vi'
      : i18n.language?.startsWith('en') ? 'en' : 'vi'
  const rawText = typeof content === 'string' ? content : (typeof message.content === 'string' ? message.content : '')
  const displayContent = tryExtractAnswerFromJsonText(rawText)
  const text = tryExtractAnswerFromJsonText(stripUnsafeModelOutput(displayContent))
  const isPlanResponseType = typeof message.type === 'string' && (
    message.type === 'plan_detail'
    || message.type === 'plan_compare'
    || message.type === 'plan_compare_two'
    || message.type === 'plan_compare_all'
    || message.type === 'plan_recommend'
  )
  const planPayload = isPlanResponseType ? message.planPayload : undefined

  const renderEmphasis = (text: string) =>
    text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>
      }
      return part
    })

  const renderRichText = (value: string) => {
    const parts = String(value || '').split(/((?:Giá|Price):\s*[^,\n]+|(?:Thời hạn|Duration):\s*[^,\n]+|(?:Quyền lợi|Benefits):|(?:Chuyên môn|Specialty|Expertise):\s*[^,\n]+|(?:Đánh giá|Rating):\s*[^,\n]+|\b\d+(?:[.,]\d+)?\/5\b|(?:\d{1,3}(?:[.,]\d{3})+|\d+)\s*(?:đ|₫|VND|VNĐ)\b|\b\d+\s*(?:ngày|days?|tháng|months?|năm|years?)\b)/gi)
    return parts.filter(Boolean).map((part, index) => {
      const text = part.trim()
      if (!text) return part
      const labelMatch = text.match(/^(?:[^\p{L}\p{N}]*)?(Giá|Price|Thời hạn|Duration|Quyền lợi|Benefits|Chuyên môn|Specialty|Expertise|Đánh giá|Rating):(\s*)/iu)
      if (labelMatch) {
        const label = labelMatch[1]
        const rest = text.slice(labelMatch[0].length)
        return (
          <span key={index}>
            <span className="ai-label">{label}:</span>
            {rest ? ' ' : ''}
            {rest ? renderRichText(rest) : null}
          </span>
        )
      }
      if (/(?:\d{1,3}(?:[.,]\d{3})+|\d+)\s*(?:đ|₫|VND|VNĐ)\b/i.test(text)) {
        return <span key={index} className="ai-price-value">{renderEmphasis(part)}</span>
      }
      if (/\b\d+\s*(?:ngày|days?|tháng|months?|năm|years?)\b/i.test(text)) {
        return <span key={index} className="ai-duration-value">{renderEmphasis(part)}</span>
      }
      if (/\b\d+(?:[.,]\d+)?\/5\b/i.test(text)) {
        return <span key={index} className="ai-rating-value">{renderEmphasis(part)}</span>
      }
      return renderEmphasis(part)
    })
  }

  const normalizeReadableText = (value: string) =>
    value
      .replace(/\s*\((\d+)\)\s*/g, '\n- ')
      .replace(/([.!?])\s+(Kết luận|Lý do|Lựa chọn|Gợi ý|Tóm tắt|Conclusion|Reason|Suggestion|Summary):/g, '$1\n\n$2:')

  const renderText = (t: string) => {
    const lines = normalizeReadableText(t).split('\n')
    const nodes: ReactNode[] = []
    let bullets: string[] = []

    const flushBullets = (keyPrefix: string) => {
      if (bullets.length === 0) return
      const items = bullets
      bullets = []
      nodes.push(
        <ul key={`${keyPrefix}-ul`} className="ai-benefit-list">
          {items.map((item, index) => <li key={index} className="ai-benefit-item">{renderRichText(item)}</li>)}
        </ul>
      )
    }

    lines.forEach((line, i) => {
      const trimmed = line.trim()
      if (!trimmed) {
        flushBullets(String(i))
        return
      }
      const bullet = trimmed.match(/^[-*•]\s+(.+)$/)
      if (bullet) {
        bullets.push(bullet[1].trim())
        return
      }
      flushBullets(String(i))
      const numberedTitle = trimmed.match(/^(\d+)\.\s+(.+)$/)
      if (numberedTitle) {
        nodes.push(
          <p key={i} className="ai-plan-title">
            <span className="ai-section-index">{numberedTitle[1]}.</span>
            {' '}
            {renderRichText(numberedTitle[2])}
          </p>
        )
        return
      }
      const isStandaloneTitle = !trimmed.includes(':')
        && trimmed.length <= 72
        && /^(Gói|Plan|PT|Huấn luyện viên|Trainer)\b/i.test(trimmed)
      nodes.push(
        <p key={i} className={isStandaloneTitle ? 'ai-plan-title' : undefined}>
          {renderRichText(trimmed)}
        </p>
      )
    })
    flushBullets('end')
    return nodes
  }

  const getCardTitle = (card: unknown) => {
    if (!card || typeof card !== 'object') return ''
    const item = card as Record<string, any>
    return lang === 'en'
      ? (item.nameEn || item.name || item.titleEn || item.title || item.questionEn || item.planNameEn || item.planName || item.ptName || item.memberName || item.categoryEn || item.category || '')
      : (item.nameVi || item.name || item.titleVi || item.title || item.questionVi || item.planNameVi || item.planName || item.ptName || item.memberName || item.categoryVi || item.category || '')
  }

  const getCardMeta = (card: unknown) => {
    if (!card || typeof card !== 'object') return ''
    const item = card as Record<string, any>
    const parts = [
      item.price !== undefined ? `${Number(item.price).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN')}đ` : '',
      item.status,
      item.slot,
      item.rating !== undefined ? `${item.rating}/5` : '',
      item.totalAmount !== undefined ? `${Number(item.totalAmount).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN')}đ` : '',
      item.daysLeft !== undefined ? `${item.daysLeft} ${lang === 'en' ? 'days' : 'ngày'}` : '',
    ].filter(Boolean)
    return parts.join(' · ')
  }

  const renderGenericCards = () => {
    const cards = Array.isArray(message.cards) ? message.cards : []
    const cardTypes = new Set([
      'checkin_summary',
      'pt_list',
      'trainer_list',
      'pt_detail',
      'booking_list',
      'product_list',
    ])
    const messageType = message.type
    if (!messageType || !cardTypes.has(messageType) || cards.length === 0) return null
    return (
      <div style={{ display: 'grid', gap: 8, marginTop: text ? 10 : 0 }}>
        {cards.slice(0, 8).map((card, index) => {
          const title = getCardTitle(card) || `${messageType.replace(/_/g, ' ')} ${index + 1}`
          const meta = getCardMeta(card)
          const body = card && typeof card === 'object'
            ? String(lang === 'en'
              ? ((card as Record<string, any>).descriptionEn || (card as Record<string, any>).description || (card as Record<string, any>).answerEn || (card as Record<string, any>).contentEn || (card as Record<string, any>).reason || '')
              : ((card as Record<string, any>).descriptionVi || (card as Record<string, any>).description || (card as Record<string, any>).answerVi || (card as Record<string, any>).contentVi || (card as Record<string, any>).reason || '')).slice(0, 180)
            : ''
          return (
            <div key={`${message.id}-card-${index}`} className="ai-plan-row">
              <div className="ai-plan-name">{title}</div>
              {meta && <div className="ai-plan-price">{meta}</div>}
              {body && <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.82 }}>{body}</p>}
            </div>
          )
        })}
      </div>
    )
  }

  const normalizeSource = (source: AiSource) => {
    const url = typeof source.url === 'string' && source.url.trim()
      ? source.url.trim()
      : (typeof source.sourceUrl === 'string' ? source.sourceUrl.trim() : '')
    if (!url) return null
    let domain = typeof source.domain === 'string' && source.domain.trim()
      ? source.domain.trim()
      : (typeof source.sourceDomain === 'string' ? source.sourceDomain.trim() : '')
    if (!domain) {
      try {
        domain = new URL(url).hostname.replace(/^www\./, '')
      } catch {
        domain = ''
      }
    }
    const title = typeof source.title === 'string' && source.title.trim()
      ? source.title.trim()
      : (typeof source.sourceTitle === 'string' && source.sourceTitle.trim() ? source.sourceTitle.trim() : domain || url)
    const favicon = typeof source.favicon === 'string' && source.favicon.trim()
      ? source.favicon.trim()
      : (domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32` : '')
    return { title, url, domain, favicon }
  }

  const renderSourceList = () => {
    const normalizedSources = (Array.isArray(message.sources) ? message.sources : [])
      .map(normalizeSource)
      .filter((source): source is { title: string; url: string; domain: string; favicon: string } => Boolean(source))
      .slice(0, 4)
    if (normalizedSources.length === 0) return null
    return (
      <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.78 }}>
          {lang === 'en' ? 'References' : 'Nguồn tham khảo'}
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {normalizedSources.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="ai-plan-row"
              style={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 8, textDecoration: 'none', color: 'inherit' }}
            >
              {source.favicon ? (
                <img src={source.favicon} alt="" width={20} height={20} style={{ borderRadius: 4, marginTop: 2 }} />
              ) : (
                <span style={{ width: 20, height: 20, borderRadius: 4, background: 'rgba(148, 163, 184, 0.24)', marginTop: 2 }} />
              )}
              <span>
                <span className="ai-plan-name" style={{ display: 'block' }}>{source.domain || source.title}</span>
                <span className="ai-plan-price" style={{ display: 'block' }}>
                  {lang === 'en' ? 'Article: ' : 'Bài viết: '}
                  {source.title}
                </span>
                <span style={{ display: 'block', marginTop: 2, fontSize: 12, fontWeight: 600 }}>
                  {lang === 'en' ? 'View source' : 'Xem nguồn'}
                </span>
              </span>
            </a>
          ))}
        </div>
      </div>
    )
  }

  const renderNavigationLinks = () => {
    const links = Array.isArray(message.links)
      ? message.links
      : (Array.isArray((message.data as any)?.links) ? (message.data as any).links : [])
    const safeLinks = links
      .filter((link: any) => typeof link?.path === 'string' && typeof link?.label === 'string')
      .slice(0, 3)
    if (safeLinks.length === 0) return null
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {safeLinks.map((link: any) => (
          <button
            key={`${link.path}-${link.label}`}
            type="button"
            onClick={() => navigate(link.path)}
            className="ai-plan-row"
            style={{
              cursor: 'pointer',
              border: '1px solid var(--theme-accent-border, color-mix(in srgb, var(--theme-accent) 36%, transparent))',
              background: 'var(--theme-accent-muted, color-mix(in srgb, var(--theme-accent) 12%, transparent))',
              color: 'var(--theme-text)',
              font: 'inherit',
              fontWeight: 800,
              padding: '8px 12px',
              textAlign: 'left',
            }}
          >
            {link.label}
          </button>
        ))}
      </div>
    )
  }

  const answerText = tryExtractAnswerFromJsonText(stripUnsafeModelOutput(tryExtractAnswerFromJsonText(message.answer)))
  const displayText = answerText || text

  const shouldRenderPlanCompact = (() => {
    if (message.type === 'plan_list') return true
    if (message.planPayload && (message.planPayload as any).type === 'plan_list') return true
    if (message.type === 'text_advice' && Array.isArray(message.plans) && message.plans.length > 0) return true
    return false
  })()

  if (planPayload?.type === 'plan_detail') {
    return (
      <div className="ai-assistant-content ai-text-content">
        {displayText && renderText(displayText)}
        <PlanDetailCard plan={planPayload.plan as PlanPayloadPlan} lang={lang} />
      </div>
    )
  }

  if (planPayload?.type === 'plan_compare_two') {
    return (
      <div className="ai-assistant-content ai-text-content">
        {displayText && renderText(displayText)}
        <CompareTwoPlansCard plans={(planPayload.plans || []) as PlanPayloadPlan[]} conclusion={planPayload.conclusion} lang={lang} />
      </div>
    )
  }

  if (planPayload?.type === 'plan_compare_all') {
    return (
      <div className="ai-assistant-content ai-text-content">
        {displayText && renderText(displayText)}
        <PlanCompareTable plans={(planPayload.plans || []) as PlanPayloadPlan[]} lang={lang} />
      </div>
    )
  }

  if (planPayload?.type === 'plan_recommend') {
    const recommended = planPayload.recommendedPlan as PlanPayloadPlan
    const alternatives = (planPayload.alternatives || []) as PlanPayloadPlan[]
    return (
      <div className="ai-assistant-content ai-text-content">
        {displayText && renderText(displayText)}
        {recommended && <PlanRecommendCard recommendedPlan={recommended} reason={planPayload.reason} conclusion={planPayload.conclusion || message.conclusion} alternatives={alternatives} lang={lang} />}
      </div>
    )
  }

  if (shouldRenderPlanCompact) {
    const plans = (message.planPayload && (message.planPayload as any).type === 'plan_list')
      ? (message.planPayload as any).plans || []
      : (message.plans || [])
    return (
      <div className="ai-assistant-content ai-text-content">
        {displayText && renderText(displayText)}
        <PlanCompactList plans={plans} lang={lang} />
      </div>
    )
  }

  if (message.type === 'smart_recommend' || (planPayload?.type === 'smart_recommend')) {
    const payload = planPayload?.type === 'smart_recommend' ? planPayload : message as any
    return (
      <div className="ai-assistant-content ai-text-content">
        {displayText && renderText(displayText)}
        <ComboRecommendCard data={payload as any} lang={lang} />
      </div>
    )
  }

  if (message.type === 'workout_analyzer' || message.type === 'workout_plan' || planPayload?.type === 'workout_analyzer' || planPayload?.type === 'workout_plan') {
    const payload = (planPayload?.type === 'workout_analyzer' || planPayload?.type === 'workout_plan') ? planPayload : message as any
    const isPlan = payload.type === 'workout_plan'
    return (
      <div className="ai-assistant-content ai-text-content">
        {displayText && renderText(displayText)}
        {isPlan ? <WorkoutPlanCard data={payload.plan || payload} lang={lang} /> : <WorkoutAnalyzeCard data={payload.analysis || payload} lang={lang} />}
      </div>
    )
  }

  return (
    <div className="ai-assistant-content ai-text-content" style={{ whiteSpace: 'pre-line', lineHeight: 1.7 }}>
      {displayText && renderText(displayText)}
      {renderGenericCards()}
      {renderSourceList()}
      {renderNavigationLinks()}
      {!displayText && (
        <span className="ai-loading-text">{loadingMessage || 'đang suy nghĩ...'}</span>
      )}
    </div>
  )
}
