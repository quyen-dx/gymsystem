import { Input, Select, Space, Tag } from 'antd'
import { useEffect, useState } from 'react'
import type { ColumnsType } from 'antd/es/table'
import { reportService } from '../../../services/reportService'
import type { ReportRangeState, TransactionRow } from '../../../types/report'
import DetailTable from './DetailTable'

const statusTag: Record<string, { label: string; color: string }> = {
  completed: { label: 'Hoàn tất', color: 'success' },
  confirmed: { label: 'Đã xác nhận', color: 'processing' },
  pending: { label: 'Chờ xử lý', color: 'warning' },
  awaiting_payment: { label: 'Chờ thanh toán', color: 'warning' },
  cancelled: { label: 'Đã hủy', color: 'error' },
  failed: { label: 'Thất bại', color: 'error' },
  member_no_show: { label: 'Member vắng mặt', color: 'error' },
  pt_no_show: { label: 'PT vắng mặt', color: 'magenta' },
  needs_review: { label: 'Cần kiểm tra', color: 'warning' },
  'GIAO THÀNH CÔNG': { label: 'Giao thành công', color: 'success' },
  'CHỜ XÁC NHẬN': { label: 'Chờ xác nhận', color: 'warning' },
  'ĐANG GIAO HÀNG': { label: 'Đang giao hàng', color: 'processing' },
}

interface Props {
  open: boolean
  title: string
  range: ReportRangeState
  filters?: Record<string, any>
  onClose: () => void
}

export default function FinancialDetailDrawer({ open, title, range, filters, onClose }: Props) {
  const [typeFilter, setTypeFilter] = useState<string | undefined>(filters?.type)
  const [search, setSearch] = useState(filters?.search || '')
  const [types, setTypes] = useState<Array<{ key: string; label: string; color: string }>>([])

  useEffect(() => {
    if (!open) return
    setTypeFilter(filters?.type)
    setSearch(filters?.search || '')
  }, [open, filters?.type, filters?.search])

  const columns: ColumnsType<TransactionRow> = [
    {
      title: 'Mã giao dịch',
      dataIndex: 'code',
      width: 130,
      render: (v: string) => <span className="font-mono text-xs font-semibold text-[var(--gs-text)]">{String(v).substring(0, 14).toUpperCase()}</span>,
    },
    {
      title: 'Hội viên',
      dataIndex: 'memberName',
      width: 150,
      render: (_: any, row: TransactionRow) => (
        <div>
          <div className="text-xs font-medium text-[var(--gs-text)]">{row.memberName}</div>
          {row.memberPhone && <div className="text-[11px] text-[var(--gs-text-soft)]">{row.memberPhone}</div>}
        </div>
      ),
    },
    { title: 'Gói tập', dataIndex: 'plan', width: 120, render: (v: string) => <span className="text-xs text-[var(--gs-text)]">{v || '-'}</span> },
    { title: 'Loại', dataIndex: 'typeLabel', width: 110, render: (_: any, row: TransactionRow) => <Tag color={row.typeColor}>{row.typeLabel}</Tag> },
    { title: 'Thanh toán', dataIndex: 'paymentMethod', width: 100, render: (v: string) => <span className="text-xs uppercase text-[var(--gs-text-soft)]">{v || '-'}</span> },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      width: 120,
      align: 'right' as const,
      render: (_: any, row: TransactionRow) => (
        <div className="text-right">
          {row.amount > 0 && <div className="text-xs font-bold text-green-600">+{row.amount.toLocaleString('vi-VN')}đ</div>}
          {row.amount < 0 && <div className="text-xs font-bold text-red-500">{row.amount.toLocaleString('vi-VN')}đ</div>}
          {row.refund > 0 && <div className="text-[11px] font-medium text-red-500">-{row.refund.toLocaleString('vi-VN')}đ</div>}
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 110,
      render: (v: string) => {
        const meta = statusTag[v] || { label: v || '-', color: 'default' }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    { title: 'PT / NV', dataIndex: 'ptName', width: 110, render: (_: any, row: TransactionRow) => <span className="text-xs text-[var(--gs-text-soft)]">{row.ptName || row.staff || '-'}</span> },
    { title: 'Thời gian', dataIndex: 'time', width: 130, render: (v?: string) => (v ? <span className="text-xs text-[var(--gs-text-soft)]">{new Date(v).toLocaleString('vi-VN')}</span> : '-') },
  ]

  return (
    <DetailTable
      open={open}
      title={title}
      onClose={onClose}
      columns={columns}
      emptyText={filters?.date || filters?.memberId || filters?.planId || filters?.shopId ? 'Không có dữ liệu trong ngày này' : 'Không có dữ liệu'}
      fetch={async (params) => {
        const res = await reportService.getTransactions(params)
        if (!types.length && res.data.types) setTypes(res.data.types)
        return res.data
      }}
      buildParams={() => ({ ...range, ...filters, type: typeFilter ?? filters?.type, search: search || undefined })}
      filterBar={
        <Space className="mb-3 flex flex-wrap gap-2">
          <Select
            allowClear
            placeholder="Loại giao dịch"
            value={typeFilter}
            onChange={setTypeFilter}
            options={types.map((t) => ({ label: t.label, value: t.key }))}
            style={{ minWidth: 160 }}
          />
          <Input.Search placeholder="Mã, tên, email, SĐT, gói tập..." value={search} onChange={(e) => setSearch(e.target.value)} allowClear style={{ width: 260 }} />
        </Space>
      }
    />
  )
}
