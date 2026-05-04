import {
  ArrowLeftOutlined, ShoppingCartOutlined, UserOutlined
} from '@ant-design/icons'
import {
  Avatar, Button, Col, Divider, Image, InputNumber,
  Rate, Row, Spin, Tag, message
} from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import MemberLayout from '../../components/layout/MemberLayout'
import { useTheme } from '../../context/ThemeProvider'
import { useCart } from '../../context/useCart'
import { useAuth } from '../../hook/useAuth'
import { addReview, getProductById } from '../../services/productService'
import type { MemberProduct } from '../../types/member/product'

const normalizeImageList = (images: unknown): string[] => {
  if (Array.isArray(images)) {
    return images.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof images === 'string') {
    return images.split('\n').map((item) => item.trim()).filter(Boolean)
  }
  return []
}

const normalizeWeightVariants = (product: MemberProduct) => {
  if (Array.isArray(product.weightVariants) && product.weightVariants.length > 0) {
    return product.weightVariants
      .map((item) => ({
        label: String(item?.label || '').trim(),
        priceDelta: Number(item?.priceDelta || 0) || 0,
        stock: Number(item?.stock || 0) || 0,
      }))
      .filter((item) => item.label)
      .map((item) => ({
        ...item,
        priceDelta: item.priceDelta > 0 ? item.priceDelta : 0,
        stock: item.stock > 0 ? item.stock : 0,
      }))
  }
  return normalizeImageList(product.weights).map((label) => ({ label, priceDelta: 0, stock: 0 }))
}

