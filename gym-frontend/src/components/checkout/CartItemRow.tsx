import { Typography } from 'antd'
import type { CartItem } from '../../types/member/cart'

const { Text } = Typography

interface CartItemRowProps {
  item: CartItem
}

function formatPrice(price: number) {
  return price.toLocaleString('vi-VN')
}

export default function CartItemRow({ item }: CartItemRowProps) {
  const lineTotal = item.price * item.quantity

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '10px 0',
        borderBottom: '1px solid var(--gs-border)',
      }}
    >
      <img
        src={item.image || '/placeholder.png'}
        alt={item.name}
        style={{
          width: 60,
          height: 60,
          borderRadius: 8,
          objectFit: 'cover',
          flexShrink: 0,
          background: '#ffffff0a',
        }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <Text
            strong
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--gs-text)',
              lineHeight: 1.4,
            }}
          >
            {item.name}
          </Text>
          <Text
            strong
            style={{
              fontSize: 14,
              color: 'var(--gs-text)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {formatPrice(lineTotal)}đ
          </Text>
        </div>

        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {item.brand && (
            <Text style={{ fontSize: 12, color: 'var(--gs-text-muted)' }}>
              {item.brand}
            </Text>
          )}
          {item.weight && (
            <span
              style={{
                display: 'inline-block',
                padding: '1px 6px',
                borderRadius: 4,
                fontSize: 11,
                lineHeight: '18px',
                background: 'var(--theme-accent-muted)',
                color: 'var(--theme-accent)',
              }}
            >
              {item.weight}
            </span>
          )}
        </div>

        <div style={{ marginTop: 4 }}>
          <Text style={{ fontSize: 12, color: 'var(--gs-text-muted)' }}>
            x{item.quantity}
          </Text>
        </div>
      </div>
    </div>
  )
}
