import type { CSSProperties } from 'react'
import type { PlanPayloadPlan } from '../../types/aichat/aichat'
import { MembershipPlanCards } from './MembershipPlanCards'

interface Props {
  recommendedPlan: PlanPayloadPlan
  reason?: string | string[]
  conclusion?: string
  alternatives?: PlanPayloadPlan[]
  lang?: 'vi' | 'en'
}

const labels = {
  vi: {
    recommended: 'Gói được đề xuất',
    description: 'Mô tả',
    benefits: 'Quyền lợi',
    price: 'Giá',
    duration: 'Thời hạn',
    suggestedNext: 'Gợi ý tiếp theo',
    reasonTitle: 'Vì sao phù hợp?',
    otherPlans: 'Các gói khác',
  },
  en: {
    recommended: 'Recommended plan',
    description: 'Description',
    benefits: 'Benefits',
    price: 'Price',
    duration: 'Duration',
    suggestedNext: 'Suggested next',
    reasonTitle: 'Why this fits',
    otherPlans: 'Other plans',
  },
}

const formatDuration = (days: number, lang: 'vi' | 'en'): string => {
  if (days % 30 === 0) {
    const months = days / 30
    return lang === 'en' ? `${months} month${months > 1 ? 's' : ''}` : `${months} tháng`
  }
  return lang === 'en' ? `${days} days` : `${days} ngày`
}

const getName = (plan: PlanPayloadPlan, lang: 'vi' | 'en') => (
  lang === 'vi' ? (plan.nameVi || plan.nameEn) : (plan.nameEn || plan.nameVi)
)

const getDescription = (plan: PlanPayloadPlan, lang: 'vi' | 'en') => (
  lang === 'vi' ? (plan.descriptionVi || plan.descriptionEn) : (plan.descriptionEn || plan.descriptionVi)
)

const getFeatures = (plan: PlanPayloadPlan, lang: 'vi' | 'en') => (
  lang === 'vi' ? (plan.featuresVi || plan.featuresEn || []) : (plan.featuresEn || plan.featuresVi || [])
)

const splitReasonItems = (reason?: string | string[]) => {
  if (Array.isArray(reason)) {
    return reason.map((item) => String(item).trim()).filter(Boolean).slice(0, 5)
  }
  if (!reason || typeof reason !== 'string') return []
  const normalized = reason
    .replace(/\s*\((\d+)\)\s*/g, '\n- ')
    .replace(/\s*(?:;|；)\s*/g, '\n- ')
    .replace(/\n\s*[-*•]\s*/g, '\n- ')
    .trim()

  const explicitItems = normalized
    .split(/\n\s*-\s+/)
    .map((item) => item.replace(/^-\s*/, '').trim())
    .filter(Boolean)

  if (explicitItems.length > 1) return explicitItems.slice(0, 5)

  return normalized
    .split(/(?<=[.!?。])\s+/)
    .map((item) => item.replace(/^-\s*/, '').trim())
    .filter((item) => item.length > 0 && item.length <= 180)
    .slice(0, 5)
}

