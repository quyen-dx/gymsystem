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
  Space,
  Table,
  Tag,
} from 'antd'
import { useEffect, useState } from 'react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { createProduct, deleteProduct, getMyProducts, updateProduct } from '../../services/productService'
import type { AdminProduct } from '../../types/admin/product'

export default function SellerProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AdminProduct | null>(null)
  const [form] = Form.useForm()
  const [submitLoading, setSubmitLoading] = useState(false)
  const [search, setSearch] = useState('')

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

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      weightVariants: [{ label: '', priceDelta: 0 }],
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
        : (record.weights || []).map((label: string) => ({ label, priceDelta: 0 })),
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
        .map((item: { label?: string; priceDelta?: number }) => ({
          label: String(item?.label || '').trim(),
          priceDelta: Number(item?.priceDelta || 0),
        }))
        .filter((item: { label: string }) => item.label)
        .map((item: { label: string; priceDelta: number }) => ({
          ...item,
          priceDelta: Number.isFinite(item.priceDelta) && item.priceDelta > 0 ? item.priceDelta : 0,
        }))

      const payload = {
        ...values,
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

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  )

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
      dataIndex: 'stock',
      render: (s: number) => (
        <Tag color={s > 0 ? 'green' : 'red'}>{s} cái</Tag>
      ),
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

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[rgba(23,23,23,0.92)] p-6">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
          <Input.Search
            placeholder="Tìm sản phẩm, danh mục..."
            allowClear
            style={{ maxWidth: 320 }}
            onChange={(e) => setSearch(e.target.value)}
          />
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
          <Form.Item label="Giá (VNĐ)" name="price" rules={[{ required: true, message: 'Nhập giá' }]}>
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              placeholder="VD: 200000"
            />
          </Form.Item>
          <Form.Item label="Danh mục" name="category">
            <Input placeholder="VD: Phụ kiện, Dinh dưỡng..." />
          </Form.Item>
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
                        style={{ width: 180, marginBottom: 0 }}
                      >
                        <InputNumber
                          min={0}
                          style={{ width: '100%' }}
                          placeholder="Tiền cộng"
                          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        />
                      </Form.Item>
                      <Button
                        danger
                        type="text"
                        icon={<MinusCircleOutlined />}
                        onClick={() => remove(field.name)}
                      />
                    </div>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ label: '', priceDelta: 0 })}>
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
