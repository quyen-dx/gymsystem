import { ArrowLeftOutlined } from '@ant-design/icons'
import { Avatar, Button, Card, Col, Divider, Empty, Input, InputNumber, Rate, Row, Select, Space, Spin, Tabs, Tag, message } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import SellerFooter from '../../../components/layout/footer/SellerFooter'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { useAuth } from '../../../hook/useAuth'
import { getProductCategories, getProducts, getShopProducts } from '../../../services/productService'
import { addShopReview, getShop } from '../../../services/shopService'
import type { MemberProduct, ProductShop } from '../../../types/member/product'

export default function MemberStorePage() {
  const { shopId } = useParams()
  const [products, setProducts] = useState<MemberProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>()
  const [sortPrice, setSortPrice] = useState<string>()
  const [minPrice, setMinPrice] = useState<number | null>(null)
  const [maxPrice, setMaxPrice] = useState<number | null>(null)
  const [priceMode, setPriceMode] = useState<'range' | 'above'>('range')
  const [categoryOptions, setCategoryOptions] = useState<{ label: string; value: string }[]>([])
  const [shopDetail, setShopDetail] = useState<any>(null)
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' })
  const [submittingReview, setSubmittingReview] = useState(false)
  const [activeTab, setActiveTab] = useState('products')
  const reviewInputRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    setLoading(true)
    const params = {
      category,
      limit: 100,
      sortPrice,
      minPrice: minPrice ?? undefined,
      maxPrice: priceMode === 'range' ? maxPrice ?? undefined : undefined,
    }
    const request = shopId ? getShopProducts(shopId, params) : getProducts(params)
    request
      .then((res) => setProducts(res.data.products || res.data))
      .catch(() => message.error('Không thể tải sản phẩm'))
      .finally(() => setLoading(false))
  }, [shopId, category, sortPrice, minPrice, maxPrice, priceMode])

  useEffect(() => {
    const params = shopId ? { shopId } : undefined
    getProductCategories(params)
      .then((res) => setCategoryOptions(res.data.categories || []))
      .catch(() => setCategoryOptions([]))
  }, [shopId])

  useEffect(() => {
    setCategory(undefined)
    setActiveTab('products')
    if (!shopId) {
      setShopDetail(null)
      return
    }
    getShop(shopId)
      .then((res) => setShopDetail(res.data.shop))
      .catch(() => message.error('Không thể tải thông tin shop'))
  }, [shopId])
  const containerStyle: React.CSSProperties = {
    maxWidth: 1280,
    margin: '0 auto',
    padding: '0 16px',
    width: '100%',
  }
  const firstShop = products
    .map((product) => product.shop_id)
    .find((shop): shop is ProductShop => typeof shop === 'object' && !!shop)
  const shopOwner = shopDetail?.user_id || firstShop?.user_id
  const shopName = shopDetail?.name || firstShop?.name || shopOwner?.name || 'Shop'
  const shopAvatar = shopDetail?.avatar || firstShop?.avatar || shopOwner?.avatar
  const shopDescription = shopDetail?.description || firstShop?.description
  const shopRating = shopDetail?.rating ?? firstShop?.rating ?? 0
  const shopReviewCount = shopDetail?.reviewCount ?? firstShop?.reviewCount ?? 0
  const shopReviews = shopDetail?.reviews || []
  const shopAddress = shopDetail?.address || firstShop?.address
  const normalizeCategory = (value?: string) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')

  const filtered = products.filter(p =>
    (!category || normalizeCategory(p.category) === category) &&
    (p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.toLowerCase().includes(search.toLowerCase()))
  )

  const resetPriceFilters = () => {
    setSortPrice(undefined)
    setPriceMode('range')
    setMinPrice(null)
    setMaxPrice(null)
  }

  const priceFilterControls = (
    <div className="mb-6 rounded-2xl border border-[var(--gs-border)] bg-[var(--gs-panel)] p-4">
      <div className="member-responsive-actions">
        <Input.Search
          placeholder="Tìm sản phẩm..."
          allowClear
          style={{ flex: '1 1 240px', minWidth: 0 }}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          allowClear
          placeholder="Lọc danh mục"
          style={{ flex: '0 1 220px', minWidth: 170 }}
          value={category}
          onChange={setCategory}
          options={categoryOptions}
        />
        <Select
          allowClear
          placeholder="Sắp xếp giá"
          style={{ flex: '0 1 180px', minWidth: 160 }}
          value={sortPrice}
          onChange={setSortPrice}
          options={[
            { label: 'Giá thấp tới cao', value: 'asc' },
            { label: 'Giá cao xuống thấp', value: 'desc' },
          ]}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Select
          value={priceMode}
          style={{ width: 180 }}
          onChange={(value) => {
            setPriceMode(value)
            if (value === 'above') setMaxPrice(null)
          }}
          options={[
            { label: 'Khoảng giá', value: 'range' },
            { label: 'Trên số tiền', value: 'above' },
          ]}
        />
        <InputNumber
          min={0}
          value={minPrice}
          placeholder={priceMode === 'above' ? 'Trên bao nhiêu tiền' : 'Từ giá'}
          formatter={(value) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
          parser={(value) => Number(value?.replace(/\./g, '') || 0)}
          onChange={(value) => setMinPrice(typeof value === 'number' ? value : null)}
          style={{ width: 190 }}
        />
        {priceMode === 'range' && (
          <InputNumber
            min={0}
            value={maxPrice}
            placeholder="Đến giá"
            formatter={(value) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
            parser={(value) => Number(value?.replace(/\./g, '') || 0)}
            onChange={(value) => setMaxPrice(typeof value === 'number' ? value : null)}
            style={{ width: 190 }}
          />
        )}
        <Space>
          <Button onClick={resetPriceFilters}>Xóa lọc giá</Button>
        </Space>
      </div>
    </div>
  )

  const handleSubmitShopReview = async () => {
    if (!shopId) return
    setSubmittingReview(true)
    try {
      const res = await addShopReview(shopId, reviewForm)
      setShopDetail(res.data.shop)
      setReviewForm({ rating: 5, comment: '' })
      message.success('Đã gửi đánh giá shop')
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể đánh giá shop')
    } finally {
      setSubmittingReview(false)
    }
  }

  const handleHeaderRatingClick = () => {
    setActiveTab('reviews')
    window.setTimeout(() => {
      reviewInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  const productPanel = (
    <>
      {priceFilterControls}

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
                    <div className="h-[200px] flex items-center justify-center text-gray-400" style={{ backgroundColor: '#3e3e3e' }}>
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
    </>
  )

  const reviewPanel = (
    <div ref={reviewInputRef} className="rounded-2xl border border-[var(--gs-border)] bg-[rgba(23,23,23,0.92)] p-6">
      <h2 className="text-xl font-bold">Đánh giá shop</h2>
      {user && user._id !== shopOwner?._id && (
        <div className="mt-4 flex flex-col gap-3">
          <Rate value={reviewForm.rating} onChange={(rating) => setReviewForm((prev) => ({ ...prev, rating }))} />
          <Input.TextArea
            rows={3}
            value={reviewForm.comment}
            onChange={(event) => setReviewForm((prev) => ({ ...prev, comment: event.target.value }))}
            placeholder="Nhận xét về shop..."
          />
          <Button
            type="primary"
            loading={submittingReview}
            onClick={handleSubmitShopReview}
            className="w-fit !bg-[#b6462f] border-none"
          >
            Gửi đánh giá shop
          </Button>
        </div>
      )}
      <Divider />
      {shopReviews.length === 0 ? (
        <Empty description="Chưa có đánh giá shop" />
      ) : (
        <div className="flex flex-col gap-4">
          {shopReviews.map((review: any) => (
            <div key={review._id} className="border-b border-[var(--gs-border)] pb-4">
              <div className="flex items-center gap-3">
                <Avatar src={review.avatar}>{review.name?.charAt(0)}</Avatar>
                <div>
                  <div className="font-semibold">{review.name}</div>
                  <Rate disabled value={review.rating} style={{ fontSize: 13 }} />
                </div>
              </div>
              {review.comment && <p className="mt-2 text-sm text-[var(--gs-text-muted)]">{review.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <>
    <MemberLayout hideFooter>
      <div className="member-page" style={containerStyle}>
        {shopId ? (
          <div className="mb-8 rounded-2xl border border-[var(--gs-border)] bg-[rgba(23,23,23,0.92)] p-6">
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/dashboard/member/store')} className="mb-4">
              Quay lại cửa hàng
            </Button>
            <div className="flex items-center gap-4 max-[640px]:items-start max-[640px]:flex-col">
              <Avatar size={72} src={shopAvatar}>
                {shopName.charAt(0)}
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold">{shopName}</h1>
                <button
                  type="button"
                  onClick={handleHeaderRatingClick}
                  className="mt-1 flex items-center gap-2 text-left"
                  style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}
                >
                  <Rate disabled allowHalf value={shopRating} style={{ fontSize: 14 }} />
                  <span className="text-sm text-[var(--gs-text-muted)]">
                    {shopRating.toFixed(1)} ({shopReviewCount} đánh giá shop)
                  </span>
                </button>
                <p className="mt-1 text-sm text-[var(--gs-text-muted)]">
                  {shopDescription || `Tất cả sản phẩm của ${shopName}`}
                </p>
                {(shopAddress?.street || shopAddress?.district || shopAddress?.city) && (
                  <p className="mt-1 text-sm text-[var(--gs-text-muted)]">
                    {shopAddress.street}{shopAddress.ward ? `, ${shopAddress.ward}` : ''}{shopAddress.district ? `, ${shopAddress.district}` : ''}{shopAddress.city ? `, ${shopAddress.city}` : ''}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="relative left-1/2 mb-8 h-[300px] w-screen -translate-x-1/2 overflow-hidden max-[640px]:h-[180px]">
            <img
              src="https://images.unsplash.com/photo-1558611848-73f7eb4001a1?q=80&w=1600"
              className="w-full h-full object-cover"
              alt="banner"
            />
            <div className="absolute inset-0 bg-black/50" />
            <div className="absolute top-1/2 left-8 max-[640px]:left-4 -translate-y-1/2 text-white pr-4">
              <h1 className="text-3xl max-[640px]:text-2xl font-extrabold">Gym Store</h1>
              <p className="mt-2 opacity-90">Dụng cụ tập luyện chính hãng - Giá tốt mỗi ngày</p>
              <Button type="primary" size="large" className="mt-4 !bg-[#b6462f] border-none max-[640px]:hidden">
                Mua ngay
              </Button>
            </div>
          </div>
        )}

        {shopId && (
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              { key: 'products', label: 'Sản phẩm', children: productPanel },
              { key: 'reviews', label: `Đánh giá Shop (${shopRating.toFixed(1)})`, children: reviewPanel },
            ]}
          />
        )}

        {!shopId && (
          <>
            {priceFilterControls}

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
                          <div className="h-[200px] flex items-center justify-center text-gray-400" style={{ backgroundColor: '#3e3e3e' }}>
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
          </>
        )}
      </div>
    </MemberLayout>
    <SellerFooter />
    </>
  )
}
