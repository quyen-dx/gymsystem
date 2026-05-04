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
import DashboardLayout from '../../components/layout/DashboardLayout'
import { createProduct, deleteProduct, getMyProducts, updateProduct } from '../../services/productService'
import { getMyShop, updateMyShop } from '../../services/shopService'
import type { AdminProduct } from '../../types/admin/product'

export default function SellerProductsPage() {
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
      message.error(err.response?.data?.message || 'Không thể tải sản phẩm của shop')
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
        message.success('Cập nhật sản phẩm thành công')
      } else {
        await createProduct(payload)
        message.success('Thêm sản phẩm thành công')
      }

      setModalOpen(false)
      fetchProducts()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Thao tác thất bại')
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteProduct(id)
      message.success('Đã xoá sản phẩm')
      fetchProducts()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Xoá thất bại')
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
      message.success('Đã cập nhật thông tin shop')
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể cập nhật shop')
    } finally {
      setShopSaving(false)
    }
  }

  const columns = [
    {
      title: 'Sản phẩm',
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
              color: '#888', fontSize: 12,
            }}>
              No img
            </div>
          )}
          <div>
            <div style={{ fontWeight: 600 }}>{p.name}</div>
            <div style={{ fontSize: 12, color: '#888' }}>
              {p.description?.slice(0, 50)}{p.description?.length > 50 ? '...' : ''}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Danh mục',
      dataIndex: 'category',
      render: (c: string) => <Tag>{c || 'Khác'}</Tag>,
    },
    {
      title: 'Giá',
      dataIndex: 'price',
      render: (v: number) => v?.toLocaleString('vi-VN') + 'đ',
    },
    {
      title: 'Tồn kho',
      render: (_: any, p: AdminProduct) => {
        const variants = p.weightVariants || []
        if (variants.length > 0) {
          return (
            <Space direction="vertical" size={4}>
              {variants.map((variant) => {
                const stock = Number(variant.stock || 0)
                const color = stock <= 0 ? 'red' : stock <= 3 ? 'gold' : 'green'
                const text = stock <= 0 ? 'Hết hàng' : stock <= 3 ? 'Sắp hết' : 'Còn hàng'
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
        return <Tag color={stock > 0 ? 'green' : 'red'}>{stock > 0 ? `${stock} cái` : 'Hết hàng'}</Tag>
      },
    },
    {
      title: 'Thao tác',
      render: (_: any, p: AdminProduct) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(p)} />
          <Popconfirm
            title="Xoá sản phẩm này?"
            onConfirm={() => handleDelete(p._id)}
            okText="Xoá"
            cancelText="Hủy"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <DashboardLayout>
      <div className="mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))] p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Seller</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)]">Sản phẩm của shop</h1>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">Tổng: {products.length} sản phẩm</p>
      </div>

      <div className="mb-6 rounded-[24px] border border-[var(--gs-border)] bg-[rgba(23,23,23,0.92)] p-6">
        <h2 className="mb-4 text-xl font-semibold">Thông tin shop</h2>
        <Form layout="vertical" form={shopForm} onFinish={handleSaveShop}>
          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item label="Tên shop" name="name" rules={[{ required: true, message: 'Nhập tên shop' }]}>
              <Input />
            </Form.Item>
            <Form.Item label="Avatar shop (URL)" name="avatar">
              <Input placeholder="https://..." />
            </Form.Item>
          </div>
          <Form.Item label="Mô tả shop" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item label="Địa chỉ shop" name={['address', 'street']}>
              <Input placeholder="Số nhà, tên đường" />
            </Form.Item>
            <Form.Item label="Phường / xã" name={['address', 'ward']}>
              <Input />
            </Form.Item>
            <Form.Item label="Quận / huyện" name={['address', 'district']}>
              <Input />
            </Form.Item>
            <Form.Item label="Tỉnh / thành phố" name={['address', 'city']}>
              <Input />
            </Form.Item>
          </div>
          <Button type="primary" htmlType="submit" loading={shopSaving}>
            Lưu thông tin shop
          </Button>
          {shop?.rating > 0 && (
            <span className="ml-3 text-sm text-[var(--gs-text-muted)]">
              Đánh giá shop: {shop.rating.toFixed(1)} ({shop.reviewCount || 0})
            </span>
          )}
        </Form>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[rgba(23,23,23,0.92)] p-6">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
          <Space wrap>
            <Input.Search
              placeholder="Tìm sản phẩm, danh mục..."
              allowClear
              style={{ width: 320 }}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              allowClear
              placeholder="Lọc danh mục"
              style={{ minWidth: 220 }}
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={existingCategories.map((category) => ({ label: category, value: category }))}
            />
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Thêm sản phẩm
          </Button>
        </div>

        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </div>

      <Modal
        title={editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form layout="vertical" form={form} onFinish={handleSubmit}>
          <Form.Item label="Tên sản phẩm" name="name" rules={[{ required: true, message: 'Nhập tên' }]}>
            <Input placeholder="VD: Găng tay tập gym" />
          </Form.Item>
          <Form.Item label="Mô tả" name="description">
            <Input.TextArea rows={8} placeholder="Mô tả sản phẩm..." />
          </Form.Item>
          <Form.Item label="Ảnh mô tả (mỗi dòng 1 URL)" name="descriptionImagesRaw">
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
            <Form.Item label="Giá (VNĐ)" name="price" rules={[{ required: true, message: 'Nhập giá' }]}>
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                placeholder="VD: 200000"
              />
            </Form.Item>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12 }}>
            <Form.Item label="Thêm danh mục" name="category">
              <Input placeholder="VD: Phụ kiện, Dinh dưỡng..." />
            </Form.Item>
            <Form.Item label="Danh mục đã có">
              <Select
                allowClear
                placeholder="Chọn danh mục"
                options={existingCategories.map((category) => ({ label: category, value: category }))}
                onChange={(value) => value && form.setFieldValue('category', value)}
              />
            </Form.Item>
          </div>
          <Form.Item label="Tồn kho" name="stock">
            <InputNumber style={{ width: '100%' }} min={0} placeholder="VD: 100" />
          </Form.Item>
          <Form.Item label="Ảnh (URL)" name="image">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item label="Ảnh phụ (mỗi dòng 1 URL)" name="imagesRaw">
            <Input.TextArea
              rows={4}
              placeholder={"https://img1.jpg\nhttps://img2.jpg"}
              onChange={(e) => {
                const arr = e.target.value.split('\n').map(s => s.trim()).filter(Boolean)
                form.setFieldValue('images', arr)
              }}
            />
          </Form.Item>
          <Form.Item label="Biến thể trọng lượng">
            <Form.List name="weightVariants">
              {(fields, { add, remove }) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {fields.map((field) => (
                    <div key={field.key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'label']}
                        style={{ flex: 1, marginBottom: 0 }}
                        rules={[{ required: true, message: 'Nhập trọng lượng' }]}
                      >
                        <Input placeholder="VD: 1kg, 2kg, 5kg" />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'priceDelta']}
                        style={{ width: 170, marginBottom: 0 }}
                        rules={[
                          { required: true, message: 'Nhập giá bán cho biến thể' },
                          { type: 'number', min: 1, message: 'Giá phải lớn hơn 0' },
                        ]}
                      >
                        <InputNumber
                          min={1}
                          style={{ width: '100%' }}
                          placeholder="Giá bán (VNĐ)"
                          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={(v) => Number(String(v || '').replace(/\D/g, '')) as any}
                        />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'stock']}
                        style={{ width: 130, marginBottom: 0 }}
                        rules={[{ type: 'number', min: 0, message: 'Tồn kho không hợp lệ' }]}
                      >
                        <InputNumber min={0} style={{ width: '100%' }} placeholder="Tồn kho" />
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
                    Thêm biến thể
                  </Button>
                </div>
              )}
            </Form.List>
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitLoading}>
            {editing ? 'Cập nhật' : 'Thêm sản phẩm'}
          </Button>
        </Form>
      </Modal>
    </DashboardLayout>
  )
}
