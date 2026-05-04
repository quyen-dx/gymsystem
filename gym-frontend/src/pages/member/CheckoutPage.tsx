import { Alert, Button, Card, Col, Form, Input, message, Modal, Radio, Row, Space, Spin, Tag, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MemberLayout from '../../components/layout/MemberLayout'
import { useCart } from '../../context/useCart'
import { useWallet } from '../../context/WalletProvider'
import { createAddress, getAddresses } from '../../services/addressService'
import { createOrder, calculateShipping as fetchShippingApi } from '../../services/orderService'
import { getWallet } from '../../services/walletService'

const { Text } = Typography

const parseWeightKg = (weight: any): number => {
  if (!weight) return 0
  if (typeof weight === 'number') return weight
  const s = String(weight).trim().toLowerCase()
  if (s.endsWith('kg')) return Number(s.replace(/kg$/, '').trim()) || 0
  if (s.endsWith('g')) return (Number(s.replace(/g$/, '').trim()) || 0) / 1000
  return Number(s) || 0
}

export default function CheckoutPage() {
  const [form] = Form.useForm()
  const { cart, setCart } = useCart()
  const { refreshWallet } = useWallet()
  const navigate = useNavigate()
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [addresses, setAddresses] = useState<any[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [addressModalOpen, setAddressModalOpen] = useState(false)
  const [addingAddress, setAddingAddress] = useState(false)

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  )

  const selectedAddress = addresses.find((a) => a._id === selectedAddressId) || addresses.find((a) => a.isDefault)

  const totalWeightKg = useMemo(
    () => cart.reduce((sum, item) => sum + parseWeightKg(item.weight) * item.quantity, 0),
    [cart],
  )

  const [shippingInfo, setShippingInfo] = useState({ shippingFee: 0, estimatedDays: 3, estimatedDeliveryDate: '' })
  const [isShippingLoading, setIsShippingLoading] = useState(false)

  useEffect(() => {
    if (!selectedAddress) return

    const delayDebounceFn = setTimeout(async () => {
      setIsShippingLoading(true)
      try {
        const res = await fetchShippingApi({
          address: selectedAddress,
          totalWeight: totalWeightKg,
          items: cart.map((item) => ({
            productId: item._id,
            quantity: item.quantity,
            weight: parseWeightKg(item.weight),
          })),
        })
        if (res.data?.success) {
          setShippingInfo({
            shippingFee: res.data.data.shippingFee,
            estimatedDays: res.data.data.estimatedDays,
            estimatedDeliveryDate: res.data.data.estimatedDeliveryDate
          })
        }
      } catch (error) {
        console.error('Failed to fetch shipping fee:', error)
      } finally {
        setIsShippingLoading(false)
      }
    }, 500)

    return () => clearTimeout(delayDebounceFn)
  }, [selectedAddress, totalWeightKg])

  const grandTotal = subtotal + shippingInfo.shippingFee

  // No longer manually calculating date because backend returns it

  const loadAddresses = async () => {
    try {
      const res = await getAddresses()
      setAddresses(res.data.data)
      const def = res.data.data.find((a: any) => a.isDefault)
      setSelectedAddressId(def?._id || res.data.data[0]?._id || null)
    } catch (e) { console.error(e) }
  }

  const loadWallet = async () => {
    try {
      const res = await getWallet()
      setWalletBalance(res.data.data.balance)
    } catch (e) { console.error(e) }
  }

  useEffect(() => { loadAddresses(); loadWallet() }, [])

  const handleCreateAddress = async (values: any) => {
    setAddingAddress(true)
    try {
      await createAddress({ ...values, isDefault: true })
      message.success('Đã lưu địa chỉ giao hàng')
      setAddressModalOpen(false)
      await loadAddresses()
    } catch (error: any) {
      message.error(error?.response?.data?.message || 'Không thể lưu địa chỉ')
    } finally {
      setAddingAddress(false)
    }
  }

  const handleSubmit = async () => {
    if (cart.length === 0) return message.error('Giỏ hàng đang trống')
    if (!selectedAddress) return message.error('Vui lòng thêm địa chỉ giao hàng')
    if (walletBalance !== null && walletBalance < grandTotal) {
      return message.error('Số dư ví không đủ để thanh toán. Vui lòng nạp thêm.')
    }

    setLoading(true)
    try {
      const orderPayload = {
        items: cart.map((item) => ({
          productId: item._id,
          sellerId: item.sellerId,
          name: item.name,
          productName: item.name,
          productImage: item.image,
          quantity: item.quantity,
          price: item.price,
          weight: item.weight || 0,
          variant: {
            weight: item.weight || '',
          },
        })),
        address: {
          recipientName: selectedAddress.fullName,
          phone: selectedAddress.phone,
          street: selectedAddress.street,
          ward: selectedAddress.ward,
          district: selectedAddress.district,
          city: selectedAddress.city,
        },
        paymentReference: `wallet_checkout_${Date.now()}`,
      }

      await createOrder(orderPayload)
      await refreshWallet()
      setCart([])
      message.success('Thanh toán thành công. Đơn hàng đã được tạo.')
      navigate('/dashboard/member/orders')
    } catch (error: any) {
      const originalMessage = error?.response?.data?.message || ''
      let errorMessage = 'Không thể thanh toán. Vui lòng thử lại.'
      if (originalMessage) {
        if (/insufficient|not enough|không đủ|balance/i.test(originalMessage)) {
          errorMessage = 'Số dư ví không đủ. Vui lòng nạp thêm.'
        } else {
          errorMessage = originalMessage
        }
      }
      message.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const renderAddressLine = (address: any) => {
    if (!address) return null
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text strong>{address.fullName}</Text>
          {address.isDefault && <Tag color="green">Mặc định</Tag>}
        </div>
        <div style={{ marginTop: 4 }}><Text>{address.phone}</Text></div>
        <div style={{ marginTop: 8, color: '#888' }}>
          {address.street}{address.ward ? `, ${address.ward}` : ''}
        </div>
        <div style={{ color: '#888' }}>{address.district}, {address.city}</div>
      </div>
    )
  }

  const notEnough = walletBalance !== null && walletBalance < grandTotal

  return (
    <MemberLayout>
      <div className="member-page">
      <Row gutter={[24, 24]}>
        <Col xs={24} md={16}>
          <Card title="Địa chỉ giao hàng" style={{ marginBottom: 24 }}>
            {selectedAddress ? renderAddressLine(selectedAddress) : (
              <div style={{ marginBottom: 16 }}>
                <Text type="danger">Chưa có địa chỉ giao hàng</Text>
              </div>
            )}
            <Space wrap>
              <Button type="primary" onClick={() => setAddressModalOpen(true)}>
                {selectedAddress ? 'Thay đổi' : 'Thêm địa chỉ'}
              </Button>
            </Space>
            {addresses.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">Chọn địa chỉ thanh toán</Text>
                <Radio.Group
                  style={{ display: 'block', marginTop: 12 }}
                  value={selectedAddressId}
                  onChange={(e) => setSelectedAddressId(e.target.value)}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {addresses.map((address) => (
                      <Radio key={address._id} value={address._id}>
                        <div>
                          <Text strong>{address.fullName}</Text>
                          <div>{address.phone}</div>
                          <div>
                            {address.street}{address.ward ? `, ${address.ward}` : ''}, {address.district}, {address.city}
                          </div>
                          {address.isDefault && <Tag color="green">Mặc định</Tag>}
                        </div>
                      </Radio>
                    ))}
                  </Space>
                </Radio.Group>
              </div>
            )}
          </Card>

          <Card title="Thông tin đơn hàng">
            <Row style={{ marginBottom: 12 }}>
              <Col span={12}><Text>Tiền hàng:</Text></Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                <Text strong>{subtotal.toLocaleString('vi-VN')}đ</Text>
              </Col>
            </Row>
            <Row style={{ marginBottom: 12 }}>
              <Col span={12}><Text>Phí vận chuyển:</Text></Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                {isShippingLoading ? (
                  <Spin size="small" />
                ) : (
                  <Text strong>{shippingInfo.shippingFee.toLocaleString('vi-VN')}đ</Text>
                )}
              </Col>
            </Row>
            
            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.1)',
              paddingTop: 12,
              marginTop: 4,
            }}>
              <Row>
                <Col span={12}><Text strong style={{ fontSize: 16 }}>Tổng cộng:</Text></Col>
                <Col span={12} style={{ textAlign: 'right' }}>
                  <Text strong style={{ fontSize: 20, color: '#b6462f' }}>
                    {grandTotal.toLocaleString('vi-VN')}đ
                  </Text>
                </Col>
              </Row>
            </div>
            <div style={{ marginTop: 12 }}>
              <Text type="secondary">Sử dụng số dư ví để thanh toán</Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card title="Tổng thanh toán">
            <Row style={{ marginBottom: 8 }}>
              <Col span={14}><Text>Giá hàng:</Text></Col>
              <Col span={10} style={{ textAlign: 'right' }}>
                <Text>{subtotal.toLocaleString('vi-VN')}đ</Text>
              </Col>
            </Row>
            <Row style={{ marginBottom: 8 }}>
              <Col span={14}><Text>Phí vận chuyển:</Text></Col>
              <Col span={10} style={{ textAlign: 'right' }}>
                {isShippingLoading ? '...' : <Text>{shippingInfo.shippingFee.toLocaleString('vi-VN')}đ</Text>}
              </Col>
            </Row>
            <Row style={{ marginBottom: 12 }}>
              <Col span={12}><Text>Dự kiến giao hàng:</Text></Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                {isShippingLoading ? '...' : (
                  <Text strong style={{ color: '#b6462f' }}>
                    {shippingInfo.estimatedDays === 1 ? 'Ngày mai' : `${shippingInfo.estimatedDays} ngày`}
                    {shippingInfo.estimatedDeliveryDate ? ` (${shippingInfo.estimatedDeliveryDate})` : ''}
                  </Text>
                )}
              </Col>
            </Row>
            <Row style={{ marginBottom: 16, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12 }}>
              <Col span={14}><Text strong>Tổng cộng:</Text></Col>
              <Col span={10} style={{ textAlign: 'right' }}>
                <Text strong style={{ color: '#b6462f', fontSize: 20 }}>
                  {grandTotal.toLocaleString('vi-VN')}đ
                </Text>
              </Col>
            </Row>
            <Row style={{ marginBottom: 8 }}>
              <Col span={14}><Text>Ví hiện tại:</Text></Col>
              <Col span={10} style={{ textAlign: 'right' }}>
                <Text strong style={{ color: notEnough ? '#ff4d4f' : '#52c41a', fontSize: '150%' }}>
                  {walletBalance !== null ? walletBalance.toLocaleString('vi-VN') + 'đ' : '...'}
                </Text>
              </Col>
            </Row>
            

            

            {notEnough && (
              <Alert
                type="error"
                showIcon
                message="Số dư ví không đủ"
                description={`Cần thêm ${(grandTotal - (walletBalance || 0)).toLocaleString('vi-VN')}đ`}
                style={{ marginBottom: 12 }}
              />
            )}

            <div style={{ marginBottom: 12 }}>
              <Text type={notEnough ? 'danger' : 'secondary'}>
                Thanh toán bằng ví nội bộ
              </Text>
            </div>
            <div className="member-responsive-actions" style={{ display: 'flex' }}>
            <Button
              type="primary"
              block
              size="large"
              loading={loading}
              onClick={handleSubmit}
              disabled={notEnough}
              style={{ background: notEnough ? undefined : '#b6462f', borderColor: notEnough ? undefined : '#b6462f', flex: '1 1 180px' }}
            >
              Thanh toán ngay
            </Button>
            <Button type="default" size="large" block style={{ flex: '1 1 140px' }}
              onClick={() => navigate('/dashboard/member/wallet/deposit')}>
              Nạp tiền vào ví
            </Button>
            </div>
            
          </Card>
        </Col>
      </Row>

      <Modal
        title="Thêm địa chỉ giao hàng"
        open={addressModalOpen}
        onCancel={() => setAddressModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateAddress}>
          <Form.Item name="fullName" label="Tên người nhận"
            rules={[{ required: true, message: 'Vui lòng nhập tên người nhận' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại"
            rules={[{ required: true }, { pattern: /^0\d{9,10}$/, message: 'Số điện thoại không hợp lệ' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="street" label="Địa chỉ cụ thể"
            rules={[{ required: true, message: 'Vui lòng nhập địa chỉ' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="ward" label="Phường / xã">
            <Input />
          </Form.Item>
          <Form.Item name="district" label="Quận / huyện"
            rules={[{ required: true, message: 'Vui lòng nhập quận / huyện' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="city" label="Tỉnh / thành phố"
            rules={[{ required: true, message: 'Vui lòng nhập tỉnh / thành phố' }]}>
            <Input />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={addingAddress}>Lưu địa chỉ</Button>
              <Button onClick={() => setAddressModalOpen(false)}>Hủy</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      </div>
    </MemberLayout>
  )
}
