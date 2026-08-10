import {
  EditOutlined,
  HistoryOutlined,
  MoneyCollectOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import {
  Avatar,
  Button,
  Input,
  InputNumber,
  Modal,
  Select,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { ptPriceService, type PTPricingItem, type PTPricingHistoryItem } from '../../../services/ptPriceService'

const formatMoney = (value?: number | null) => value ? `${Number(value).toLocaleString('vi-VN')}đ` : ''

const MAX_PRICE = 100000000
const PAGE_SIZE = 15

const getErrMsg = (err: unknown, fallback: string) => {
  const data = (err as { response?: { data?: { message?: string } } })?.response?.data
  return data?.message || fallback
}

const PRICE_TYPE_LABELS: Record<string, string> = {
  ONE_TO_ONE: 'PT 1-1',
  GROUP: 'PT nhóm',
}

export default function AdminPTPricesPage({ embedded = false }: { embedded?: boolean }) {
  const [items, setItems] = useState<PTPricingItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [priceStatus, setPriceStatus] = useState('')
  const [loading, setLoading] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<PTPricingItem | null>(null)
  const [editOneToOne, setEditOneToOne] = useState<number | null>(null)
  const [editGroup, setEditGroup] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyPt, setHistoryPt] = useState<PTPricingItem | null>(null)
  const [history, setHistory] = useState<PTPricingHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const fetchPrices = useCallback(async (p = page, keyword = search, status = priceStatus) => {
    setLoading(true)
    try {
      const res = await ptPriceService.getPTPrices({
        page: p,
        limit: PAGE_SIZE,
        search: keyword || undefined,
        priceStatus: status || undefined,
      })
      setItems(res.data.pts || [])
      setTotal(res.data.pagination?.total || 0)
    } catch (err) {
      message.error(getErrMsg(err, 'Không tải được danh sách giá PT'))
    } finally {
      setLoading(false)
    }
  }, [page, search, priceStatus])

  useEffect(() => {
    fetchPrices()
  }, [fetchPrices])

  const openEdit = (pt: PTPricingItem) => {
    setEditing(pt)
    setEditOneToOne(pt.oneToOnePrice)
    setEditGroup(pt.groupPrice)
    setEditOpen(true)
  }

  const handleSave = async () => {
    if (!editing) return
    if (editOneToOne === null && editGroup === null) {
      message.warning('Vui lòng nhập ít nhất một mức giá')
      return
    }
    for (const [label, value] of [['Giá 1-1', editOneToOne], ['Giá nhóm', editGroup]] as const) {
      if (value === null || value === undefined) continue
      if (value <= 0) { message.warning(`${label} phải lớn hơn 0`); return }
      if (value > MAX_PRICE) { message.warning(`${label} không được vượt quá 100.000.000đ`); return }
    }

    setSaving(true)
    try {
      await ptPriceService.updatePTPrice(editing._id, {
        oneToOnePrice: editOneToOne,
        groupPrice: editGroup,
      })
      message.success('Cập nhật giá PT thành công.')
      setEditOpen(false)
      fetchPrices()
    } catch (err) {
      message.error(getErrMsg(err, 'Cập nhật giá thất bại'))
    } finally {
      setSaving(false)
    }
  }

  const openHistory = async (pt: PTPricingItem) => {
    setHistoryPt(pt)
    setHistoryOpen(true)
    setHistoryLoading(true)
    try {
      const res = await ptPriceService.getPriceHistory(pt._id)
      setHistory(res.data.history || [])
    } catch (err) {
      message.error(getErrMsg(err, 'Không tải được lịch sử giá'))
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const columns = [
    {
      title: 'PT',
      dataIndex: 'name',
      key: 'name',
      render: (_: unknown, r: PTPricingItem) => (
        <div className="flex items-center gap-2.5">
          <Avatar src={r.avatar} size={36}>{r.name?.charAt(0)}</Avatar>
          <div>
            <div className="font-semibold text-[var(--gs-text)]">{r.name}</div>
            <div className="text-xs text-[var(--gs-text-muted)]">{r.email}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Giá PT 1-1 / buổi',
      dataIndex: 'oneToOnePrice',
      key: 'oneToOnePrice',
      width: 170,
      render: (value: number | null) => value
        ? <span className="font-semibold text-[var(--gs-text)]">{formatMoney(value)}</span>
        : <span className="text-[var(--gs-text-muted)]">Chưa cấu hình</span>,
    },
    {
      title: 'Giá PT nhóm / người / buổi',
      dataIndex: 'groupPrice',
      key: 'groupPrice',
      width: 210,
      render: (value: number | null) => value
        ? <span className="font-semibold text-[var(--gs-text)]">{formatMoney(value)}</span>
        : <span className="text-[var(--gs-text-muted)]">Chưa cấu hình</span>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'hasOneToOne',
      key: 'status',
      width: 140,
      render: (_: unknown, r: PTPricingItem) => (r.hasOneToOne || r.hasGroup)
        ? <Tag color="green">Đã cấu hình</Tag>
        : <Tag color="orange">Chưa cấu hình</Tag>,
    },
    {
      title: 'Cập nhật',
      dataIndex: 'priceUpdatedAt',
      key: 'priceUpdatedAt',
      width: 190,
      render: (value: string | null, r: PTPricingItem) => value
        ? (
          <div className="text-xs text-[var(--gs-text-muted)]">
            <div>{dayjs(value).format('DD/MM/YYYY HH:mm')}</div>
            {r.priceUpdatedBy && <div className="text-[var(--gs-text-soft)]">bởi {r.priceUpdatedBy.name}</div>}
          </div>
        )
        : <span className="text-[var(--gs-text-muted)]">—</span>,
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 170,
      render: (_: unknown, r: PTPricingItem) => (
        <div className="flex items-center gap-1.5">
          <Tooltip title="Chỉnh sửa giá">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>Chỉnh sửa</Button>
          </Tooltip>
          <Tooltip title="Lịch sử thay đổi giá">
            <Button size="small" icon={<HistoryOutlined />} onClick={() => openHistory(r)} />
          </Tooltip>
        </div>
      ),
    },
  ]

  const content = (
    <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[var(--gs-text)]">Cấu hình giá PT</h1>
            <p className="mt-0.5 text-sm text-[var(--gs-text-muted)]">
              Thiết lập giá đặt lịch PT 1-1 và PT nhóm. Giá được snapshot vào lịch đặt khi PT xác nhận.
            </p>
          </div>
        </div>

        <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
          <div className="dashboard-filter-bar">
            <Input
              allowClear
              placeholder="Tìm kiếm PT..."
              prefix={<SearchOutlined />}
              style={{ maxWidth: 300 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={() => { setPage(1); fetchPrices(1, search, priceStatus) }}
            />
            <Select
              allowClear
              placeholder="Lọc trạng thái"
              style={{ minWidth: 180 }}
              value={priceStatus || undefined}
              onChange={(v) => { setPriceStatus(v || ''); setPage(1); fetchPrices(1, search, v || '') }}
              options={[
                { value: 'configured', label: 'Đã cấu hình' },
                { value: 'missing', label: 'Chưa cấu hình' },
              ]}
            />
            <Button icon={<SearchOutlined />} onClick={() => { setPage(1); fetchPrices(1, search, priceStatus) }}>Tìm</Button>
          </div>
          <div className="member-scroll-x">
            <Table
              dataSource={items}
              columns={columns}
              rowKey="_id"
              loading={loading}
              pagination={{
                total,
                current: page,
                pageSize: PAGE_SIZE,
                onChange: (p) => { setPage(p); fetchPrices(p, search, priceStatus) },
                showTotal: (t) => `Tổng ${t} PT`,
              }}
            />
          </div>
        </div>

        <Modal
          open={editOpen}
          title={<span><MoneyCollectOutlined className="mr-2" />Cấu hình giá PT</span>}
          onCancel={() => setEditOpen(false)}
          onOk={handleSave}
          okText="Lưu cấu hình giá"
          cancelText="Hủy"
          confirmLoading={saving}
          destroyOnClose
        >
          {editing && (
            <div className="space-y-5 pt-2">
              <div className="rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card-soft)] px-4 py-3">
                <div className="text-sm font-semibold text-[var(--gs-text)]">PT: {editing.name}</div>
                <div className="text-xs text-[var(--gs-text-muted)]">{editing.email}</div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[var(--gs-text)]">Giá đặt lịch 1-1</label>
                <div className="flex items-center gap-2">
                  <InputNumber
                    min={1}
                    max={MAX_PRICE}
                    style={{ width: 200 }}
                    placeholder="Chưa cấu hình"
                    value={editOneToOne}
                    onChange={(v) => setEditOneToOne(v ?? null)}
                  />
                  <span className="text-sm text-[var(--gs-text-muted)]">VNĐ / buổi</span>
                </div>
                <p className="mt-1 text-xs text-[var(--gs-text-soft)]">Bỏ trống = PT chưa được phép nhận đặt lịch 1-1.</p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[var(--gs-text)]">Giá đặt lịch nhóm</label>
                <div className="flex items-center gap-2">
                  <InputNumber
                    min={1}
                    max={MAX_PRICE}
                    style={{ width: 200 }}
                    placeholder="Chưa cấu hình"
                    value={editGroup}
                    onChange={(v) => setEditGroup(v ?? null)}
                  />
                  <span className="text-sm text-[var(--gs-text-muted)]">VNĐ / người / buổi</span>
                </div>
                <p className="mt-1 text-xs text-[var(--gs-text-soft)]">Bỏ trống = PT chưa được phép xếp lớp nhóm.</p>
              </div>
            </div>
          )}
        </Modal>

        <Modal
          open={historyOpen}
          title={<span><HistoryOutlined className="mr-2" />Lịch sử thay đổi giá — {historyPt?.name}</span>}
          onCancel={() => setHistoryOpen(false)}
          footer={null}
          width={640}
          destroyOnClose
        >
          <Table
            dataSource={history}
            rowKey="_id"
            loading={historyLoading}
            size="small"
            pagination={false}
            locale={{ emptyText: 'Chưa có thay đổi giá nào.' }}
            columns={[
              {
                title: 'Loại',
                dataIndex: 'priceType',
                width: 110,
                render: (v: string) => <Tag color={v === 'ONE_TO_ONE' ? 'blue' : 'purple'}>{PRICE_TYPE_LABELS[v] || v}</Tag>,
              },
              {
                title: 'Giá cũ',
                dataIndex: 'oldPrice',
                width: 130,
                render: (v: number | null) => v ? formatMoney(v) : <span className="text-[var(--gs-text-muted)]">Chưa cấu hình</span>,
              },
              {
                title: 'Giá mới',
                dataIndex: 'newPrice',
                width: 130,
                render: (v: number) => <span className="font-semibold text-[var(--gs-text)]">{formatMoney(v)}</span>,
              },
              {
                title: 'Người thay đổi',
                dataIndex: 'changedBy',
                render: (u: { name?: string; fullName?: string }) => u?.fullName || u?.name || '—',
              },
              {
                title: 'Thời gian',
                dataIndex: 'changedAt',
                width: 150,
                render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
              },
            ]}
          />
        </Modal>
    </div>
  )

  return embedded ? content : <DashboardLayout>{content}</DashboardLayout>
}
