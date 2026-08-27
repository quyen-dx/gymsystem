import { Select, Space, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useState } from 'react'
import { reportService } from '../../../services/reportService'
import type { ReportRangeState } from '../../../types/report'
import DetailTable from './DetailTable'

interface CheckinRow {
  id: string
  memberName: string
  memberCode: string
  plan: string
  time?: string
  status: string
  statusLabel: string
  method: string
  methodLabel: string
  sessionType: string
  sessionTypeLabel: string
  session: string
  performedBy: string
  note: string
}

const STATUS_COLORS: Record<string, string> = {
  success: 'success',
  failed: 'error',
  expired: 'warning',
  blocked: 'error',
}

interface Props {
  open: boolean
  title: string
  range: ReportRangeState
  filters?: Record<string, any>
  onClose: () => void
}

export default function CheckinDetailDrawer({ open, title, range, filters, onClose }: Props) {
  const [status, setStatus] = useState<string | undefined>(filters?.status)
  const [method, setMethod] = useState<string | undefined>(filters?.method)
  const [sessionType, setSessionType] = useState<string | undefined>(filters?.sessionType)
  const [options, setOptions] = useState<{ statuses: Array<{ key: string; label: string }>; methods: Array<{ key: string; label: string }>; sessionTypes: Array<{ key: string; label: string }> }>({ statuses: [], methods: [], sessionTypes: [] })

  useEffect(() => {
    if (!open) return
    setStatus(filters?.status)
    setMethod(filters?.method)
    setSessionType(filters?.sessionType)
  }, [open, filters?.status, filters?.method, filters?.sessionType])

  const columns: ColumnsType<CheckinRow> = [
    { title: 'Hội viên', dataIndex: 'memberName', width: 170, render: (_value, row) => <div><div className="text-xs font-medium text-[var(--gs-text)]">{row.memberName}</div><div className="text-[11px] text-[var(--gs-text-muted)]">{row.memberCode || '—'}</div></div> },
    { title: 'Thời gian', dataIndex: 'time', width: 155, render: (value?: string) => <span className="text-xs text-[var(--gs-text-soft)]">{value ? new Date(value).toLocaleString('vi-VN') : '—'}</span> },
    { title: 'Gói tập', dataIndex: 'plan', width: 130, render: (value: string) => <span className="text-xs text-[var(--gs-text)]">{value}</span> },
    { title: 'Buổi tập', dataIndex: 'session', width: 170, render: (value: string, row) => <div><div className="text-xs text-[var(--gs-text)]">{value}</div><div className="text-[11px] text-[var(--gs-text-muted)]">{row.sessionTypeLabel}</div></div> },
    { title: 'Phương thức', dataIndex: 'methodLabel', width: 140, render: (value: string) => <Tag color="blue">{value}</Tag> },
    { title: 'Trạng thái', dataIndex: 'statusLabel', width: 130, render: (_value, row) => <Tag color={STATUS_COLORS[row.status] || 'default'}>{row.statusLabel}</Tag> },
    { title: 'Người thực hiện', dataIndex: 'performedBy', width: 150, render: (value: string) => <span className="text-xs text-[var(--gs-text-soft)]">{value || 'Hội viên tự check-in'}</span> },
  ]

  return (
    <DetailTable
      open={open}
      title={title}
      onClose={onClose}
      columns={columns}
      emptyText="Không có bản ghi check-in phù hợp"
      fetch={async (params) => {
        const response = await reportService.getCheckins(params)
        const data = response.data
        setOptions({ statuses: data.statuses || [], methods: data.methods || [], sessionTypes: data.sessionTypes || [] })
        return data
      }}
      buildParams={() => ({ ...range, ...filters, status: status ?? filters?.status, method: method ?? filters?.method, sessionType: sessionType ?? filters?.sessionType })}
      filterBar={
        <Space className="mb-3 flex flex-wrap gap-2">
          <Select allowClear value={status} placeholder="Trạng thái" onChange={setStatus} options={options.statuses.map((item) => ({ label: item.label, value: item.key }))} style={{ minWidth: 150 }} />
          <Select allowClear value={method} placeholder="Phương thức" onChange={setMethod} options={options.methods.map((item) => ({ label: item.label, value: item.key }))} style={{ minWidth: 165 }} />
          <Select allowClear value={sessionType} placeholder="Loại buổi tập" onChange={setSessionType} options={options.sessionTypes.map((item) => ({ label: item.label, value: item.key }))} style={{ minWidth: 165 }} />
        </Space>
      }
    />
  )
}
