import {
  ArrowLeftOutlined,
  EditOutlined,
  PlusOutlined,
  PoweroffOutlined
} from '@ant-design/icons'
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  message
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { planFeatureService, type PlanFeature } from '../../../services/planFeatureService'

export default function AdminFeatureManagePage() {
  const navigate = useNavigate()
  const [features, setFeatures] = useState<PlanFeature[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingFeature, setEditingFeature] = useState<PlanFeature | null>(null)
  const [form] = Form.useForm()
  const [submitLoading, setSubmitLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const { data } = await planFeatureService.getAll()
      setFeatures(data.data || [])
    } catch {
      message.error('Không thể tải danh sách quyền lợi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const filteredFeatures = useMemo(() => {
    const q = search.trim().toLowerCase()
    return features.filter((f) => {
      if (!q) return true
      return f.name.toLowerCase().includes(q) || f.code.toLowerCase().includes(q)
    })
  }, [features, search])

  const openCreate = () => {
    setEditingFeature(null)
    form.resetFields()
    form.setFieldsValue({ isActive: true })
    setModalOpen(true)
  }

  const openEdit = (f: PlanFeature) => {
    setEditingFeature(f)
    form.setFieldsValue({
      name: f.name,
      code: f.code,
      description: f.description || '',
      isActive: f.isActive,
    })
    setModalOpen(true)
  }

  const handleSubmit = async (values: any) => {
    setSubmitLoading(true)
    try {
      const payload = { name: values.name, code: values.code, description: values.description || '' }
      if (editingFeature) {
        await planFeatureService.update(editingFeature._id, payload)
        message.success('Cập nhật quyền lợi thành công')
      } else {
        await planFeatureService.create({ ...payload, isActive: values.isActive ?? true })
        message.success('Tạo quyền lợi thành công')
      }
      setModalOpen(false)
      loadData()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Thao tác thất bại')
    } finally {
      setSubmitLoading(false)
    }
  }

  const handleToggle = async (id: string) => {
    try {
      await planFeatureService.toggleActive(id)
      message.success('Thay đổi trạng thái thành công')
      loadData()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Thao tác thất bại')
    }
  }

  const columns = [
    {
      title: 'STT', width: 70, align: 'center' as const,
      render: (_: any, __: PlanFeature, i: number) => (page - 1) * 10 + i + 1,
    },
    {
      title: 'Tên quyền lợi',
      render: (_: any, r: PlanFeature) => <span style={{ fontWeight: 600 }}>{r.name}</span>,
    },
    { title: 'Mã code', dataIndex: 'code', render: (c: string) => <Tag>{c}</Tag> },
    {
      title: 'Trạng thái', dataIndex: 'isActive',
      render: (v: boolean) => <Tag color={v ? 'success' : 'error'}>{v ? 'Đang hoạt động' : 'Đã tắt'}</Tag>,
    },
    {
      title: 'Hệ thống', dataIndex: 'isSystem',
      render: (v: boolean) => v ? <Tag color="orange">Hệ thống</Tag> : <Tag>—</Tag>,
    },
    {
      title: 'Thao tác',
      render: (_: any, r: PlanFeature) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm
            title={r.isActive ? 'Vô hiệu hóa quyền lợi?' : 'Kích hoạt quyền lợi?'}
            onConfirm={() => handleToggle(r._id)}
            okText="Xác nhận" cancelText="Hủy"
          >
            <Button size="small" danger={r.isActive} icon={<PoweroffOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Admin</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">Quản lý quyền lợi</h1>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
        <div className="dashboard-filter-bar">
          <Input.Search
            placeholder="Tìm kiếm quyền lợi..."
            allowClear
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
          <Space wrap>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/plans')}>
              Quay lại gói tập
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Thêm quyền lợi
            </Button>
          </Space>
        </div>

        <div className="member-scroll-x">
          <Table
            dataSource={filteredFeatures}
            columns={columns}
            rowKey="_id"
            loading={loading}
            pagination={{
              total: filteredFeatures.length,
              current: page,
              pageSize: 10,
              onChange: (p) => setPage(p),
            }}
          />
        </div>
      </div>

      <Modal
        title={editingFeature ? 'Chỉnh sửa quyền lợi' : 'Thêm quyền lợi'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnHidden
        width={520}
      >
        <Form layout="vertical" form={form} onFinish={handleSubmit}>
          <Form.Item label="Tên quyền lợi" name="name" rules={[{ required: true, message: 'Vui lòng nhập tên' }]}>
            <Input placeholder="VD: Đặt lịch PT nhóm" />
          </Form.Item>
          <Form.Item label="Mã code" name="code" rules={[{ required: true, message: 'Vui lòng nhập mã code' }]}>
            <Input placeholder="VD: BOOK_PT_GROUP" disabled={!!editingFeature} />
          </Form.Item>
          <Form.Item label="Mô tả" name="description">
            <Input.TextArea rows={3} placeholder="Cho phép hội viên đặt lịch PT nhóm." />
          </Form.Item>
          {!editingFeature && (
            <Form.Item label="Kích hoạt" name="isActive" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>Đóng</Button>
              <Button type="primary" htmlType="submit" loading={submitLoading}>
                {editingFeature ? 'Cập nhật' : 'Tạo mới'}
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </DashboardLayout>
  )
}
