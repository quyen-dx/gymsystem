import type { CSSProperties } from 'react'
import type { PlanPayloadPlan } from '../../types/aichat/aichat'

interface Props {
  plans: PlanPayloadPlan[]
  conclusion?: string
  lang?: 'vi' | 'en'
}

const labels = {
  vi: {
    price: 'Giá',
    duration: 'Thời hạn',
    benefits: 'Quyền lợi',
    differences: 'Điểm khác nhau nổi bật',
  },
  en: {
    price: 'Price',
    duration: 'Duration',
    benefits: 'Benefits',
    differences: 'Key differences',
  },
}

const formatDuration = (days: number, lang: 'vi' | 'en'): string => {
  if (days % 30 === 0) {
    const months = days / 30
    return lang === 'en' ? `${months} month${months > 1 ? 's' : ''}` : `${months} tháng`
  }
  return lang === 'en' ? `${days} days` : `${days} ngày`
}

const planName = (plan: PlanPayloadPlan) => plan.nameVi

const planDescription = (plan: PlanPayloadPlan) => plan.descriptionVi

const planFeatures = (plan: PlanPayloadPlan) => plan.featuresVi || []

const suitability = (plan: PlanPayloadPlan, otherPlan: PlanPayloadPlan, lang: 'vi' | 'en') => {
  const featureCount = plan.featuresVi?.length || 0
  const otherFeatureCount = otherPlan.featuresVi?.length || 0
  if ((plan.price || 0) < (otherPlan.price || 0)) return lang === 'en' ? 'Best for saving cost or trying first.' : 'Phù hợp nếu muốn tiết kiệm hoặc tập thử.'
  if ((plan.durationDays || 0) > (otherPlan.durationDays || 0)) return lang === 'en' ? 'Best for longer commitment.' : 'Phù hợp nếu muốn tập lâu dài.'
  if (featureCount > otherFeatureCount) return lang === 'en' ? 'Best for more services and benefits.' : 'Phù hợp nếu muốn nhiều quyền lợi hơn.'
  return lang === 'en' ? 'Best if this plan matches your preferred benefits.' : 'Phù hợp nếu quyền lợi của gói đúng nhu cầu.'
}

