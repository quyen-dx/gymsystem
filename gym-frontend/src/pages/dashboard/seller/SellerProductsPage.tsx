import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import {
  Button,
  Form,
  Image,
  Input,
  message,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { deleteProduct, getMyProducts } from '../../../services/productService'
import { getMyShop, updateMyShop } from '../../../services/shopService'
import type { AdminProduct } from '../../../types/admin/product'

export default function SellerProductsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>()
  const [shop, setShop] = useState<any>(null)
  const [shopForm] = Form.useForm()
  const [shopSaving, setShopSaving] = useState(false)

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const res = await getMyProducts()
      setProducts(res.data.products || [])
    } catch (err: any) {
      message.error(err.response?.data?.message || t('seller_products.load_failed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProducts() }, [])

  const fetchShop = async () => {
    try {
      const res = await getMyShop()
      setShop(res.data.shop)
      shopForm.setFieldsValue({
        name: res.data.shop?.name,
        description: res.data.shop?.description,
        address: res.data.shop?.address || {},
      })
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => { fetchShop() }, [])

  const handleDelete = async (id: string) => {
    try {
      await deleteProduct(id)
      message.success(t('seller_products.delete_success'))
      fetchProducts()
    } catch (err: any) {
      message.error(err.response?.data?.message || t('seller_products.delete_failed'))
    }
  }

  const existingCategories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort()

  const filtered = products.filter(p =>
    (!categoryFilter || p.category === categoryFilter) &&
    (p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.toLowerCase().includes(search.toLowerCase()))
  )

  const handleSaveShop = async (values: any) => {
    setShopSaving(true)
    try {
      const res = await updateMyShop(values)
      setShop(res.data.shop)
      message.success(t('seller_products.shop_update_success'))
    } catch (err: any) {
      message.error(err.response?.data?.message || t('seller_products.shop_update_failed'))
    } finally {
      setShopSaving(false)
    }
  }

  const columns = [
    {
      title: t('seller_products.product'),
      render: (_: any, p: AdminProduct) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {p.image ? (
            <Image
              src={p.image}
              width={48}
              height={48}
              style={{ objectFit: 'cover', borderRadius: 8 }}
              fallback="https://placehold.co/48x48"
            />
          ) : (
            <div style={{
              width: 48, height: 48, borderRadius: 8,
              background: '#333', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: 'var(--gs-text-muted)', fontSize: 12,
            }}>
              {t('seller_products.no_image')}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 600 }}>{p.name}</div>
            <div style={{ fontSize: 12, color: 'var(--gs-text-muted)' }}>
              {p.description?.slice(0, 50)}{p.description?.length > 50 ? '...' : ''}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: t('seller_products.category'),
      dataIndex: 'category',
      render: (c: string) => <Tag>{c || t('seller_products.other')}</Tag>,
    },
    {
      title: t('seller_products.price'),
      dataIndex: 'price',
      render: (v: number) => v?.toLocaleString('vi-VN') + 'đ',
    },
    {
      title: t('seller_products.stock'),
      render: (_: any, p: AdminProduct) => {
        const variants = p.weightVariants || []
        if (variants.length > 0) {
          return (
            <Space direction="vertical" size={4}>
              {variants.map((variant) => {
                const stock = Number(variant.stock || 0)
                const color = stock <= 0 ? 'red' : stock <= 3 ? 'gold' : 'green'
                const text = stock <= 0 ? t('seller_products.out_of_stock') : stock <= 3 ? t('seller_products.low_stock') : t('seller_products.in_stock')
                return (
                  <Tag key={variant.label} color={color}>
                    {variant.label}: {stock} - {text}
                  </Tag>
                )
              })}
            </Space>
          )
        }
        const stock = Number(p.stock || 0)
        return <Tag color={stock > 0 ? 'green' : 'red'}>{stock > 0 ? `${stock} ${t('seller_products.piece')}` : t('seller_products.out_of_stock')}</Tag>
      },
    },
    {
      title: t('seller_products.actions'),
      render: (_: any, p: AdminProduct) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/seller/products/edit/${p._id}`)} />
          <Popconfirm
            title={t('seller_products.delete_confirm')}
            onConfirm={() => handleDelete(p._id)}
            okText={t('seller_products.delete')}
            cancelText={t('seller_products.cancel')}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)]" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent, #b6462f) 14%, transparent), transparent)' }}>
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">{t('seller_products.seller_label')}</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">{t('seller_products.hero_title')}</h1>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">{t('seller_products.total_products', { count: products.length })}</p>
      </div>

      <div className="mb-6 rounded-[24px] border border-[var(--gs-border)] p-6 max-[640px]:p-4" style={{ background: 'var(--gs-card)' }}>
        <h2 className="mb-4 text-xl font-semibold">{t('seller_products.shop_info')}</h2>
        <Form layout="vertical" form={shopForm} onFinish={handleSaveShop}>
          <Form.Item label={t('seller_products.shop_name')} name="name" rules={[{ required: true, message: t('seller_products.shop_name_required') }]}> 
            <Input />
          </Form.Item>
          <Form.Item label={t('seller_products.shop_description')} name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item label={t('seller_products.shop_address')} name={['address', 'street']}>
              <Input placeholder={t('seller_products.street_placeholder')} />
            </Form.Item>
            <Form.Item label={t('seller_products.ward')} name={['address', 'ward']}>
              <Input />
            </Form.Item>
            <Form.Item label={t('seller_products.district')} name={['address', 'district']}>
              <Input />
            </Form.Item>
            <Form.Item label={t('seller_products.city')} name={['address', 'city']}>
              <Input />
            </Form.Item>
          </div>
          <Button type="primary" htmlType="submit" loading={shopSaving}>
            {t('seller_products.save_shop')}
          </Button>
          {shop?.rating > 0 && (
            <span className="ml-3 text-sm text-[var(--gs-text-muted)]">
              {t('seller_products.shop_rating', { rating: shop.rating.toFixed(1), count: shop.reviewCount || 0 })}
            </span>
          )}
        </Form>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] p-6 max-[640px]:p-4" style={{ background: 'var(--gs-card)' }}>
        <div className="dashboard-filter-bar">
          <Space wrap>
            <Input.Search
              placeholder={t('seller_products.search_placeholder')}
              allowClear
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              allowClear
              placeholder={t('seller_products.category_filter')}
              style={{ minWidth: 180 }}
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={existingCategories.map((category) => ({ label: category, value: category }))}
            />
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/seller/products/create')}>
            {t('seller_products.add_product')}
          </Button>
        </div>

        <div className="member-scroll-x">
          <Table
            dataSource={filtered}
            columns={columns}
            rowKey="_id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </div>
      </div>
    </DashboardLayout>
  )
}
