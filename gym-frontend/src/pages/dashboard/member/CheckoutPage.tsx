import { Alert, Button, Card, Col, Form, Input, message, Modal, Radio, Row, Space, Tag, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import CartItemRow from '../../../components/checkout/CartItemRow'
import { useCart } from '../../../context/useCart'
import { useWallet } from '../../../context/WalletProvider'
import { createAddress, getAddresses } from '../../../services/addressService'
import { createOrder, calculateShipping as fetchShippingApi } from '../../../services/orderService'
import { getWallet } from '../../../services/walletService'

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
  const { t } = useTranslation()
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
      message.success(t('checkout.msg_address_saved'))
      setAddressModalOpen(false)
      await loadAddresses()
    } catch (error: any) {
      message.error(error?.response?.data?.message || t('checkout.msg_address_save_failed'))
    } finally {
      setAddingAddress(false)
    }
  }

  const handleSubmit = async () => {
    if (cart.length === 0) return message.error(t('checkout.msg_empty_cart'))
    if (!selectedAddress) return message.error(t('checkout.msg_no_address'))
    if (walletBalance !== null && walletBalance < grandTotal) {
      return message.error(t('checkout.msg_insufficient_balance'))
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
      message.success(t('checkout.msg_payment_success'))
      navigate('/orders')
    } catch (error: any) {
      const originalMessage = error?.response?.data?.message || ''
      let errorMessage = t('checkout.msg_payment_failed')
      if (originalMessage) {
        if (/insufficient|not enough|không đủ|balance/i.test(originalMessage)) {
          errorMessage = t('checkout.msg_insufficient_balance_short')
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
          {address.isDefault && <Tag color="green">{t('checkout.default')}</Tag>}
        </div>
        <div style={{ marginTop: 4 }}><Text>{address.phone}</Text></div>
        <div style={{ marginTop: 8, color: 'var(--theme-muted)' }}>
          {address.street}{address.ward ? `, ${address.ward}` : ''}
        </div>
        <div style={{ color: 'var(--theme-muted)' }}>{address.district}, {address.city}</div>
      </div>
    )
  }

  const notEnough = walletBalance !== null && walletBalance < grandTotal

  return (
    <MemberLayout>
      <div className="member-page">
        <Row gutter={[24, 24]}>
          <Col xs={24} md={16}>
            <Card title={t('checkout.delivery_address')} style={{ marginBottom: 24 }}>
              {selectedAddress ? renderAddressLine(selectedAddress) : (
                <div style={{ marginBottom: 16 }}>
                  <Text type="danger">{t('checkout.no_address')}</Text>
                </div>
              )}
              <Space wrap>
                <Button type="primary" onClick={() => setAddressModalOpen(true)}>
                  {selectedAddress ? t('checkout.change_address') : t('checkout.add_address')}
                </Button>
              </Space>
              {addresses.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Text type="secondary">{t('checkout.select_address')}</Text>
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
                            {address.isDefault && <Tag color="green">{t('checkout.default')}</Tag>}
                          </div>
                        </Radio>
                      ))}
                    </Space>
                  </Radio.Group>
                </div>
              )}
            </Card>

            <Card title={t('checkout.order_info')}>
              <div style={{ maxHeight: 420, overflowY: 'auto', marginBottom: 4 }}>
                {cart.length === 0 ? (
                  <Text style={{ color: 'var(--theme-muted)' }}>{t('checkout.empty_cart')}</Text>
                ) : (
                  cart.map((item) => (
                    <CartItemRow
                      key={item._id + (item.weight || '')}
                      item={item}
                    />
                  ))
                )}
              </div>
              {cart.length > 0 && (
                <div style={{
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                  paddingTop: 12,
                }}>
                  <Row>
                    <Col span={12}><Text>{t('checkout.subtotal')}</Text></Col>
                    <Col span={12} style={{ textAlign: 'right' }}>
                      <Text strong>{subtotal.toLocaleString('vi-VN')}đ</Text>
                    </Col>
                  </Row>
                </div>
              )}
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card title={t('checkout.payment_summary')}>
              <Row style={{ marginBottom: 8 }}>
                <Col span={14}><Text>{t('checkout.goods_total')}</Text></Col>
                <Col span={10} style={{ textAlign: 'right' }}>
                  <Text>{subtotal.toLocaleString('vi-VN')}đ</Text>
                </Col>
              </Row>
              <Row style={{ marginBottom: 8 }}>
                <Col span={14}><Text>{t('checkout.shipping_fee')}</Text></Col>
                <Col span={10} style={{ textAlign: 'right' }}>
                  {isShippingLoading ? '...' : <Text>{shippingInfo.shippingFee.toLocaleString('vi-VN')}đ</Text>}
                </Col>
              </Row>
              <Row style={{ marginBottom: 12 }}>
                <Col span={12}><Text>{t('checkout.estimated_delivery')}</Text></Col>
                <Col span={12} style={{ textAlign: 'right' }}>
                  {isShippingLoading ? '...' : (
                    <Text strong style={{ color: 'var(--theme-accent)' }}>
                      {shippingInfo.estimatedDays === 1 ? t('checkout.tomorrow') : t('checkout.days', { days: shippingInfo.estimatedDays })}
                      {shippingInfo.estimatedDeliveryDate ? ` (${shippingInfo.estimatedDeliveryDate})` : ''}
                    </Text>
                  )}
                </Col>
              </Row>
              <Row style={{ marginBottom: 16, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12 }}>
                <Col span={14}><Text strong>{t('checkout.grand_total')}</Text></Col>
                <Col span={10} style={{ textAlign: 'right' }}>
                  <Text strong style={{ color: 'var(--theme-accent)', fontSize: 20 }}>
                    {grandTotal.toLocaleString('vi-VN')}đ
                  </Text>
                </Col>
              </Row>
              <Row style={{ marginBottom: 8 }}>
                <Col span={14}><Text>{t('checkout.current_wallet')}</Text></Col>
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
                  message={t('checkout.insufficient_balance')}
                  description={t('checkout.needs_more', { amount: (grandTotal - (walletBalance || 0)).toLocaleString('vi-VN') })}
                  style={{ marginBottom: 12 }}
                />
              )}

              <div style={{ marginBottom: 12 }}>
                <Text type={notEnough ? 'danger' : 'secondary'}>
                  {t('checkout.pay_with_wallet')}
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
                  style={{ background: notEnough ? undefined : 'var(--theme-accent)', borderColor: notEnough ? undefined : 'var(--theme-accent)', flex: '1 1 180px' }}
                >
                  {t('checkout.pay_now')}
                </Button>
                <Button type="default" size="large" block style={{ flex: '1 1 140px' }}
                  onClick={() => navigate('/deposit')}>
                  {t('checkout.deposit')}
                </Button>
              </div>

            </Card>
          </Col>
        </Row>

        <Modal
          title={t('checkout.address_modal_title')}
          open={addressModalOpen}
          onCancel={() => setAddressModalOpen(false)}
          footer={null}
        >
          <Form form={form} layout="vertical" onFinish={handleCreateAddress}>
            <Form.Item name="fullName" label={t('checkout.form_full_name')}
              rules={[{ required: true, message: t('checkout.form_full_name_required') }]}>
              <Input />
            </Form.Item>
            <Form.Item name="phone" label={t('checkout.form_phone')}
              rules={[{ required: true }, { pattern: /^0\d{9,10}$/, message: t('checkout.form_phone_invalid') }]}>
              <Input />
            </Form.Item>
            <Form.Item name="street" label={t('checkout.form_street')}
              rules={[{ required: true, message: t('checkout.form_street_required') }]}>
              <Input />
            </Form.Item>
            <Form.Item name="ward" label={t('checkout.form_ward')}>
              <Input />
            </Form.Item>
            <Form.Item name="district" label={t('checkout.form_district')}
              rules={[{ required: true, message: t('checkout.form_district_required') }]}>
              <Input />
            </Form.Item>
            <Form.Item name="city" label={t('checkout.form_city')}
              rules={[{ required: true, message: t('checkout.form_city_required') }]}>
              <Input />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={addingAddress}>{t('checkout.form_save')}</Button>
                <Button onClick={() => setAddressModalOpen(false)}>{t('checkout.form_cancel')}</Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </MemberLayout>
  )
}