export function PlanRecommendCard({ recommendedPlan, reason, conclusion, alternatives = [], lang = 'vi' }: Props) {
  const name = getName(recommendedPlan, lang)
  const description = getDescription(recommendedPlan, lang)
  const features = getFeatures(recommendedPlan, lang)
  const accentColor = recommendedPlan.color || 'var(--theme-accent)'
  const alternativePlans = alternatives.filter((plan) => String(plan._id) !== String(recommendedPlan._id)).slice(0, 2)
  const t = labels[lang]
  const reasonItems = splitReasonItems(reason)

  return (
    <div className="ai-plan-recommend">
      <div className="ai-plan-card ai-plan-recommend-card" style={{ '--plan-color': accentColor } as CSSProperties}>
        <div className="ai-plan-recommend-kicker">{t.recommended}</div>
        <div className="ai-plan-name ai-plan-recommend-name">{name}</div>
        <div className="ai-plan-price ai-plan-recommend-price">
          {t.price}: {recommendedPlan.price.toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN')}₫ / {t.duration}: {formatDuration(recommendedPlan.durationDays, lang)}
        </div>
        {conclusion && <div className="ai-plan-recommend-conclusion">{conclusion}</div>}
        {reasonItems.length > 0 && (
          <div className="ai-reason-box">
            <div className="ai-reason-title">{t.reasonTitle}</div>
            <ul>
              {reasonItems.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          </div>
        )}
        {description && <p className="ai-plan-recommend-desc"><strong>{t.description}: </strong>{description}</p>}
        {features.length > 0 && (
          <div className="ai-plan-recommend-benefits">
            <div className="ai-plan-recommend-label">{t.benefits}</div>
            {features.map((feature, i) => (
              <div key={i} className="ai-plan-benefit ai-plan-recommend-benefit">
                <span>✓</span>
                {feature}
              </div>
            ))}
          </div>
        )}
      </div>

      {alternativePlans.length > 0 && (
        <div className="ai-plan-recommend-others">
          <div className="ai-plan-recommend-other-title">{t.suggestedNext}</div>
          <MembershipPlanCards plans={alternativePlans} lang={lang} compact />
        </div>
      )}

      <style>{`
        .ai-plan-recommend {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 10px;
        }
        .ai-plan-card {
          background: color-mix(in srgb, var(--theme-card) 88%, white 6%);
          border: 1px solid var(--theme-border);
          border-radius: 14px;
          padding: 14px;
          color: var(--theme-text);
          box-shadow: 0 10px 28px rgba(0,0,0,0.28);
          min-width: 0;
          overflow-wrap: normal;
          word-break: normal;
        }
        .ai-plan-recommend-card {
          border-left: 4px solid var(--plan-color, var(--theme-accent));
          transition: transform 0.15s ease, border-color 0.15s ease;
        }
        .ai-plan-recommend-card:hover {
          border-color: var(--theme-accent);
          transform: translateY(-2px);
        }
        .ai-plan-recommend-kicker {
          color: var(--theme-accent);
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0;
          margin-bottom: 6px;
        }
        .ai-plan-recommend-label {
          color: var(--theme-accent);
          font-weight: 900;
          font-size: 12px;
          margin-bottom: 2px;
        }
        .ai-plan-name {
          color: var(--plan-color, var(--theme-text));
          font-weight: 900;
        }
        .ai-plan-recommend-name {
          font-size: 18px;
          line-height: 1.2;
          white-space: normal;
          word-break: keep-all;
        }
        .ai-plan-price {
          color: var(--theme-text);
          font-weight: 800;
        }
        .ai-plan-recommend-price {
          margin-top: 4px;
          font-size: 14px;
        }
        .ai-plan-recommend-conclusion {
          margin-top: 10px;
          font-size: 13px;
          font-weight: 800;
          line-height: 1.55;
          overflow-wrap: anywhere;
        }
        .ai-reason-title {
          color: var(--theme-text);
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 6px;
        }
        .ai-reason-box ul {
          margin: 0;
          padding-left: 18px;
        }
        .ai-plan-recommend-desc {
          margin: 10px 0 0;
          color: var(--theme-text);
          opacity: 0.84;
          font-size: 13px;
          line-height: 1.5;
        }
        .ai-plan-recommend-benefits {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--theme-border);
        }
        .ai-plan-recommend-benefit {
          display: flex;
          gap: 8px;
          color: var(--theme-text);
          opacity: 0.95;
          font-size: 13px;
          line-height: 1.45;
        }
        .ai-plan-recommend-benefit span {
          color: var(--plan-color, var(--theme-accent));
          font-weight: 900;
        }
        .ai-plan-recommend-other-title {
          color: var(--theme-text);
          opacity: 0.72;
          font-size: 12px;
          font-weight: 800;
          padding-bottom: 6px;
        }
      `}</style>
    </div>
  )
}
