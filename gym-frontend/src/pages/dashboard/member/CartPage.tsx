import { DeleteOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  Empty,
  InputNumber,
  Popconfirm,
  Row,
  message
} from 'antd'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { useTheme } from '../../../context/ThemeProvider'
import { useCart } from '../../../context/useCart'
import type { CartItem } from '../../../types/member/cart'

export default function CartPage() {
  const { t } = useTranslation()
  const { cart, setCart } = useCart()
  const navigate = useNavigate()
  const { dark } = useTheme()
  const panelBg = 'var(--theme-card)'
  const borderColor = dark ? 'rgba(255,255,255,0.08)' : '#5a5a5a'
  const mutedText = dark ? '#bbb' : 'rgba(237,235,230,0.5)'

  const updateQty = (id: string, weight: string | undefined, qty: number) => {
    const w = weight || ''
    setCart((prev: CartItem[]) =>
      prev
        .map((i: CartItem) =>
          i._id === id && (i.weight || '') === w ? { ...i, quantity: qty } : i
        )
        .filter((i: CartItem) => i.quantity > 0)
    )
  }

  const removeItem = (id: string, weight: string | undefined) => {
    const w = weight || ''
    setCart((prev: CartItem[]) =>
      prev.filter((i: CartItem) => !(i._id === id && (i.weight || '') === w))
    )
    message.success(t('cart.removed'))
  }

  const total = cart.reduce(
    (sum: number, i: CartItem) => sum + i.price * i.quantity,
    0
  )

  const handleCheckout = () => {
    navigate('/checkout')
  }

  return (
    <MemberLayout>
      <div className="member-page">
        <h2 style={{ marginBottom: 24 }}>
          {t('cart.title', { count: cart.length })}
        </h2>

        {cart.length === 0 ? (
          <Empty description={t('cart.empty')} />
        ) : (
          <>
            <Row gutter={[16, 16]}>
              {cart.map((item: CartItem) => (
                <Col xs={24} sm={12} md={8} key={`${item._id}-${item.weight || ''}`}>
                  <Card
                    style={{
                      background: panelBg,
                      border: `1px solid ${borderColor}`,
                    }}
                    cover={
                      item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          style={{ height: 160, objectFit: 'cover' }}
                        />
                      ) : undefined
                    }
                  >
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>
                      {item.name}
                    </div>

                    {item.weight && (
                      <div style={{ marginBottom: 8, color: mutedText }}>
                        {t('cart.weight')} <b>{item.weight}</b>
                      </div>
                    )}

                    <div style={{ marginBottom: 8 }}>
                      {t('cart.price')}{' '}
                      <b style={{ color: 'var(--theme-accent)' }}>
                        {item.price.toLocaleString('vi-VN')}đ
                      </b>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span>{t('cart.quantity')}</span>
                      <InputNumber
                        min={1}
                        max={item.stock || 99}
                        value={item.quantity}
                        onChange={(val) =>
                          updateQty(item._id, item.weight, val || 1)
                        }
                        style={{ width: 80 }}
                      />
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      {t('cart.subtotal')}{' '}
                      <b style={{ color: 'var(--theme-accent)' }}>
                        {(item.price * item.quantity).toLocaleString('vi-VN')}đ
                      </b>
                    </div>

                    <Popconfirm
                      title={t('cart.confirm_delete_title')}
                      onConfirm={() => removeItem(item._id, item.weight)}
                      okText={t('cart.confirm_delete_ok')}
                      cancelText={t('cart.confirm_delete_cancel')}
                    >
                      <Button danger icon={<DeleteOutlined />} block>
                        {t('cart.delete')}
                      </Button>
                    </Popconfirm>
                  </Card>
                </Col>
              ))}
            </Row>

            <div
              style={{
                marginTop: 32,
                padding: 24,
                background: panelBg,
                border: `1px solid ${borderColor}`,
                borderRadius: 16,
                textAlign: 'right'
              }}
            >
              <div style={{ fontSize: 18, marginBottom: 16 }}>
                {t('cart.total')}{' '}
                <b style={{ color: 'var(--theme-accent)', fontSize: 24 }}>
                  {total.toLocaleString('vi-VN')}đ
                </b>
              </div>

              <Button
                type="primary"
                size="large"
                onClick={handleCheckout}
                style={{ width: 'min(100%, 280px)' }}
              >
                {t('cart.checkout')}
              </Button>
            </div>
          </>
        )}
      </div>
    </MemberLayout>
  )
}
