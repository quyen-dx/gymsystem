import {
  ArrowLeftOutlined, ShopOutlined, ShoppingCartOutlined, UserOutlined
} from '@ant-design/icons'
import {
  Avatar, Button, Image, InputNumber,
  Rate, Spin, Tag, message
} from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { useTheme } from '../../../context/ThemeProvider'
import { useCart } from '../../../context/useCart'
import { useAuth } from '../../../hooks/useAuth'
import { addReview, getProductById } from '../../../services/productService'
import type { MemberProduct } from '../../../types/member/product'
import { getUserDisplayName } from '../../../utils/userDisplay'

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

const renderProductDescription = (html: string | null | undefined, plainText: string | null | undefined): string => {
  if (html) return html
  const text = (plainText || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return text.replace(/(https?:\/\/[^\s]+)/gi, (url) => {
    if (/\.(jpg|jpeg|png|webp|gif)(\?|#|$)/i.test(url)) {
      return `<img src="${url}" alt="" class="product-description-image" />`
    }
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
  })
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
            ? { ...review, name: getUserDisplayName(user, review.name || 'User'), avatar: user.avatar || '' }
            : review,
        ),
      }
    })
  }, [user?._id, user?.fullName, user?.displayName, user?.name, user?.avatar])

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
    if (selectedStock <= 0) { message.error('Biến thể này đã hết hàng'); return }
    if (qty > selectedStock) { message.error(`Chỉ còn ${selectedStock} sản phẩm cho biến thể này`); return }
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
      const err = error as any
      message.error(err.response?.data?.message || 'Đánh giá thất bại')
    } finally { setSubmittingReview(false) }
  }

  if (loading) {
    return (
      <MemberLayout>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>
      </MemberLayout>
    )
  }

  if (!product) {
    return (
      <MemberLayout>
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Button onClick={() => navigate('/store')}>Quay lại cửa hàng</Button>
        </div>
      </MemberLayout>
    )
  }

  const allImages = Array.from(
    new Set([...normalizeImageList(product.images), product.image].filter((s): s is string => !!s)),
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
  const shop = typeof product.shop_id === 'object' ? product.shop_id : null
  const shopOwner = shop?.user_id
  const shopName = shop?.name || shopOwner?.name || product.partner?.name || 'Shop'
  const shopAvatar = shopOwner?.avatar || shop?.avatar || product.partner?.avatar
  const shopRating = shop?.rating ?? 0
  const shopReviewCount = shop?.reviewCount ?? 0
  const shopId = shop?._id
  const descriptionImages = normalizeImageList(product.descriptionImages)
  const starDist = [5, 4, 3, 2, 1].map(s => ({ star: s, count: reviews.filter(r => r.rating === s).length }))
  const filteredReviews = ratingFilter ? reviews.filter(r => r.rating === ratingFilter) : reviews

  const c = (dark: boolean) => ({
    border: 'var(--gs-border)',
    muted: 'var(--gs-text-muted)',
    text: 'var(--gs-text)',
    card: 'var(--gs-card)',
    accent: 'var(--theme-accent, #b6462f)',
    thumbBg: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
  })

  const colors = c(dark)

  return (
    <MemberLayout>
      <div className="product-detail-page">
        <div className="pdp-inner">
          {/* ===== BACK ===== */}
          <button className="pdp-back" onClick={() => navigate('/store')}>
            <ArrowLeftOutlined /> Quay lại cửa hàng
          </button>

          {/* ===== HERO ===== */}
          <div className="pdp-hero">
            <div className="pdp-gallery">
              <div className="pdp-main-img-wrap">
                <Image.PreviewGroup items={allImages}>
                  <Image
                    src={activeImg || 'https://placehold.co/400x400'}
                    alt={product.name}
                    className="pdp-main-img"
                  />
                </Image.PreviewGroup>
              </div>
              {allImages.length > 1 && (
                <div className="pdp-thumbs">
                  {allImages.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt={`thumb-${i}`}
                      onClick={() => setActiveImg(img)}
                      className={`pdp-thumb${activeImg === img ? ' pdp-thumb--active' : ''}`}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="pdp-info">
              <h1 className="pdp-name">{product.name}</h1>

              <div className="pdp-rating-row">
                <Rate disabled defaultValue={rating} allowHalf className="pdp-stars" />
                <span className="pdp-rating-num">{rating.toFixed(1)}</span>
                <span className="pdp-rating-count">({reviewCount} đánh giá)</span>
              </div>

              <div className="pdp-price">{dynamicPrice.toLocaleString('vi-VN')}đ</div>

              {weightVariants.length > 0 && (
                <div className="pdp-variants">
                  <div className="pdp-variant-label">Trọng lượng</div>
                  <div className="pdp-variant-list">
                    {weightVariants.map((v) => {
                      const isActive = activeWeight === v.label
                      const hasStock = Number(v.stock || 0) > 0
                      return (
                        <button
                          key={v.label}
                          type="button"
                          disabled={!hasStock}
                          onClick={() => setActiveWeight(v.label)}
                          className={`pdp-variant-btn${isActive ? ' pdp-variant-btn--active' : ''}`}
                        >
                          {v.label}
                        </button>
                      )
                    })}
                  </div>
                  {selectedVariant && (
                    <div className="pdp-variant-tags">
                      <Tag color="blue">{selectedVariant.label}</Tag>
                      <Tag color={stock > 0 ? 'green' : 'red'}>
                        {stock > 0 ? `Còn ${stock}` : 'Hết hàng'}
                      </Tag>
                    </div>
                  )}
                </div>
              )}
              {weightVariants.length === 0 && (
                <div className="pdp-stock-tag">
                  <Tag color={stock > 0 ? 'green' : 'red'}>
                    {stock > 0 ? `Còn ${stock} sản phẩm` : 'Hết hàng'}
                  </Tag>
                </div>
              )}

              <div className="pdp-qty-row">
                <span className="pdp-qty-label">Số lượng:</span>
                <InputNumber min={1} max={stock || 99} value={qty} onChange={(v) => setQty(v || 1)} disabled={!inStock} />
              </div>

              <div className="pdp-actions">
                <Button type="primary" size="large" icon={<ShoppingCartOutlined />} disabled={!inStock} onClick={handleAddToCart} className="pdp-btn-cart">
                  Thêm vào giỏ
                </Button>
                <Button size="large" onClick={() => navigate('/cart')} className="pdp-btn-view">
                  Xem giỏ hàng
                </Button>
              </div>
            </div>
          </div>

          {/* ===== SHOP ===== */}
          {shop && (
            <div className="pdp-shop-card" onClick={() => shopId && navigate(`/store/${shopId}`)}>
              <Avatar size={52} src={shopAvatar} icon={<ShopOutlined />} className="pdp-shop-avatar" />
              <div className="pdp-shop-info">
                <div className="pdp-shop-name">{shopName}</div>
                <div className="pdp-shop-rating-row">
                  <Rate disabled allowHalf value={shopRating} className="pdp-shop-stars" />
                  <span className="pdp-shop-rating-text">{shopRating.toFixed(1)} ({shopReviewCount} đánh giá)</span>
                </div>
                <div className="pdp-shop-desc">Shop bán sản phẩm này</div>
              </div>
            </div>
          )}

          {!shop && product.partner?.name && (
            <div className="pdp-shop-card">
              <Avatar size={52} src={product.partner.avatar} icon={<UserOutlined />} className="pdp-shop-avatar" />
              <div className="pdp-shop-info">
                <div className="pdp-shop-name">{product.partner.name}</div>
                {product.partner.description && <div className="pdp-shop-desc">{product.partner.description}</div>}
              </div>
            </div>
          )}

          {/* ===== DESCRIPTION ===== */}
          <div className="pdp-description-card">
            <h2 className="pdp-section-title">Mô tả sản phẩm</h2>
            <div className="pdp-description-content" dangerouslySetInnerHTML={{
              __html: renderProductDescription(product.descriptionHtml, product.description)
            }} />
            {descriptionImages.length > 0 && (
              <div className="pdp-desc-images">
                {descriptionImages.map((img, i) => (
                  <Image key={i} src={img} alt={`${product.name} mô tả ${i + 1}`} className="pdp-desc-image" />
                ))}
              </div>
            )}
          </div>

          {/* ===== REVIEWS ===== */}
          <div className="pdp-review-card">
            <h2 className="pdp-section-title">Đánh giá sản phẩm</h2>

            <div className="pdp-review-summary">
              <div className="pdp-review-score-col">
                <div className="pdp-review-score-num">{rating.toFixed(1)}</div>
                <Rate disabled value={rating} allowHalf className="pdp-review-stars" />
                <div className="pdp-review-score-count">{reviewCount} đánh giá</div>
              </div>
              <div className="pdp-review-dist">
                {starDist.map(({ star, count }) => (
                  <div key={star} className="pdp-star-row">
                    <span className="pdp-star-label">{star} sao</span>
                    <div className="pdp-star-track">
                      <div className="pdp-star-fill" style={{
                        width: reviewCount > 0 ? `${(count / reviewCount) * 100}%` : '0%',
                      }} />
                    </div>
                    <span className="pdp-star-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pdp-review-filters">
              <button className={`pdp-filter-btn${ratingFilter === null ? ' pdp-filter-btn--active' : ''}`} onClick={() => setRatingFilter(null)}>Tất cả</button>
              {[5, 4, 3, 2, 1].map(s => (
                <button
                  key={s}
                  className={`pdp-filter-btn${ratingFilter === s ? ' pdp-filter-btn--active' : ''}`}
                  onClick={() => setRatingFilter(ratingFilter === s ? null : s)}
                >
                  {s} Sao ({starDist.find(d => d.star === s)?.count || 0})
                </button>
              ))}
            </div>

            {filteredReviews.length === 0 ? (
              <div className="pdp-review-empty">Chưa có đánh giá nào</div>
            ) : (
              filteredReviews.map((review) => (
                <div key={review._id} className="pdp-review-item">
                  <div className="pdp-review-item-header">
                    <Avatar src={review.avatar} icon={<UserOutlined />} size={36} />
                    <div>
                      <div className="pdp-review-item-name">{review.name}</div>
                      <div className="pdp-review-item-date">{new Date(review.createdAt).toLocaleDateString('vi-VN')}</div>
                    </div>
                  </div>
                  <Rate disabled value={review.rating} className="pdp-review-item-stars" />
                  {review.comment && <div className="pdp-review-item-comment">{review.comment}</div>}
                </div>
              ))
            )}

            {user && (
              <div className="pdp-review-form">
                <h3 className="pdp-review-form-title">Viết đánh giá của bạn</h3>
                <div className="pdp-review-form-row">
                  <span>Đánh giá:</span>
                  <Rate value={reviewForm.rating} onChange={(v) => setReviewForm(f => ({ ...f, rating: v }))} />
                </div>
                <textarea
                  value={reviewForm.comment}
                  onChange={(e) => setReviewForm(f => ({ ...f, comment: e.target.value }))}
                  placeholder="Nhận xét về sản phẩm..."
                  rows={4}
                  className="pdp-review-textarea"
                />
                <Button type="primary" loading={submittingReview} onClick={handleSubmitReview} className="pdp-review-submit">
                  Gửi đánh giá
                </Button>
              </div>
            )}
          </div>

          {/* ===== RELATED ===== */}
          {related.length > 0 && (
            <div className="pdp-related-card">
              <h2 className="pdp-section-title">Có thể bạn cũng thích</h2>
              <div className="pdp-related-grid">
                {related.map((p) => (
                  <div key={p._id} className="pdp-related-item" onClick={() => { navigate(`/product/${p._id}`); window.scrollTo(0, 0) }}>
                    <div className="pdp-related-img-wrap">
                      <img src={p.image || p.images?.[0] || 'https://placehold.co/200x200'} alt={p.name} className="pdp-related-img" />
                    </div>
                    <div className="pdp-related-body">
                      <div className="pdp-related-name">{p.name?.slice(0, 50)}{p.name?.length > 50 ? '...' : ''}</div>
                      <div className="pdp-related-price">{p.price?.toLocaleString('vi-VN')}đ</div>
                      {(p.rating ?? 0) > 0 && <Rate disabled value={p.rating ?? 0} allowHalf className="pdp-related-stars" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ height: 32 }} />
        </div>
      </div>

      <style>{`
        .product-detail-page {
          width: 100%;
        }

        .pdp-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 16px;
        }

        .pdp-back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          color: var(--gs-text);
          font-size: 14px;
          cursor: pointer;
          padding: 8px 0;
          margin-bottom: 16px;
        }

        .pdp-back:hover {
          color: var(--theme-accent, #b6462f);
        }

        /* ===== HERO ===== */
        .pdp-hero {
          display: grid;
          grid-template-columns: 520px 1fr;
          gap: 40px;
          background: var(--gs-card);
          border: 1px solid var(--gs-border);
          border-radius: 16px;
          padding: 28px;
          margin-bottom: 20px;
        }

        .pdp-main-img-wrap {
          width: 100%;
          aspect-ratio: 1;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--gs-border);
          background: ${colors.thumbBg};
        }

        .pdp-main-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          cursor: zoom-in;
        }

        .pdp-thumbs {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          flex-wrap: wrap;
        }

        .pdp-thumb {
          width: 60px;
          height: 60px;
          object-fit: cover;
          border-radius: 8px;
          cursor: pointer;
          border: 2px solid transparent;
          opacity: 0.55;
          transition: all 0.2s;
        }

        .pdp-thumb:hover {
          opacity: 0.8;
        }

        .pdp-thumb--active {
          border-color: var(--theme-accent, #b6462f);
          opacity: 1;
        }

        .pdp-info {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .pdp-name {
          margin: 0;
          font-size: 22px;
          font-weight: 700;
          line-height: 1.35;
          color: var(--gs-text);
        }

        .pdp-rating-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pdp-stars {
          font-size: 16px;
        }

        .pdp-rating-num {
          font-weight: 600;
          color: var(--gs-text);
        }

        .pdp-rating-count {
          color: ${colors.muted};
        }

        .pdp-price {
          font-size: 30px;
          font-weight: 800;
          color: var(--gs-text);
          padding: 16px 0;
          border-top: 1px solid var(--gs-border);
          border-bottom: 1px solid var(--gs-border);
        }

        .pdp-variant-label {
          color: ${colors.muted};
          font-size: 14px;
          margin-bottom: 10px;
        }

        .pdp-variant-list {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .pdp-variant-btn {
          padding: 8px 18px;
          border-radius: 10px;
          cursor: pointer;
          background: ${colors.thumbBg};
          border: 1px solid var(--gs-border);
          color: inherit;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.2s;
        }

        .pdp-variant-btn:hover {
          border-color: var(--theme-accent, #b6462f);
        }

        .pdp-variant-btn--active {
          border-color: var(--theme-accent, #b6462f);
          background: var(--theme-elevated);
        }

        .pdp-variant-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .pdp-variant-tags {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }

        .pdp-stock-tag {
          margin-bottom: 4px;
        }

        .pdp-qty-row {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .pdp-qty-label {
          color: ${colors.muted};
          font-size: 14px;
        }

        .pdp-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .pdp-btn-cart {
          flex: 1 1 200px;
          height: 48px;
          font-size: 16px;
          font-weight: 600;
          border-radius: 10px;
        }

        .pdp-btn-view {
          flex: 1 1 160px;
          height: 48px;
          font-size: 15px;
          border-radius: 10px;
        }

        /* ===== SHOP ===== */
        .pdp-shop-card {
          display: flex;
          align-items: center;
          gap: 16px;
          background: var(--gs-card);
          border: 1px solid var(--gs-border);
          border-radius: 16px;
          padding: 20px 24px;
          margin-bottom: 20px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .pdp-shop-card:hover {
          border-color: var(--theme-accent, #b6462f);
        }

        .pdp-shop-avatar {
          flex-shrink: 0;
        }

        .pdp-shop-name {
          font-weight: 700;
          font-size: 16px;
          color: var(--gs-text);
        }

        .pdp-shop-rating-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 4px;
          font-size: 13px;
          color: ${colors.muted};
        }

        .pdp-shop-stars {
          font-size: 13px;
        }

        .pdp-shop-rating-text {
          color: ${colors.muted};
        }

        .pdp-shop-desc {
          color: ${colors.muted};
          font-size: 13px;
          margin-top: 4px;
        }

        /* ===== DESCRIPTION ===== */
        .pdp-description-card {
          background: var(--gs-card);
          border: 1px solid var(--gs-border);
          border-radius: 16px;
          padding: 28px;
          margin-bottom: 20px;
        }

        .pdp-section-title {
          margin: 0 0 16px;
          font-size: 18px;
          font-weight: 700;
          color: var(--gs-text);
        }

        .pdp-description-content {
          width: 100%;
          max-width: none;
          margin: 0;
          text-align: left;
          line-height: 1.7;
          color: ${colors.muted};
          font-size: 15px;
          overflow-wrap: anywhere;
          word-break: break-word;
          white-space: pre-wrap;
        }

        .pdp-description-content p,
        .pdp-description-content div,
        .pdp-description-content h1,
        .pdp-description-content h2,
        .pdp-description-content h3,
        .pdp-description-content ul,
        .pdp-description-content ol {
          text-align: left;
          margin-left: 0;
          padding-left: 0;
        }

        .pdp-description-content .product-description-image {
          display: block;
          width: 100%;
          max-width: 800px;
          height: auto;
          object-fit: contain;
          margin: 16px auto;
          border-radius: 10px;
        }

        .pdp-description-content p {
          margin-bottom: 10px;
        }

        .pdp-description-content h1,
        .pdp-description-content h2,
        .pdp-description-content h3 {
          margin: 20px 0 10px;
          color: var(--gs-text);
        }

        .pdp-description-content ul,
        .pdp-description-content ol {
          padding-left: 24px;
          margin-bottom: 10px;
        }

        .pdp-description-content a {
          color: var(--theme-accent, #b6462f);
          text-decoration: underline;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .pdp-desc-images {
          display: grid;
          gap: 16px;
          margin-top: 24px;
        }

        .pdp-desc-image {
          width: 100%;
          max-height: 500px;
          object-fit: contain;
          border-radius: 12px;
          border: 1px solid var(--gs-border);
          background: ${colors.thumbBg};
        }

        /* ===== REVIEWS ===== */
        .pdp-review-card {
          background: var(--gs-card);
          border: 1px solid var(--gs-border);
          border-radius: 16px;
          padding: 28px;
          margin-bottom: 20px;
        }

        .pdp-review-summary {
          display: flex;
          gap: 48px;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .pdp-review-score-col {
          text-align: center;
          min-width: 140px;
        }

        .pdp-review-score-num {
          font-size: 48px;
          font-weight: 800;
          color: var(--gs-text);
          line-height: 1;
        }

        .pdp-review-stars {
          font-size: 18px;
          margin-top: 4px;
        }

        .pdp-review-score-count {
          color: ${colors.muted};
          margin-top: 4px;
          font-size: 14px;
        }

        .pdp-review-dist {
          flex: 1;
          min-width: 200px;
        }

        .pdp-star-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }

        .pdp-star-label {
          width: 40px;
          color: var(--gs-text);
          font-size: 13px;
        }

        .pdp-star-track {
          flex: 1;
          height: 8px;
          background: ${dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)'};
          border-radius: 4px;
          overflow: hidden;
        }

        .pdp-star-fill {
          height: 100%;
          background: #faad14;
          border-radius: 4px;
          transition: width 0.3s;
        }

        .pdp-star-count {
          width: 24px;
          color: ${colors.muted};
          font-size: 13px;
          text-align: right;
        }

        .pdp-review-filters {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .pdp-filter-btn {
          padding: 4px 14px;
          border-radius: 8px;
          border: 1px solid var(--gs-border);
          background: transparent;
          color: var(--gs-text);
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        }

        .pdp-filter-btn:hover {
          border-color: var(--theme-accent, #b6462f);
        }

        .pdp-filter-btn--active {
          background: var(--theme-accent, #b6462f);
          border-color: var(--theme-accent, #b6462f);
          color: #fff;
        }

        .pdp-review-empty {
          color: ${colors.muted};
          text-align: center;
          padding: 32px;
        }

        .pdp-review-item {
          padding: 16px 0;
          border-bottom: 1px solid var(--gs-border);
        }

        .pdp-review-item:last-of-type {
          border-bottom: none;
        }

        .pdp-review-item-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .pdp-review-item-name {
          font-weight: 600;
          color: var(--gs-text);
        }

        .pdp-review-item-date {
          font-size: 12px;
          color: ${colors.muted};
        }

        .pdp-review-item-stars {
          font-size: 14px;
          margin-bottom: 8px;
        }

        .pdp-review-item-comment {
          color: ${colors.muted};
          line-height: 1.7;
        }

        .pdp-review-form {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid var(--gs-border);
          max-width: 600px;
        }

        .pdp-review-form-title {
          margin: 0 0 12px;
          font-size: 16px;
          font-weight: 600;
          color: var(--gs-text);
        }

        .pdp-review-form-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
          color: ${colors.muted};
        }

        .pdp-review-textarea {
          width: 100%;
          padding: 12px;
          border-radius: 8px;
          background: var(--theme-card);
          border: 1px solid var(--gs-border);
          color: inherit;
          resize: vertical;
          font-size: 14px;
          outline: none;
          box-sizing: border-box;
        }

        .pdp-review-textarea:focus {
          border-color: var(--theme-accent, #b6462f);
        }

        .pdp-review-submit {
          margin-top: 8px;
        }

        /* ===== RELATED ===== */
        .pdp-related-card {
          background: var(--gs-card);
          border: 1px solid var(--gs-border);
          border-radius: 16px;
          padding: 28px;
          margin-bottom: 20px;
        }

        .pdp-related-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .pdp-related-item {
          cursor: pointer;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid var(--gs-border);
          background: ${colors.thumbBg};
          transition: all 0.2s;
        }

        .pdp-related-item:hover {
          border-color: var(--theme-accent, #b6462f);
          transform: translateY(-2px);
        }

        .pdp-related-img-wrap {
          width: 100%;
          aspect-ratio: 1;
          overflow: hidden;
        }

        .pdp-related-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .pdp-related-body {
          padding: 10px 12px 14px;
        }

        .pdp-related-name {
          font-weight: 600;
          font-size: 13px;
          color: var(--gs-text);
          margin-bottom: 4px;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .pdp-related-price {
          font-weight: 700;
          color: var(--gs-text);
          font-size: 14px;
        }

        .pdp-related-stars {
          font-size: 12px;
          margin-top: 2px;
        }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 1024px) {
          .pdp-hero {
            grid-template-columns: 1fr 1fr;
            gap: 28px;
          }

          .pdp-related-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 768px) {
          .pdp-hero {
            grid-template-columns: 1fr;
            gap: 24px;
            padding: 20px;
          }

          .pdp-price {
            font-size: 24px;
          }

          .pdp-review-summary {
            flex-direction: column;
            text-align: center;
          }

          .pdp-related-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 480px) {
          .pdp-hero {
            padding: 16px;
          }

          .pdp-name {
            font-size: 18px;
          }

          .pdp-price {
            font-size: 20px;
          }

          .pdp-actions {
            flex-direction: column;
          }

          .pdp-btn-cart,
          .pdp-btn-view {
            flex: 1 1 auto;
            width: 100%;
          }

          .pdp-related-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }
        }
      `}</style>
    </MemberLayout>
  )
}
