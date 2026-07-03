import { Avatar, Card, Descriptions, Empty, Spin, Typography, message } from 'antd'
import { useEffect, useState } from 'react'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { useAuth } from '../../../hooks/useAuth'
import { getMyShop } from '../../../services/shopService'

const { Text, Title } = Typography

export default function SellerShopPage() {
  const { user } = useAuth()
  const [shop, setShop] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMyShop()
      .then((res) => setShop(res.data.shop))
      .catch((err) => message.error(err.response?.data?.message || 'Tải thông tin cửa hàng thất bại'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <DashboardLayout>
      <div className="p-4 max-[640px]:p-0">
        <Card className="max-[640px]:border-0 max-[640px]:bg-transparent">
          <Title level={4} style={{ marginTop: 0 }}>Cửa hàng của tôi</Title>
          {loading ? (
            <div className="grid min-h-48 place-items-center"><Spin /></div>
          ) : !shop ? (
            <Empty description="Chưa có thông tin cửa hàng" />
          ) : (
            <div className="grid gap-6 md:grid-cols-[220px_1fr]">
              <div className="rounded-2xl border border-[var(--gs-border)] bg-[var(--gs-page)] p-5 text-center">
                <Avatar size={96} src={user?.avatar || shop.avatar || undefined}>{shop.name?.charAt(0) || 'S'}</Avatar>
                <Title level={5} style={{ marginBottom: 4 }}>{shop.name || 'Cửa hàng'}</Title>
                <Text type="secondary">{shop.description || 'Chưa có mô tả'}</Text>
              </div>
              <Descriptions bordered column={1} size="middle">
                <Descriptions.Item label="Tên cửa hàng">{shop.name || '-'}</Descriptions.Item>
                <Descriptions.Item label="Mô tả">{shop.description || '-'}</Descriptions.Item>
                <Descriptions.Item label="Địa chỉ">
                  {[shop.address?.detail, shop.address?.ward, shop.address?.district, shop.address?.province].filter(Boolean).join(', ') || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Trạng thái">{shop.status || shop.isActive ? 'Hoạt động' : 'Ngừng hoạt động'}</Descriptions.Item>
              </Descriptions>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  )
}
