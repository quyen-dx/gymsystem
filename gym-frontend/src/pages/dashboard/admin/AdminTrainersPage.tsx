import {
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  StarFilled,
} from '@ant-design/icons'
import {
  Button,
  Input,
  Rate,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { trainerService } from '../../../services/trainerService'
import type { PT } from '../../../types/admin/trainer'
import { getUserDisplayName } from '../../../utils/userDisplay'

export default function AdminTrainersPage() {
  const navigate = useNavigate()
  const [pts, setPts] = useState<PT[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [specialtyFilter, setSpecialtyFilter] = useState<string | undefined>()

  const fetchPTs = useCallback(async (p = page, s = search, sp = specialtyFilter) => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page: p, limit: 15 }
      if (s) params.search = s
      if (sp) params.specialty = sp
      const { data } = await trainerService.getPTs(params)
      setPts(data.pts)
      setTotal(data.pagination.total)
    } catch {
      message.error('Không thể tải danh sách huấn luyện viên')
    } finally {
      setLoading(false)
    }
  }, [page, search, specialtyFilter])

  useEffect(() => {
    fetchPTs()
  }, [])

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
    fetchPTs(1, value, specialtyFilter)
  }

  const handleSpecialtyFilter = (value: string | undefined) => {
    setSpecialtyFilter(value)
    setPage(1)
    fetchPTs(1, search, value)
  }

  const columns = [
    {
      title: 'Huấn luyện viên',
      width: 220,
      render: (_: unknown, record: PT) => (
        <Space>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: record.avatar ? `url(${record.avatar}) center/cover` : 'var(--gs-border)',
              flexShrink: 0,
            }}
          />
          <div>
            <div style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--gs-text)' }}
              onClick={() => navigate(`/admin/trainers/${record._id}`)}>
              {getUserDisplayName(record, 'PT')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--gs-text-muted)' }}>
              {record.email || record.phone || '—'}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Chuyên môn',
      render: (_: unknown, record: PT) => (
        <Space size={4} wrap>
          {record.specialties?.length > 0
            ? record.specialties.map((s) => <Tag key={s} style={{ margin: 0 }}>{s}</Tag>)
            : <span style={{ opacity: 0.4 }}>—</span>
          }
        </Space>
      ),
    },
    {
      title: 'Đánh giá',
      width: 140,
      render: (_: unknown, record: PT) => (
        <span>
          <Rate disabled value={record.rating} allowHalf style={{ fontSize: 14 }} character={<StarFilled />} />
          <span style={{ marginLeft: 6, fontSize: 13, color: 'var(--gs-text-muted)' }}>{record.rating.toFixed(1)}</span>
        </span>
      ),
    },
    {
      title: 'Kinh nghiệm',
      width: 100,
      align: 'center' as const,
      render: (_: unknown, record: PT) => (
        <span>{record.experienceYears ? `${record.experienceYears}y` : '—'}</span>
      ),
    },
    {
      title: 'Lượt đặt',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, record: PT) => (
        <span>{record.bookingCount ?? 0}</span>
      ),
    },
    {
      title: 'Trạng thái',
      width: 100,
      render: (_: unknown, record: PT) => (
        <Tag color={record.isActive ? 'success' : 'error'}>
          {record.isActive ? 'Hoạt động' : 'Đã khóa'}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      width: 130,
      render: (_: unknown, record: PT) => (
        <Space size={4}>
          <Tooltip title="Xem chi tiết">
            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/admin/trainers/${record._id}`)} />
          </Tooltip>
          <Tooltip title="Chỉnh sửa">
            <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/admin/trainers/${record._id}/edit`)} />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Quản lý</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">Quản lý huấn luyện viên</h1>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
        <div className="dashboard-filter-bar">
          <Input.Search
            placeholder="Tìm kiếm huấn luyện viên..."
            allowClear
            onSearch={handleSearch}
            style={{ maxWidth: 300 }}
          />
          <Select
            allowClear
            placeholder="Lọc theo chuyên môn"
            style={{ minWidth: 160 }}
            onChange={handleSpecialtyFilter}
            options={[
              { value: 'Yoga', label: 'Yoga' },
              { value: 'GYM', label: 'GYM' },
              { value: 'Boxing', label: 'Boxing' },
              { value: 'CrossFit', label: 'CrossFit' },
              { value: 'Pilates', label: 'Pilates' },
              { value: 'Zumba', label: 'Zumba' },
              { value: 'Personal Training', label: 'Personal Training' },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/admin/trainers/create')}>
            Thêm huấn luyện viên
          </Button>
        </div>

        <div className="member-scroll-x">
          <Table
            dataSource={pts}
            columns={columns}
            rowKey="_id"
            loading={loading}
            pagination={{
              total,
              current: page,
              pageSize: 15,
              onChange: (p) => {
                setPage(p)
                fetchPTs(p, search, specialtyFilter)
              },
            }}
          />
        </div>
      </div>

    </DashboardLayout>
  )
}
