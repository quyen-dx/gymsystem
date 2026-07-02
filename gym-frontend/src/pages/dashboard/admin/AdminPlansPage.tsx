import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  PoweroffOutlined
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
  Radio,
  Select,
  Space,
  Table,
  Tag,
  message
} from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import api from '../../../services/api'
import type { AdminPlan } from '../../../types/admin/plan'
import AdminHistoryButton from './AdminHistoryButton'

const PRESET_COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#EC4899', '#06B6D4', '#F97316']

const DEFAULT_FEATURES = [
  'Sử dụng phòng tập',
  'Check-in QR',
  'Theo dõi sức khỏe',
  'Huấn luyện cá nhân',
  'Giáo án riêng',
  'Dành cho doanh nghiệp',
  'Quản lý nhóm nhân viên',
  'Ưu tiên hỗ trợ',
  'Lịch tập cá nhân hóa',
  'Đo lường chỉ số cơ thể',
  'Dinh dưỡng',
  'Thể dục nhóm',
]

const DEFAULT_SPECIALIZATIONS = ['Yoga', 'GYM', 'Boxing', 'CrossFit', 'Pilates', 'Zumba', 'Personal Training', 'Cardio', 'Weight Loss', 'Muscle Gain']

function getPlanDisplayName(plan: AdminPlan, lang: string): string {
  if (lang.startsWith('vi')) return plan.nameVi || plan.nameEn
  return plan.nameEn || plan.nameVi
}

function getPlanDisplayFeatures(plan: AdminPlan, lang: string): string[] {
  if (lang.startsWith('vi')) return plan.featuresVi?.length ? plan.featuresVi : plan.featuresEn
  return plan.featuresEn?.length ? plan.featuresEn : plan.featuresVi
}

