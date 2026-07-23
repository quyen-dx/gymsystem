import type { CSSProperties } from 'react'
import type { PlanPayloadPlan } from '../../types/aichat/aichat'

interface Props {
  plans: PlanPayloadPlan[]
  lang?: 'vi' | 'en'
}

const labels = {
  vi: {
    heading: 'Hiện GymPro có các gói sau:',
    price: 'Giá',
    duration: 'Thời hạn',
    description: 'Mô tả',
    benefits: 'Quyền lợi',
  },
  en: {
    heading: 'GymPro currently has these plans:',
    price: 'Price',
    duration: 'Duration',
    description: 'Description',
    benefits: 'Benefits',
  },
}

const formatDuration = (days: number, lang: 'vi' | 'en'): string => {
  if (days % 30 === 0) {
    const months = days / 30
    return lang === 'en' ? `${months} month${months > 1 ? 's' : ''}` : `${months} tháng`
  }
  return lang === 'en' ? `${days} days` : `${days} ngày`
}

export function PlanCompareTable({ plans, lang = 'vi' }: Props) {
  if (!plans || plans.length === 0) return null
  const t = labels[lang]

  return (
    <>
      <div className="ai-plan-compare-heading">{t.heading}</div>
      <div className="ai-plan-compare">
        {plans.map((plan) => {
        const name = plan.nameVi
        const description = plan.descriptionVi
        const features = plan.features || []
        const accentColor = plan.color || 'var(--theme-accent)'

        return (
          <div key={plan._id} className="ai-plan-card ai-plan-compare-card" style={{ '--plan-color': accentColor } as CSSProperties}>
            <div className="ai-plan-name ai-plan-compare-name">{name}</div>
            <div className="ai-plan-price ai-plan-compare-price">
              {t.price}: {plan.price.toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN')}₫
              <span className="ai-plan-compare-dur"> / {t.duration}: {formatDuration(plan.durationDays, lang)}</span>
            </div>

            {description && (
              <div className="ai-plan-compare-desc"><strong>{t.description}: </strong>{description}</div>
            )}

            {Array.isArray(features) && features.length > 0 && (
              <div className="ai-plan-compare-features">
                {features.map((f, i) => (
                  <div key={i} className="ai-plan-compare-feature">
                    <span className="ai-plan-compare-bullet">&#10003;</span> {f.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
      </div>

      <style>{`
        .ai-plan-compare-heading {
          color: var(--theme-text);
          font-weight: 900;
          font-size: 14px;
          margin: 0 0 10px;
        }
        .ai-plan-compare {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
          gap: 10px;
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
        .ai-plan-card:hover {
          border-color: var(--theme-accent);
          transform: translateY(-2px);
        }
        .ai-plan-compare-card {
          border-left: 4px solid var(--plan-color, var(--theme-accent));
          transition: transform 0.15s ease, border-color 0.15s ease;
        }
        .ai-plan-compare-name {
          color: var(--plan-color, var(--theme-text)) !important;
          font-weight: 800;
          font-size: 15px;
          margin-bottom: 2px;
          line-height: 1.4;
          white-space: normal;
          word-break: keep-all;
        }
        .ai-plan-compare-price {
          color: var(--theme-text) !important;
          font-weight: 800;
          font-size: 14px;
          margin-bottom: 8px;
        }
        .ai-plan-compare-dur {
          font-weight: 500;
          font-size: 12.5px;
          opacity: 0.8;
        }
        .ai-plan-compare-desc {
          color: var(--theme-text) !important;
          opacity: 0.84;
          font-size: 13px;
          line-height: 1.5;
          margin-bottom: 6px;
          padding-top: 6px;
          border-top: 1px solid var(--theme-border);
        }
        .ai-plan-compare-features {
          padding-top: 4px;
        }
        .ai-plan-compare-feature {
          color: var(--theme-text) !important;
          opacity: 0.9;
          font-size: 12.5px;
          padding: 2px 0;
          line-height: 1.5;
        }
        .ai-plan-compare-bullet {
          color: var(--plan-color, var(--theme-accent)) !important;
          font-weight: 700;
          margin-right: 4px;
        }
      `}</style>
    </>
  )
}
