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
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { trainerService } from '../../../services/trainerService'
import type { PT } from '../../../types/admin/trainer'
import TrainerFormModal from './TrainerFormModal'

export default function AdminTrainersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [pts, setPts] = useState<PT[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [specialtyFilter, setSpecialtyFilter] = useState<string | undefined>()
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [editingPT, setEditingPT] = useState<PT | null>(null)

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
      message.error(t('admin.trainers.messages.fetch_failed'))
    } finally {
      setLoading(false)
    }
  }, [page, search, specialtyFilter, t])

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

  const openAdd = () => {
    setEditingPT(null)
    setFormModalOpen(true)
  }

  const openEdit = (pt: PT) => {
    setEditingPT(pt)
    setFormModalOpen(true)
  }

  const onFormSuccess = () => {
    setFormModalOpen(false)
    setEditingPT(null)
    fetchPTs()
  }

  const columns = [
    {
      title: '#',
      width: 60,
      align: 'center' as const,
      render: (_: unknown, __: PT, index: number) => (page - 1) * 15 + index + 1,
    },
    {
      title: t('admin.trainers.columns.name'),
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
              {record.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--gs-text-muted)' }}>
              {record.email || record.phone || '—'}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: t('admin.trainers.columns.specialties'),
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
      title: t('admin.trainers.columns.rating'),
      width: 140,
      render: (_: unknown, record: PT) => (
        <span>
          <Rate disabled value={record.rating} allowHalf style={{ fontSize: 14 }} character={<StarFilled />} />
          <span style={{ marginLeft: 6, fontSize: 13, color: 'var(--gs-text-muted)' }}>{record.rating.toFixed(1)}</span>
        </span>
      ),
    },
    {
      title: t('admin.trainers.columns.experience'),
      width: 100,
      align: 'center' as const,
      render: (_: unknown, record: PT) => (
        <span>{record.experienceYears ? `${record.experienceYears}y` : '—'}</span>
      ),
    },
    {
      title: t('admin.trainers.columns.bookings'),
      width: 80,
      align: 'center' as const,
      render: (_: unknown, record: PT) => (
        <span>{record.bookingCount ?? 0}</span>
      ),
    },
    {
      title: t('admin.trainers.columns.status'),
      width: 100,
      render: (_: unknown, record: PT) => (
        <Tag color={record.isActive ? 'success' : 'error'}>
          {record.isActive ? t('admin.members.status.active') : t('admin.members.status.locked')}
        </Tag>
      ),
    },
    {
      title: t('admin.trainers.columns.actions'),
      width: 130,
      render: (_: unknown, record: PT) => (
        <Space size={4}>
          <Tooltip title={t('admin.trainers.view_detail')}>
            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/admin/trainers/${record._id}`)} />
          </Tooltip>
          <Tooltip title={t('admin.trainers.edit')}>
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">{t('admin.trainers.module')}</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">{t('admin.trainers.title')}</h1>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
        <div className="dashboard-filter-bar">
          <Input.Search
            placeholder={t('admin.trainers.search_placeholder')}
            allowClear
            onSearch={handleSearch}
            style={{ maxWidth: 300 }}
          />
          <Select
            allowClear
            placeholder={t('admin.trainers.filter_specialty')}
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
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            {t('admin.trainers.add')}
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

      <TrainerFormModal
        open={formModalOpen}
        pt={editingPT}
        onClose={() => { setFormModalOpen(false); setEditingPT(null) }}
        onSuccess={onFormSuccess}
      />
    </DashboardLayout>
  )
}
