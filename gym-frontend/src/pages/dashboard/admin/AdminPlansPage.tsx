import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  PoweroffOutlined
} from '@ant-design/icons'
import {
  Button,
  Card,
  ColorPicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import api from '../../../services/api'
import type { AdminPlan } from '../../../types/admin/plan'
import AdminHistoryButton from './AdminHistoryButton'

const { Text } = Typography

interface PackageTemplate {
  key: string
  nameVi: string
  nameEn: string
  descriptionVi: string
  descriptionEn: string
  featuresVi: string[]
  featuresEn: string[]
  durationDays: number
  color: string
}

const packageTemplates: PackageTemplate[] = [
  {
    key: 'basic',
    nameVi: 'Gói Cơ Bản',
    nameEn: 'Basic Membership',
    descriptionVi: 'Gói tập cơ bản dành cho hội viên mới bắt đầu.',
    descriptionEn: 'Basic plan for new members.',
    featuresVi: ['Sử dụng phòng tập', 'Check-in QR'],
    featuresEn: ['Gym access', 'QR check-in'],
    durationDays: 30,
    color: '#3B82F6',
  },
  {
    key: 'premium',
    nameVi: 'Gói Nâng Cao',
    nameEn: 'Premium Membership',
    descriptionVi: 'Gói tập nâng cao với nhiều tiện ích hơn.',
    descriptionEn: 'Premium plan with additional benefits.',
    featuresVi: ['Sử dụng phòng tập', 'Check-in QR', 'Theo dõi sức khỏe'],
    featuresEn: ['Gym access', 'QR check-in', 'Health monitoring'],
    durationDays: 90,
    color: '#8B5CF6',
  },
  {
    key: 'vip',
    nameVi: 'Gói VIP',
    nameEn: 'VIP Membership',
    descriptionVi: 'Gói VIP cao cấp dành cho hội viên thân thiết.',
    descriptionEn: 'Premium VIP package for loyal members.',
    featuresVi: ['Sử dụng phòng tập', 'Check-in QR', 'Theo dõi sức khỏe', 'Ưu tiên hỗ trợ'],
    featuresEn: ['Gym access', 'QR check-in', 'Health monitoring', 'Priority support'],
    durationDays: 365,
    color: '#F59E0B',
  },
  {
    key: 'personal_training',
    nameVi: 'Gói Huấn Luyện Cá Nhân',
    nameEn: 'Personal Training Package',
    descriptionVi: 'Gói huấn luyện 1-1 với PT chuyên nghiệp.',
    descriptionEn: 'One-on-one training with a professional personal trainer.',
    featuresVi: ['Huấn luyện cá nhân', 'Giáo án riêng'],
    featuresEn: ['Personal trainer', 'Custom workout plan'],
    durationDays: 30,
    color: '#EF4444',
  },
  {
    key: 'corporate',
    nameVi: 'Gói Doanh Nghiệp',
    nameEn: 'Corporate Membership',
    descriptionVi: 'Gói tập dành cho doanh nghiệp, quản lý nhóm nhân viên.',
    descriptionEn: 'Corporate plan for employee groups.',
    featuresVi: ['Dành cho doanh nghiệp', 'Quản lý nhóm nhân viên'],
    featuresEn: ['Corporate access', 'Employee group management'],
    durationDays: 365,
    color: '#10B981',
  },
]

function matchTemplate(plan: AdminPlan): PackageTemplate | undefined {
  return packageTemplates.find(
    (t) => t.nameVi === plan.nameVi && t.nameEn === plan.nameEn,
  )
}

function getPlanDisplayName(plan: AdminPlan, lang: string): string {
  if (lang.startsWith('vi')) return plan.nameVi || plan.nameEn
  return plan.nameEn || plan.nameVi
}

function getPlanDisplayDesc(plan: AdminPlan, lang: string): string {
  if (lang.startsWith('vi')) return plan.descriptionVi || plan.descriptionEn || ''
  return plan.descriptionEn || plan.descriptionVi || ''
}

function getPlanDisplayFeatures(plan: AdminPlan, lang: string): string[] {
  if (lang.startsWith('vi')) return plan.featuresVi?.length ? plan.featuresVi : plan.featuresEn
  return plan.featuresEn?.length ? plan.featuresEn : plan.featuresVi
}

export default function AdminPlansPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [plans, setPlans] = useState<AdminPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<PackageTemplate | null>(null)
  const [form] = Form.useForm()
  const [submitLoading, setSubmitLoading] = useState(false)

  const planTypeOptions = useMemo(
    () =>
      packageTemplates.map((pkg) => ({
        value: pkg.key,
        label: lang.startsWith('vi') ? pkg.nameVi : pkg.nameEn,
      })),
    [lang],
  )

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

  const applyTemplate = (template: PackageTemplate) => {
    setSelectedTemplate(template)
    form.setFieldsValue({
      nameVi: template.nameVi,
      nameEn: template.nameEn,
      descriptionVi: template.descriptionVi,
      descriptionEn: template.descriptionEn,
      featuresVi: template.featuresVi,
      featuresEn: template.featuresEn,
      durationDays: template.durationDays,
      color: template.color,
    })
  }

  const openCreate = () => {
    setEditingPlan(null)
    setSelectedTemplate(null)
    form.resetFields()
    form.setFieldsValue({ color: '#3B82F6', isActive: true })
    setModalOpen(true)
  }

  const openEdit = (plan: AdminPlan) => {
    setEditingPlan(plan)
    const matched = matchTemplate(plan)
    setSelectedTemplate(matched || null)
    form.setFieldsValue({
      planType: matched?.key || 'custom',
      nameVi: plan.nameVi,
      nameEn: plan.nameEn,
      price: plan.price,
      durationDays: plan.durationDays,
      descriptionVi: plan.descriptionVi || '',
      descriptionEn: plan.descriptionEn || '',
      featuresVi: plan.featuresVi || [],
      featuresEn: plan.featuresEn || [],
      color: plan.color,
      isActive: plan.isActive,
    })
    setModalOpen(true)
  }

  const handleSubmit = async (values: any) => {
    setSubmitLoading(true)
    try {
      const payload = {
        nameVi: values.nameVi,
        nameEn: values.nameEn,
        price: values.price,
        durationDays: values.durationDays,
        descriptionVi: values.descriptionVi || '',
        descriptionEn: values.descriptionEn || '',
        featuresVi: values.featuresVi || [],
        featuresEn: values.featuresEn || [],
        isActive: values.isActive ?? true,
        color: typeof values.color === 'string'
          ? values.color
          : values.color?.toHexString?.() || '#3B82F6',
      }

      if (editingPlan) {
        await api.put(`/plans/${editingPlan._id}`, payload)
        message.success(t('admin.plans.messages.update_success'))
      } else {
        await api.post('/plans', payload)
        message.success(t('admin.membershipPlan.createSuccess'))
      }

      setModalOpen(false)
      fetchPlans()
    } catch (err: any) {
      message.error(err.response?.data?.message || (editingPlan ? t('admin.plans.messages.action_failed') : t('admin.membershipPlan.createError')))
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
      title: t('admin.table_no'),
      width: 70,
      align: 'center' as const,
      render: (_: any, __: AdminPlan, index: number) => (page - 1) * 10 + index + 1,
    },
    {
      title: t('admin.plans.columns.name'),
      render: (_: any, record: AdminPlan) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 12, height: 12, borderRadius: '50%',
              background: record.color, flexShrink: 0,
            }}
          />
          <span style={{ fontWeight: 600 }}>{getPlanDisplayName(record, lang)}</span>
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
      title: t('admin.membershipPlan.columnFeatures'),
      render: (_: any, record: AdminPlan) => {
        const feats = getPlanDisplayFeatures(record, lang)
        return feats.length > 0
          ? feats.slice(0, 3).map((f, i) => <Tag key={i} style={{ marginBottom: 2 }}>{f}</Tag>).concat(
              feats.length > 3 ? <Tag key="more">+{feats.length - 3}</Tag> : []
            )
          : <Tag>—</Tag>
      },
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

  const template = selectedTemplate
  const previewName = template
    ? (lang.startsWith('vi') ? template.nameVi : template.nameEn)
    : editingPlan
      ? getPlanDisplayName(editingPlan, lang)
      : ''
  const previewDesc = template
    ? (lang.startsWith('vi') ? template.descriptionVi : template.descriptionEn)
    : editingPlan
      ? getPlanDisplayDesc(editingPlan, lang)
      : ''
  const previewFeatures = template
    ? (lang.startsWith('vi') ? template.featuresVi : template.featuresEn)
    : editingPlan
      ? getPlanDisplayFeatures(editingPlan, lang)
      : []

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Admin</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">{t('admin.plans.title')}</h1>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
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
        title={editingPlan ? t('admin.plans.modal.edit_title') : t('admin.membershipPlan.createTitle')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
        width={640}
      >
        <Form layout="vertical" form={form} onFinish={handleSubmit}>
          {/* planType — hidden field for tracking */}
          <Form.Item name="planType" hidden />
          <Form.Item name="nameVi" hidden />
          <Form.Item name="nameEn" hidden />
          <Form.Item name="descriptionVi" hidden />
          <Form.Item name="descriptionEn" hidden />
          <Form.Item name="featuresVi" hidden />
          <Form.Item name="featuresEn" hidden />
          <Form.Item name="durationDays" hidden />
          <Form.Item name="isActive" hidden />

          {/* Template selector (create only) */}
          {!editingPlan && (
            <Form.Item
              label={t('admin.membershipPlan.planType')}
              rules={[{ required: true, message: t('admin.membershipPlan.required') }]}
            >
              <Select
                placeholder={t('admin.membershipPlan.planTypePlaceholder')}
                options={planTypeOptions}
                onChange={(key) => {
                  const pkg = packageTemplates.find((p) => p.key === key)
                  if (pkg) applyTemplate(pkg)
                }}
                allowClear
              />
            </Form.Item>
          )}

          {/* Preview card */}
          {(template || editingPlan) && (
            <Card
              size="small"
              title={t('admin.membershipPlan.planPreview')}
              style={{ marginBottom: 16 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div
                  style={{
                    width: 14, height: 14, borderRadius: '50%',
                    background: template?.color || editingPlan?.color || '#3B82F6',
                    flexShrink: 0,
                  }}
                />
                <Text strong style={{ fontSize: 16 }}>{previewName}</Text>
              </div>

              {previewDesc && (
                <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                  {previewDesc}
                </Text>
              )}

              {previewFeatures.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  {previewFeatures.map((f, i) => (
                    <Tag key={i} style={{ marginBottom: 4 }}>{f}</Tag>
                  ))}
                </div>
              )}

              <Text type="secondary">
                {t('admin.membershipPlan.duration')}: {template?.durationDays || editingPlan?.durationDays} ngày
              </Text>
            </Card>
          )}

          {/* Editable fields */}
          <Space style={{ width: '100%' }} direction="vertical" size={12}>
            <Form.Item
              label={t('admin.membershipPlan.price')}
              name="price"
              rules={[{ required: true, message: t('admin.membershipPlan.required') }]}
              style={{ marginBottom: 0 }}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                placeholder={t('admin.membershipPlan.pricePlaceholder')}
              />
            </Form.Item>

            <Form.Item label={t('admin.membershipPlan.color')} name="color" style={{ marginBottom: 0 }}>
              <ColorPicker format="hex" />
            </Form.Item>
          </Space>

          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>
                {t('admin.membershipPlan.close')}
              </Button>
              <Button type="primary" htmlType="submit" loading={submitLoading}>
                {editingPlan ? t('admin.plans.submit.update') : t('admin.membershipPlan.submitCreate')}
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </DashboardLayout>
  )
}
