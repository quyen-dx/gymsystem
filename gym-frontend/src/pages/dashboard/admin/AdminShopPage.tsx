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
import { useTranslation } from 'react-i18next'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { getAdminShopProducts } from '../../../services/productService'
import { deleteShop, getAdminShops } from '../../../services/shopService'
import type { AdminProduct } from '../../../types/admin/product'
import type { AdminShop } from '../../../types/admin/shop'
import AdminHistoryButton from './AdminHistoryButton'

const { Text } = Typography

export default function AdminProductsPage() {
  const { t } = useTranslation()
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
      message.error(t('admin.shops.messages.fetch_failed'))
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
      message.error(t('admin.shops.messages.products_failed'))
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
      message.warning(t('admin.shops.messages.reason_required'))
      return
    }

    setDeleteLoading(true)
    try {
      await deleteShop(deletingShop._id, deleteReason)
      message.success(t('admin.shops.messages.delete_success', { name: deletingShop.name }))
      setIsDeleteModalVisible(false)
      fetchShops()
    } catch (err: any) {
      message.error(err.response?.data?.message || t('admin.shops.messages.delete_failed'))
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
      title: t('admin.shops.columns.shop'),
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
      title: t('admin.shops.columns.owner'),
      render: (_: any, s: AdminShop) => (
        <div>
          <div>{s.user_id?.name}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{s.user_id?.email}</div>
        </div>
      ),
    },
    {
      title: t('admin.shops.columns.created_at'),
      dataIndex: 'createdAt',
      render: (d: string) => new Date(d).toLocaleDateString('vi-VN'),
    },
    {
      title: t('admin.shops.columns.status'),
      render: (_: any, s: AdminShop) => (
        <Tag color={s.isActive ? 'green' : 'red'}>
          {s.isActive ? t('admin.shops.status.active') : t('admin.shops.status.inactive')}
        </Tag>
      ),
    },
    {
      title: t('admin.shops.columns.actions'),
      render: (_: any, s: AdminShop) => (
        <Space>
          <Button type="link" onClick={() => handleViewProducts(s)}>{t('admin.shops.actions.products')}</Button>
          <Button type="link" danger onClick={() => showDeleteModal(s)}>{t('admin.shops.actions.delete')}</Button>
        </Space>
      ),
    },
  ]

  const productColumns = [
    {
      title: t('admin.shops.products_columns.product'),
      render: (_: any, p: AdminProduct) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Image src={p.image} width={40} height={40} style={{ borderRadius: 4 }} />
          <span>{p.name}</span>
        </div>
      )
    },
    { title: t('admin.shops.products_columns.category'), dataIndex: 'category' },
    { title: t('admin.shops.products_columns.price'), dataIndex: 'price', render: (v: number) => v.toLocaleString() + 'đ' },
    { title: t('admin.shops.products_columns.stock'), dataIndex: 'stock' },
  ]

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Admin</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">{t('admin.shops.title')}</h1>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">{t('admin.shops.total', { count: shops.length })}</p>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
        <div className="dashboard-filter-bar">
          <Input.Search
            placeholder={t('admin.shops.search_placeholder')}
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
        title={t('admin.shops.products_modal_title', { name: viewingShopName })}
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
        title={t('admin.shops.delete_modal.title')}
        open={isDeleteModalVisible}
        onOk={handleDeleteShop}
        onCancel={() => setIsDeleteModalVisible(false)}
        confirmLoading={deleteLoading}
        okText={t('admin.shops.delete_modal.ok_text')}
        cancelText={t('admin.shops.delete_modal.cancel_text')}
        okButtonProps={{ danger: true }}
      >
        <p>{t('admin.shops.delete_modal.confirm', { name: deletingShop?.name })}</p>
        <p>{t('admin.shops.delete_modal.warning')}</p>
        <div className="mt-4">
          <Text strong>{t('admin.shops.delete_modal.reason_label')}</Text>
          <Input.TextArea
            rows={4}
            placeholder={t('admin.shops.delete_modal.reason_placeholder')}
            value={deleteReason}
            onChange={e => setDeleteReason(e.target.value)}
            className="mt-2"
          />
        </div>
      </Modal>

    </DashboardLayout>
  )
}
