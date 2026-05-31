import { Avatar, Card, Statistic, Table, Typography } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { getSellerOrders } from '../../../services/orderService'

const { Text, Title } = Typography
const formatMoney = (value = 0) => `${Number(value || 0).toLocaleString('vi-VN')}đ`

const getItemId = (item: any) => item.productId?._id || item.productId || item.productName || item.name || 'unknown'
const getItemImage = (item: any) => item.productImage || item.productId?.image || item.productId?.images?.[0] || ''
const getItemName = (item: any, fallback: string) => item.productName || item.name || item.productId?.name || fallback
const getItemVariant = (item: any) => item.variant?.weight || item.weight || ''

export default function SellerRevenuePage() {
  const { t } = useTranslation()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getSellerOrders()
      .then((res) => setOrders(res.data.data || []))
      .catch((error) => console.error(error))
      .finally(() => setLoading(false))
  }, [])

  const soldProducts = useMemo(() => {
    const map = new Map<string, any>()

    orders.forEach((order) => {
      ;(order.items || []).forEach((item: any) => {
        const variant = getItemVariant(item)
        const key = `${getItemId(item)}::${variant}`
        const quantity = Number(item.quantity || 0)
        const revenue = quantity * Number(item.price || 0)
        const current = map.get(key)

        if (current) {
          current.quantity += quantity
          current.revenue += revenue
          current.orderCount += 1
          return
        }

        map.set(key, {
          key,
          name: getItemName(item, t('seller_dashboard.product_fallback')),
          image: getItemImage(item),
          variant,
          price: Number(item.price || 0),
          quantity,
          revenue,
          orderCount: 1,
        })
      })
    })

    return Array.from(map.values()).sort((a, b) => b.quantity - a.quantity)
  }, [orders, t])

  const totalSold = soldProducts.reduce((sum, item) => sum + item.quantity, 0)
  const totalRevenue = soldProducts.reduce((sum, item) => sum + item.revenue, 0)

  const columns = [
    {
      title: t('seller_dashboard.product_sold'),
      render: (_: any, item: any) => (
        <div className="flex items-center gap-3">
          <Avatar shape="square" size={48} src={item.image || undefined}>{!item.image && item.name.charAt(0)}</Avatar>
          <div>
            <Text strong>{item.name}</Text>
            {item.variant && <div><Text type="secondary">{t('seller_dashboard.variant')}: {item.variant}</Text></div>}
          </div>
        </div>
      ),
    },
    { title: t('seller_dashboard.unit_price'), dataIndex: 'price', render: (value: number) => formatMoney(value) },
    { title: t('seller_dashboard.quantity_sold'), dataIndex: 'quantity', sorter: (a: any, b: any) => a.quantity - b.quantity },
    { title: t('seller_dashboard.order_lines'), dataIndex: 'orderCount' },
    { title: t('seller_dashboard.revenue'), dataIndex: 'revenue', render: (value: number) => formatMoney(value), sorter: (a: any, b: any) => a.revenue - b.revenue },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-4 p-4 max-[640px]:p-0">
        <div className="dashboard-hero rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Seller</p>
          <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">{t('seller_dashboard.revenue_title')}</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card><Statistic title={t('seller_dashboard.total_sold')} value={totalSold} /></Card>
          <Card><Statistic title={t('seller_dashboard.sold_product_types')} value={soldProducts.length} /></Card>
          <Card><Statistic title={t('seller_dashboard.total_revenue')} value={formatMoney(totalRevenue)} /></Card>
        </div>
        <Card className="max-[640px]:border-0 max-[640px]:bg-transparent">
          <Title level={4} style={{ marginTop: 0 }}>{t('seller_dashboard.sold_products_title')}</Title>
          <div className="member-scroll-x">
            <Table rowKey="key" loading={loading} dataSource={soldProducts} columns={columns} pagination={{ pageSize: 10 }} scroll={{ x: 760 }} />
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
