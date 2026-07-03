import {
  Button,
  Image,
  Input,
  message,
  Modal,
  Space,
  Table,
  Tag,
  Typography
} from 'antd'
import { useEffect, useState } from 'react'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { getAdminShopProducts } from '../../../services/productService'
import { deleteShop, getAdminShops } from '../../../services/shopService'
import type { AdminProduct } from '../../../types/admin/product'
import type { AdminShop } from '../../../types/admin/shop'
import AdminHistoryButton from './AdminHistoryButton'

const { Text } = Typography

export default function AdminProductsPage() {
  const [shops, setShops] = useState<AdminShop[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const [viewingProducts, setViewingProducts] = useState<AdminProduct[]>([])
  const [isProductsModalVisible, setIsProductsModalVisible] = useState(false)
  const [viewingShopName, setViewingShopName] = useState('')
  const [productsLoading, setProductsLoading] = useState(false)

  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false)
  const [deletingShop, setDeletingShop] = useState<AdminShop | null>(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchShops = async () => {
    setLoading(true)
    try {
      const res = await getAdminShops()
      setShops(res.data)
    } catch {
      message.error('Không thể tải danh sách cửa hàng')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchShops() }, [])

  const handleViewProducts = async (shop: AdminShop) => {
    setViewingShopName(shop.name)
    setProductsLoading(true)
    setIsProductsModalVisible(true)
    try {
      const res = await getAdminShopProducts(shop._id)
      setViewingProducts(res.data.products || res.data)
    } catch {
      message.error('Không thể tải sản phẩm')
    } finally {
      setProductsLoading(false)
    }
  }

  const showDeleteModal = (shop: AdminShop) => {
    setDeletingShop(shop)
    setIsDeleteModalVisible(true)
    setDeleteReason('')
  }

  const handleDeleteShop = async () => {
    if (!deletingShop) return
    if (!deleteReason.trim()) {
      message.warning('Vui lòng nhập lý do xóa')
      return
    }

    setDeleteLoading(true)
    try {
      await deleteShop(deletingShop._id, deleteReason)
      message.success(`Đã xóa cửa hàng "${deletingShop.name}"`)
      setIsDeleteModalVisible(false)
      fetchShops()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể xóa cửa hàng')
    } finally {
      setDeleteLoading(false)
    }
  }

  const filtered = shops.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.user_id?.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.user_id?.email?.toLowerCase().includes(search.toLowerCase())
  )

  const columns = [
    {
      title: 'Cửa hàng',
      render: (_: any, s: AdminShop) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Image
            src={s.avatar || 'https://placehold.co/48x48?text=Shop'}
            width={48}
            height={48}
            style={{ objectFit: 'cover', borderRadius: 8 }}
          />
          <div>
            <div style={{ fontWeight: 600 }}>{s.name}</div>
            <div style={{ fontSize: 12, color: '#888' }}>{s.description?.slice(0, 50)}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Chủ cửa hàng',
      render: (_: any, s: AdminShop) => (
        <div>
          <div>{s.user_id?.name}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{s.user_id?.email}</div>
        </div>
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      render: (d: string) => new Date(d).toLocaleDateString('vi-VN'),
    },
    {
      title: 'Trạng thái',
      render: (_: any, s: AdminShop) => (
        <Tag color={s.isActive ? 'green' : 'red'}>
          {s.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      render: (_: any, s: AdminShop) => (
        <Space>
          <Button type="link" onClick={() => handleViewProducts(s)}>Sản phẩm</Button>
          <Button type="link" danger onClick={() => showDeleteModal(s)}>Xóa</Button>
        </Space>
      ),
    },
  ]

  const productColumns = [
    {
      title: 'Sản phẩm',
      render: (_: any, p: AdminProduct) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Image src={p.image} width={40} height={40} style={{ borderRadius: 4 }} />
          <span>{p.name}</span>
        </div>
      )
    },
    { title: 'Danh mục', dataIndex: 'category' },
    { title: 'Giá', dataIndex: 'price', render: (v: number) => v.toLocaleString() + 'đ' },
    { title: 'Tồn kho', dataIndex: 'stock' },
  ]

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Admin</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">Quản lý cửa hàng</h1>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">Tổng số cửa hàng: {shops.length}</p>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
        <div className="dashboard-filter-bar">
          <Input.Search
            placeholder="Tìm kiếm cửa hàng..."
            allowClear
            onChange={(e) => setSearch(e.target.value)}
          />
          <AdminHistoryButton module="shops" title="shop" />
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
        title={`Sản phẩm của ${viewingShopName}`}
        open={isProductsModalVisible}
        onCancel={() => setIsProductsModalVisible(false)}
        footer={null}
        width={800}
      >
        <Table
          dataSource={viewingProducts}
          columns={productColumns}
          rowKey="_id"
          loading={productsLoading}
          pagination={{ pageSize: 5 }}
        />
      </Modal>

      <Modal
        title="Xác nhận xóa cửa hàng"
        open={isDeleteModalVisible}
        onOk={handleDeleteShop}
        onCancel={() => setIsDeleteModalVisible(false)}
        confirmLoading={deleteLoading}
        okText="Xóa"
        cancelText="Hủy"
        okButtonProps={{ danger: true }}
      >
        <p>Bạn có chắc chắn muốn xóa cửa hàng <strong>{deletingShop?.name}</strong>?</p>
        <p>Hành động này không thể hoàn tác và toàn bộ dữ liệu liên quan sẽ bị xóa.</p>
        <div className="mt-4">
          <Text strong>Lý do xóa</Text>
          <Input.TextArea
            rows={4}
            placeholder="Nhập lý do xóa cửa hàng..."
            value={deleteReason}
            onChange={e => setDeleteReason(e.target.value)}
            className="mt-2"
          />
        </div>
      </Modal>

    </DashboardLayout>
  )
}
