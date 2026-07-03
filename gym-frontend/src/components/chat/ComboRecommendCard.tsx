import type { SmartRecommendPayload, PlanPayloadPlan } from '../../types/aichat/aichat'

interface Props {
  data: SmartRecommendPayload
  lang?: 'vi' | 'en'
}

const GOAL_EMOJI: Record<string, string> = {
  muscle_gain: '💪',
  fat_loss: '🔥',
  weight_gain: '📈',
  endurance: '🏃',
  general_fitness: '⭐',
}

export function ComboRecommendCard({ data, lang: propLang }: Props) {
  const lang = propLang || 'vi'

  const fmtPrice = (price: number) => `${price.toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN')}₫`

  const plan = data.recommendedPlan as (PlanPayloadPlan & { reason?: string[]; score?: number }) | null
  const pt = data.recommendedPT
  const product = data.recommendedProduct

  return (
    <div className="smart-recommend-card" style={{ marginTop: 12 }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{GOAL_EMOJI[data.goal] || '🎯'}</span>
        <span>{lang === 'en' ? 'Smart Recommendation' : 'Gợi ý thông minh'}</span>
        <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.6, marginLeft: 'auto' }}>{data.goalLabel}</span>
      </div>

      <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 14, lineHeight: 1.6 }}>{data.summary}</p>

      <div style={{ display: 'grid', gap: 10 }}>
        {plan && (
          <div className="ai-plan-row" style={{ borderLeft: `4px solid ${plan.color || '#3B82F6'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="ai-plan-name" style={{ fontSize: 14 }}>
                  {lang === 'en' ? plan.nameEn || plan.nameVi : plan.nameVi || plan.nameEn}
                </div>
                <div className="ai-plan-price" style={{ fontSize: 13 }}>{fmtPrice(plan.price)} / {lang === 'en' ? `${plan.durationDays} days` : `${plan.durationDays} ngày`}</div>
              </div>
              {plan.score && (
                <span style={{ fontSize: 11, fontWeight: 600, color: plan.score >= 80 ? '#22c55e' : plan.score >= 60 ? '#eab308' : '#ef4444', background: plan.score >= 80 ? '#052e16' : plan.score >= 60 ? '#422006' : '#450a0a', padding: '2px 8px', borderRadius: 10 }}>
                  {plan.score}%
                </span>
              )}
            </div>
            {plan.reason && plan.reason.length > 0 && (
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{plan.reason[0]}</div>
            )}
            {Array.isArray(plan.featuresVi) && plan.featuresVi.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(lang === 'en' ? plan.featuresEn || plan.featuresVi : plan.featuresVi || plan.featuresEn)?.slice(0, 3).map((f, i) => (
                  <span key={i} style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.08)' }}>{f}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {pt && (
          <div className="ai-plan-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: pt.avatar ? `url(${pt.avatar}) center/cover` : '#333', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="ai-plan-name" style={{ fontSize: 14 }}>{pt.name}</div>
              {pt.specialties && pt.specialties.length > 0 && (
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{pt.specialties.slice(0, 3).join(' · ')}</div>
              )}
              <div style={{ fontSize: 11, opacity: 0.5, marginTop: 1 }}>
                {pt.rating ? `${pt.rating}/5` : ''}
                {pt.experienceYears ? ` · ${pt.experienceYears} ${lang === 'en' ? 'yrs' : 'năm'}` : ''}
                {pt.totalSessions ? ` · ${pt.totalSessions} sessions` : ''}
              </div>
              {pt.reason && pt.reason.length > 0 && (
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2, color: '#22c55e' }}>{pt.reason[0]}</div>
              )}
            </div>
            {pt.score && (
              <span style={{ fontSize: 11, fontWeight: 600, color: pt.score >= 80 ? '#22c55e' : '#eab308', padding: '2px 8px', borderRadius: 10, background: pt.score >= 80 ? '#052e16' : '#422006' }}>
                {pt.score}%
              </span>
            )}
          </div>
        )}

        {product && (
          <div className="ai-plan-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: product.image ? `url(${product.image}) center/cover` : '#333', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="ai-plan-name" style={{ fontSize: 14 }}>{product.name}</div>
              <div className="ai-plan-price" style={{ fontSize: 13 }}>{fmtPrice(product.price)}</div>
              {product.reason && product.reason.length > 0 && (
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2, color: '#22c55e' }}>{product.reason[0]}</div>
              )}
            </div>
            {product.score && (
              <span style={{ fontSize: 11, fontWeight: 600, color: product.score >= 80 ? '#22c55e' : '#eab308', padding: '2px 8px', borderRadius: 10, background: product.score >= 80 ? '#052e16' : '#422006' }}>
                {product.score}%
              </span>
            )}
          </div>
        )}
      </div>

      {data.alternatives && (data.alternatives.plans.length > 0 || data.alternatives.pts.length > 0 || data.alternatives.products.length > 0) && (
        <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, opacity: 0.7 }}>
            {lang === 'en' ? 'Alternatives' : 'Lựa chọn thay thế'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {data.alternatives.plans.slice(0, 2).map((p) => (
              <span key={p._id} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'rgba(255,255,255,0.08)' }}>
                {lang === 'en' ? p.nameEn || p.nameVi : p.nameVi || p.nameEn}
              </span>
            ))}
            {data.alternatives.pts.slice(0, 1).map((p) => (
              <span key={p._id} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'rgba(255,255,255,0.08)' }}>
                {p.name}
              </span>
            ))}
            {data.alternatives.products.slice(0, 1).map((p) => (
              <span key={p._id} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'rgba(255,255,255,0.08)' }}>
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
