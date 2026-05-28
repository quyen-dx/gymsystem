import { Button, Descriptions, Image, Input, message, Modal, Select, Space, Table, Tag, Tabs, Typography } from 'antd'
import { useEffect, useState } from 'react'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import {
  approvePartnershipRequest,
  getAdminPartnershipRequests,
  rejectPartnershipRequest,
} from '../../../services/partnershipRequestService'
import { getAdminShopProducts } from '../../../services/productService'
import { deleteShop, getAdminShops } from '../../../services/shopService'
import type { AdminProduct } from '../../../types/admin/product'
import type { AdminShop } from '../../../types/admin/shop'
import AdminHistoryButton from './AdminHistoryButton'

const { Text } = Typography

type PartnershipRequest = {
  _id: string
  brand_name: string
  category: string
  contact_name: string
  phone: string
  email: string
  website?: string
  description?: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  updated_at: string
  shop_id?: { _id: string; name: string } | null
}

const statusColor: Record<PartnershipRequest['status'], string> = {
  pending: 'gold',
  approved: 'green',
  rejected: 'red',
}

const statusLabel: Record<PartnershipRequest['status'], string> = {
  pending: 'Chờ xử lý',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
}

const categoryOptions = [
  { label: 'Thiết bị gym', value: 'Thiết bị gym' },
  { label: 'Thực phẩm thể thao', value: 'Thực phẩm thể thao' },
  { label: 'Phụ kiện', value: 'Phụ kiện' },
  { label: 'Trang phục', value: 'Trang phục' },
  { label: 'Khác', value: 'Khác' },
]

