import type { ChatMessage, PlanPayloadPlan } from '../../types/aichat/aichat'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { PlanDetailCard } from './PlanDetailCard'
import { PlanCompareTable } from './PlanCompareTable'
import { CompareTwoPlansCard } from './CompareTwoPlansCard'
import { MembershipPlanCards } from './MembershipPlanCards'
import { PlanRecommendCard } from './PlanRecommendCard'

interface Props {
  message: ChatMessage
  content?: string
}

export function AssistantMessageBubble({ message, content }: Props) {
  const { i18n } = useTranslation()
  const lang = message.metadata?.answerLanguage === 'en'
    ? 'en'
    : message.metadata?.answerLanguage === 'vi'
      ? 'vi'
      : i18n.language?.startsWith('en') ? 'en' : 'vi'
  const stripUnsafeModelOutput = (value: string) => {
    const cleaned = String(value || '')
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
      .replace(/^```[a-z0-9_-]*\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()
    if (/^\s*\{[\s\S]*\}\s*$/.test(cleaned)) {
      try {
        const parsed = JSON.parse(cleaned)
        if (typeof parsed?.answer === 'string') return parsed.answer.trim()
        if (typeof parsed?.message === 'string') return parsed.message.trim()
        return ''
      } catch {
        return ''
      }
    }
    return cleaned
  }
  const rawText = typeof content === 'string' ? content : (typeof message.content === 'string' ? message.content : '')
  const text = stripUnsafeModelOutput(rawText)
  const isPlanResponseType = typeof message.type === 'string' && (
    message.type === 'plan_detail'
    || message.type === 'plan_list'
    || message.type === 'plan_compare'
    || message.type === 'plan_compare_two'
    || message.type === 'plan_compare_all'
    || message.type === 'plan_recommend'
  )
  const planPayload = isPlanResponseType ? message.planPayload : undefined

  const renderBold = (text: string) =>
    text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>
      }
      return part
    })

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
        <ul key={`${keyPrefix}-ul`}>
          {items.map((item, index) => <li key={index}>{renderBold(item)}</li>)}
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
      nodes.push(<p key={i}>{renderBold(trimmed)}</p>)
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

  const displayText = typeof message.answer === 'string' && message.answer.trim() ? stripUnsafeModelOutput(message.answer) : text

  if (planPayload?.type === 'plan_detail') {
    return (
      <div className="ai-assistant-content ai-text-content">
        {displayText && renderText(displayText)}
        <PlanDetailCard plan={planPayload.plan as PlanPayloadPlan} lang={lang} />
      </div>
    )
  }

  if (planPayload?.type === 'plan_list') {
    const plans = (planPayload.plans || []) as PlanPayloadPlan[]
    return (
      <div className="ai-assistant-content ai-text-content">
        {displayText && renderText(displayText)}
        {plans.length > 0 && (
          <div>
            <MembershipPlanCards plans={plans} lang={lang} />
          </div>
        )}
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

  return (
    <div className="ai-assistant-content ai-text-content" style={{ whiteSpace: 'pre-line', lineHeight: 1.7 }}>
      {displayText && renderText(displayText)}
      {renderGenericCards()}
      {!displayText && (
        <span className="ai-loading-text">đang suy nghĩ...</span>
      )}
    </div>
  )
}
