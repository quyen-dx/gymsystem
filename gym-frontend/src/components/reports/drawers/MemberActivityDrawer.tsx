import { Input, Select, Space, Tag } from 'antd'
import { useState } from 'react'
import type { ColumnsType } from 'antd/es/table'
import { reportService } from '../../../services/reportService'
import type { ActivityRow, ReportRangeState } from '../../../types/report'
import DetailTable from './DetailTable'

const TYPE_COLORS: Record<string, string> = {
  register: 'green',
  renew: 'blue',
  change: 'purple',
  cancel: 'red',
  checkin: 'orange',
}

interface Props {
  open: boolean
  title: string
  range: ReportRangeState
  filters?: Record<string, any>
  onClose: () => void
}

export default function MemberActivityDrawer({ open, title, range, filters, onClose }: Props) {
  const [typeFilter, setTypeFilter] = useState<string | undefined>(filters?.activityType)
  const [search, setSearch] = useState(filters?.search || '')
  const [types, setTypes] = useState<Array<{ key: string; label: string }>>([])

  const columns: ColumnsType<ActivityRow> = [
    {
      title: 'Hội viên',
      dataIndex: 'memberName',
      width: 170,
      render: (_: any, row: ActivityRow) => (
        <div>
          <div className="text-xs font-medium text-[var(--gs-text)]">{row.memberName}</div>
          {row.memberCode && <div className="text-[11px] text-[var(--gs-text-soft)]">{row.memberCode}</div>}
        </div>
      ),
    },
    { title: 'Hoạt động', dataIndex: 'activityLabel', width: 130, render: (_: any, row: ActivityRow) => <Tag color={TYPE_COLORS[row.activityType] || 'default'}>{row.activityLabel}</Tag> },
    { title: 'Gói', dataIndex: 'plan', width: 120, render: (v: string) => <span className="text-xs text-[var(--gs-text)]">{v || '-'}</span> },
    { title: 'Chi tiết', dataIndex: 'detail', ellipsis: true, render: (v: string) => <span className="text-xs text-[var(--gs-text)]">{v || '-'}</span> },
    { title: 'Thời gian', dataIndex: 'time', width: 150, render: (v?: string) => (v ? <span className="text-xs text-[var(--gs-text-soft)]">{new Date(v).toLocaleString('vi-VN')}</span> : '-') },
  ]

  return (
    <DetailTable
      open={open}
      title={title}
      onClose={onClose}
      columns={columns}
      emptyText={filters?.memberId ? 'Không có hoạt động cho hội viên này' : 'Không có dữ liệu'}
      fetch={async (params) => {
        const res = await reportService.getMemberActivity(params)
        if (!types.length && res.data.types) setTypes(res.data.types)
        return res.data
      }}
      buildParams={() => ({ ...range, ...filters, type: typeFilter, search: search || undefined })}
      filterBar={
        <Space className="mb-3 flex flex-wrap gap-2">
          <Select
            allowClear
            placeholder="Loại hoạt động"
            value={typeFilter}
            onChange={setTypeFilter}
            options={types.map((t) => ({ label: t.label, value: t.key }))}
            style={{ minWidth: 160 }}
          />
          <Input.Search placeholder="Tên, mã, gói, chi tiết..." value={search} onChange={(e) => setSearch(e.target.value)} allowClear style={{ width: 240 }} />
        </Space>
      }
    />
  )
}