export function CompareTwoPlansCard({ plans, conclusion, lang = 'vi' }: Props) {
  if (!plans || plans.length < 2) return null

  const planA = plans[0]
  const planB = plans[1]

  const nameA = planName(planA)
  const nameB = planName(planB)
  const descA = planDescription(planA)
  const descB = planDescription(planB)
  const featuresA = planFeatures(planA)
  const featuresB = planFeatures(planB)
  const t = labels[lang]

  const colorA = planA.color || 'var(--theme-accent)'
  const colorB = planB.color || 'var(--theme-accent)'

  const allFeatures = new Set<string>()
  if (Array.isArray(featuresA)) featuresA.forEach((f) => allFeatures.add(f))
  if (Array.isArray(featuresB)) featuresB.forEach((f) => allFeatures.add(f))

  return (
    <div className="ai-compare-two">
      <div className="ai-compare-two-cols">
        <div className="ai-plan-card ai-compare-two-plan" style={{ '--plan-color': colorA } as CSSProperties}>
          <div className="ai-plan-name ai-compare-two-name">{nameA}</div>
          <div className="ai-plan-price ai-compare-two-price">
            {t.price}: {planA.price.toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN')}₫
            <span className="ai-compare-two-dur"> / {t.duration}: {formatDuration(planA.durationDays, lang)}</span>
          </div>
          {descA && <div className="ai-compare-two-desc">{descA}</div>}
          {Array.isArray(featuresA) && featuresA.length > 0 && (
            <div className="ai-compare-two-list">
              {featuresA.map((feature, i) => (
                <div key={i} className="ai-plan-benefit ai-compare-two-benefit"><span>✓</span>{feature}</div>
              ))}
            </div>
          )}
          <div className="ai-compare-two-fit">{suitability(planA, planB, lang)}</div>
        </div>

        <div className="ai-plan-card ai-compare-two-plan" style={{ '--plan-color': colorB } as CSSProperties}>
          <div className="ai-plan-name ai-compare-two-name">{nameB}</div>
          <div className="ai-plan-price ai-compare-two-price">
            {t.price}: {planB.price.toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN')}₫
            <span className="ai-compare-two-dur"> / {t.duration}: {formatDuration(planB.durationDays, lang)}</span>
          </div>
          {descB && <div className="ai-compare-two-desc">{descB}</div>}
          {Array.isArray(featuresB) && featuresB.length > 0 && (
            <div className="ai-compare-two-list">
              {featuresB.map((feature, i) => (
                <div key={i} className="ai-plan-benefit ai-compare-two-benefit"><span>✓</span>{feature}</div>
              ))}
            </div>
          )}
          <div className="ai-compare-two-fit">{suitability(planB, planA, lang)}</div>
        </div>
      </div>

      {conclusion && <div className="ai-compare-two-conclusion">{conclusion}</div>}

      {allFeatures.size > 0 && (
        <div className="ai-compare-two-features">
          <div className="ai-compare-two-section-label">
            {t.differences}
          </div>
          {Array.from(allFeatures).map((feature, i) => {
            const hasA = Array.isArray(featuresA) && featuresA.includes(feature)
            const hasB = Array.isArray(featuresB) && featuresB.includes(feature)
            return (
              <div key={i} className="ai-compare-two-feature-row">
                <span className="ai-compare-two-feature-name">{feature}</span>
                <span className="ai-compare-two-feature-check" style={{ color: hasA ? 'var(--theme-accent)' : 'var(--theme-muted)' }}>
                  {hasA ? '✓' : '—'}
                </span>
                <span className="ai-compare-two-feature-check" style={{ color: hasB ? 'var(--theme-accent)' : 'var(--theme-muted)' }}>
                  {hasB ? '✓' : '—'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        .ai-compare-two {
          margin-top: 10px;
        }
        .ai-compare-two-cols {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
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
        .ai-compare-two-plan {
          border-left: 4px solid var(--plan-color, var(--theme-accent));
          transition: transform 0.15s ease, border-color 0.15s ease;
        }
        .ai-compare-two-plan:hover {
          transform: translateY(-2px);
          border-color: var(--theme-accent);
        }
        .ai-compare-two-name {
          color: var(--plan-color, var(--theme-text)) !important;
          font-weight: 800;
          font-size: 15px;
          margin-bottom: 2px;
          line-height: 1.4;
          white-space: normal;
          word-break: keep-all;
        }
        .ai-compare-two-price {
          color: var(--theme-text) !important;
          font-weight: 800;
          font-size: 13px;
          margin-bottom: 6px;
        }
        .ai-compare-two-dur {
          font-weight: 500;
          font-size: 11px;
          opacity: 0.8;
        }
        .ai-compare-two-desc {
          color: var(--theme-text) !important;
          opacity: 0.82;
          font-size: 12px;
          line-height: 1.5;
          margin-top: 8px;
        }
        .ai-compare-two-list {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid var(--theme-border);
        }
        .ai-compare-two-benefit {
          display: flex;
          gap: 7px;
          color: var(--theme-text);
          opacity: 0.95;
          font-size: 12px;
          line-height: 1.4;
        }
        .ai-compare-two-benefit span {
          color: var(--plan-color, var(--theme-accent));
          font-weight: 800;
        }
        .ai-compare-two-fit {
          margin-top: 10px;
          border-radius: 8px;
          background: var(--theme-accent-muted);
          color: var(--theme-accent);
          padding: 8px;
          font-size: 12px;
          font-weight: 700;
          line-height: 1.4;
        }
        .ai-compare-two-conclusion {
          margin-top: 10px;
          border: 1px solid var(--theme-accent-border);
          border-radius: 10px;
          background: var(--theme-accent-muted);
          color: var(--theme-accent);
          padding: 9px 10px;
          font-size: 12.5px;
          font-weight: 800;
          line-height: 1.45;
        }
        .ai-compare-two-features {
          margin-top: 10px;
          border: 1px solid var(--theme-border);
          border-radius: 12px;
          background: color-mix(in srgb, var(--theme-card) 82%, transparent);
          padding: 10px;
        }
        .ai-compare-two-section-label {
          color: var(--theme-text) !important;
          opacity: 0.74;
          font-size: 12.5px;
          font-weight: 800;
          margin-bottom: 6px;
        }
        .ai-compare-two-feature-row {
          display: grid;
          grid-template-columns: 1fr 28px 28px;
          gap: 4px;
          align-items: center;
          padding: 3px 0;
          border-bottom: 1px solid var(--theme-border);
        }
        .ai-compare-two-feature-name {
          color: var(--theme-text) !important;
          opacity: 0.86;
          font-size: 12px;
        }
        .ai-compare-two-feature-check {
          font-weight: 700;
          font-size: 14px;
          text-align: center;
        }
        @media (max-width: 640px) {
          .ai-compare-two-cols {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