export default function ProductDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToCart } = useCart()
  const { user } = useAuth()
  const { dark } = useTheme()

  const [product, setProduct] = useState<MemberProduct | null>(null)
  const [related, setRelated] = useState<MemberProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [qty, setQty] = useState(1)
  const [activeImg, setActiveImg] = useState('')
  const [activeWeight, setActiveWeight] = useState<string>('')
  const [ratingFilter, setRatingFilter] = useState<number | null>(null)
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' })
  const [submittingReview, setSubmittingReview] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getProductById(id)
      .then((res) => {
        setProduct(res.data.product)
        setRelated(res.data.related || [])
        const imgs = res.data.product.images || []
        setActiveImg(imgs[0] || res.data.product.image || '')
        const variants = normalizeWeightVariants(res.data.product)
        setActiveWeight(variants[0]?.label || '')
      })
      .catch(() => message.error('Không tìm thấy sản phẩm'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!user) return
    setProduct((current) => {
      if (!current?.reviews?.length) return current
      return {
        ...current,
        reviews: current.reviews.map((review) =>
          String(review.userId) === String(user._id)
            ? { ...review, name: user.name, avatar: user.avatar || '' }
            : review,
        ),
      }
    })
  }, [user?._id, user?.name, user?.avatar])

  useEffect(() => {
    if (!product) return
    const variants = normalizeWeightVariants(product)
    const selected = variants.find((item) => item.label === activeWeight)
    const selectedStock = variants.length > 0 ? Number(selected?.stock || 0) : Number(product.stock || 0)
    if (selectedStock > 0 && qty > selectedStock) setQty(selectedStock)
    if (selectedStock <= 0 && qty !== 1) setQty(1)
  }, [activeWeight, product?._id])

  const handleAddToCart = () => {
    if (!product) return
    const selectedVariant = weightVariants.find((item) => item.label === activeWeight)
    const dynamicPrice = selectedVariant?.priceDelta ?? basePrice
    const selectedStock = weightVariants.length > 0 ? Number(selectedVariant?.stock || 0) : Number(product.stock || 0)
    if (selectedStock <= 0) {
      message.error('Biến thể này đã hết hàng')
      return
    }
    if (qty > selectedStock) {
      message.error(`Chỉ còn ${selectedStock} sản phẩm cho biến thể này`)
      return
    }
    const sellerId = typeof product.shop_id === 'object' ? product.shop_id?.user_id?._id || '' : ''

    for (let i = 0; i < qty; i++) {
      addToCart(
        { ...product, basePrice, price: dynamicPrice, sellerId },
        { weight: selectedVariant?.label || undefined },
      )
    }
    message.success(`Đã thêm ${qty} "${product.name}" vào giỏ`)
  }

  const handleSubmitReview = async () => {
    if (!product) return
    setSubmittingReview(true)
    try {
      const res = await addReview(product._id, reviewForm)
      setProduct(res.data.product)
      message.success('Đánh giá thành công!')
      setReviewForm({ rating: 5, comment: '' })
    } catch (error) {
      const err = error as any;
      message.error(err.response?.data?.message || 'Đánh giá thất bại')
    } finally {
      setSubmittingReview(false)
    }
  }

  if (loading) return (
    <MemberLayout>
      <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
    </MemberLayout>
  )

  if (!product) return (
    <MemberLayout>
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Button onClick={() => navigate('/dashboard/member/store')}>Quay lại cửa hàng</Button>
      </div>
    </MemberLayout>
  )

  const allImages = Array.from(
    new Set(
      [...normalizeImageList(product.images), product.image].filter(
        (img): img is string => Boolean(img),
      ),
    ),
  )
  const reviews = product.reviews || []
  const basePrice = product.price ?? 0
  const weightVariants = normalizeWeightVariants(product)
  const selectedVariant = weightVariants.find((item) => item.label === activeWeight)
  const dynamicPrice = selectedVariant?.priceDelta ?? basePrice
  const stock = weightVariants.length > 0 ? Number(selectedVariant?.stock || 0) : Number(product.stock || 0)
  const rating = product.rating ?? 0
  const reviewCount = product.reviewCount ?? reviews.length
  const inStock = stock > 0
  const panelBg = dark ? 'rgba(23,23,23,0.92)' : '#ffffff'
  const borderColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)'
  const mutedText = dark ? '#888' : '#666'
  const softText = dark ? '#aaa' : '#444'
  const thumbBg = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
  const thumbBorder = dark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.12)'
  const shop = typeof product.shop_id === 'object' ? product.shop_id : null
  const shopOwner = shop?.user_id
  const shopName = shop?.name || shopOwner?.name || product.partner?.name || 'Shop'
  const shopAvatar = shop?.avatar || shopOwner?.avatar || product.partner?.avatar
  const shopRating = shop?.rating ?? 0
  const shopReviewCount = shop?.reviewCount ?? 0
  const shopId = shop?._id
  const descriptionImages = normalizeImageList(product.descriptionImages)

  const starDist = [5, 4, 3, 2, 1].map(s => ({
    star: s,
    count: reviews.filter(r => r.rating === s).length,
  }))

  const filteredReviews = ratingFilter
    ? reviews.filter(r => r.rating === ratingFilter)
    : reviews

  // Style container giữa màn hình kiểu Shopee
  const containerStyle: React.CSSProperties = {
    maxWidth: 1280,
    margin: '0 auto',
    padding: '0 16px',
    width: '100%',
  }

  const sectionStyle: React.CSSProperties = {
    background: panelBg,
    borderRadius: 16,
    border: `1px solid ${borderColor}`,
    padding: 'clamp(16px, 3vw, 32px)',
    marginBottom: 16,
  }

  return (
    <MemberLayout>
      <div className="member-page" style={containerStyle}>

        {/* BACK BUTTON */}
        <Button
          icon={<ArrowLeftOutlined />}
          type="text"
          onClick={() => navigate('/dashboard/member/store')}
          style={{ marginBottom: 16 }}
        >
          Quay lại cửa hàng
        </Button>

        {/* ===== ẢNH + THÔNG TIN ===== */}
        <div style={sectionStyle}>
          <Row gutter={[40, 32]}>

            {/* CỘT ẢNH */}
            <Col xs={24} md={10}>
              <Image.PreviewGroup items={allImages}>
                <Image
                  src={activeImg || 'https://placehold.co/400x400'}
                  alt={product.name}
                  style={{
                    width: '100%',
                    borderRadius: 12,
                    objectFit: 'cover',
                    maxHeight: 400,
                    border: `1px solid ${borderColor}`,
                    cursor: 'zoom-in',
                  }}
                />
              </Image.PreviewGroup>

              {allImages.length > 1 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  {allImages.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt={`thumb-${i}`}
                      onClick={() => setActiveImg(img)}
                      style={{
                        width: 64, height: 64, objectFit: 'cover',
                        borderRadius: 8, cursor: 'pointer',
                        border: activeImg === img ? '2px solid #b6462f' : '2px solid transparent',
                        opacity: activeImg === img ? 1 : 0.6,
                        transition: 'all 0.2s',
                      }}
                    />
                  ))}
                </div>
              )}
            </Col>

            {/* CỘT THÔNG TIN */}
            <Col xs={24} md={14}>
              {product.category && (
                <Tag color="orange" style={{ marginBottom: 8 }}>{product.category}</Tag>
              )}

              <h1 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 700, lineHeight: 1.4 }}>
                {product.name}
              </h1>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <Rate disabled defaultValue={rating} allowHalf style={{ fontSize: 16 }} />
                <span style={{ color: '#b6462f', fontWeight: 600 }}>{rating.toFixed(1)}</span>
                <span style={{ color: mutedText }}>({reviewCount} đánh giá)</span>
              </div>

              <div style={{
                fontSize: 32, fontWeight: 800, color: '#b6462f', marginBottom: 24,
                padding: '16px 0', borderTop: `1px solid ${borderColor}`, borderBottom: `1px solid ${borderColor}`,
              }}>
                {dynamicPrice.toLocaleString('vi-VN')}đ
              </div>

              {/* TRỌNG LƯỢNG */}
              {weightVariants.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ color: mutedText, marginBottom: 10, fontSize: 14 }}>Trọng lượng</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {weightVariants.map((variant) => {
                      const active = activeWeight === variant.label
                      const variantInStock = Number(variant.stock || 0) > 0
                      return (
                        <button
                          key={variant.label}
                          type="button"
                          onClick={() => setActiveWeight(variant.label)}
                          style={{
                            padding: '8px 16px',
                            borderRadius: 10,
                            cursor: 'pointer',
                            background: active ? 'rgba(182,70,47,0.18)' : thumbBg,
                            border: active ? '1px solid #b6462f' : thumbBorder,
                            color: 'inherit',
                            fontWeight: 600,
                            minWidth: 64,
                            fontSize: 14,
                            opacity: variantInStock ? 1 : 0.55,
                          }}
                        >
                          {variant.label}
                        </button>
                      )
                    })}
                  </div>
                  {selectedVariant && (
                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Tag color="blue">Trọng lượng: {selectedVariant.label}</Tag>
                      <Tag color={stock > 0 ? 'green' : 'red'}>
                        {stock > 0 ? `Còn ${stock} sản phẩm` : 'Hết hàng'}
                      </Tag>
                    </div>
                  )}
                </div>
              )}
              {weightVariants.length === 0 && (
                <div style={{ marginBottom: 20 }}>
                  <Tag color={stock > 0 ? 'green' : 'red'}>
                    {stock > 0 ? `Còn ${stock} sản phẩm` : 'Hết hàng'}
                  </Tag>
                </div>
              )}

              {/* SỐ LƯỢNG */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
                <span style={{ color: mutedText, fontSize: 14 }}>Số lượng:</span>
                <InputNumber
                  min={1} max={stock || 99}
                  value={qty}
                  onChange={(v) => setQty(v || 1)}
                  disabled={!inStock}
                  style={{ width: 100 }}
                />
              </div>

              {/* NÚT */}
              <div className="member-responsive-actions" style={{ display: 'flex', gap: 12 }}>
                <Button
                  type="primary"
                  size="large"
                  icon={<ShoppingCartOutlined />}
                  disabled={!inStock}
                  onClick={handleAddToCart}
                  style={{ flex: '1 1 220px', background: '#b6462f', borderColor: '#b6462f' }}
                >
                  Thêm vào giỏ
                </Button>
                <Button
                  size="large"
                  onClick={() => navigate('/dashboard/member/cart')}
                  style={{ flex: '1 1 180px' }}
                >
                  Xem giỏ hàng
                </Button>
              </div>
            </Col>
          </Row>
        </div>

        {/* ===== SHOP ===== */}
        {shop && (
          <div style={{
            ...sectionStyle,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
            cursor: shopId ? 'pointer' : 'default',
          }}>
            <Avatar
              size={56}
              src={shopAvatar}
              icon={<UserOutlined />}
              style={{ background: '#b6462f' }}
              onClick={() => shopId && navigate(`/dashboard/member/shop/${shopId}`)}
            />
            <div onClick={() => shopId && navigate(`/dashboard/member/shop/${shopId}`)}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{shopName}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <Rate disabled allowHalf value={shopRating} style={{ fontSize: 13 }} />
                <span style={{ color: mutedText, fontSize: 13 }}>
                  {shopRating.toFixed(1)} ({shopReviewCount} đánh giá shop)
                </span>
              </div>
              <div style={{ color: mutedText, fontSize: 13, marginTop: 4 }}>Shop bán sản phẩm này</div>
            </div>
          </div>
        )}

        {/* ===== ĐỐI TÁC ===== */}
        {!shop && product.partner?.name && (
          <div style={{
            ...sectionStyle,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}>
            <Avatar
              size={56}
              src={product.partner.avatar}
              icon={<UserOutlined />}
              style={{ background: '#b6462f' }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{product.partner.name}</div>
              {product.partner.description && (
                <div style={{ color: mutedText, fontSize: 13, marginTop: 4 }}>
                  {product.partner.description}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== MÔ TẢ SẢN PHẨM ===== */}
        <div style={sectionStyle}>
          <h2 style={{ marginBottom: 16, fontSize: 18, fontWeight: 700 }}>MÔ TẢ SẢN PHẨM</h2>
          <div style={{ color: softText, lineHeight: 2, fontSize: 15, whiteSpace: 'pre-line' }}>
            {product.description || 'Chưa có mô tả'}
          </div>
          {descriptionImages.length > 0 && (
            <div style={{ display: 'grid', gap: 16, marginTop: 24 }}>
              {descriptionImages.map((img, index) => (
                <Image
                  key={`${img}-${index}`}
                  src={img}
                  alt={`${product.name} mô tả ${index + 1}`}
                  style={{
                    width: '100%', maxHeight: 720, objectFit: 'contain',
                    borderRadius: 12, border: `1px solid ${borderColor}`,
                    background: thumbBg,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* ===== ĐÁNH GIÁ ===== */}
        <div style={sectionStyle}>
          <h2 style={{ marginBottom: 24, fontSize: 18, fontWeight: 700 }}>ĐÁNH GIÁ SẢN PHẨM</h2>

          <div style={{ display: 'flex', gap: 40, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, fontWeight: 800, color: '#b6462f' }}>{rating.toFixed(1)}</div>
              <Rate disabled value={rating} allowHalf style={{ fontSize: 18 }} />
              <div style={{ color: mutedText, marginTop: 4 }}>{reviewCount} đánh giá</div>
            </div>

            <div style={{ flex: 1, minWidth: 200 }}>
              {starDist.map(({ star, count }) => (
                <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 40, color: mutedText, fontSize: 13 }}>{star} sao</span>
                  <div style={{
                    flex: 1, height: 8,
                    background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    borderRadius: 4, overflow: 'hidden',
                  }}>
                    <div style={{
                      width: reviewCount > 0 ? `${(count / reviewCount) * 100}%` : '0%',
                      height: '100%', background: '#b6462f', borderRadius: 4,
                    }} />
                  </div>
                  <span style={{ width: 24, color: mutedText, fontSize: 13 }}>{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* BỘ LỌC SAO */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
            <Button
              size="small"
              type={ratingFilter === null ? 'primary' : 'default'}
              onClick={() => setRatingFilter(null)}
              style={ratingFilter === null ? { background: '#b6462f', borderColor: '#b6462f' } : {}}
            >
              Tất cả
            </Button>
            {[5, 4, 3, 2, 1].map(s => (
              <Button
                key={s}
                size="small"
                type={ratingFilter === s ? 'primary' : 'default'}
                onClick={() => setRatingFilter(ratingFilter === s ? null : s)}
                style={ratingFilter === s ? { background: '#b6462f', borderColor: '#b6462f' } : {}}
              >
                {s} Sao ({starDist.find(d => d.star === s)?.count || 0})
              </Button>
            ))}
          </div>

          {/* DANH SÁCH REVIEW */}
          {filteredReviews.length === 0 ? (
            <div style={{ color: mutedText, textAlign: 'center', padding: 32 }}>
              Chưa có đánh giá nào
            </div>
          ) : (
            filteredReviews.map((review) => (
              <div key={review._id} style={{
                padding: '16px 0',
                borderBottom: `1px solid ${borderColor}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <Avatar src={review.avatar} icon={<UserOutlined />} style={{ background: '#b6462f' }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{review.name}</div>
                    <div style={{ fontSize: 12, color: mutedText }}>
                      {new Date(review.createdAt).toLocaleDateString('vi-VN')}
                    </div>
                  </div>
                </div>
                <Rate disabled value={review.rating} style={{ fontSize: 14, marginBottom: 8 }} />
                {review.comment && (
                  <div style={{ color: softText, lineHeight: 1.7 }}>{review.comment}</div>
                )}
              </div>
            ))
          )}

          {/* FORM ĐÁNH GIÁ */}
          {user && (
            <>
              <Divider />
              <h3 style={{ marginBottom: 16 }}>Viết đánh giá của bạn</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ color: mutedText }}>Đánh giá:</span>
                  <Rate
                    value={reviewForm.rating}
                    onChange={(v) => setReviewForm(f => ({ ...f, rating: v }))}
                  />
                </div>
                <textarea
                  value={reviewForm.comment}
                  onChange={(e) => setReviewForm(f => ({ ...f, comment: e.target.value }))}
                  placeholder="Nhận xét về sản phẩm..."
                  rows={4}
                  style={{
                    width: '100%', padding: 12, borderRadius: 8,
                    background: dark ? 'rgba(255,255,255,0.05)' : '#fff',
                    border: `1px solid ${borderColor}`,
                    color: 'inherit', resize: 'vertical', fontSize: 14, outline: 'none',
                  }}
                />
                <Button
                  type="primary"
                  loading={submittingReview}
                  onClick={handleSubmitReview}
                  style={{ width: 'fit-content', maxWidth: '100%', background: '#b6462f', borderColor: '#b6462f' }}
                >
                  Gửi đánh giá
                </Button>
              </div>
            </>
          )}
        </div>

        {/* ===== SẢN PHẨM LIÊN QUAN ===== */}
        {related.length > 0 && (
          <div style={sectionStyle}>
            <h2 style={{ marginBottom: 24, fontSize: 18, fontWeight: 700 }}>CÓ THỂ BẠN CŨNG THÍCH</h2>
            <Row gutter={[16, 16]}>
              {related.map((p) => (
                <Col xs={12} sm={8} md={6} lg={4} key={p._id}>
                  <div
                    onClick={() => { navigate(`/dashboard/member/store/${p._id}`); window.scrollTo(0, 0) }}
                    style={{ cursor: 'pointer' }}
                  >
                    <img
                      src={p.image || p.images?.[0] || 'https://placehold.co/200x200'}
                      alt={p.name}
                      style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }}
                    />
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                      {p.name?.slice(0, 40)}{p.name?.length > 40 ? '...' : ''}
                    </div>
                    <div style={{ color: '#b6462f', fontWeight: 700 }}>
                      {p.price?.toLocaleString('vi-VN')}đ
                    </div>
                    {(p.rating ?? 0) > 0 && (
                      <Rate disabled value={p.rating ?? 0} allowHalf style={{ fontSize: 12 }} />
                    )}
                  </div>
                </Col>
              ))}
            </Row>
          </div>
        )}

      </div>
    </MemberLayout>
  )
}
