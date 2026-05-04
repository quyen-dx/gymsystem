import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  PoweroffOutlined
} from '@ant-design/icons'
import {
  Button,
  ColorPicker,
  Form, Input, InputNumber,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  message
} from 'antd'
import { useEffect, useState } from 'react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import api from '../../services/api'
import type { AdminPlan } from '../../types/admin/plan'
import AdminHistoryButton from './AdminHistoryButton'

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<AdminPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null)
  const [form] = Form.useForm()
  const [submitLoading, setSubmitLoading] = useState(false)

  const fetchPlans = async (p = page, s = search) => {
    setLoading(true)
    try {
      const { data } = await api.get('/plans', {
        params: { page: p, limit: 10, search: s },
      })
      setPlans(data.plans)
      setTotal(data.pagination.total)
    } catch {
      message.error('Không thể tải danh sách gói tập')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlans()
  }, [])

  const openCreate = () => {
    setEditingPlan(null)
    form.resetFields()
    form.setFieldsValue({ color: '#3B82F6' })
    setModalOpen(true)
  }

  const openEdit = (plan: AdminPlan) => {
    setEditingPlan(plan)
    form.setFieldsValue({
      name: plan.name,
      price: plan.price,
      durationDays: plan.durationDays,
      description: plan.description,
      color: plan.color,
    })
    setModalOpen(true)
  }

  const handleSubmit = async (values: any) => {
    setSubmitLoading(true)
    try {
      const payload = {
        ...values,
        color: typeof values.color === 'string'
          ? values.color
          : values.color?.toHexString?.() || '#3B82F6',
      }

      if (editingPlan) {
        await api.put(`/plans/${editingPlan._id}`, payload)
        message.success('Cập nhật gói tập thành công')
      } else {
        await api.post('/plans', payload)
        message.success('Tạo gói tập thành công')
      }

      setModalOpen(false)
      fetchPlans()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Thao tác thất bại')
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/plans/${id}`)
      message.success('Xóa gói tập thành công')
      fetchPlans()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Xóa thất bại')
    }
  }

  const handleToggle = async (id: string) => {
    try {
      await api.patch(`/plans/${id}/toggle-status`)
      message.success('Cập nhật trạng thái thành công')
      fetchPlans()
    } catch {
      message.error('Thao tác thất bại')
    }
  }

  const columns = [
    {
      title: 'Gói tập',
      dataIndex: 'name',
      render: (name: string, record: AdminPlan) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 12, height: 12, borderRadius: '50%',
              background: record.color, flexShrink: 0,
            }}
          />
          <span style={{ fontWeight: 600 }}>{name}</span>
        </div>
      ),
    },
    {
      title: 'Giá',
      dataIndex: 'price',
      render: (price: number) => (
        <span>{price.toLocaleString('vi-VN')}đ</span>
      ),
    },
    {
      title: 'Số ngày',
      dataIndex: 'durationDays',
      render: (days: number) => `${days} ngày`,
    },
    {
      title: 'Members',
      dataIndex: 'memberCount',
      render: (count: number) => (
        <Tag color={count > 0 ? 'blue' : 'default'}>{count} members</Tag>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'error'}>
          {isActive ? 'Đang hoạt động' : 'Vô hiệu hóa'}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      render: (_: any, record: AdminPlan) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          />
          <Button
            size="small"
            icon={<PoweroffOutlined />}
            onClick={() => handleToggle(record._id)}
            title={record.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}
          />
          <Popconfirm
            title="Xóa gói tập này?"
            description="Không thể xóa nếu có member đang sử dụng."
            onConfirm={() => handleDelete(record._id)}
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
      <div className="mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))] p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Admin</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)]">Quản lý gói tập</h1>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[rgba(23,23,23,0.92)] p-6">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
          <Input.Search
            placeholder="Tìm kiếm gói tập..."
            allowClear
            style={{ maxWidth: 320 }}
            onSearch={(val) => {
              setSearch(val)
              setPage(1)
              fetchPlans(1, val)
            }}
          />
          <Space>
            <AdminHistoryButton module="plans" title="gói tập" />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Tạo gói tập
            </Button>
          </Space>
        </div>

        <Table
          dataSource={plans}
          columns={columns}
          rowKey="_id"
          loading={loading}
          pagination={{
            total,
            current: page,
            pageSize: 10,
            onChange: (p) => {
              setPage(p)
              fetchPlans(p, search)
            },
          }}
        />
      </div>

      <Modal
        title={editingPlan ? 'Cập nhật gói tập' : 'Tạo gói tập mới'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form layout="vertical" form={form} onFinish={handleSubmit}>
          <Form.Item label="Tên gói" name="name" rules={[{ required: true, message: 'Nhập tên gói' }]}>
            <Input placeholder="VD: Gói 1 tháng" />
          </Form.Item>

          <Form.Item label="Giá (VNĐ)" name="price" rules={[{ required: true, message: 'Nhập giá' }]}>
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              placeholder="VD: 500000"
            />
          </Form.Item>

          <Form.Item label="Số ngày" name="durationDays" rules={[{ required: true, message: 'Nhập số ngày' }]}>
            <InputNumber style={{ width: '100%' }} min={1} placeholder="VD: 30" />
          </Form.Item>

          <Form.Item label="Mô tả" name="description">
            <Input.TextArea rows={3} placeholder="Mô tả gói tập..." />
          </Form.Item>

          <Form.Item label="Màu sắc" name="color">
            <ColorPicker format="hex" />
          </Form.Item>

          <Button type="primary" htmlType="submit" block loading={submitLoading}>
            {editingPlan ? 'Cập nhật' : 'Tạo gói tập'}
          </Button>
        </Form>
      </Modal>
    </DashboardLayout>
  )
}