export default function AdminPlansPage() {
  const lang = 'vi'
  const navigate = useNavigate()
  const [plans, setPlans] = useState<AdminPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [specializationFilter, setSpecializationFilter] = useState<string | undefined>(undefined)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<AdminPlan | null>(null)
  const [form] = Form.useForm()
  const [submitLoading, setSubmitLoading] = useState(false)
  const [allFeatures, setAllFeatures] = useState<string[]>(DEFAULT_FEATURES)
  const [newFeatureInput, setNewFeatureInput] = useState('')
  const [allSpecializations, setAllSpecializations] = useState<string[]>(DEFAULT_SPECIALIZATIONS)
  const [newSpecializationInput, setNewSpecializationInput] = useState('')
  const [selectedColor, setSelectedColor] = useState('#3B82F6')

  const updateColor = (color: string) => {
    setSelectedColor(color)
    form.setFieldsValue({ color })
  }

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



  const openEdit = (plan: AdminPlan) => {
    setEditingPlan(plan)
    setSelectedColor(plan.color || '#3B82F6')
    form.setFieldsValue({
      nameVi: plan.nameVi,
      price: plan.price,
      durationDays: plan.durationDays,
      descriptionVi: plan.descriptionVi || '',
      featuresVi: plan.featuresVi || [],
      applicableSpecializations: plan.applicableSpecializations?.[0] || undefined,
      color: plan.color,
      isActive: plan.isActive,
    })
    setModalOpen(true)
  }

  const handleSubmit = async (values: any) => {
    setSubmitLoading(true)
    try {
      const features = values.featuresVi || []
      if (features.length === 0) {
        message.warning('Vui lòng chọn ít nhất 1 quyền lợi')
        setSubmitLoading(false)
        return
      }

      const payload = {
        nameVi: values.nameVi,
        nameEn: values.nameVi,
        price: values.price,
        durationDays: values.durationDays,
        descriptionVi: values.descriptionVi || '',
        descriptionEn: values.descriptionVi || '',
        featuresVi: features,
        featuresEn: features,
        applicableSpecializations: values.applicableSpecializations ? [values.applicableSpecializations] : [],
        isActive: values.isActive ?? true,
        color: typeof values.color === 'string'
          ? values.color
          : values.color?.toHexString?.() || '#3B82F6',
      }

      await api.put(`/plans/${editingPlan!._id}`, payload)
      message.success('Cập nhật gói tập thành công')

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
      message.error(err.response?.data?.message || 'Không thể xóa gói tập')
    }
  }

  const handleToggle = async (id: string) => {
    try {
      await api.patch(`/plans/${id}/toggle-status`)
      message.success('Thay đổi trạng thái thành công')
      fetchPlans()
    } catch {
      message.error('Thao tác thất bại')
    }
  }

  const columns = [
    {
      title: 'STT',
      width: 70,
      align: 'center' as const,
      render: (_: any, __: AdminPlan, index: number) => (page - 1) * 10 + index + 1,
    },
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
          <span style={{ fontWeight: 600 }}>{getPlanDisplayName(record, lang)}</span>
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
        const feats = getPlanDisplayFeatures(record, lang)
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

  const handleAddFeature = () => {
    const val = newFeatureInput.trim()
    if (!val) return
    if (allFeatures.includes(val)) {
      message.info('Quyền lợi này đã có trong danh sách')
      setNewFeatureInput('')
      return
    }
    setAllFeatures((prev) => [...prev, val])
    const current = form.getFieldValue('featuresVi') || []
    form.setFieldsValue({ featuresVi: [...current, val] })
    setNewFeatureInput('')
  }

  const handleAddSpecialization = () => {
    const val = newSpecializationInput.trim()
    if (!val) return
    if (allSpecializations.includes(val)) {
      message.info('Chuyên môn này đã có trong danh sách')
      setNewSpecializationInput('')
      return
    }
    setAllSpecializations((prev) => [...prev, val])
    form.setFieldsValue({ applicableSpecializations: val })
    setNewSpecializationInput('')
  }

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
          <Select
            placeholder="Chuyên môn"
            style={{ minWidth: 160 }}
            value={specializationFilter || ''}
            onChange={(val) => {
              const next = val || undefined
              setSpecializationFilter(next)
              setPage(1)
              fetchPlans(1, search, val)
            }}
            options={[
              { value: '', label: 'Tất cả' },
              ...allSpecializations.map((s) => ({ value: s, label: s })),
            ]}
          />
          <Space wrap>
            <AdminHistoryButton module="plans" title="gói tập" />
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
        width={720}
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
            label="Mô tả ngắn"
            name="descriptionVi"
          >
            <Input.TextArea rows={2} placeholder="Mô tả gói tập (không bắt buộc)" />
          </Form.Item>

          <Form.Item
            label="Quyền lợi"
            name="featuresVi"
            rules={[{ required: true, type: 'array', min: 1, message: 'Vui lòng chọn ít nhất 1 quyền lợi' }]}
          >
            <Checkbox.Group>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {allFeatures.map((f) => (
                  <Checkbox key={f} value={f}>{f}</Checkbox>
                ))}
              </div>
            </Checkbox.Group>
          </Form.Item>

          <div className="flex items-center gap-2 mb-4">
            <Input
              size="small"
              style={{ width: 260 }}
              placeholder="Nhập quyền lợi mới..."
              value={newFeatureInput}
              onChange={(e) => setNewFeatureInput(e.target.value)}
              onPressEnter={handleAddFeature}
            />
            <Button size="small" icon={<PlusOutlined />} onClick={handleAddFeature}>
              Thêm quyền lợi mới
            </Button>
          </div>

          <Form.Item
            label="Chuyên môn áp dụng"
            name="applicableSpecializations"
            rules={[{ required: true, message: 'Vui lòng chọn chuyên môn' }]}
          >
            <Radio.Group>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {allSpecializations.map((s) => (
                  <Radio key={s} value={s}>{s}</Radio>
                ))}
              </div>
            </Radio.Group>
          </Form.Item>

          <div className="flex items-center gap-2 mb-4">
            <Input
              size="small"
              style={{ width: 260 }}
              placeholder="Nhập chuyên môn mới..."
              value={newSpecializationInput}
              onChange={(e) => setNewSpecializationInput(e.target.value)}
              onPressEnter={handleAddSpecialization}
            />
            <Button size="small" icon={<PlusOutlined />} onClick={handleAddSpecialization}>
              Thêm chuyên môn mới
            </Button>
          </div>

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
