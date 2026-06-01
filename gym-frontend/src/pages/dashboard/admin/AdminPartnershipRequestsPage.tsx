import { Button, Descriptions, Form, Image, Input, InputNumber, message, Modal, Select, Space, Table, Tag, Tabs, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import {
  approvePartnershipRequest,
  createDiscountCode,
  getAdminPartnershipRequests,
  getDiscountCodes,
  rejectPartnershipRequest,
  toggleDiscountCode,
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

type DiscountCode = {
  _id: string
  code: string
  type: 'order_discount' | 'free_shipping' | 'shipping_discount'
  amount: number
  isActive: boolean
}

const statusColor: Record<PartnershipRequest['status'], string> = {
  pending: 'gold',
  approved: 'green',
  rejected: 'red',
}

export default function AdminPartnershipRequestsPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('requests')

  const [requests, setRequests] = useState<PartnershipRequest[]>([])
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState('')
  const [requestSearch, setRequestSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [requestCategoryFilter, setRequestCategoryFilter] = useState<string>('')
  const [requestPage, setRequestPage] = useState(1)
  const [selectedRequest, setSelectedRequest] = useState<PartnershipRequest | null>(null)

  const [shops, setShops] = useState<AdminShop[]>([])
  const [shopsLoading, setShopsLoading] = useState(false)
  const [shopSearch, setShopSearch] = useState('')
  const [shopCategoryFilter, setShopCategoryFilter] = useState<string>('')
  const [shopPage, setShopPage] = useState(1)
  const [viewingProducts, setViewingProducts] = useState<AdminProduct[]>([])
  const [isProductsModalVisible, setIsProductsModalVisible] = useState(false)
  const [viewingShopName, setViewingShopName] = useState('')
  const [productsLoading, setProductsLoading] = useState(false)
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false)
  const [deletingShop, setDeletingShop] = useState<AdminShop | null>(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [discountModalOpen, setDiscountModalOpen] = useState(false)
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([])
  const [discountLoading, setDiscountLoading] = useState(false)
  const [discountForm] = Form.useForm()
  const discountType = Form.useWatch('type', discountForm)

  const statusLabel: Record<PartnershipRequest['status'], string> = {
    pending: t('admin.partnership_requests.status.pending'),
    approved: t('admin.partnership_requests.status.approved'),
    rejected: t('admin.partnership_requests.status.rejected'),
  }

  const categoryOptions = [
    { label: t('admin.partnership_requests.category_options.equipment'), value: 'Thiết bị gym' },
    { label: t('admin.partnership_requests.category_options.sports_food'), value: 'Thực phẩm thể thao' },
    { label: t('admin.partnership_requests.category_options.accessories'), value: 'Phụ kiện' },
    { label: t('admin.partnership_requests.category_options.clothing'), value: 'Trang phục' },
    { label: t('admin.partnership_requests.category_options.other'), value: 'Khác' },
  ]

  const fetchRequests = async () => {
    setRequestsLoading(true)
    try {
      const res = await getAdminPartnershipRequests()
      setRequests(res.data.requests || [])
    } catch (err: any) {
      message.error(err.response?.data?.message || t('admin.partnership_requests.messages.fetch_requests_failed'))
    } finally {
      setRequestsLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [])

  const fetchShops = async () => {
    setShopsLoading(true)
    try {
      const res = await getAdminShops()
      setShops(res.data)
    } catch {
      message.error(t('admin.partnership_requests.messages.fetch_shops_failed'))
    } finally {
      setShopsLoading(false)
    }
  }

  useEffect(() => { fetchShops() }, [])

  const fetchDiscountCodes = async () => {
    setDiscountLoading(true)
    try {
      const res = await getDiscountCodes()
      setDiscountCodes(res.data.codes || [])
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể tải mã giảm giá')
    } finally {
      setDiscountLoading(false)
    }
  }

  const openDiscountModal = () => {
    setDiscountModalOpen(true)
    fetchDiscountCodes()
  }

  const handleCreateDiscount = async (values: any) => {
    try {
      await createDiscountCode({
        code: values.code,
        type: values.type,
        amount: values.type === 'free_shipping' ? 0 : Number(values.amount || 0),
      })
      message.success('Đã tạo mã giảm giá')
      discountForm.resetFields()
      discountForm.setFieldValue('type', 'order_discount')
      fetchDiscountCodes()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể tạo mã giảm giá')
    }
  }

  const handleToggleDiscount = async (id: string) => {
    try {
      await toggleDiscountCode(id)
      fetchDiscountCodes()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể cập nhật mã giảm giá')
    }
  }

  const handleApprove = async (request: PartnershipRequest) => {
    setActionLoadingId(request._id)
    try {
      await approvePartnershipRequest(request._id)
      message.success(t('admin.partnership_requests.messages.approve_success'))
      fetchRequests()
    } catch (err: any) {
      message.error(err.response?.data?.message || t('admin.partnership_requests.messages.approve_failed'))
    } finally {
      setActionLoadingId('')
    }
  }

  const handleReject = async (request: PartnershipRequest) => {
    setActionLoadingId(request._id)
    try {
      await rejectPartnershipRequest(request._id)
      message.success(t('admin.partnership_requests.messages.reject_success'))
      fetchRequests()
    } catch (err: any) {
      message.error(err.response?.data?.message || t('admin.partnership_requests.messages.reject_failed'))
    } finally {
      setActionLoadingId('')
    }
  }

  const handleViewProducts = async (shop: AdminShop) => {
    setViewingShopName(shop.name)
    setProductsLoading(true)
    setIsProductsModalVisible(true)
    try {
      const res = await getAdminShopProducts(shop._id)
      setViewingProducts(res.data.products || res.data)
    } catch {
      message.error(t('admin.partnership_requests.messages.products_failed'))
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
      message.warning(t('admin.partnership_requests.messages.reason_required'))
      return
    }
    setDeleteLoading(true)
    try {
      await deleteShop(deletingShop._id, deleteReason)
      message.success(t('admin.partnership_requests.messages.delete_success', { name: deletingShop.name }))
      setIsDeleteModalVisible(false)
      fetchShops()
    } catch (err: any) {
      message.error(err.response?.data?.message || t('admin.partnership_requests.messages.delete_failed'))
    } finally {
      setDeleteLoading(false)
    }
  }

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
      title: t('admin.table_no'),
      width: 70,
      align: 'center' as const,
      render: (_: any, __: PartnershipRequest, index: number) => (requestPage - 1) * 10 + index + 1,
    },
    {
      title: t('admin.partnership_requests.request_columns.brand'),
      dataIndex: 'brand_name',
      render: (value: string, item: PartnershipRequest) => (
        <div>
          <div className="font-semibold text-[var(--theme-text)]">{value}</div>
          <div className="text-xs text-[var(--theme-muted)]">{item.contact_name}</div>
        </div>
      ),
    },
    { title: t('admin.partnership_requests.request_columns.category'), dataIndex: 'category' },
    { title: t('admin.partnership_requests.request_columns.phone'), dataIndex: 'phone' },
    { title: t('admin.partnership_requests.request_columns.email'), dataIndex: 'email' },
    {
      title: t('admin.partnership_requests.request_columns.submitted_at'),
      dataIndex: 'created_at',
      render: (value: string) => new Date(value).toLocaleString('vi-VN'),
    },
    {
      title: t('admin.partnership_requests.request_columns.status'),
      dataIndex: 'status',
      render: (value: PartnershipRequest['status']) => (
        <Tag color={statusColor[value]}>{statusLabel[value]}</Tag>
      ),
    },
    {
      title: t('admin.partnership_requests.request_columns.actions'),
      render: (_: any, item: PartnershipRequest) => (
        <Space onClick={(event) => event.stopPropagation()}>
          <Button
            type="link"
            disabled={item.status !== 'pending'}
            loading={actionLoadingId === item._id}
            onClick={() => handleApprove(item)}
          >
            {t('admin.partnership_requests.request_actions.approve')}
          </Button>
          <Button
            type="link"
            danger
            disabled={item.status !== 'pending'}
            loading={actionLoadingId === item._id}
            onClick={() => handleReject(item)}
          >
            {t('admin.partnership_requests.request_actions.reject')}
          </Button>
        </Space>
      ),
    },
  ]

  const shopColumns = [
    {
      title: t('admin.table_no'),
      width: 70,
      align: 'center' as const,
      render: (_: any, __: AdminShop, index: number) => (shopPage - 1) * 10 + index + 1,
    },
    {
      title: t('admin.partnership_requests.shop_columns.brand'),
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
      title: t('admin.partnership_requests.shop_columns.category'),
      render: (_: any, s: AdminShop) => {
        const req = requestByShopId.get(s._id)
        return req?.category || '—'
      },
    },
    {
      title: t('admin.partnership_requests.shop_columns.phone'),
      render: (_: any, s: AdminShop) => {
        const req = requestByShopId.get(s._id)
        return req?.phone || '—'
      },
    },
    {
      title: t('admin.partnership_requests.shop_columns.email'),
      render: (_: any, s: AdminShop) => {
        const req = requestByShopId.get(s._id)
        return req?.email || '—'
      },
    },
    {
      title: t('admin.partnership_requests.shop_columns.website'),
      render: (_: any, s: AdminShop) => {
        const req = requestByShopId.get(s._id)
        return req?.website || '—'
      },
    },
    {
      title: t('admin.partnership_requests.shop_columns.created_at'),
      dataIndex: 'createdAt',
      render: (d: string) => new Date(d).toLocaleDateString('vi-VN'),
    },
    {
      title: t('admin.partnership_requests.shop_columns.status'),
      render: (_: any, s: AdminShop) => (
        <Tag color={s.isActive ? 'green' : 'red'}>
          {s.isActive ? t('admin.partnership_requests.shop_status.active') : t('admin.partnership_requests.shop_status.inactive')}
        </Tag>
      ),
    },
    {
      title: t('admin.partnership_requests.shop_columns.actions'),
      render: (_: any, s: AdminShop) => (
        <Space>
          <Button type="link" onClick={() => handleViewProducts(s)}>{t('admin.partnership_requests.shop_actions.products')}</Button>
          <Button type="link" danger onClick={() => showDeleteModal(s)}>{t('admin.partnership_requests.shop_actions.delete')}</Button>
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

  const discountColumns = [
    { title: 'Mã', dataIndex: 'code' },
    {
      title: 'Loại',
      dataIndex: 'type',
      render: (value: DiscountCode['type']) => ({
        order_discount: 'Giảm giá đơn hàng',
        free_shipping: 'Free ship',
        shipping_discount: 'Giảm phí ship',
      }[value]),
    },
    { title: 'Số tiền giảm', dataIndex: 'amount', render: (value: number) => value ? `${value.toLocaleString('vi-VN')}đ` : '—' },
    { title: 'Trạng thái', dataIndex: 'isActive', render: (value: boolean) => <Tag color={value ? 'green' : 'red'}>{value ? 'Đang bật' : 'Đã tắt'}</Tag> },
    { title: 'Thao tác', render: (_: any, item: DiscountCode) => <Button type="link" onClick={() => handleToggleDiscount(item._id)}>{item.isActive ? 'Tắt' : 'Bật'}</Button> },
  ]

  const subtitleText = activeTab === 'requests'
    ? t('admin.partnership_requests.subtitle.requests', { total: requests.length, pending: pendingCount })
    : t('admin.partnership_requests.subtitle.shops', { total: shops.length })

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,var(--theme-accent-muted),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">{t('admin.partnership_requests.overline')}</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">{t('admin.partnership_requests.title')}</h1>
        <p className="mt-2 text-sm text-[var(--gs-text-muted)]">{subtitleText}</p>
        <Button className="mt-4" type="primary" onClick={openDiscountModal}>Mã giảm giá</Button>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'requests',
            label: t('admin.partnership_requests.tabs.requests'),
            children: (
              <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
                <div className="dashboard-filter-bar">
                  <Input.Search
                    allowClear
                    placeholder={t('admin.partnership_requests.search_placeholder')}
                    onChange={(event) => {
                      setRequestSearch(event.target.value)
                      setRequestPage(1)
                    }}
                  />
                  <Space wrap>
                    <Select
                      allowClear
                      placeholder={t('admin.partnership_requests.filter_status')}
                      style={{ minWidth: 150 }}
                      value={statusFilter || undefined}
                      onChange={(value) => {
                        setStatusFilter(value || '')
                        setRequestPage(1)
                      }}
                      options={[
                        { label: t('admin.partnership_requests.status.pending'), value: 'pending' },
                        { label: t('admin.partnership_requests.status.approved'), value: 'approved' },
                        { label: t('admin.partnership_requests.status.rejected'), value: 'rejected' },
                      ]}
                    />
                    <Select
                      allowClear
                      placeholder={t('admin.partnership_requests.filter_category')}
                      style={{ minWidth: 150 }}
                      value={requestCategoryFilter || undefined}
                      onChange={(value) => {
                        setRequestCategoryFilter(value || '')
                        setRequestPage(1)
                      }}
                      options={categoryOptions}
                    />
                  </Space>
                </div>
                <div className="member-scroll-x">
                  <Table
                    rowKey="_id"
                    loading={requestsLoading}
                    dataSource={filteredRequests}
                    columns={requestColumns}
                    pagination={{
                      current: requestPage,
                      pageSize: 10,
                      onChange: setRequestPage,
                    }}
                    onRow={(record) => ({
                      onClick: () => setSelectedRequest(record),
                      style: { cursor: 'pointer' },
                    })}
                  />
                </div>
              </div>
            ),
          },
          {
            key: 'shops',
            label: t('admin.partnership_requests.tabs.shops'),
            children: (
              <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
                <div className="dashboard-filter-bar">
                  <Space wrap>
                    <Input.Search
                      placeholder={t('admin.partnership_requests.search_placeholder')}
                      allowClear
                      onChange={(e) => {
                        setShopSearch(e.target.value)
                        setShopPage(1)
                      }}
                    />
                    <Select
                      allowClear
                      placeholder={t('admin.partnership_requests.filter_category')}
                      style={{ minWidth: 150 }}
                      value={shopCategoryFilter || undefined}
                      onChange={(value) => {
                        setShopCategoryFilter(value || '')
                        setShopPage(1)
                      }}
                      options={categoryOptions}
                    />
                  </Space>
                  <AdminHistoryButton module="shops" title="thương hiệu" />
                </div>
                <div className="member-scroll-x">
                  <Table
                    dataSource={filteredShops}
                    columns={shopColumns}
                    rowKey="_id"
                    loading={shopsLoading}
                    pagination={{
                      current: shopPage,
                      pageSize: 10,
                      onChange: setShopPage,
                    }}
                  />
                </div>
              </div>
            ),
          },
        ]}
      />

      <Modal
        title="Mã giảm giá"
        open={discountModalOpen}
        onCancel={() => setDiscountModalOpen(false)}
        footer={null}
        width={820}
      >
        <Form form={discountForm} layout="vertical" onFinish={handleCreateDiscount} initialValues={{ type: 'order_discount' }}>
          <Space align="start" wrap>
            <Form.Item name="code" label="Mã" rules={[{ required: true, message: 'Vui lòng nhập mã' }]}>
              <Input placeholder="VD: GYM30K" onChange={(event) => discountForm.setFieldValue('code', event.target.value.toUpperCase())} />
            </Form.Item>
            <Form.Item name="type" label="Loại" rules={[{ required: true }]}>
              <Select
                style={{ width: 180 }}
                options={[
                  { label: 'Giảm giá', value: 'order_discount' },
                  { label: 'Free ship', value: 'free_shipping' },
                  { label: 'Giảm phí ship', value: 'shipping_discount' },
                ]}
              />
            </Form.Item>
            {discountType !== 'free_shipping' && (
              <Form.Item name="amount" label="Số tiền giảm" rules={[{ required: true, message: 'Vui lòng nhập số tiền' }]}>
                <InputNumber min={1000} step={1000} addonAfter="đ" />
              </Form.Item>
            )}
            <Form.Item label=" ">
              <Button type="primary" htmlType="submit">Tạo mã</Button>
            </Form.Item>
          </Space>
        </Form>
        <Table rowKey="_id" loading={discountLoading} dataSource={discountCodes} columns={discountColumns} pagination={{ pageSize: 6 }} />
      </Modal>

      <Modal
        title={t('admin.partnership_requests.detail_modal_title')}
        open={!!selectedRequest}
        onCancel={() => setSelectedRequest(null)}
        footer={null}
        width={760}
      >
        {selectedRequest && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label={t('admin.partnership_requests.detail.brand_name')}>{selectedRequest.brand_name}</Descriptions.Item>
            <Descriptions.Item label={t('admin.partnership_requests.detail.category')}>{selectedRequest.category}</Descriptions.Item>
            <Descriptions.Item label={t('admin.partnership_requests.detail.contact')}>{selectedRequest.contact_name}</Descriptions.Item>
            <Descriptions.Item label={t('admin.partnership_requests.detail.phone')}>{selectedRequest.phone}</Descriptions.Item>
            <Descriptions.Item label={t('admin.partnership_requests.detail.email')}>{selectedRequest.email}</Descriptions.Item>
            <Descriptions.Item label={t('admin.partnership_requests.detail.website')}>{selectedRequest.website || t('admin.partnership_requests.detail.not_provided')}</Descriptions.Item>
            <Descriptions.Item label={t('admin.partnership_requests.detail.description')}>{selectedRequest.description || t('admin.partnership_requests.detail.not_provided')}</Descriptions.Item>
            <Descriptions.Item label={t('admin.partnership_requests.detail.status')}>
              <Tag color={statusColor[selectedRequest.status]}>{statusLabel[selectedRequest.status]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('admin.partnership_requests.detail.shop_created')}>
              {selectedRequest.shop_id?.name || t('admin.partnership_requests.detail.not_yet')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal
        title={t('admin.partnership_requests.products_modal_title', { name: viewingShopName })}
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
        title={t('admin.partnership_requests.delete_modal.title')}
        open={isDeleteModalVisible}
        onOk={handleDeleteShop}
        onCancel={() => setIsDeleteModalVisible(false)}
        confirmLoading={deleteLoading}
        okText={t('admin.partnership_requests.delete_modal.ok_text')}
        cancelText={t('admin.partnership_requests.delete_modal.cancel_text')}
        okButtonProps={{ danger: true }}
      >
        <p dangerouslySetInnerHTML={{ __html: t('admin.partnership_requests.delete_modal.confirm', { name: deletingShop?.name }) }} />
        <p>{t('admin.partnership_requests.delete_modal.warning')}</p>
        <div className="mt-4">
          <Text strong>{t('admin.partnership_requests.delete_modal.reason_label')}</Text>
          <Input.TextArea
            rows={4}
            placeholder={t('admin.partnership_requests.delete_modal.reason_placeholder')}
            value={deleteReason}
            onChange={e => setDeleteReason(e.target.value)}
            className="mt-2"
          />
        </div>
      </Modal>
    </DashboardLayout>
  )
}