export default function AdminPartnershipRequestsPage() {
  const [activeTab, setActiveTab] = useState('requests')

  // Partnerships state
  const [requests, setRequests] = useState<PartnershipRequest[]>([])
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState('')
  const [requestSearch, setRequestSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [requestCategoryFilter, setRequestCategoryFilter] = useState<string>('')
  const [selectedRequest, setSelectedRequest] = useState<PartnershipRequest | null>(null)

  // Shop state
  const [shops, setShops] = useState<AdminShop[]>([])
  const [shopsLoading, setShopsLoading] = useState(false)
  const [shopSearch, setShopSearch] = useState('')
  const [shopCategoryFilter, setShopCategoryFilter] = useState<string>('')
  const [viewingProducts, setViewingProducts] = useState<AdminProduct[]>([])
  const [isProductsModalVisible, setIsProductsModalVisible] = useState(false)
  const [viewingShopName, setViewingShopName] = useState('')
  const [productsLoading, setProductsLoading] = useState(false)
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false)
  const [deletingShop, setDeletingShop] = useState<AdminShop | null>(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Fetch partnerships
  const fetchRequests = async () => {
    setRequestsLoading(true)
    try {
      const res = await getAdminPartnershipRequests()
      setRequests(res.data.requests || [])
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể tải yêu cầu hợp tác')
    } finally {
      setRequestsLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  // Fetch shops
  const fetchShops = async () => {
    setShopsLoading(true)
    try {
      const res = await getAdminShops()
      setShops(res.data)
    } catch {
      message.error('Không thể tải danh sách thương hiệu')
    } finally {
      setShopsLoading(false)
    }
  }

  useEffect(() => { fetchShops() }, [])

  // Partnership actions
  const handleApprove = async (request: PartnershipRequest) => {
    setActionLoadingId(request._id)
    try {
      await approvePartnershipRequest(request._id)
      message.success('Đã duyệt yêu cầu và tạo shop')
      fetchRequests()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể duyệt yêu cầu')
    } finally {
      setActionLoadingId('')
    }
  }

  const handleReject = async (request: PartnershipRequest) => {
    setActionLoadingId(request._id)
    try {
      await rejectPartnershipRequest(request._id)
      message.success('Đã từ chối yêu cầu')
      fetchRequests()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể từ chối yêu cầu')
    } finally {
      setActionLoadingId('')
    }
  }

  // Shop actions
  const handleViewProducts = async (shop: AdminShop) => {
    setViewingShopName(shop.name)
    setProductsLoading(true)
    setIsProductsModalVisible(true)
    try {
      const res = await getAdminShopProducts(shop._id)
      setViewingProducts(res.data.products || res.data)
    } catch {
      message.error('Không thể tải sản phẩm của thương hiệu')
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
      message.success(`Đã xóa thương hiệu ${deletingShop.name}`)
      setIsDeleteModalVisible(false)
      fetchShops()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi xóa thương hiệu')
    } finally {
      setDeleteLoading(false)
    }
  }

  // Filtered data
  const filteredRequests = requests.filter((item) => {
    const query = requestSearch.trim().toLowerCase()
    const matchesSearch = !query || [item.brand_name, item.category, item.phone, item.email, item.contact_name]
      .some((value) => String(value || '').toLowerCase().includes(query))
    const matchesStatus = !statusFilter || item.status === statusFilter
    const matchesCategory = !requestCategoryFilter || item.category === requestCategoryFilter
    return matchesSearch && matchesStatus && matchesCategory
  })

  const requestByShopId = new Map<string, PartnershipRequest>()
  requests.forEach(r => {
    if (r.shop_id?._id) {
      requestByShopId.set(r.shop_id._id, r)
    }
  })

  const filteredShops = shops.filter(s => {
    const matchesSearch = !shopSearch ||
      s.name?.toLowerCase().includes(shopSearch.toLowerCase()) ||
      s.user_id?.name?.toLowerCase().includes(shopSearch.toLowerCase()) ||
      s.user_id?.email?.toLowerCase().includes(shopSearch.toLowerCase())
    const req = requestByShopId.get(s._id)
    const matchesCategory = !shopCategoryFilter || req?.category === shopCategoryFilter
    return matchesSearch && matchesCategory
  })

  const pendingCount = requests.filter((item) => item.status === 'pending').length

  const requestColumns = [
    {
      title: 'Thương hiệu',
      dataIndex: 'brand_name',
      render: (value: string, item: PartnershipRequest) => (
        <div>
          <div className="font-semibold text-[var(--theme-text)]">{value}</div>
          <div className="text-xs text-[var(--theme-muted)]">{item.contact_name}</div>
        </div>
      ),
    },
    { title: 'Lĩnh vực', dataIndex: 'category' },
    { title: 'SĐT', dataIndex: 'phone' },
    { title: 'Email', dataIndex: 'email' },
    {
      title: 'Ngày gửi',
      dataIndex: 'created_at',
      render: (value: string) => new Date(value).toLocaleString('vi-VN'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (value: PartnershipRequest['status']) => (
        <Tag color={statusColor[value]}>{statusLabel[value]}</Tag>
      ),
    },
    {
      title: 'Hành động',
      render: (_: any, item: PartnershipRequest) => (
        <Space onClick={(event) => event.stopPropagation()}>
          <Button
            type="link"
            disabled={item.status !== 'pending'}
            loading={actionLoadingId === item._id}
            onClick={() => handleApprove(item)}
          >
            Duyệt
          </Button>
          <Button
            type="link"
            danger
            disabled={item.status !== 'pending'}
            loading={actionLoadingId === item._id}
            onClick={() => handleReject(item)}
          >
            Từ chối
          </Button>
        </Space>
      ),
    },
  ]

  const shopColumns = [
    {
      title: 'Thương hiệu',
      render: (_: any, s: AdminShop) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Image
            src={s.avatar || 'https://placehold.co/48x48?text=TH'}
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
      title: 'Lĩnh vực',
      render: (_: any, s: AdminShop) => {
        const req = requestByShopId.get(s._id)
        return req?.category || '—'
      },
    },
    {
      title: 'SĐT',
      render: (_: any, s: AdminShop) => {
        const req = requestByShopId.get(s._id)
        return req?.phone || '—'
      },
    },
    {
      title: 'Email',
      render: (_: any, s: AdminShop) => {
        const req = requestByShopId.get(s._id)
        return req?.email || '—'
      },
    },
    {
      title: 'Website',
      render: (_: any, s: AdminShop) => {
        const req = requestByShopId.get(s._id)
        return req?.website || '—'
      },
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
          {s.isActive ? 'Đang hoạt động' : 'Tạm ngưng'}
        </Tag>
      ),
    },
    {
      title: 'Hành động',
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

  const subtitleText = activeTab === 'requests'
    ? `${requests.length} yêu cầu | ${pendingCount} đang chờ xử lý`
    : `Tổng: ${shops.length} thương hiệu`

  return (
    <DashboardLayout>
      <div className="mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,var(--theme-accent-muted),rgba(255,255,255,0.02))] p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Admin</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)]">Partnerships</h1>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">{subtitleText}</p>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'requests',
            label: 'Yêu cầu hợp tác',
            children: (
              <div className="rounded-[24px] border border-[var(--gs-border)] bg-[rgba(23,23,23,0.92)] p-6">
                <div className="mb-4 flex justify-between gap-3">
                  <Space>
                    <Input.Search
                      allowClear
                      placeholder="Tìm thương hiệu, lĩnh vực, liên hệ..."
                      style={{ maxWidth: 360 }}
                      onChange={(event) => setRequestSearch(event.target.value)}
                    />
                    <Select
                      allowClear
                      placeholder="Tất cả trạng thái"
                      style={{ minWidth: 150 }}
                      value={statusFilter || undefined}
                      onChange={(value) => setStatusFilter(value || '')}
                      options={[
                        { label: 'Chờ xử lý', value: 'pending' },
                        { label: 'Đã duyệt', value: 'approved' },
                        { label: 'Từ chối', value: 'rejected' },
                      ]}
                    />
                    <Select
                      allowClear
                      placeholder="Tất cả lĩnh vực"
                      style={{ minWidth: 150 }}
                      value={requestCategoryFilter || undefined}
                      onChange={(value) => setRequestCategoryFilter(value || '')}
                      options={categoryOptions}
                    />
                  </Space>
                </div>
                <Table
                  rowKey="_id"
                  loading={requestsLoading}
                  dataSource={filteredRequests}
                  columns={requestColumns}
                  pagination={{ pageSize: 10 }}
                  onRow={(record) => ({
                    onClick: () => setSelectedRequest(record),
                    style: { cursor: 'pointer' },
                  })}
                />
              </div>
            ),
          },
          {
            key: 'shops',
            label: 'Quản lý Thương hiệu',
            children: (
              <div className="rounded-[24px] border border-[var(--gs-border)] bg-[rgba(23,23,23,0.92)] p-6">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
                  <Space>
                    <Input.Search
                      placeholder="Tìm thương hiệu, chủ sở hữu..."
                      allowClear
                      style={{ maxWidth: 320 }}
                      onChange={(e) => setShopSearch(e.target.value)}
                    />
                    <Select
                      allowClear
                      placeholder="Tất cả lĩnh vực"
                      style={{ minWidth: 150 }}
                      value={shopCategoryFilter || undefined}
                      onChange={(value) => setShopCategoryFilter(value || '')}
                      options={categoryOptions}
                    />
                  </Space>
                  <Space>
                    <AdminHistoryButton module="shops" title="thương hiệu" />
                  </Space>
                </div>
                <Table
                  dataSource={filteredShops}
                  columns={shopColumns}
                  rowKey="_id"
                  loading={shopsLoading}
                  pagination={{ pageSize: 10 }}
                />
              </div>
            ),
          },
        ]}
      />

      <Modal
        title="Chi tiết yêu cầu hợp tác"
        open={!!selectedRequest}
        onCancel={() => setSelectedRequest(null)}
        footer={null}
        width={760}
      >
        {selectedRequest && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="Tên thương hiệu">{selectedRequest.brand_name}</Descriptions.Item>
            <Descriptions.Item label="Lĩnh vực">{selectedRequest.category}</Descriptions.Item>
            <Descriptions.Item label="Người liên hệ">{selectedRequest.contact_name}</Descriptions.Item>
            <Descriptions.Item label="Số điện thoại">{selectedRequest.phone}</Descriptions.Item>
            <Descriptions.Item label="Email">{selectedRequest.email}</Descriptions.Item>
            <Descriptions.Item label="Website">{selectedRequest.website || 'Không cung cấp'}</Descriptions.Item>
            <Descriptions.Item label="Mô tả">{selectedRequest.description || 'Không cung cấp'}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Tag color={statusColor[selectedRequest.status]}>{statusLabel[selectedRequest.status]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Shop đã tạo">
              {selectedRequest.shop_id?.name || 'Chưa có'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal
        title={`Sản phẩm của thương hiệu: ${viewingShopName}`}
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
        title="Xác nhận xóa thương hiệu"
        open={isDeleteModalVisible}
        onOk={handleDeleteShop}
        onCancel={() => setIsDeleteModalVisible(false)}
        confirmLoading={deleteLoading}
        okText="Xác nhận xóa"
        cancelText="Hủy"
        okButtonProps={{ danger: true }}
      >
        <p>Bạn có chắc chắn muốn xóa thương hiệu <strong>{deletingShop?.name}</strong>?</p>
        <p>Hành động này sẽ xóa tất cả sản phẩm của thương hiệu và gửi thông báo cho chủ sở hữu.</p>
        <div className="mt-4">
          <Text strong>Lý do xóa:</Text>
          <Input.TextArea
            rows={4}
            placeholder="Nhập lý do xóa thương hiệu..."
            value={deleteReason}
            onChange={e => setDeleteReason(e.target.value)}
            className="mt-2"
          />
        </div>
      </Modal>
    </DashboardLayout>
  )
}
