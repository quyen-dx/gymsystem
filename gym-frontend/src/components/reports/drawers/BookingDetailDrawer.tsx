import { Select, Space, Tag } from 'antd'
import { useState } from 'react'
import type { ColumnsType } from 'antd/es/table'
import { reportService } from '../../../services/reportService'
import type { BookingRow, ReportRangeState } from '../../../types/report'
import DetailTable from './DetailTable'

const STATUS_COLORS: Record<string, string> = {
  pending: 'default',
  awaiting_payment: 'warning',
  confirmed: 'processing',
  completed: 'success',
  cancelled: 'error',
  member_no_show: 'error',
  pt_no_show: 'magenta',
  needs_review: 'warning',
}

interface Props {
  open: boolean
  title: string
  range: ReportRangeState
  filters?: Record<string, any>
  onClose: () => void
}

export default function BookingDetailDrawer({ open, title, range, filters, onClose }: Props) {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(filters?.status)
  const [types, setTypes] = useState<Array<{ key: string; label: string }>>([])

  const columns: ColumnsType<BookingRow> = [
    { title: 'Mã', dataIndex: 'code', width: 110, render: (v: string) => <span className="font-mono text-[11px] text-[var(--gs-text-soft)]">{String(v).substring(0, 10).toUpperCase()}</span> },
    { title: 'Hội viên', dataIndex: 'memberName', width: 150, render: (_: any, row: BookingRow) => <span className="text-xs text-[var(--gs-text)]">{row.memberName || '-'}</span> },
    { title: 'PT', dataIndex: 'ptName', width: 140, render: (v: string) => <span className="text-xs text-[var(--gs-text)]">{v || '-'}</span> },
    { title: 'Ngày', dataIndex: 'date', width: 110, render: (v?: string) => (v ? <span className="text-xs text-[var(--gs-text-soft)]">{new Date(v).toLocaleDateString('vi-VN')}</span> : '-') },
    { title: 'Giờ', dataIndex: 'slot', width: 90, render: (v: string) => <span className="text-xs text-[var(--gs-text)]">{v || '-'}</span> },
    { title: 'Loại', dataIndex: 'trainingType', width: 90, render: (v?: string) => <Tag color={v === 'group' ? 'purple' : 'blue'}>{v === 'group' ? 'Nhóm' : 'PT 1-1'}</Tag> },
    { title: 'Trạng thái', dataIndex: 'statusLabel', width: 120, render: (_: any, row: BookingRow) => <Tag color={STATUS_COLORS[row.status] || 'default'}>{row.statusLabel}</Tag> },
  ]

  return (
    <DetailTable
      open={open}
      title={title}
      onClose={onClose}
      columns={columns}
      emptyText="Không có dữ liệu"
      fetch={async (params) => {
        const res = await reportService.getBookings(params)
        if (!types.length && res.data.types) setTypes(res.data.types)
        return res.data
      }}
      buildParams={() => ({ ...range, ...filters, status: statusFilter })}
      filterBar={
        <Space className="mb-3 flex flex-wrap gap-2">
          <Select
            allowClear
            placeholder="Trạng thái"
            value={statusFilter}
            onChange={setStatusFilter}
            options={types.map((t) => ({ label: t.label, value: t.key }))}
            style={{ minWidth: 150 }}
          />
        </Space>
      }
    />
  )
}
