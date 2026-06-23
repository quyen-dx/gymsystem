import { DeleteOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  Empty,
  Image,
  Input,
  InputNumber,
  Popconfirm,
  Spin,
  Tag,
  Tabs,
  Typography,
  message,
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { useCart } from '../../../context/useCart'
import { getMyOrders } from '../../../services/orderService'
import type { CartItem } from '../../../types/member/cart'

const { Text, Title } = Typography

const statusText: Record<string, string> = {
  pending: 'CHỜ XÁC NHẬN',
  paid: 'CHỜ XÁC NHẬN',
  processing: 'CHỜ XÁC NHẬN',
  shipped: 'ĐANG GIAO',
  delivered: 'HOÀN THÀNH',
  completed: 'HOÀN THÀNH',
  cancelled: 'ĐÃ HỦY',
  canceled: 'ĐÃ HỦY',
}

const statusColor: Record<string, string> = {
  pending: 'gold',
  paid: 'gold',
  processing: 'gold',
  shipped: 'blue',
  delivered: 'green',
  completed: 'green',
  cancelled: 'red',
  canceled: 'red',
}

const statusFilters: Array<{ key: string; labelKey: string; statuses: string[] }> = [
  { key: 'all', labelKey: 'cart.status_all', statuses: [] },
  { key: 'pending', labelKey: 'cart.status_pending', statuses: ['pending', 'paid', 'processing'] },
  { key: 'shipping', labelKey: 'cart.status_shipping', statuses: ['shipped'] },
  { key: 'completed', labelKey: 'cart.status_completed', statuses: ['delivered', 'completed'] },
  { key: 'cancelled', labelKey: 'cart.status_cancelled', statuses: ['cancelled', 'canceled'] },
]

const formatMoney = (value: number = 0) => `${Number(value || 0).toLocaleString('vi-VN')}đ`
const hasOrderItems = (order: any) => Array.isArray(order.items) && order.items.length > 0
const getOrderItemName = (item: any, fallback: string) => item.productName || item.name || item.productId?.name || fallback
const getOrderItemImage = (item: any) => item.productImage || item.productId?.image || item.productId?.images?.[0] || ''
const getOrderItemVariant = (item: any) => item.variant?.weight || item.weight || ''
const getOrderDate = (order: any) => order.createdAt || order.paidAt || order.updatedAt
const getOrderQuantity = (order: any) =>
  Array.isArray(order.items)
    ? order.items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0)
    : 0

