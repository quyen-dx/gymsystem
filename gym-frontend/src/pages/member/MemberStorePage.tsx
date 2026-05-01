import { Avatar, Button, Card, Col, Empty, Input, Rate, Row, Spin, Tag, message } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import MemberLayout from '../../components/layout/MemberLayout'
import { getProducts, getShopProducts } from '../../services/productService'
import type { MemberProduct, ProductShop } from '../../types/member/product'

export default function MemberStorePage() {
  const { shopId } = useParams()
  const [products, setProducts] = useState<MemberProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    const request = shopId ? getShopProducts(shopId) : getProducts()
    request
      .then((res) => setProducts(res.data.products || res.data))
      .catch(() => message.error('Không thể tải sản phẩm'))
      .finally(() => setLoading(false))
  }, [shopId])
const containerStyle: React.CSSProperties = {
  maxWidth: 1280,
  margin: '0 auto',
  padding: '0 16px',
}
  const firstShop = products
    .map((product) => product.shop_id)
    .find((shop): shop is ProductShop => typeof shop === 'object' && !!shop)
  const shopOwner = firstShop?.user_id
  const shopName = shopOwner?.name || firstShop?.name || 'Shop'
  const shopAvatar = shopOwner?.avatar || firstShop?.avatar
  const shopDescription = firstShop?.description

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <MemberLayout>
      <div style={containerStyle}>
      {shopId ? (
        <div className="mb-8 rounded-2xl border border-[var(--gs-border)] bg-[rgba(23,23,23,0.92)] p-6">
          <Button type="text" onClick={() => navigate('/dashboard/member/store')} className="mb-4">
            Quay lại cửa hàng
          </Button>
          <div className="flex items-center gap-4">
            <Avatar size={72} src={shopAvatar}>
              {shopName.charAt(0)}
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">{shopName}</h1>
              <p className="mt-1 text-sm text-[var(--gs-text-muted)]">
                {shopDescription || `Tất cả sản phẩm của ${shopName}`}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full h-[220px] mb-8 rounded-2xl overflow-hidden relative">
          <img
            src="https://images.unsplash.com/photo-1558611848-73f7eb4001a1?q=80&w=1600"
            className="w-full h-full object-cover"
            alt="banner"
          />
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute top-1/2 left-8 -translate-y-1/2 text-white">
            <h1 className="text-3xl font-extrabold">Gym Store</h1>
            <p className="mt-2 opacity-90">Dụng cụ tập luyện chính hãng - Giá tốt mỗi ngày</p>
            <Button type="primary" size="large" className="mt-4 !bg-[#b6462f] border-none">
              Mua ngay
            </Button>
          </div>
        </div>
      )}

      <Input.Search
        placeholder="Tìm sản phẩm..."
        allowClear
        className="max-w-md mb-6"
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <div className="text-center my-10"><Spin size="large" /></div>
      ) : filtered.length === 0 ? (
        <Empty description="Không có sản phẩm" />
      ) : (
        <Row gutter={[16, 16]}>
          {filtered.map((product) => (
            <Col xs={24} sm={12} md={8} lg={6} key={product._id}>
              <Card
                hoverable
                onClick={() => navigate(`/dashboard/member/store/${product._id}`)}
                className="rounded-xl overflow-hidden"
                cover={
                  product.image ? (
                    <img src={product.image} className="h-[200px] w-full object-cover" alt={product.name} />
                  ) : (
                    <div className="h-[200px] flex items-center justify-center bg-gray-100 text-gray-400">
                      No image
                    </div>
                  )
                }
              >
                <div className="font-bold text-base mb-1">{product.name}</div>

                {product.rating && product.rating > 0 ? (
                  <div className="flex items-center gap-2 mb-1">
                    <Rate disabled allowHalf value={product.rating} style={{ fontSize: 14 }} />
                    <span className="text-[#b6462f] text-sm font-medium">
                      {product.rating.toFixed(1)}
                    </span>
                    <span className="text-gray-400 text-xs">
                      ({product.reviewCount || 0})
                    </span>
                  </div>
                ) : (
                  <div className="text-gray-400 text-xs mb-1">
                    Chưa có đánh giá
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-[#b6462f] font-bold text-lg">
                    {product.price?.toLocaleString('vi-VN')}đ
                  </span>
                  <Tag color={product.stock && product.stock > 0 ? 'green' : 'red'}>
                    {product.stock && product.stock > 0 ? `Còn ${product.stock}` : 'Hết hàng'}
                  </Tag>
                </div>

                {product.category && (
                  <Tag className="mt-2 rounded-md font-medium" color="orange">
                    {product.category}
                  </Tag>
                )}
              </Card>
            </Col>
          ))}
        </Row>
      )}
      </div>
    </MemberLayout>
  )
}
