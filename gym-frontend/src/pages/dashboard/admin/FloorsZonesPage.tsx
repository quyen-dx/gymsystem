import { useEffect, useState } from 'react'
import { Table, Button, Tag, Modal, Form, Input, InputNumber, Select, message, Space, Tooltip, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { floorZoneService, type Floor, type Zone } from '../../../services/floorZoneService'

export default function FloorsZonesPage() {
  const [floors, setFloors] = useState<Floor[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(false)

  // Floor modal
  const [floorOpen, setFloorOpen] = useState(false)
  const [editFloor, setEditFloor] = useState<Floor | null>(null)
  const [floorForm] = Form.useForm()

  // Zone modal
  const [zoneOpen, setZoneOpen] = useState(false)
  const [editZone, setEditZone] = useState<Zone | null>(null)
  const [zoneForm] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const [fRes, zRes] = await Promise.all([
        floorZoneService.getFloors(),
        floorZoneService.getZonesWithOccupancy(),
      ])
      setFloors(fRes.data.floors || [])
      setZones(zRes.data.zones || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleSaveFloor = async () => {
    const v = await floorForm.validateFields()
    try {
      if (editFloor) {
        await floorZoneService.updateFloor(editFloor._id, v)
        message.success('Đã cập nhật tầng')
      } else {
        await floorZoneService.createFloor(v)
        message.success('Đã tạo tầng')
      }
      setFloorOpen(false)
      load()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Lỗi')
    }
  }

  const handleDeleteFloor = async (id: string) => {
    try {
      await floorZoneService.deleteFloor(id)
      message.success('Đã xóa tầng và các khu vực liên quan')
      load()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Lỗi')
    }
  }

  const handleSaveZone = async () => {
    const v = await zoneForm.validateFields()
    try {
      if (editZone) {
        await floorZoneService.updateZone(editZone._id, v)
        message.success('Đã cập nhật khu vực')
      } else {
        await floorZoneService.createZone(v)
        message.success('Đã tạo khu vực')
      }
      setZoneOpen(false)
      load()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Lỗi')
    }
  }

  const handleDeleteZone = async (id: string) => {
    try {
      await floorZoneService.deleteZone(id)
      message.success('Đã xóa khu vực')
      load()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Lỗi')
    }
  }

  const getFloorName = (floorId: any) => {
    if (!floorId) return '—'
    if (typeof floorId === 'object') return floorId.name || '—'
    const f = floors.find((x) => x._id === floorId)
    return f?.name || '—'
  }

  const floorColumns = [
    {
      title: 'Tên tầng', dataIndex: 'name', key: 'name',
      render: (n: string) => <span className="font-medium text-[var(--gs-text)]">{n}</span>,
    },
    {
      title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 120,
      render: (s: string) => (
        <Tag color={s === 'active' ? 'green' : 'orange'}>{s === 'active' ? 'Đang hoạt động' : 'Bảo trì'}</Tag>
      ),
    },
    {
      title: '', key: 'action', width: 100,
      render: (_: any, r: Floor) => (
        <Space size={4}>
          <Tooltip title="Sửa">
            <Button size="small" icon={<EditOutlined />}
              onClick={() => {
                setEditFloor(r)
                floorForm.setFieldsValue(r)
                setFloorOpen(true)
              }} />
          </Tooltip>
          <Popconfirm title="Xóa tầng này?" description="Các khu vực thuộc tầng cũng sẽ bị xóa."
            onConfirm={() => handleDeleteFloor(r._id)} okText="Xóa" cancelText="Hủy">
            <Tooltip title="Xóa">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const zoneColumns = [
    {
      title: 'Tên Tầng', key: 'floor', width: 130,
      render: (_: any, r: Zone) => (
        <span className="text-sm text-[var(--gs-text)]">{getFloorName(r.floorId)}</span>
      ),
    },
    {
      title: 'Tên Khu Vực', dataIndex: 'name', key: 'name',
      render: (n: string) => <span className="font-medium text-[var(--gs-text)]">{n}</span>,
    },
    {
      title: 'Sức chứa', key: 'capacity', width: 120, align: 'center' as const,
      render: (_: any, r: Zone) => {
        const max = r.maxCapacity || 0
        return max === 0 ? <span className="text-sm text-[var(--gs-text-muted)]">Không giới hạn</span>
          : <span className="text-sm text-[var(--gs-text)]">{max} người</span>
      },
    },
    {
      title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 150,
      render: (s: string) => (
        <Tag color={s === 'active' ? 'green' : 'orange'}>
          {s === 'active' ? 'Đang hoạt động' : 'Bảo trì / Tạm dừng'}
        </Tag>
      ),
    },
    {
      title: 'Thao tác', key: 'action', width: 120,
      render: (_: any, r: Zone) => (
        <Space size={4}>
          <Tooltip title="Sửa">
            <Button size="small" icon={<EditOutlined />}
              onClick={() => {
                setEditZone(r)
                const floorIdVal = typeof r.floorId === 'object' ? (r.floorId as any)._id : r.floorId
                zoneForm.setFieldsValue({
                  name: r.name,
                  floorId: floorIdVal,
                  maxCapacity: r.maxCapacity,
                  status: r.status,
                })
                setZoneOpen(true)
              }} />
          </Tooltip>
          <Popconfirm title="Xóa khu vực này?" onConfirm={() => handleDeleteZone(r._id)} okText="Xóa" cancelText="Hủy">
            <Tooltip title="Xóa">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const zoneStatusOptions = [
    { label: 'Đang hoạt động', value: 'active' },
    { label: 'Bảo trì / Tạm dừng', value: 'maintenance' },
  ]

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold text-[var(--gs-text)]">Tầng & Khu vực</h1>

        {/* Danh sách tầng */}
        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--gs-card)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--gs-text)]">Danh sách Tầng</h2>
            <Button type="primary" size="small" icon={<PlusOutlined />}
              onClick={() => {
                setEditFloor(null)
                floorForm.resetFields()
                setFloorOpen(true)
              }}>
              Thêm tầng
            </Button>
          </div>
          <Table dataSource={floors} columns={floorColumns} rowKey="_id"
            loading={loading} pagination={false} size="small" />
        </div>

        {/* Danh sách khu vực */}
        <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--gs-card)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--gs-text)]">Danh sách Khu vực</h2>
            <Button type="primary" size="small" icon={<PlusOutlined />}
              onClick={() => {
                setEditZone(null)
                zoneForm.resetFields()
                setZoneOpen(true)
              }}>
              Thêm khu vực
            </Button>
          </div>
          <Table dataSource={zones} columns={zoneColumns} rowKey="_id"
            loading={loading} pagination={false} size="middle" />
        </div>

        {/* Modal Tầng */}
        <Modal title={editFloor ? 'Sửa tầng' : 'Thêm tầng'} open={floorOpen}
          onOk={handleSaveFloor} onCancel={() => setFloorOpen(false)}
          okText="Lưu" cancelText="Hủy" destroyOnClose>
          <Form form={floorForm} layout="vertical" size="middle">
            <Form.Item name="name" label="Tên tầng" rules={[{ required: true, message: 'Nhập tên tầng' }]}>
              <Input placeholder="VD: Tầng 1, Tầng 2, Tầng G..." />
            </Form.Item>
            <Form.Item name="status" label="Trạng thái" initialValue="active">
              <Select options={zoneStatusOptions} />
            </Form.Item>
          </Form>
        </Modal>

        {/* Modal Khu vực */}
        <Modal title={editZone ? 'Sửa khu vực' : 'Thêm khu vực'} open={zoneOpen}
          onOk={handleSaveZone} onCancel={() => setZoneOpen(false)}
          okText="Lưu" cancelText="Hủy" destroyOnClose width={520}>
          <Form form={zoneForm} layout="vertical" size="middle">
            <Form.Item name="name" label="Tên khu vực" rules={[{ required: true, message: 'Nhập tên khu vực' }]}>
              <Input placeholder="VD: Khu Cardio, Khu Tạ Nặng, Phòng Yoga..." />
            </Form.Item>
            <Form.Item name="floorId" label="Thuộc tầng" rules={[{ required: true, message: 'Chọn tầng' }]}>
              <Select placeholder="Chọn tầng"
                options={floors.map((f) => ({ label: f.name, value: f._id }))} />
            </Form.Item>
            <Form.Item name="maxCapacity" label="Sức chứa tối đa (số ca tập cùng lúc)" initialValue={0}
              rules={[{ type: 'number', min: 0, message: 'Sức chứa phải >= 0' }]}>
              <InputNumber min={0} className="w-full"
                placeholder="0 = Không giới hạn" />
            </Form.Item>
            <Form.Item name="status" label="Trạng thái" initialValue="active">
              <Select options={zoneStatusOptions} />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </DashboardLayout>
  )
}
