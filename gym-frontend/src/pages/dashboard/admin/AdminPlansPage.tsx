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
import { useTranslation } from 'react-i18next'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import api from '../../../services/api'
import type { AdminPlan } from '../../../types/admin/plan'
import AdminHistoryButton from './AdminHistoryButton'

export default function AdminPlansPage() {
  const { t } = useTranslation()
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
      message.error(t('admin.plans.messages.fetch_failed'))
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
        message.success(t('admin.plans.messages.update_success'))
      } else {
        await api.post('/plans', payload)
        message.success(t('admin.plans.messages.create_success'))
      }

      setModalOpen(false)
      fetchPlans()
    } catch (err: any) {
      message.error(err.response?.data?.message || t('admin.plans.messages.action_failed'))
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/plans/${id}`)
      message.success(t('admin.plans.messages.delete_success'))
      fetchPlans()
    } catch (err: any) {
      message.error(err.response?.data?.message || t('admin.plans.messages.delete_failed'))
    }
  }

  const handleToggle = async (id: string) => {
    try {
      await api.patch(`/plans/${id}/toggle-status`)
      message.success(t('admin.plans.messages.toggle_success'))
      fetchPlans()
    } catch {
      message.error(t('admin.plans.messages.action_failed'))
    }
  }

  const columns = [
    {
      title: t('admin.plans.columns.name'),
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
      title: t('admin.plans.columns.price'),
      dataIndex: 'price',
      render: (price: number) => (
        <span>{price.toLocaleString('vi-VN')}đ</span>
      ),
    },
    {
      title: t('admin.plans.columns.duration'),
      dataIndex: 'durationDays',
      render: (days: number) => t('admin.plans.days', { days }),
    },
    {
      title: t('admin.plans.columns.members'),
      dataIndex: 'memberCount',
      render: (count: number) => (
        <Tag color={count > 0 ? 'blue' : 'default'}>{count} members</Tag>
      ),
    },
    {
      title: t('admin.plans.columns.status'),
      dataIndex: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'error'}>
          {isActive ? t('admin.plans.status.active') : t('admin.plans.status.disabled')}
        </Tag>
      ),
    },
    {
      title: t('admin.plans.columns.actions'),
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
            title={record.isActive ? t('admin.plans.actions.disable') : t('admin.plans.actions.enable')}
          />
          <Popconfirm
            title={t('admin.plans.popconfirm.title')}
            description={t('admin.plans.popconfirm.description')}
            onConfirm={() => handleDelete(record._id)}
            okText={t('admin.plans.popconfirm.ok')}
            cancelText={t('admin.plans.popconfirm.cancel')}
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
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Admin</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">{t('admin.plans.title')}</h1>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[rgba(23,23,23,0.92)] p-6 max-[640px]:p-4">
        <div className="dashboard-filter-bar">
          <Input.Search
            placeholder={t('admin.plans.search_placeholder')}
            allowClear
            onSearch={(val) => {
              setSearch(val)
              setPage(1)
              fetchPlans(1, val)
            }}
          />
          <Space wrap>
            <AdminHistoryButton module="plans" title="gói tập" />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              {t('admin.plans.create')}
            </Button>
          </Space>
        </div>

        <div className="member-scroll-x">
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
      </div>

      <Modal
        title={editingPlan ? t('admin.plans.modal.edit_title') : t('admin.plans.modal.create_title')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form layout="vertical" form={form} onFinish={handleSubmit}>
          <Form.Item label={t('admin.plans.form.name')} name="name" rules={[{ required: true, message: t('admin.plans.form.name_required') }]}>
            <Input placeholder={t('admin.plans.form.name_placeholder')} />
          </Form.Item>

          <Form.Item label={t('admin.plans.form.price')} name="price" rules={[{ required: true, message: t('admin.plans.form.price_required') }]}>
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              placeholder={t('admin.plans.form.price_placeholder')}
            />
          </Form.Item>

          <Form.Item label={t('admin.plans.form.duration')} name="durationDays" rules={[{ required: true, message: t('admin.plans.form.duration_required') }]}>
            <InputNumber style={{ width: '100%' }} min={1} placeholder={t('admin.plans.form.duration_placeholder')} />
          </Form.Item>

          <Form.Item label={t('admin.plans.form.description')} name="description">
            <Input.TextArea rows={3} placeholder={t('admin.plans.form.description_placeholder')} />
          </Form.Item>

          <Form.Item label={t('admin.plans.form.color')} name="color">
            <ColorPicker format="hex" />
          </Form.Item>

          <Button type="primary" htmlType="submit" block loading={submitLoading}>
            {editingPlan ? t('admin.plans.submit.update') : t('admin.plans.submit.create')}
          </Button>
        </Form>
      </Modal>
    </DashboardLayout>
  )
}
