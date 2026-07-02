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
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { deleteProduct, getMyProducts } from '../../../services/productService'
import { getMyShop, updateMyShop } from '../../../services/shopService'
import type { AdminProduct } from '../../../types/admin/product'

export default function SellerProductsPage() {
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
      message.error(err.response?.data?.message || 'Tải sản phẩm thất bại')
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
      message.success('Xóa sản phẩm thành công')
      fetchProducts()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Xóa sản phẩm thất bại')
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
      message.success('Cập nhật cửa hàng thành công')
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Cập nhật cửa hàng thất bại')
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
              color: 'var(--gs-text-muted)', fontSize: 12,
            }}>
              {'Không có ảnh'}
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
          <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/seller/products/edit/${p._id}`)} />
          <Popconfirm
            title="Bạn có chắc muốn xóa sản phẩm này?"
            onConfirm={() => handleDelete(p._id)}
            okText="Xóa"
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
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)]" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent, #b6462f) 14%, transparent), transparent)' }}>
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Người bán</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">Quản lý sản phẩm</h1>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">Tổng cộng {products.length} sản phẩm</p>
      </div>

      <div className="mb-6 rounded-[24px] border border-[var(--gs-border)] p-6 max-[640px]:p-4" style={{ background: 'var(--gs-card)' }}>
        <h2 className="mb-4 text-xl font-semibold">Thông tin cửa hàng</h2>
        <Form layout="vertical" form={shopForm} onFinish={handleSaveShop}>
          <Form.Item label="Tên cửa hàng" name="name" rules={[{ required: true, message: 'Vui lòng nhập tên cửa hàng' }]}> 
            <Input />
          </Form.Item>
          <Form.Item label="Mô tả" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item label="Địa chỉ" name={['address', 'street']}>
              <Input placeholder="Số nhà, tên đường" />
            </Form.Item>
            <Form.Item label="Phường/Xã" name={['address', 'ward']}>
              <Input />
            </Form.Item>
            <Form.Item label="Quận/Huyện" name={['address', 'district']}>
              <Input />
            </Form.Item>
            <Form.Item label="Tỉnh/Thành phố" name={['address', 'city']}>
              <Input />
            </Form.Item>
          </div>
          <Button type="primary" htmlType="submit" loading={shopSaving}>
            {'Lưu'}
          </Button>
          {shop?.rating > 0 && (
            <span className="ml-3 text-sm text-[var(--gs-text-muted)]">
              {`${shop.rating.toFixed(1)} ⭐ (${shop.reviewCount || 0} đánh giá)`}
            </span>
          )}
        </Form>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] p-6 max-[640px]:p-4" style={{ background: 'var(--gs-card)' }}>
        <div className="dashboard-filter-bar">
          <Space wrap>
            <Input.Search
              placeholder="Tìm kiếm sản phẩm..."
              allowClear
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              allowClear
              placeholder="Lọc danh mục"
              style={{ minWidth: 180 }}
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={existingCategories.map((category) => ({ label: category, value: category }))}
            />
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/seller/products/create')}>
            {'Thêm sản phẩm'}
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
