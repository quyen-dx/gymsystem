import { useEffect, useState } from 'react'
import { Table, Button, Tag, Modal, Form, Input, Select, message, Space, Tooltip, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { trainingClassService, DAY_OPTIONS, SPECIALIZATION_OPTIONS, type TrainingClass } from '../../../services/trainingGroupService'
import { trainerService } from '../../../services/trainerService'
import { floorZoneService } from '../../../services/floorZoneService'
import { getUserDisplayName } from '../../../utils/userDisplay'

const TIME_SLOTS = [
  '07:00 - 09:00',
  '09:00 - 11:00',
  '12:00 - 14:00',
  '14:00 - 16:00',
  '16:00 - 18:00',
  '18:00 - 20:00',
  '20:00 - 22:00',
]

const CLASS_SPECIALIZATION_OPTIONS = [
  { value: 'YOGA', label: 'YOGA' },
  { value: 'GYM', label: 'GYM' },
  { value: 'BOXING', label: 'BOXING' },
  { value: 'CROSSFIT', label: 'CROSSFIT' },
  { value: 'PILATES', label: 'PILATES' },
  { value: 'ZUMBA', label: 'ZUMBA' },
  { value: 'PERSONAL TRAINING', label: 'PERSONAL TRAINING' },
  { value: 'CARDIO', label: 'CARDIO' },
  { value: 'STRENGTH TRAINING', label: 'STRENGTH TRAINING' },
  { value: 'HIIT', label: 'HIIT' },
  { value: 'DANCE', label: 'DANCE' },
  { value: 'MEDITATION', label: 'MEDITATION' },
]

export default function TrainingClassesPage() {
  const [classes, setClasses] = useState<TrainingClass[]>([])
  const [trainers, setTrainers] = useState<any[]>([])
  const [floors, setFloors] = useState<any[]>([])
  const [zones, setZones] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TrainingClass | null>(null)
  const [form] = Form.useForm()
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null)
  const [filterSpecialization, setFilterSpecialization] = useState<string | undefined>()
  const [filterPtId, setFilterPtId] = useState<string | undefined>()
  const [filterTimeSlot, setFilterTimeSlot] = useState<string | undefined>()
  const [filterCapacity, setFilterCapacity] = useState<string | undefined>() // 'full' | 'available' | undefined
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | undefined>()

  const filteredTrainers = trainers.filter((t: any) => {
    if (!selectedSpecialty) return false
    const ptSpecialties = Array.isArray(t.specialties) ? t.specialties.map((s: string) => s.toUpperCase()) : []
    return ptSpecialties.includes(selectedSpecialty.toUpperCase())
  })

  const load = async () => {
    setLoading(true)
    try {
      const [cRes, ptRes, fRes, zRes] = await Promise.all([
        trainingClassService.getAll({}),
        trainerService.getPTs({ pageSize: 100 }),
        floorZoneService.getFloors(),
        floorZoneService.getZones(),
      ])
      setClasses(cRes.data.classes || [])
      setTrainers(ptRes.data?.pts || [])
      setFloors(fRes.data.floors || [])
      setZones(zRes.data.zones || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleOpen = (c?: TrainingClass) => {
    if (c) {
      setEditing(c)
      const pt = (c.ptId as any)
      const floor = (c.floorId as any)
      const zone = (c.zoneId as any)
      setSelectedFloor(floor?._id || null)
      setSelectedSpecialty(c.specialization || undefined)
      form.setFieldsValue({
        name: c.name,
        description: c.description,
        specialization: c.specialization || undefined,
        ptId: pt?._id || pt || undefined,
        floorId: floor?._id || undefined,
        zoneId: zone?._id || undefined,
        daysOfWeek: c.daysOfWeek || [],
        timeSlot: c.startTime && c.endTime ? `${c.startTime.slice(0, 5)} - ${c.endTime.slice(0, 5)}` : undefined,
      })
    } else {
      setEditing(null)
      setSelectedFloor(null)
      setSelectedSpecialty(undefined)
      form.resetFields()
    }
    setOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await trainingClassService.delete(id)
      message.success('Đã xóa lớp tập')
      load()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Xóa thất bại')
    }
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    const [startTime, endTime] = values.timeSlot
      ? values.timeSlot.split(' - ').map((s: string) => s.trim())
      : [null, null]
    const { timeSlot, ...rest } = values
    const payload = { ...rest, startTime, endTime }
    try {
      if (editing) {
        await trainingClassService.update(editing._id, payload)
        message.success('Đã cập nhật lớp tập')
      } else {
        await trainingClassService.create(payload)
        message.success('Đã tạo lớp tập')
      }
      setOpen(false)
      load()
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Lưu thất bại')
    }
  }

  const filteredZones = zones.filter((z: any) => {
    const zFloor = z.floorId as any
    return !selectedFloor || String(zFloor._id || zFloor) === String(selectedFloor)
  })

  const filteredClasses = classes.filter((c) => {
    const clsSpec = (c.specialization || '').trim().toLowerCase()
    const fltSpec = (filterSpecialization || '').trim().toLowerCase()
    if (filterSpecialization && clsSpec !== fltSpec) return false
    if (filterPtId) {
      const pt = c.ptId as any
      if (String(pt?._id || pt) !== String(filterPtId)) return false
    }
    if (filterTimeSlot) {
      const slot = c.startTime && c.endTime ? `${c.startTime.slice(0, 5)} - ${c.endTime.slice(0, 5)}` : ''
      if (slot !== filterTimeSlot) return false
    }
    if (filterCapacity === 'full') {
      const zone = c.zoneId as any
      const maxCap = zone?.maxCapacity
      if (!maxCap) return false
      const current = c.currentActiveCount ?? 0
      if (current < maxCap) return false
    }
    if (filterCapacity === 'available') {
      const zone = c.zoneId as any
      const maxCap = zone?.maxCapacity
      if (!maxCap) return true // unlimited = always available
      const current = c.currentActiveCount ?? 0
      if (current >= maxCap) return false
    }
    return true
  })

  const getSpecializationTag = (s: string) => {
    const opt = SPECIALIZATION_OPTIONS.find((o) => o.value === s)
    return opt?.label || s || '—'
  }

  const getLocationLabel = (r: TrainingClass) => {
    const floor = r.floorId as any
    const zone = r.zoneId as any
    if (!floor && !zone) return '—'
    return `${floor?.name || '—'}${zone?.name ? ` - ${zone.name}` : ''}`
  }

  const getCapacityLabel = (r: TrainingClass) => {
    const zone = r.zoneId as any
    const maxCap = zone?.maxCapacity
    if (!maxCap) return <span className="text-[var(--gs-text-muted)]">Không giới hạn</span>
    const current = r.currentActiveCount ?? 0
    const isFull = current >= maxCap
    return (
      <span className={isFull ? 'text-red-500 font-semibold' : ''}>
        {current} / {maxCap}
        {isFull && <Tag className="ml-1 text-[10px] leading-none" color="red" style={{ fontSize: 10, lineHeight: '16px' }}>Đầy</Tag>}
      </span>
    )
  }

  const getTimeLabel = (r: TrainingClass) => {
    const days = r.daysOfWeek || []
    if (days.length === 0) return '—'
    const dayStr = days.map((d) => DAY_OPTIONS.find((o) => o.value === d)?.label || `Thứ ${d + 1}`).join(', ')
    if (!r.startTime || !r.endTime) return dayStr
    return `${dayStr} | ${r.startTime.slice(0, 5)} - ${r.endTime.slice(0, 5)}`
  }

  const columns = [
    {
      title: 'Mã lớp', dataIndex: 'code', key: 'code', width: 80,
      render: (c: string) => <span className="font-mono text-xs font-semibold text-[var(--gs-text)]">{c || '—'}</span>,
    },
    {
      title: 'Tên lớp', dataIndex: 'name', key: 'name',
      render: (n: string) => <span className="font-semibold text-[var(--gs-text)]">{n}</span>,
    },
    {
      title: 'Chuyên môn', dataIndex: 'specialization', key: 'specialization', width: 130,
      render: (s: string) => <Tag className="uppercase">{getSpecializationTag(s)}</Tag>,
    },
    {
      title: 'PT phụ trách', key: 'pt', width: 150,
      render: (_: any, r: TrainingClass) => {
        const pt = r.ptId as any
        if (!pt) return <span className="text-sm text-[var(--gs-text-muted)]">—</span>
        return (
          <Space size={4}>
            {pt?.avatar && <img src={pt.avatar} className="h-6 w-6 rounded-full object-cover" />}
            <span className="text-sm text-[var(--gs-text)]">{getUserDisplayName(pt)}</span>
          </Space>
        )
      },
    },
    {
      title: 'Thời gian', key: 'time', width: 150,
      render: (_: any, r: TrainingClass) => (
        <span className="text-sm text-[var(--gs-text)]">{getTimeLabel(r)}</span>
      ),
    },
    {
      title: 'Địa điểm', key: 'location', width: 150,
      render: (_: any, r: TrainingClass) => (
        <span className="text-sm text-[var(--gs-text)]">{getLocationLabel(r)}</span>
      ),
    },
    {
      title: 'Sức chứa hiện tại', key: 'capacity', width: 120, align: 'center' as const,
      render: (_: any, r: TrainingClass) => getCapacityLabel(r),
    },
    {
      title: '', key: 'action', width: 80,
      render: (_: any, r: TrainingClass) => (
        <Space size={4}>
          <Tooltip title="Sửa">
            <Button size="small" icon={<EditOutlined />} onClick={() => handleOpen(r)} />
          </Tooltip>
          <Popconfirm title="Xóa lớp này?" onConfirm={() => handleDelete(r._id)} okText="Xóa" cancelText="Hủy">
            <Tooltip title="Xóa">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--gs-text)]">Lớp tập</h1>
            <p className="text-sm text-[var(--gs-text-muted)]">Quản lý danh sách lớp tập</p>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpen()}>Tạo lớp</Button>
        </div>

        <div className="dashboard-filter-bar flex flex-wrap gap-3">
          <Select allowClear placeholder="Lọc theo chuyên môn" style={{ minWidth: 160 }}
            onChange={(val) => setFilterSpecialization(val)} options={SPECIALIZATION_OPTIONS} />
          <Select allowClear showSearch placeholder="Lọc theo PT" style={{ minWidth: 180 }}
            onChange={(val) => setFilterPtId(val)} optionFilterProp="label"
            options={trainers.map((t: any) => ({ label: getUserDisplayName(t, 'PT'), value: t._id }))} />
          <Select allowClear placeholder="Lọc theo ca tập" style={{ minWidth: 180 }}
            onChange={(val) => setFilterTimeSlot(val)}
            options={TIME_SLOTS.map(s => ({ label: s, value: s }))} />
          <Select allowClear placeholder="Lọc sức chứa" style={{ minWidth: 150 }}
            onChange={(val) => setFilterCapacity(val)}
            options={[
              { value: 'available', label: '🟢 Còn chỗ' },
              { value: 'full', label: '🔴 Đã đầy' },
            ]} />
        </div>

        <Table dataSource={filteredClasses} columns={columns} rowKey="_id" loading={loading}
          pagination={false} locale={{ emptyText: 'Chưa có lớp tập nào' }} />

        <Modal title={editing ? 'Sửa lớp tập' : 'Tạo lớp tập mới'} open={open}
          onOk={handleSave} onCancel={() => setOpen(false)} okText="Lưu" cancelText="Hủy" width={800} destroyOnClose>
          <Form form={form} layout="vertical" size="middle">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Form.Item name="name" label="Tên lớp" rules={[{ required: true, message: 'Nhập tên lớp' }]}>
                  <Input placeholder="VD: Yoga Sáng, Kickboxing nâng cao..." />
                </Form.Item>
                <Form.Item name="description" label="Mô tả">
                  <Input.TextArea rows={5} placeholder="Mô tả về lớp tập" />
                </Form.Item>
              </div>
              <div className="space-y-2">
                <Form.Item name="specialization" label="Chuyên môn của lớp" rules={[{ required: true, message: 'Chọn chuyên môn' }]}>
                  <Select placeholder="Chọn chuyên môn" options={CLASS_SPECIALIZATION_OPTIONS}
                    onChange={(val) => { setSelectedSpecialty(val); form.setFieldValue('ptId', undefined) }} />
                </Form.Item>
                <Form.Item name="ptId" label="PT điều hành">
                  <Select placeholder={selectedSpecialty ? 'Chọn PT' : 'Vui lòng chọn chuyên môn của lớp trước'}
                    disabled={!selectedSpecialty} allowClear showSearch optionFilterProp="label"
                    options={filteredTrainers.map((t: any) => ({ label: getUserDisplayName(t, 'PT'), value: t._id }))} />
                </Form.Item>
                <Form.Item name="daysOfWeek" label="Thứ trong tuần">
                  <Select placeholder="Chọn các thứ" mode="multiple" options={DAY_OPTIONS} />
                </Form.Item>
                <Form.Item name="timeSlot" label="Khung giờ dạy">
                  <Select placeholder="Chọn khung giờ" options={TIME_SLOTS.map(s => ({ label: s, value: s }))} />
                </Form.Item>
                <Form.Item name="floorId" label="Địa điểm - Chọn Tầng">
                  <Select placeholder="Chọn tầng" allowClear
                    onChange={(val) => { setSelectedFloor(val || null); form.setFieldValue('zoneId', undefined) }}
                    options={floors.map((f: any) => ({ label: f.name, value: f._id }))} />
                </Form.Item>
                <Form.Item name="zoneId" label="Địa điểm - Chọn Khu vực">
                  <Select placeholder="Chọn khu vực" allowClear
                    options={filteredZones.map((z: any) => ({ label: z.name, value: z._id }))} />
                </Form.Item>
              </div>
            </div>
          </Form>
        </Modal>
      </div>
    </DashboardLayout>
  )
}
