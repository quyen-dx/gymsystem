import { DeleteOutlined, EditOutlined, MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import {
  Button,
  Form,
  Image,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { createProduct, deleteProduct, getMyProducts, updateProduct } from '../../../services/productService'
import { getMyShop, updateMyShop } from '../../../services/shopService'
import type { AdminProduct } from '../../../types/admin/product'

export default function SellerProductsPage() {
  const { t } = useTranslation()
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AdminProduct | null>(null)
  const [form] = Form.useForm()
  const weightVariants = Form.useWatch('weightVariants', form) || []
  const hasVariants = Array.isArray(weightVariants) && weightVariants.length > 0
  const [submitLoading, setSubmitLoading] = useState(false)
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
        avatar: res.data.shop?.avatar,
        address: res.data.shop?.address || {},
      })
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => { fetchShop() }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      weightVariants: [{ label: '', priceDelta: 0, stock: 0 }],
    })
    setModalOpen(true)
  }

  const openEdit = (record: AdminProduct) => {
    setEditing(record)
    form.setFieldsValue({
      ...record,
      imagesRaw: (record.images || []).join('\n'),
      descriptionImagesRaw: (record.descriptionImages || []).join('\n'),
      weightVariants: record.weightVariants?.length
        ? record.weightVariants
        : (record.weights || []).map((label: string) => ({ label, priceDelta: 0, stock: 0 })),
    })
    setModalOpen(true)
  }

  const handleSubmit = async (values: any) => {
    setSubmitLoading(true)
    try {
      const parsedImages = Array.isArray(values.images)
        ? values.images
        : (values.imagesRaw || '')
          .split('\n')
          .map((s: string) => s.trim())
          .filter(Boolean)

      const parsedDescriptionImages = Array.isArray(values.descriptionImages)
        ? values.descriptionImages
        : (values.descriptionImagesRaw || '')
          .split('\n')
          .map((s: string) => s.trim())
          .filter(Boolean)

      const parsedWeightVariants = (values.weightVariants || [])
        .map((item: { label?: string; priceDelta?: number; stock?: number }) => ({
          label: String(item?.label || '').trim(),
          priceDelta: Number(item?.priceDelta || 0),
          stock: Number(item?.stock || 0),
        }))
        .filter((item: { label: string }) => item.label)
        .map((item: { label: string; priceDelta: number; stock: number }) => ({
          ...item,
          priceDelta: Number.isFinite(item.priceDelta) && item.priceDelta > 0 ? item.priceDelta : 0,
          stock: Number.isFinite(item.stock) && item.stock > 0 ? item.stock : 0,
        }))

      const payload = {
        ...values,
        price: parsedWeightVariants.length > 0 ? parsedWeightVariants[0].priceDelta : Number(values.price || 0),
        stock: parsedWeightVariants.length > 0
          ? parsedWeightVariants.reduce((sum: number, item: { stock: number }) => sum + item.stock, 0)
          : Number(values.stock || 0),
        images: parsedImages,
        descriptionImages: parsedDescriptionImages,
        weights: parsedWeightVariants.map((item: { label: string }) => item.label),
        weightVariants: parsedWeightVariants,
      }

      if (editing) {
        await updateProduct(editing._id, payload)
        message.success(t('seller_products.update_success'))
      } else {
        await createProduct(payload)
        message.success(t('seller_products.create_success'))
      }

      setModalOpen(false)
      fetchProducts()
    } catch (err: any) {
      message.error(err.response?.data?.message || t('seller_products.action_failed'))
    } finally {
      setSubmitLoading(false)
    }
  }

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
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(p)} />
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
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">{t('seller_products.seller_label')}</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">{t('seller_products.hero_title')}</h1>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">{t('seller_products.total_products', { count: products.length })}</p>
      </div>

      <div className="mb-6 rounded-[24px] border border-[var(--gs-border)] bg-[rgba(23,23,23,0.92)] p-6 max-[640px]:p-4">
        <h2 className="mb-4 text-xl font-semibold">{t('seller_products.shop_info')}</h2>
        <Form layout="vertical" form={shopForm} onFinish={handleSaveShop}>
          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item label={t('seller_products.shop_name')} name="name" rules={[{ required: true, message: t('seller_products.shop_name_required') }]}> 
              <Input />
            </Form.Item>
            <Form.Item label={t('seller_products.shop_avatar')} name="avatar">
              <Input placeholder="https://..." />
            </Form.Item>
          </div>
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

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[rgba(23,23,23,0.92)] p-6 max-[640px]:p-4">
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
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
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

      <Modal
        title={editing ? t('seller_products.edit_product') : t('seller_products.add_product')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form layout="vertical" form={form} onFinish={handleSubmit}>
          <Form.Item label={t('seller_products.product_name')} name="name" rules={[{ required: true, message: t('seller_products.product_name_required') }]}> 
            <Input placeholder={t('seller_products.product_name_placeholder')} />
          </Form.Item>
          <Form.Item label={t('seller_products.description')} name="description">
            <Input.TextArea rows={8} placeholder={t('seller_products.description_placeholder')} />
          </Form.Item>
          <Form.Item label={t('seller_products.description_images')} name="descriptionImagesRaw">
            <Input.TextArea
              rows={4}
              placeholder={"https://detail-img1.jpg\nhttps://detail-img2.jpg"}
              onChange={(e) => {
                const arr = e.target.value.split('\n').map(s => s.trim()).filter(Boolean)
                form.setFieldValue('descriptionImages', arr)
              }}
            />
          </Form.Item>
          {!hasVariants && (
            <Form.Item label={t('seller_products.price_vnd')} name="price" rules={[{ required: true, message: t('seller_products.price_required') }]}> 
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                placeholder={t('seller_products.price_placeholder')}
              />
            </Form.Item>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12 }}>
            <Form.Item label={t('seller_products.add_category')} name="category">
              <Input placeholder={t('seller_products.form_category_placeholder')} />
            </Form.Item>
            <Form.Item label={t('seller_products.existing_category')}>
              <Select
                allowClear
                placeholder={t('seller_products.choose_category')}
                options={existingCategories.map((category) => ({ label: category, value: category }))}
                onChange={(value) => value && form.setFieldValue('category', value)}
              />
            </Form.Item>
          </div>
          <Form.Item label={t('seller_products.stock')} name="stock">
            <InputNumber style={{ width: '100%' }} min={0} placeholder={t('seller_products.stock_placeholder')} />
          </Form.Item>
          <Form.Item label={t('seller_products.image_url')} name="image">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item label={t('seller_products.extra_images')} name="imagesRaw">
            <Input.TextArea
              rows={4}
              placeholder={"https://img1.jpg\nhttps://img2.jpg"}
              onChange={(e) => {
                const arr = e.target.value.split('\n').map(s => s.trim()).filter(Boolean)
                form.setFieldValue('images', arr)
              }}
            />
          </Form.Item>
          <Form.Item label={t('seller_products.weight_variants')}>
            <Form.List name="weightVariants">
              {(fields, { add, remove }) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {fields.map((field) => (
                    <div key={field.key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'label']}
                        style={{ flex: 1, marginBottom: 0 }}
                        rules={[{ required: true, message: t('seller_products.weight_required') }]}
                      >
                        <Input placeholder={t('seller_products.weight_placeholder')} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'priceDelta']}
                        style={{ width: 170, marginBottom: 0 }}
                        rules={[
                          { required: true, message: t('seller_products.variant_price_required') },
                          { type: 'number', min: 1, message: t('seller_products.variant_price_min') },
                        ]}
                      >
                        <InputNumber
                          min={1}
                          style={{ width: '100%' }}
                          placeholder={t('seller_products.variant_price_placeholder')}
                          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={(v) => Number(String(v || '').replace(/\D/g, '')) as any}
                        />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'stock']}
                        style={{ width: 130, marginBottom: 0 }}
                        rules={[{ type: 'number', min: 0, message: t('seller_products.stock_invalid') }]}
                      >
                        <InputNumber min={0} style={{ width: '100%' }} placeholder={t('seller_products.stock')} />
                      </Form.Item>
                      <Button
                        danger
                        type="text"
                        icon={<MinusCircleOutlined />}
                        onClick={() => remove(field.name)}
                      />
                    </div>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ label: '', priceDelta: 0, stock: 0 })}>
                    {t('seller_products.add_variant')}
                  </Button>
                </div>
              )}
            </Form.List>
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitLoading}>
            {editing ? t('seller_products.update') : t('seller_products.add_product')}
          </Button>
        </Form>
      </Modal>
    </DashboardLayout>
  )
}
