export interface RichResponseCard {
  id: string
  type: string
  title: string
  subtitle?: string
  status?: string | null
  icon?: string
  data?: Record<string, unknown>
  actions?: Array<{ label: string; type: string; path?: string }>
  deeplink?: string
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#22c55e',
  PENDING: '#f59e0b',
  RENEWING: '#3b82f6',
  CANCELLED: '#ef4444',
  EXPIRED: '#94a3b8',
  NONE: '#94a3b8',
  unread: '#ef4444',
  confirmed: '#22c55e',
}

export function AICardRenderer({ cards }: { cards: RichResponseCard[] }) {
  if (!cards || cards.length === 0) return null
  return (
    <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
      {cards.map((card) => {
        const statusColor = card.status ? STATUS_COLORS[card.status] : undefined
        return (
          <div
            key={card.id}
            className="ai-plan-row"
            style={{ cursor: card.deeplink ? 'pointer' : undefined, position: 'relative', animation: 'cardScaleIn 0.25s ease' }}
            onClick={card.deeplink ? () => (window.location.href = card.deeplink) : undefined}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              {card.icon && <span style={{ fontSize: 20 }}>{card.icon}</span>}
              <span className="ai-plan-name" style={{ flex: 1 }}>{card.title}</span>
              {card.status && statusColor && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                  background: `${statusColor}22`, color: statusColor,
                }}>
                  {card.status}
                </span>
              )}
            </div>
            {card.subtitle && <div className="ai-plan-price" style={{ fontSize: 13, opacity: 0.72, marginBottom: 6 }}>{card.subtitle}</div>}
            {card.actions && card.actions.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {card.actions.slice(0, 3).map((action, i) => (
                  <span
                    key={`${card.id}-${i}`}
                    style={{
                      fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                      background: 'var(--theme-accent-muted, color-mix(in srgb, var(--theme-accent) 12%, transparent))',
                      color: 'var(--theme-text)', cursor: 'pointer',
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (action.path) window.location.href = action.path
                    }}
                  >
                    {action.label}
                  </span>
                ))}
              </div>
            )}
            {card.deeplink && (
              <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, opacity: 0.6 }}>
                Xem chi tiết →
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
