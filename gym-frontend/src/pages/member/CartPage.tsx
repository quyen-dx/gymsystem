import {
  Button,
  Card,
  Col,
  Empty,
  Row,
  InputNumber,
  Popconfirm,
  message
} from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import MemberLayout from '../../components/layout/MemberLayout'
import { useCart } from '../../context/useCart'
import { useTheme } from '../../context/ThemeProvider'
import type { CartItem } from '../../types/member/cart'

export default function CartPage() {
  const { cart, setCart } = useCart()
  const { dark } = useTheme()
  const panelBg = dark ? 'rgba(23,23,23,0.92)' : '#ffffff'
  const borderColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)'
  const mutedText = dark ? '#bbb' : '#666'

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
    message.success('Đã xóa khỏi giỏ hàng')
  }

  const total = cart.reduce(
    (sum: number, i: CartItem) => sum + i.price * i.quantity,
    0
  )

  const handleCheckout = () => {
    message.info('Tính năng thanh toán đang phát triển!')
  }

  return (
    <MemberLayout>
      <h2 style={{ marginBottom: 24 }}>
        Giỏ hàng của bạn ({cart.length} sản phẩm)
      </h2>

      {cart.length === 0 ? (
        <Empty description="Giỏ hàng trống" />
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
                      Trọng lượng: <b>{item.weight}</b>
                    </div>
                  )}

                  <div style={{ marginBottom: 8 }}>
                    Giá:{' '}
                    <b style={{ color: '#b6462f' }}>
                      {item.price.toLocaleString('vi-VN')}đ
                    </b>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 12
                    }}
                  >
                    <span>Số lượng:</span>
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
                    Thành tiền:{' '}
                    <b style={{ color: '#b6462f' }}>
                      {(item.price * item.quantity).toLocaleString('vi-VN')}đ
                    </b>
                  </div>

                  <Popconfirm
                    title="Xóa sản phẩm này khỏi giỏ?"
                    onConfirm={() => removeItem(item._id, item.weight)}
                    okText="Xóa"
                    cancelText="Hủy"
                  >
                    <Button danger icon={<DeleteOutlined />} block>
                      Xóa
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
              Tổng cộng:{' '}
              <b style={{ color: '#b6462f', fontSize: 24 }}>
                {total.toLocaleString('vi-VN')}đ
              </b>
            </div>

            <Button
              type="primary"
              size="large"
              onClick={handleCheckout}
            >
              Tiến hành thanh toán
            </Button>
          </div>
        </>
      )}
    </MemberLayout>
  )
}