import type { PlanPayloadPlan } from '../../types/aichat/aichat'

interface Props {
    plans: PlanPayloadPlan[]
    lang?: 'en' | 'vi'
}

export function PlanCompactList({ plans, lang = 'vi' }: Props) {
    if (!Array.isArray(plans) || plans.length === 0) return null

    return (
        <div className="plan-compact-list">
            {plans.slice(0, 12).map((p, idx) => {
                const name = p.nameVi
                const price = p.price != null ? `${Number(p.price).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN')}đ` : ''
                const duration = p.durationDays != null ? (lang === 'en' ? `${p.durationDays} days` : `${p.durationDays} ngày`) : ''
                const features = p.features || []
                const featureLine = features.filter(Boolean).slice(0, 6).map((f) => f.name).join(' · ')

                return (
                    <div key={p._id || idx} className="plan-compact-card">
                        <div className="plan-compact-title"><span className="plan-compact-index">{idx + 1}.</span> <span className="plan-compact-name">{name}</span></div>
                        <div className="plan-compact-row">
                            {price && <span className="plan-compact-label">{lang === 'en' ? 'Price:' : 'Giá:'}</span>}
                            {price && <span className="plan-compact-value">{price}</span>}
                            {price && duration && <span className="plan-compact-spacer" />}
                            {duration && <span className="plan-compact-label">{lang === 'en' ? 'Duration:' : 'Thời hạn:'}</span>}
                            {duration && <span className="plan-compact-value">{duration}</span>}
                        </div>
                        {featureLine ? (
                            <div className="plan-compact-row plan-compact-benefits">
                                <span className="plan-compact-label">{lang === 'en' ? 'Benefits:' : 'Quyền lợi:'}</span>
                                <span className="plan-compact-value">{featureLine}</span>
                            </div>
                        ) : null}
                    </div>
                )
            })}
        </div>
    )
}

export default PlanCompactList