export default function CartPage() {
  const { t } = useTranslation()
  const { cart, setCart } = useCart()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [orders, setOrders] = useState<any[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [activeStatus, setActiveStatus] = useState('all')
  const panelBg = 'var(--gs-card)'
  const borderColor = 'var(--gs-border)'
  const mutedText = 'var(--gs-text-muted)'
  const activeTab = searchParams.get('tab') === 'orders' ? 'orders' : 'cart'

  useEffect(() => {
    let mounted = true
    setOrdersLoading(true)
    getMyOrders()
      .then((response) => {
        if (mounted) setOrders(response.data.data || [])
      })
      .catch((error) => {
        console.error(error)
      })
      .finally(() => {
        if (mounted) setOrdersLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

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

  const visibleOrders = useMemo(() => orders.filter(hasOrderItems), [orders])
  const filteredOrders = useMemo(() => {
    const filter = statusFilters.find((item) => item.key === activeStatus)
    if (!filter || filter.key === 'all') return visibleOrders
    return visibleOrders.filter((order) => filter.statuses.includes(String(order.status || '').toLowerCase()))
  }, [activeStatus, visibleOrders])

  const handleTabChange = (key: string) => {
    setSearchParams(key === 'orders' ? { tab: 'orders' } : {})
  }

  const renderCartItems = () => (
    <div className="cart-shopping-grid">
      <div className="cart-product-list">
        {cart.length === 0 ? (
          <Card className="cart-panel">
            <Empty description={t('cart.empty')} />
          </Card>
        ) : (
          cart.map((item: CartItem) => (
            <Card className="cart-item-card" key={`${item._id}-${item.weight || ''}`}>
              <div className="cart-item-row">
                <div className="cart-item-image">
                  {item.image ? (
                    <img src={item.image} alt={item.name} />
                  ) : (
                    <div className="cart-item-image-fallback" />
                  )}
                </div>

                <div className="cart-item-main">
                  <Text strong className="cart-item-name">{item.name}</Text>
                  {item.weight ? (
                    <Text className="cart-item-meta">
                      {t('cart.weight')} <b>{item.weight}</b>
                    </Text>
                  ) : null}
                  <Text className="cart-item-meta">
                    {t('cart.price')} <b>{formatMoney(item.price)}</b>
                  </Text>
                </div>

                <div className="cart-item-actions">
                  <div className="cart-quantity-control">
                    <Text className="cart-label">{t('cart.quantity')}</Text>
                    <InputNumber
                      min={1}
                      max={item.stock || 99}
                      value={item.quantity}
                      onChange={(val) => updateQty(item._id, item.weight, val || 1)}
                      style={{ width: 88 }}
                    />
                  </div>
                  <Text strong className="cart-item-subtotal">
                    {formatMoney(item.price * item.quantity)}
                  </Text>
                  <Popconfirm
                    title={t('cart.confirm_delete_title')}
                    onConfirm={() => removeItem(item._id, item.weight)}
                    okText={t('cart.confirm_delete_ok')}
                    cancelText={t('cart.confirm_delete_cancel')}
                  >
                    <Button danger icon={<DeleteOutlined />}>
                      {t('cart.delete')}
                    </Button>
                  </Popconfirm>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <aside className="cart-checkout-panel">
        <Card className="cart-panel">
          <Title level={4} style={{ marginTop: 0 }}>{t('cart.payment_title')}</Title>
          <div className="cart-summary-line">
            <Text>{t('cart.total')}</Text>
            <Text strong className="cart-summary-total">{formatMoney(total)}</Text>
          </div>
          <div className="cart-voucher-box">
            <Text className="cart-label">{t('cart.voucher')}</Text>
            <Input placeholder={t('cart.voucher_placeholder')} />
          </div>
          <Button
            type="primary"
            size="large"
            block
            disabled={cart.length === 0}
            onClick={() => navigate('/checkout')}
          >
            {t('cart.checkout')}
          </Button>
        </Card>
      </aside>
    </div>
  )

  const renderOrders = () => (
    <Card className="cart-panel">
      <Tabs
        className="cart-status-tabs"
        activeKey={activeStatus}
        onChange={setActiveStatus}
        items={statusFilters.map((item) => ({ key: item.key, label: t(item.labelKey) }))}
      />

      {ordersLoading ? (
        <div className="cart-orders-loading">
          <Spin />
        </div>
      ) : filteredOrders.length === 0 ? (
        <Empty description={t('cart.orders_empty')} />
      ) : (
        <div className="cart-order-list">
          {filteredOrders.map((order) => {
            const orderDate = getOrderDate(order)
            const quantity = getOrderQuantity(order)
            const orderStatus = String(order.status || '').toLowerCase()
            return (
              <Card size="small" className="cart-order-card" key={order._id}>
                <div className="cart-order-content">
                  <div className="cart-order-products">
                    {order.items.slice(0, 3).map((item: any, index: number) => {
                      const image = getOrderItemImage(item)
                      const variant = getOrderItemVariant(item)
                      return (
                        <div className="cart-order-product" key={`${item.productId?._id || item.productId || index}-${variant}`}>
                          {image ? (
                            <Image src={image} width={56} height={56} style={{ objectFit: 'cover', borderRadius: 8 }} preview={false} />
                          ) : (
                            <div className="cart-order-image-fallback" />
                          )}
                          <div>
                            <Text strong>{getOrderItemName(item, t('order_history.product_fallback'))}</Text>
                            <div className="cart-order-meta">
                              <Text type="secondary">
                                x{item.quantity} - {formatMoney(item.price)}
                                {variant ? ` - ${variant}` : ''}
                              </Text>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {order.items.length > 3 ? (
                      <Text type="secondary">+{order.items.length - 3} {t('cart.more_products')}</Text>
                    ) : null}
                  </div>

                  <div className="cart-order-summary">
                    <div>
                      <Text type="secondary">{t('cart.purchase_date')}</Text>
                      <Text strong>{orderDate ? new Date(orderDate).toLocaleDateString('vi-VN') : '-'}</Text>
                    </div>
                    <div>
                      <Text type="secondary">{t('cart.order_quantity')}</Text>
                      <Text strong>{quantity}</Text>
                    </div>
                    <div>
                      <Text type="secondary">{t('cart.order_total')}</Text>
                      <Text strong>{formatMoney(order.totalAmount)}</Text>
                    </div>
                    <div>
                      <Text type="secondary">{t('cart.order_status')}</Text>
                      <Tag color={statusColor[orderStatus] || 'default'} style={{ width: 'fit-content', marginInlineEnd: 0 }}>
                        {statusText[orderStatus] || order.status}
                      </Tag>
                    </div>
                    <Link to={`/track/${order._id}`}>
                      <Button type="primary" ghost block>{t('cart.view_detail')}</Button>
                    </Link>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </Card>
  )

  return (
    <MemberLayout>
      <div className="member-page cart-page">
        <Tabs
          className="cart-main-tabs"
          activeKey={activeTab}
          onChange={handleTabChange}
          items={[
            {
              key: 'cart',
              label: t('cart.tab_cart'),
              children: (
                <>
                  <Title level={3} style={{ marginTop: 0 }}>
                    {t('cart.title', { count: cart.length })}
                  </Title>
                  {renderCartItems()}
                </>
              ),
            },
            {
              key: 'orders',
              label: t('cart.tab_orders'),
              children: renderOrders(),
            },
          ]}
        />
      </div>

      <style>{`
        .cart-page {
          max-width: 1180px;
          overflow-x: hidden;
        }

        .cart-main-tabs > .ant-tabs-nav,
        .cart-status-tabs > .ant-tabs-nav {
          margin-bottom: 20px;
          overflow-x: auto;
          overflow-y: hidden;
        }

        .cart-main-tabs .ant-tabs-nav-list,
        .cart-status-tabs .ant-tabs-nav-list {
          min-width: max-content;
        }

        .cart-shopping-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 360px;
          gap: 20px;
          align-items: start;
        }

        .cart-product-list,
        .cart-order-list {
          display: grid;
          gap: 14px;
          min-width: 0;
        }

        .cart-panel,
        .cart-item-card,
        .cart-order-card {
          background: ${panelBg};
          border: 1px solid ${borderColor};
          border-radius: 12px;
        }

        .cart-checkout-panel {
          position: sticky;
          top: 88px;
          min-width: 0;
        }

        .cart-item-row {
          display: grid;
          grid-template-columns: 108px minmax(0, 1fr) minmax(180px, 240px);
          gap: 16px;
          align-items: center;
        }

        .cart-item-image,
        .cart-item-image-fallback {
          width: 108px;
          height: 108px;
          border-radius: 10px;
          overflow: hidden;
          background: var(--theme-elevated);
        }

        .cart-item-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .cart-item-main,
        .cart-item-actions,
        .cart-order-summary {
          display: grid;
          gap: 8px;
          min-width: 0;
        }

        .cart-item-name {
          color: var(--gs-text);
          font-size: 16px;
          line-height: 1.4;
        }

        .cart-item-meta,
        .cart-label {
          color: ${mutedText};
        }

        .cart-quantity-control,
        .cart-summary-line {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .cart-item-subtotal,
        .cart-summary-total {
          color: var(--gs-text);
          font-size: 18px;
        }

        .cart-voucher-box {
          display: grid;
          gap: 8px;
          margin: 18px 0;
        }

        .cart-orders-loading {
          display: flex;
          justify-content: center;
          padding: 32px 0;
        }

        .cart-order-content {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 260px;
          gap: 18px;
          align-items: start;
        }

        .cart-order-products {
          display: grid;
          gap: 12px;
          min-width: 0;
        }

        .cart-order-product {
          display: grid;
          grid-template-columns: 56px minmax(0, 1fr);
          gap: 12px;
          align-items: center;
          min-width: 0;
        }

        .cart-order-image-fallback {
          width: 56px;
          height: 56px;
          border-radius: 8px;
          background: var(--theme-elevated);
        }

        .cart-order-meta {
          margin-top: 4px;
        }

        .cart-order-summary > div {
          display: grid;
          gap: 3px;
        }

        @media (max-width: 900px) {
          .cart-shopping-grid,
          .cart-order-content {
            grid-template-columns: 1fr;
          }

          .cart-checkout-panel {
            position: static;
            order: 2;
          }
        }

        @media (max-width: 640px) {
          .cart-page {
            padding-left: 12px;
            padding-right: 12px;
          }

          .cart-item-row {
            grid-template-columns: 84px minmax(0, 1fr);
            align-items: start;
          }

          .cart-item-image,
          .cart-item-image-fallback {
            width: 84px;
            height: 84px;
          }

          .cart-item-actions {
            grid-column: 1 / -1;
            grid-template-columns: 1fr;
          }

          .cart-quantity-control,
          .cart-summary-line {
            align-items: flex-start;
          }
        }
      `}</style>
    </MemberLayout>
  )
}
