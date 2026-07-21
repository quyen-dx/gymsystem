import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  PoweroffOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import {
  Button,
  Checkbox,
  ColorPicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  message,
} from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import api from '../../../services/api'
import { planFeatureService, type PlanFeature } from '../../../services/planFeatureService'
import type { AdminPlan } from '../../../types/admin/plan'
import AdminHistoryButton from './AdminHistoryButton'
import { PRESET_COLORS } from './planColors'

export default function AdminPlansPage() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<AdminPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [specializationFilter] = useState<string | undefined>(undefined)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null)
  const [form] = Form.useForm()
  const [submitLoading, setSubmitLoading] = useState(false)
  const [allFeatures, setAllFeatures] = useState<PlanFeature[]>([])
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([])
  const [featuresLoading, setFeaturesLoading] = useState(true)
  const [selectedColor, setSelectedColor] = useState('#3B82F6')

  const updateColor = (color: string) => {
    setSelectedColor(color)
    form.setFieldsValue({ color })
  }

  useEffect(() => {
    planFeatureService.getAll({ isActive: true })
      .then((res) => setAllFeatures(res.data.data || []))
      .catch(() => { /* ignore */ })
      .finally(() => setFeaturesLoading(false))
  }, [])

  const fetchPlans = async (p = page, s = search, spec = specializationFilter) => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page: p, limit: 10 }
      if (s) params.search = s
      if (spec) params.specialization = spec
      const { data } = await api.get('/plans', { params })
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


  const resolveFeatureIds = (plan: AdminPlan): string[] => {
    if (plan.featureIds && plan.featureIds.length > 0) {
      return plan.featureIds.map((f: any) => typeof f === 'string' ? f : f._id)
    }
    if (allFeatures.length === 0) return []
    return allFeatures
      .filter((f) => plan.featuresVi?.includes(f.name))
      .map((f) => f._id)
  }

  const openEdit = (plan: AdminPlan) => {
    setEditingPlan(plan)
    setSelectedColor(plan.color || '#3B82F6')

    const featIds = resolveFeatureIds(plan)
    setSelectedFeatureIds(featIds)

    form.setFieldsValue({
      nameVi: plan.nameVi,
      price: plan.price,
      durationDays: plan.durationDays,
      descriptionVi: plan.descriptionVi || '',
      color: plan.color || '#3B82F6',
    })
    setModalOpen(true)
  }

  const openCreate = () => {
    navigate('/admin/plans/create')
  }

  const handleToggle = async (id: string) => {
    try {
      await api.patch(`/plans/${id}/toggle-status`)
      message.success('Thay đổi trạng thái gói tập thành công')
      fetchPlans()
    } catch {
      message.error('Không thể thay đổi trạng thái')
    }
  }

  const handleDelete = async (id: string) => {
    console.log('[DELETE] handleDelete called with id:', id)
    try {
      console.log('[DELETE] Calling api.delete...')
      const res = await api.delete(`/plans/${id}`)
      console.log('[DELETE] api.delete succeeded, response:', res)
      message.success('Xóa gói tập thành công')
      fetchPlans()
    } catch (err: any) {
      console.log('[DELETE] api.delete FAILED with error:', err)
      console.log('[DELETE] err.message:', err?.message)
      console.log('[DELETE] err.response:', err?.response)
      console.log('[DELETE] err.config:', err?.config)
      message.error(err?.response?.data?.message || 'Không thể xóa gói tập')
    }
  }

  const handleFeatureChange = (checkedValues: any[]) => {
    setSelectedFeatureIds(checkedValues)
  }

  const handleSubmit = async (values: any) => {
    setSubmitLoading(true)
    try {
      const featureNames = allFeatures
        .filter((f) => selectedFeatureIds.includes(f._id))
        .map((f) => f.name)

      const body = {
        ...values,
        featureIds: selectedFeatureIds,
        featuresVi: featureNames,
      }
      await api.put(`/plans/${editingPlan?._id}`, body)
      message.success('Cập nhật gói tập thành công')
      setModalOpen(false)
      fetchPlans()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể cập nhật gói tập')
    } finally {
      setSubmitLoading(false)
    }
  }

  const columns = [
    {
      title: 'Tên gói tập',
      render: (_: any, record: AdminPlan) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 12, height: 12, borderRadius: '50%',
              background: record.color, flexShrink: 0,
            }}
          />
          <span style={{ fontWeight: 600 }}>{record.nameVi}</span>
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
      title: 'Thời hạn',
      dataIndex: 'durationDays',
      render: (days: number) => `${days} ngày`,
    },
    {
      title: 'Quyền lợi',
      render: (_: any, record: AdminPlan) => {
        const feats = record.featuresVi || []
        return feats.length > 0
          ? feats.slice(0, 3).map((f, i) => <Tag key={i} style={{ marginBottom: 2 }}>{f}</Tag>).concat(
            feats.length > 3 ? <Tag key="more">+{feats.length - 3}</Tag> : []
          )
          : <Tag>—</Tag>
      },
    },
    {
      title: 'Thành viên',
      dataIndex: 'memberCount',
      render: (count: number) => (
        <Tag color={count > 0 ? 'blue' : 'default'}>{count} thành viên</Tag>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'error'}>
          {isActive ? 'Đang hoạt động' : 'Đã tắt'}
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
            title="Xóa gói tập"
            description="Bạn có chắc chắn muốn xóa gói tập này?"
            onConfirm={() => {
              console.log('[DELETE] Popconfirm onConfirm fired with id:', record._id)
              handleDelete(record._id)
            }}
            onCancel={() => {
              console.log('[DELETE] Popconfirm onCancel fired')
            }}
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
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Admin</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">Quản lý gói tập</h1>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
        <div className="dashboard-filter-bar">
          <Input.Search
            placeholder="Tìm kiếm gói tập..."
            allowClear
            onSearch={(val) => {
              setSearch(val)
              setPage(1)
              fetchPlans(1, val, specializationFilter)
            }}
          />
          <Space wrap>
            <AdminHistoryButton module="plans" title="gói tập" />
            <Button icon={<SettingOutlined />} onClick={() => navigate('/admin/features')}>
              Quản lý quyền lợi
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/admin/plans/create')}>
              Tạo gói tập
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
                fetchPlans(p, search, specializationFilter)
              },
            }}
          />
        </div>
      </div>

      <Modal
        title="Chỉnh sửa gói tập"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnHidden
        width={640}
      >
        <Form layout="vertical" form={form} onFinish={handleSubmit}>
          <Form.Item name="isActive" hidden />

          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item
              label="Tên gói tập"
              name="nameVi"
              rules={[{ required: true, message: 'Vui lòng nhập tên gói tập' }]}
            >
              <Input placeholder="VD: Gói Cơ Bản" />
            </Form.Item>

            <Form.Item
              label="Giá"
              name="price"
              rules={[{ required: true, message: 'Vui lòng nhập giá gói tập' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                addonAfter="VNĐ"
                placeholder="250000"
              />
            </Form.Item>

            <Form.Item
              label="Thời hạn"
              name="durationDays"
              rules={[{ required: true, message: 'Vui lòng nhập số ngày sử dụng' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={1}
                addonAfter="ngày"
                placeholder="30"
              />
            </Form.Item>

            <Form.Item
              label="Màu sắc"
              name="color"
            >
              <div className="flex items-center gap-2">
                {PRESET_COLORS.map((c) => (
                  <div
                    key={c}
                    onClick={() => updateColor(c)}
                    style={{
                      width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                      border: selectedColor === c ? '3px solid #fff' : '2px solid transparent',
                      boxShadow: selectedColor === c ? `0 0 0 2px ${c}` : 'none',
                    }}
                  />
                ))}
                <ColorPicker format="hex" value={selectedColor} onChange={(c) => updateColor(c.toHexString())} />
              </div>
            </Form.Item>
          </div>

          <Form.Item
            label="Mô tả"
            name="descriptionVi"
          >
            <Input.TextArea rows={3} placeholder="Mô tả gói tập (không bắt buộc)" />
          </Form.Item>

          <Form.Item label="Quyền lợi" required>
            {featuresLoading ? (
              <div className="text-sm text-[var(--gs-text-muted)]">Đang tải quyền lợi...</div>
            ) : (
              <Checkbox.Group value={selectedFeatureIds} onChange={handleFeatureChange}>
                <div className="grid grid-cols-1 gap-y-3">
                  {allFeatures.map((f) => (
                    <div key={f._id} className="flex items-start gap-3">
                      <Checkbox value={f._id} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-[var(--gs-text)]">{f.name}</span>
                        {f.description && (
                          <p className="m-0 mt-0.5 text-xs text-[var(--gs-text-muted)]">{f.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Checkbox.Group>
            )}
          </Form.Item>

          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>
                Đóng
              </Button>
              <Button type="primary" htmlType="submit" loading={submitLoading}>
                Cập nhật
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </DashboardLayout>
  )
}
