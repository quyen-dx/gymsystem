import type { CSSProperties } from 'react'
import type { PlanPayloadPlan } from '../../types/aichat/aichat'

interface Props {
  plans: PlanPayloadPlan[]
  excludeIds?: string[]
  lang?: 'vi' | 'en'
  compact?: boolean
}

const labels = {
  vi: {
    heading: 'Hiện GymPro có các gói sau:',
    benefits: 'Quyền lợi',
    price: 'Giá',
    duration: 'Thời hạn',
  },
  en: {
    heading: 'GymPro currently has these plans:',
    benefits: 'Benefits',
    price: 'Price',
    duration: 'Duration',
  },
}

const formatDuration = (days: number, lang: 'vi' | 'en'): string => {
  if (days % 30 === 0) {
    const months = days / 30
    return lang === 'en' ? `${months} month${months > 1 ? 's' : ''}` : `${months} tháng`
  }
  return lang === 'en' ? `${days} days` : `${days} ngày`
}

const getPlanText = (plan: PlanPayloadPlan, key: 'name' | 'description', lang: 'vi' | 'en') => (
  key === 'name'
    ? (lang === 'en' ? (plan.nameEn || plan.nameVi || '') : (plan.nameVi || plan.nameEn || ''))
    : (lang === 'en' ? (plan.descriptionEn || plan.descriptionVi || '') : (plan.descriptionVi || plan.descriptionEn || ''))
)

const getFeatures = (plan: PlanPayloadPlan, lang: 'vi' | 'en') => (
  lang === 'en'
    ? (Array.isArray(plan.featuresEn) && plan.featuresEn.length > 0 ? plan.featuresEn : Array.isArray(plan.featuresVi) ? plan.featuresVi : [])
    : Array.isArray(plan.featuresVi) && plan.featuresVi.length > 0
    ? plan.featuresVi
    : Array.isArray(plan.featuresEn) ? plan.featuresEn : []
)

export function MembershipPlanCards({ plans, excludeIds = [], lang = 'vi', compact = false }: Props) {
  const filtered = plans.filter((p) => !excludeIds.includes(String(p._id)))
  if (filtered.length === 0) return null
  const t = labels[lang]

  return (
    <>
      {!compact && !excludeIds.length && <div className="mpc-heading">{t.heading}</div>}
      <div className="mpc-wrapper">
        {filtered.map((plan) => {
          const name = getPlanText(plan, 'name', lang)
          const description = getPlanText(plan, 'description', lang)
          const features = getFeatures(plan, lang).slice(0, 3)
          const accent = plan.color || 'var(--theme-accent)'
          return (
            <div
              key={plan._id}
              className="ai-plan-card mpc-card"
              style={{ '--plan-color': accent } as CSSProperties}
            >
              <div className="mpc-accent-bar" />
              <div className="mpc-body">
                <div className="mpc-head">
                  <span className="ai-plan-name mpc-name">{name}</span>
                  <div className="mpc-meta">
                    <span className="ai-plan-price mpc-price">
                      {t.price}: {plan.price.toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN')}đ
                    </span>
                    <span className="mpc-duration">
                      {t.duration}: {formatDuration(plan.durationDays, lang)}
                    </span>
                  </div>
                </div>
                {description && <p className="mpc-desc">{description}</p>}
                {features.length > 0 && (
                  <div className="mpc-benefits">
                    {features.map((feature, i) => (
                      <div key={i} className="ai-plan-benefit mpc-benefit">
                        <span className="mpc-dot" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <style>{`
        .mpc-wrapper {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .mpc-heading {
          color: var(--theme-text);
          font-weight: 900;
          font-size: 14px;
          margin: 0 0 10px;
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
        .mpc-card {
          position: relative;
          display: flex;
          overflow: hidden;
          transition: transform 0.15s ease, border-color 0.15s ease;
        }
        .mpc-card:hover {
          transform: translateY(-2px);
          border-color: var(--theme-accent);
        }
        .mpc-accent-bar {
          width: 4px;
          border-radius: 999px;
          flex-shrink: 0;
          margin: 0 12px 0 0;
          background: var(--plan-color, var(--theme-accent));
        }
        .mpc-body {
          flex: 1;
          min-width: 0;
        }
        .mpc-head {
          display: grid;
          gap: 8px;
          min-width: 0;
        }
        .mpc-name {
          color: var(--plan-color, var(--theme-text));
          font-weight: 800;
          font-size: 15px;
          line-height: 1.4;
          white-space: normal;
          word-break: keep-all;
          overflow-wrap: normal;
        }
        .mpc-meta {
          display: grid;
          gap: 4px;
          min-width: 0;
        }
        .mpc-price {
          color: var(--theme-text) !important;
          font-weight: 700;
          white-space: normal;
          font-size: 13px;
          line-height: 1.35;
        }
        .mpc-duration {
          color: var(--theme-text);
          font-weight: 500;
          opacity: 0.7;
          font-size: 13px;
          line-height: 1.35;
        }
        .mpc-desc {
          margin: 8px 0 0;
          color: var(--theme-text);
          opacity: 0.78;
          font-size: 13px;
          line-height: 1.45;
        }
        .mpc-benefits {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin-top: 10px;
        }
        .mpc-benefit {
          display: flex;
          align-items: flex-start;
          gap: 7px;
          color: var(--theme-text);
          opacity: 0.95;
          font-size: 12.5px;
          line-height: 1.4;
        }
        .mpc-dot {
          width: 6px;
          height: 6px;
          margin-top: 6px;
          border-radius: 999px;
          flex: 0 0 auto;
          background: var(--plan-color, var(--theme-accent));
        }
      `}</style>
    </>
  )
}
