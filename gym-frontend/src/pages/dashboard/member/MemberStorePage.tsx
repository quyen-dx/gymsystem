import { ArrowLeftOutlined, ShopOutlined } from '@ant-design/icons'
import { Avatar, Button, Card, Col, Divider, Empty, Input, InputNumber, Modal, Rate, Row, Select, Space, Spin, Tabs, Tag, message } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import SellerFooter from '../../../components/layout/footer/SellerFooter'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import PartnershipRequestForm from '../../../components/partnership/PartnershipRequestForm'
import { useTheme } from '../../../context/ThemeProvider'
import { useAuth } from '../../../hooks/useAuth'
import { getShopProducts } from '../../../services/productService'
import { addShopReview, getShop, getShops } from '../../../services/shopService'
import type { MemberProduct, ProductShop } from '../../../types/member/product'

export default function MemberStorePage() {
  const { dark } = useTheme()
  const { storeId } = useParams()
  const [shops, setShops] = useState<ProductShop[]>([])
  const [products, setProducts] = useState<MemberProduct[]>([])
  const [featuredProductsByShop, setFeaturedProductsByShop] = useState<Record<string, MemberProduct[]>>({})
  const [featuredProductCountsByShop, setFeaturedProductCountsByShop] = useState<Record<string, number>>({})
  const [featuredProductsLoading, setFeaturedProductsLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [sortPrice, setSortPrice] = useState('')
  const [minPrice, setMinPrice] = useState<number | null>(null)
  const [maxPrice, setMaxPrice] = useState<number | null>(null)
  const [priceMode, setPriceMode] = useState<'range' | 'above'>('range')
  const [categoryOptions, setCategoryOptions] = useState<{ label: string; value: string }[]>([])
  const [categoryLoading, setCategoryLoading] = useState(false)
  const [shopDetail, setShopDetail] = useState<any>(null)
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' })
  const [submittingReview, setSubmittingReview] = useState(false)
  const [activeTab, setActiveTab] = useState('products')
  const [partnershipModalOpen, setPartnershipModalOpen] = useState(false)
  const reviewInputRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    if (storeId) return
    setLoading(true)
    getShops()
      .then((res) => setShops(res.data.shops || res.data || []))
      .catch(() => message.error('Không thể tải danh sách cửa hàng'))
      .finally(() => setLoading(false))
  }, [storeId])

  useEffect(() => {
    if (storeId || shops.length === 0) {
      setFeaturedProductsByShop({})
      setFeaturedProductCountsByShop({})
      setFeaturedProductsLoading(false)
      return
    }

    let cancelled = false
    setFeaturedProductsLoading(true)

    Promise.all(
      shops.map((shop) =>
        getShopProducts(shop._id, { limit: 4 })
          .then((res) => {
            const products = res.data.products || res.data || []
            const total = typeof res.data.total === 'number' ? res.data.total : products.length
            return [shop._id, products, total] as const
          })
          .catch(() => [shop._id, [], 0] as const)
      )
    )
      .then((entries) => {
        if (cancelled) return
        setFeaturedProductsByShop(Object.fromEntries(entries.map(([shopId, products]) => [shopId, products])))
        setFeaturedProductCountsByShop(Object.fromEntries(entries.map(([shopId, , total]) => [shopId, total])))
      })
      .finally(() => {
        if (!cancelled) setFeaturedProductsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [storeId, shops])

  useEffect(() => {
    if (!storeId) return
    setLoading(true)
    const params = {
      category: category || undefined,
      limit: 100,
      sortPrice: sortPrice || undefined,
      minPrice: minPrice ?? undefined,
      maxPrice: priceMode === 'range' ? maxPrice ?? undefined : undefined,
    }
    getShopProducts(storeId, params)
      .then((res) => setProducts(res.data.products || res.data))
      .catch(() => message.error('Không thể tải danh sách sản phẩm'))
      .finally(() => setLoading(false))
  }, [storeId, category, sortPrice, minPrice, maxPrice, priceMode])

  useEffect(() => {
    if (!storeId) {
      setCategoryOptions([])
      setCategoryLoading(false)
      return
    }
    let cancelled = false
    setCategoryOptions([])
    setCategoryLoading(true)

    getShopProducts(storeId, { limit: 100 })
      .then((res) => {
        if (cancelled) return
        const shopProducts: MemberProduct[] = res.data.products || res.data || []
        const categoryMap = new Map<string, string>()

        shopProducts.forEach((product) => {
          const raw = String(product.category || '').trim()
          const key = normalizeCategory(raw)
          if (!raw || !key || categoryMap.has(key)) return
          categoryMap.set(key, raw)
        })

        setCategoryOptions(
          [...categoryMap.entries()]
            .map(([value, label]) => ({ label, value }))
            .sort((a, b) => a.label.localeCompare(b.label, 'vi'))
        )
      })
      .catch(() => {
        if (!cancelled) setCategoryOptions([])
      })
      .finally(() => {
        if (!cancelled) setCategoryLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [storeId])

  useEffect(() => {
    setCategory('')
    setSearch('')
    setSortPrice('')
    setPriceMode('range')
    setMinPrice(null)
    setMaxPrice(null)
    setActiveTab('products')
    if (!storeId) {
      setShopDetail(null)
      setProducts([])
      return
    }
    getShop(storeId)
      .then((res) => setShopDetail(res.data.shop))
      .catch(() => message.error('Không thể tải thông tin cửa hàng'))
  }, [storeId])

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
  const shopName = shopDetail?.name || firstShop?.name || shopOwner?.name || 'Cửa hàng'
  const shopAvatar = shopOwner?.avatar || shopDetail?.avatar || firstShop?.avatar
  const shopDescription = shopDetail?.description || firstShop?.description
  const shopRating = shopDetail?.rating ?? firstShop?.rating ?? 0
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
  const categorySelectOptions = categoryOptions.length > 0
    ? [{ label: 'Tất cả sản phẩm', value: '' }, ...categoryOptions]
    : []
  const categoryPlaceholder = categoryLoading
    ? 'Đang tải...'
    : categoryOptions.length === 0
      ? 'Không có danh mục'
      : 'Tất cả sản phẩm'
  const getProductImage = (product: MemberProduct) => product.image || product.images?.[0] || ''
  const formatProductPrice = (price?: number) =>
    typeof price === 'number' && Number.isFinite(price)
      ? `${price.toLocaleString('vi-VN')}đ`
      : 'Liên hệ'
  const featuredShopSections = shops
    .map((shop) => ({
      shop,
      products: featuredProductsByShop[shop._id] || [],
    }))
    .filter((section) => section.products.length > 0)

  const resetPriceFilters = () => {
    setCategory('')
    setSortPrice('')
    setPriceMode('range')
    setMinPrice(null)
    setMaxPrice(null)
  }

  const priceFilterControls = (
    <div className="mb-6 rounded-2xl border border-[var(--gs-border)] bg-[var(--gs-panel)] p-4">
      <div className="member-responsive-actions">
        <Input.Search
          placeholder="Tìm kiếm sản phẩm..."
          allowClear
          style={{ flex: '1 1 240px', minWidth: 0 }}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          disabled={categoryLoading || categoryOptions.length === 0}
          placeholder={categoryPlaceholder}
          style={{ flex: '0 1 220px', minWidth: 170 }}
          value={category}
          onChange={(value) => setCategory(value || '')}
          options={categorySelectOptions}
        />
        <Select
          style={{ flex: '0 1 180px', minWidth: 160 }}
          value={sortPrice}
          onChange={(value) => setSortPrice(value || '')}
          options={[
            { label: 'Tất cả mức giá', value: '' },
            { label: 'Giá tăng dần', value: 'asc' },
            { label: 'Giá giảm dần', value: 'desc' },
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
            { label: 'Trên', value: 'above' },
          ]}
        />
        <InputNumber
          min={0}
          value={minPrice}
          placeholder={priceMode === 'above' ? 'Giá từ...' : 'Từ'}
          formatter={(value) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
          parser={(value) => Number(value?.replace(/\./g, '') || 0)}
          onChange={(value) => setMinPrice(typeof value === 'number' ? value : null)}
          style={{ width: 190 }}
        />
        {priceMode === 'range' && (
          <InputNumber
            min={0}
            value={maxPrice}
            placeholder="Đến"
            formatter={(value) => value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
            parser={(value) => Number(value?.replace(/\./g, '') || 0)}
            onChange={(value) => setMaxPrice(typeof value === 'number' ? value : null)}
            style={{ width: 190 }}
          />
        )}
        <Space>
          <Button onClick={resetPriceFilters}>Xóa bộ lọc</Button>
        </Space>
      </div>
    </div>
  )

  const handleSubmitShopReview = async () => {
    if (!storeId) return
    setSubmittingReview(true)
    try {
      const res = await addShopReview(storeId, reviewForm)
      setShopDetail(res.data.shop)
      setReviewForm({ rating: 5, comment: '' })
      message.success('Đã gửi đánh giá')
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Gửi đánh giá thất bại')
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
            <Col xs={24} sm={12} md={8} lg={6} key={product._id} style={{ display: 'flex' }}>
              <Card
                hoverable
                onClick={() => navigate(`/product/${product._id}`)}
                className="rounded-xl overflow-hidden"
                style={{
                  background: 'var(--gs-card)', borderColor: 'var(--gs-border)',
                  display: 'flex', flexDirection: 'column', width: '100%',
                }}
                cover={
                  product.image ? (
                    <img src={product.image} className="h-[200px] w-full object-cover flex-none" alt={product.name} />
                  ) : (
                    <div className="h-[200px] flex-none flex items-center justify-center" style={{ backgroundColor: 'var(--theme-bg)', color: 'var(--gs-text-muted)' }}>
                      {'Không có ảnh'}
                    </div>
                  )
                }
                classNames={{ cover: 'flex-none' }}
                styles={{ body: { display: 'flex', flexDirection: 'column', flex: 1 } as React.CSSProperties }}
              >
                <div className="font-bold text-base text-[var(--gs-text)] line-clamp-2">{product.name}</div>

                {product.rating && product.rating > 0 ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Rate disabled allowHalf value={product.rating} style={{ fontSize: 14 }} />
                    <span className="text-[var(--theme-accent)] text-sm font-medium">
                      {product.rating.toFixed(1)}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--gs-text-muted)' }}>
                      ({product.reviewCount || 0})
                    </span>
                  </div>
                ) : (
                  <div className="text-xs mt-1" style={{ color: 'var(--gs-text-muted)' }}>
                    Chưa có đánh giá
                  </div>
                )}

                <div className="flex justify-between items-center mt-auto pt-2">
                  <span className="text-[var(--gs-text)] font-bold text-lg">
                    {product.price?.toLocaleString('vi-VN')}đ
                  </span>
                  <Tag color={product.stock && product.stock > 0 ? 'green' : 'red'}>
                    {product.stock && product.stock > 0 ? 'Còn hàng' : 'Hết hàng'}
                  </Tag>
                </div>

                <Tag className="mt-1 rounded-md font-medium" color="orange">
                  Giao dự kiến: 2-4 ngày
                </Tag>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </>
  )

  const reviewPanel = (
    <div ref={reviewInputRef} className="rounded-2xl border border-[var(--gs-border)] bg-[rgba(23,23,23,0.92)] p-6">
      <h2 className="text-xl font-bold">Đánh giá cửa hàng</h2>
      {user && user._id !== shopOwner?._id && (
        <div className="mt-4 flex flex-col gap-3">
          <Rate value={reviewForm.rating} onChange={(rating) => setReviewForm((prev) => ({ ...prev, rating }))} />
          <Input.TextArea
            rows={3}
            value={reviewForm.comment}
            onChange={(event) => setReviewForm((prev) => ({ ...prev, comment: event.target.value }))}
            placeholder="Viết đánh giá của bạn..."
          />
          <Button
            type="primary"
            loading={submittingReview}
            onClick={handleSubmitShopReview}
            className="w-fit !bg-[var(--theme-button-bg)] !text-[var(--theme-button-text)] border-none"
          >
            Gửi đánh giá
          </Button>
        </div>
      )}
      <Divider />
      {shopReviews.length === 0 ? (
        <Empty description="Chưa có đánh giá" />
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

  const storeList = (
    <>
      <div className="mb-12 mt-4 flex items-center justify-between gap-5 py-4 max-[760px]:items-start max-[760px]:flex-col max-[640px]:mb-8 max-[640px]:mt-0 max-[640px]:gap-4 max-[640px]:py-2">
        <div className="flex min-w-0 items-center gap-5 max-[640px]:gap-4">
          <div className="h-14 w-1.5 rounded-full bg-[var(--theme-accent)] max-[640px]:h-9 max-[640px]:w-1" />
          <h1 className="m-0 text-5xl font-medium leading-tight text-[var(--theme-text)] max-[1024px]:text-4xl max-[640px]:text-2xl">
            Cửa hàng
          </h1>
        </div>
        <Button
          ghost
          onClick={() => setPartnershipModalOpen(true)}
          className="shrink-0 !border-[var(--theme-accent)] !text-[var(--theme-accent)] hover:!bg-[var(--theme-accent-muted)]"
        >
          Đăng ký cộng tác
        </Button>
      </div>

      {loading ? (
        <div className="text-center my-10"><Spin size="large" /></div>
      ) : shops.length === 0 ? (
        <Empty description="Không có cửa hàng" />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {shops.map((shop) => {
              const owner = shop.user_id
              const name = shop.name || owner?.name || 'Cửa hàng'
              const avatar = owner?.avatar || shop.avatar
              const productCount = featuredProductCountsByShop[shop._id] ?? 0
              const openStore = () => navigate(`/store/${shop._id}`)

              return (
                <Col xs={12} lg={6} key={shop._id}>
                  <Card
                    hoverable
                    tabIndex={0}
                    role="link"
                    onClick={openStore}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        openStore()
                      }
                    }}
                    className="relative h-full cursor-pointer overflow-hidden rounded-xl transition-all duration-150 hover:!-translate-y-[3px] hover:!border-[var(--theme-accent-border)]"
                    bodyStyle={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: 24 }}
                  >
                    <div className="absolute left-0 top-0 h-1 w-full bg-[var(--theme-accent)]" />
                    <div
                      className="absolute right-3 top-3 rounded-full px-2 py-1 text-[11px] font-medium leading-none"
                      style={{
                        background: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
                        color: dark ? '#ffffff' : '#111111',
                        border: `1px solid ${dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)'}`,
                      }}
                    >
                      {productCount + ' sản phẩm'}
                    </div>
                    <Avatar size={72} src={avatar} icon={<ShopOutlined />} className="mb-4 shrink-0">
                      {name.charAt(0)}
                    </Avatar>
                    <div className="mb-2 w-full truncate text-lg font-medium">{name}</div>
                    <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
                      <Rate disabled allowHalf value={shop.rating || 0} style={{ fontSize: 13 }} />
                      <span className="text-xs text-[var(--gs-text-muted)]">
                        {(shop.reviewCount || 0) + ' đánh giá'}
                      </span>
                    </div>
                  </Card>
                </Col>
              )
            })}
          </Row>

          {!featuredProductsLoading && featuredShopSections.length > 0 && (
            <div className="mt-14">
              {featuredShopSections.map(({ shop, products }) => {
                const owner = shop.user_id
                const name = shop.name || owner?.name || 'Cửa hàng'

                return (
                  <section
                    key={shop._id}
                    className="mb-12"
                  >
                    <div className="mb-4 flex items-center gap-4 border-b border-[var(--gs-border)] pb-4">
                      <div className="h-8 w-1 rounded-full bg-[var(--theme-accent)]" />
                      <h2 className="m-0 min-w-0 flex-1 truncate text-2xl font-medium text-[var(--theme-text)] max-[640px]:text-lg">
                        {name}
                      </h2>
                      <button
                        type="button"
                        onClick={() => navigate(`/store/${shop._id}`)}
                        className="shrink-0 border-0 bg-transparent p-0 text-sm font-medium text-[var(--theme-accent)] transition-opacity hover:opacity-80"
                      >
                        Xem tất cả
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-4 max-[640px]:gap-2">
                      {products.slice(0, 4).map((product) => {
                        const image = getProductImage(product)

                        return (
                          <button
                            key={product._id}
                            type="button"
                            onClick={() => navigate(`/product/${product._id}`)}
                            className="group overflow-hidden rounded-[10px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-0 text-left transition-all hover:border-[var(--theme-accent-border)] hover:-translate-y-0.5"
                          >
                            {image ? (
                              <img
                                src={image}
                                alt={product.name}
                                className="aspect-square w-full object-cover"
                              />
                            ) : (
                              <div className="flex aspect-square w-full items-center justify-center bg-[var(--theme-bg)] text-xs text-[var(--gs-text-muted)]">
                                {'Không có ảnh'}
                              </div>
                            )}
                            <div className="p-3 max-[640px]:p-2">
                              <div className="line-clamp-2 min-h-[40px] text-sm font-medium leading-5 text-[var(--gs-text)] max-[640px]:text-xs max-[640px]:leading-4">
                                {product.name}
                              </div>
                              <div className="mt-2 text-sm font-semibold text-[var(--gs-text)] max-[640px]:text-xs">
                                {formatProductPrice(product.price)}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </>
      )}

      <Modal
        title="Đăng ký cộng tác"
        open={partnershipModalOpen}
        onCancel={() => setPartnershipModalOpen(false)}
        footer={null}
        width={640}
      >
        <PartnershipRequestForm compact onSuccess={() => setPartnershipModalOpen(false)} />
      </Modal>
    </>
  )

  const storeDetail = (
    <>
      <div className="mb-6 rounded-2xl border border-[var(--gs-border)] bg-[var(--gs-panel)] p-5 max-[640px]:p-4">
        <div className="mb-5">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/store')}
            className="!px-0"
          >
            Quay lại danh sách
          </Button>
        </div>

        <div className="flex items-center gap-5 max-[640px]:items-start max-[640px]:gap-4">
          <Avatar size={80} src={shopAvatar} className="shrink-0">
            {shopName.charAt(0)}
          </Avatar>

          <div className="min-w-0 flex-1">
            <h1 className="m-0 text-3xl font-bold leading-tight max-[640px]:text-2xl">{shopName}</h1>
            <div className="mt-1 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--theme-accent)]">
              Nổi bật
            </div>
            <button
              type="button"
              onClick={handleHeaderRatingClick}
              className="mt-3 flex flex-wrap items-center gap-2 text-left"
              style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}
            >
              <Rate disabled allowHalf value={shopRating} style={{ fontSize: 14 }} />
              <span className="text-sm text-[var(--gs-text-muted)]">
                {shopRating.toFixed(1)} ({shopRating.toFixed(1)} đánh giá)
              </span>
            </button>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--gs-text-muted)]">
              {shopDescription || ('Tất cả sản phẩm của ' + shopName)}
            </p>
            {(shopAddress?.street || shopAddress?.district || shopAddress?.city) && (
              <p className="mt-2 text-sm text-[var(--gs-text-muted)]">
                {shopAddress.street}{shopAddress.ward ? `, ${shopAddress.ward}` : ''}{shopAddress.district ? `, ${shopAddress.district}` : ''}{shopAddress.city ? `, ${shopAddress.city}` : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'products', label: 'Sản phẩm', children: productPanel },
          { key: 'reviews', label: shopRating.toFixed(1) + ' đánh giá', children: reviewPanel },
        ]}
      />
    </>
  )

  return (
    <>
      <MemberLayout hideFooter>
        <div className="member-page" style={containerStyle}>
          {storeId ? storeDetail : storeList}
        </div>
      </MemberLayout>
      <SellerFooter />
    </>
  )
}
