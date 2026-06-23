import { Avatar, Card, Descriptions, Empty, Spin, Typography, message } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { useAuth } from '../../../hooks/useAuth'
import { getMyShop } from '../../../services/shopService'

const { Text, Title } = Typography

export default function SellerShopPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [shop, setShop] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyShop()
      .then((res) => setShop(res.data.shop))
      .catch((err) => message.error(err.response?.data?.message || t('seller_dashboard.shop_load_failed')))
      .finally(() => setLoading(false))
  }, [])

  return (
    <DashboardLayout>
      <div className="p-4 max-[640px]:p-0">
        <Card className="max-[640px]:border-0 max-[640px]:bg-transparent">
          <Title level={4} style={{ marginTop: 0 }}>{t('seller_dashboard.shop_title')}</Title>
          {loading ? (
            <div className="grid min-h-48 place-items-center"><Spin /></div>
          ) : !shop ? (
            <Empty description={t('seller_dashboard.shop_empty')} />
          ) : (
            <div className="grid gap-6 md:grid-cols-[220px_1fr]">
              <div className="rounded-2xl border border-[var(--gs-border)] bg-[var(--gs-page)] p-5 text-center">
                <Avatar size={96} src={user?.avatar || shop.avatar || undefined}>{shop.name?.charAt(0) || 'S'}</Avatar>
                <Title level={5} style={{ marginBottom: 4 }}>{shop.name || t('seller_dashboard.shop_name_fallback')}</Title>
                <Text type="secondary">{shop.description || t('seller_dashboard.description_empty')}</Text>
              </div>
              <Descriptions bordered column={1} size="middle">
                <Descriptions.Item label={t('seller_dashboard.field_name')}>{shop.name || '-'}</Descriptions.Item>
                <Descriptions.Item label={t('seller_dashboard.field_description')}>{shop.description || '-'}</Descriptions.Item>
                <Descriptions.Item label={t('seller_dashboard.field_address')}>
                  {[shop.address?.detail, shop.address?.ward, shop.address?.district, shop.address?.province].filter(Boolean).join(', ') || '-'}
                </Descriptions.Item>
                <Descriptions.Item label={t('seller_dashboard.field_status')}>{shop.status || shop.isActive ? t('seller_dashboard.status_active') : t('seller_dashboard.status_inactive')}</Descriptions.Item>
              </Descriptions>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  )
}
