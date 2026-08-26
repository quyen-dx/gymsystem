import { Input, Select, Space, Tag } from 'antd'
import { useEffect, useState } from 'react'
import type { ColumnsType } from 'antd/es/table'
import { reportService } from '../../../services/reportService'
import type { OrderRow, ReportRangeState } from '../../../types/report'
import DetailTable from './DetailTable'

const STATUS_COLORS: Record<string, string> = {
  'CHỜ XÁC NHẬN': 'warning',
  'ĐANG GIAO HÀNG': 'processing',
  'GIAO THÀNH CÔNG': 'success',
  unpaid: 'default',
  paid: 'success',
  failed: 'error',
}

interface Props {
  open: boolean
  title: string
  range: ReportRangeState
  filters?: Record<string, any>
  onClose: () => void
}

export default function ShopOrderDrawer({ open, title, range, filters, onClose }: Props) {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(filters?.status)
  const [search, setSearch] = useState(filters?.search || '')
  const [types, setTypes] = useState<Array<{ key: string; label: string }>>([])

  useEffect(() => {
    if (!open) return
    setStatusFilter(filters?.status)
    setSearch(filters?.search || '')
  }, [open, filters?.status, filters?.search])

  const columns: ColumnsType<OrderRow> = [
    { title: 'Mã đơn', dataIndex: 'code', width: 120, render: (v: string) => <span className="font-mono text-[11px] text-[var(--gs-text-soft)]">{String(v).substring(0, 14).toUpperCase()}</span> },
    { title: 'Hội viên', dataIndex: 'memberName', width: 150, render: (_: any, row: OrderRow) => <span className="text-xs text-[var(--gs-text)]">{row.memberName || '-'}</span> },
    { title: 'Shop', dataIndex: 'shopName', width: 140, render: (v: string) => <span className="text-xs text-[var(--gs-text)]">{v || '-'}</span> },
    { title: 'Sản phẩm', dataIndex: 'itemsSummary', width: 180, ellipsis: true, render: (v: string) => <span className="text-xs text-[var(--gs-text-soft)]">{v || '-'}</span> },
    { title: 'Seller', dataIndex: 'sellerName', width: 120, render: (v: string) => <span className="text-xs text-[var(--gs-text-soft)]">{v || '-'}</span> },
    { title: 'Tổng tiền', dataIndex: 'total', width: 120, align: 'right' as const, render: (v: number) => <span className="text-xs font-bold text-[var(--gs-text)]">{v.toLocaleString('vi-VN')}đ</span> },
    { title: 'Thanh toán', dataIndex: 'paymentStatusLabel', width: 125, render: (_: any, row: OrderRow) => <Tag color={STATUS_COLORS[row.paymentStatus || ''] || 'default'}>{row.paymentStatusLabel || '-'}</Tag> },
    { title: 'Trạng thái', dataIndex: 'statusLabel', width: 130, render: (_: any, row: OrderRow) => <Tag color={STATUS_COLORS[row.status] || 'default'}>{row.statusLabel}</Tag> },
    { title: 'Ngày', dataIndex: 'time', width: 120, render: (v?: string) => (v ? <span className="text-xs text-[var(--gs-text-soft)]">{new Date(v).toLocaleDateString('vi-VN')}</span> : '-') },
  ]

  return (
    <DetailTable
      open={open}
      title={title}
      onClose={onClose}
      columns={columns}
      emptyText="Không có dữ liệu"
      fetch={async (params) => {
        const res = await reportService.getOrders(params)
        if (!types.length && res.data.types) setTypes(res.data.types)
        return res.data
      }}
      buildParams={() => ({ ...range, ...filters, status: statusFilter ?? filters?.status, search: search || undefined })}
      filterBar={
        <Space className="mb-3 flex flex-wrap gap-2">
          <Select
            allowClear
            placeholder="Trạng thái đơn"
            value={statusFilter}
            onChange={setStatusFilter}
            options={types.map((t) => ({ label: t.label, value: t.key }))}
            style={{ minWidth: 170 }}
          />
          <Input.Search placeholder="Mã đơn, hội viên, sản phẩm..." value={search} onChange={(e) => setSearch(e.target.value)} allowClear style={{ width: 240 }} />
        </Space>
      }
    />
  )
}
