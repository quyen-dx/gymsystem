import type { CSSProperties } from 'react'
import type { PlanPayloadPlan } from '../../types/aichat/aichat'

interface Props {
  plan: PlanPayloadPlan
  lang?: 'vi' | 'en'
}

const formatDuration = (days: number, lang: 'vi' | 'en'): string => {
  if (days % 30 === 0) {
    const months = days / 30
    return lang === 'en' ? `${months} month${months > 1 ? 's' : ''}` : `${months} tháng`
  }
  return lang === 'en' ? `${days} days` : `${days} ngày`
}

const labels = {
  vi: {
    details: 'Thông tin chi tiết',
    description: 'Mô tả',
    benefits: 'Quyền lợi',
    price: 'Giá',
    duration: 'Thời hạn',
    register: 'Đăng ký gói',
    compare: 'So sánh gói',
    other: 'Xem gói khác',
  },
  en: {
    details: 'Plan details',
    description: 'Description',
    benefits: 'Benefits',
    price: 'Price',
    duration: 'Duration',
    register: 'Register plan',
    compare: 'Compare plans',
    other: 'View other plans',
  },
}

export function PlanDetailCard({ plan, lang = 'vi' }: Props) {
  const name = lang === 'vi' ? (plan.nameVi || plan.nameEn) : (plan.nameEn || plan.nameVi)
  const description = lang === 'vi' ? (plan.descriptionVi || plan.descriptionEn) : (plan.descriptionEn || plan.descriptionVi)
  const features = lang === 'vi' ? (plan.featuresVi || plan.featuresEn) : (plan.featuresEn || plan.featuresVi)
  const accentColor = plan.color || 'var(--theme-accent)'
  const t = labels[lang]

  return (
    <div className="ai-plan-card ai-plan-detail-card" style={{ '--plan-color': accentColor } as CSSProperties}>
      <div className="ai-plan-detail-kicker">{t.details}</div>
      <div className="ai-plan-detail-header">
        <span className="ai-plan-name ai-plan-detail-name">{name}</span>
        <span className="ai-plan-detail-pricing">
          {t.price}: {plan.price.toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN')}₫
          <span> / {t.duration}: {formatDuration(plan.durationDays, lang)}</span>
        </span>
      </div>

      {description && (
        <div className="ai-plan-detail-description">
          <div className="ai-plan-detail-label">{t.description}</div>
          {description}
        </div>
      )}

      {Array.isArray(features) && features.length > 0 && (
        <div className="ai-plan-detail-features">
          <div className="ai-plan-detail-label">{t.benefits}</div>
          {features.map((feature, i) => (
            <div key={i} className="ai-plan-benefit ai-plan-detail-feature-row">
              <span className="ai-plan-detail-check">&#10003;</span>
              <span>{feature}</span>
            </div>
          ))}
        </div>
      )}

      <div className="ai-plan-detail-actions" aria-label="Gợi ý thao tác">
        <span>{t.register}</span>
        <span>{t.compare}</span>
        <span>{t.other}</span>
      </div>

      <style>{`
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
        .ai-plan-card:hover {
          border-color: var(--theme-accent);
          transform: translateY(-2px);
        }
        .ai-plan-detail-card {
          margin-top: 10px;
          transition: transform 0.15s ease, border-color 0.15s ease;
        }
        .ai-plan-detail-kicker,
        .ai-plan-detail-label {
          color: var(--theme-accent);
          font-weight: 900;
          font-size: 12px;
          margin-bottom: 6px;
        }
        .ai-plan-detail-header {
          padding-left: 12px;
          border-left: 4px solid var(--plan-color, var(--theme-accent));
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .ai-plan-name {
          color: var(--plan-color, var(--theme-text));
          font-weight: 900;
        }
        .ai-plan-detail-name {
          font-size: 17px;
          line-height: 1.4;
          white-space: normal;
          word-break: keep-all;
        }
        .ai-plan-detail-pricing {
          color: var(--theme-text) !important;
          font-weight: 800;
          font-size: 14px;
        }
        .ai-plan-detail-description {
          padding-top: 12px;
          color: var(--theme-text) !important;
          opacity: 0.86;
          font-size: 14px;
          line-height: 1.6;
        }
        .ai-plan-detail-features {
          padding-top: 12px;
          margin-top: 12px;
          border-top: 1px solid var(--theme-border);
        }
        .ai-plan-detail-feature-row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 4px 0;
          color: var(--theme-text) !important;
          opacity: 0.95;
          font-size: 13.5px;
          line-height: 1.5;
        }
        .ai-plan-detail-check {
          color: var(--plan-color, var(--theme-accent)) !important;
          font-weight: 700;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .ai-plan-detail-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
        }
        .ai-plan-detail-actions span {
          border: 1px solid var(--theme-accent-border);
          border-radius: 999px;
          background: var(--theme-accent-muted);
          color: var(--theme-accent);
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 700;
          line-height: 1;
        }
      `}</style>
    </div>
  )
}
