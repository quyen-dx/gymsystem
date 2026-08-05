import { Input, Select, Space, Tag } from 'antd'
import { useState } from 'react'
import type { ColumnsType } from 'antd/es/table'
import { reportService } from '../../../services/reportService'
import type { ReportRangeState, SystemUserRow } from '../../../types/report'
import DetailTable from './DetailTable'

interface Props {
  open: boolean
  title: string
  range: ReportRangeState
  filters?: Record<string, any>
  onClose: () => void
}

export default function SystemUserDrawer({ open, title, range, filters, onClose }: Props) {
  const [roleFilter, setRoleFilter] = useState<string | undefined>(filters?.role)
  const [search, setSearch] = useState(filters?.search || '')
  const [roles, setRoles] = useState<Array<{ key: string; label: string }>>([])

  const columns: ColumnsType<SystemUserRow> = [
    {
      title: 'Người dùng',
      dataIndex: 'name',
      width: 170,
      render: (_: any, row: SystemUserRow) => (
        <div>
          <div className="text-xs font-medium text-[var(--gs-text)]">{row.name}</div>
          {row.memberCode && <div className="text-[11px] text-[var(--gs-text-soft)]">{row.memberCode}</div>}
        </div>
      ),
    },
    { title: 'Vai trò', dataIndex: 'roleLabel', width: 110, render: (_: any, row: SystemUserRow) => <Tag color="default">{row.roleLabel}</Tag> },
    { title: 'Email', dataIndex: 'email', width: 180, ellipsis: true, render: (v: string) => <span className="text-xs text-[var(--gs-text-soft)]">{v || '-'}</span> },
    { title: 'SĐT', dataIndex: 'phone', width: 120, render: (v: string) => <span className="text-xs text-[var(--gs-text-soft)]">{v || '-'}</span> },
    { title: 'Trạng thái', dataIndex: 'status', width: 100, render: (v: string) => <Tag color={v === 'active' ? 'success' : 'error'}>{v === 'active' ? 'Hoạt động' : 'Khóa'}</Tag> },
    { title: 'Đăng ký', dataIndex: 'registeredAt', width: 120, render: (v?: string) => (v ? <span className="text-xs text-[var(--gs-text-soft)]">{new Date(v).toLocaleDateString('vi-VN')}</span> : '-') },
  ]

  return (
    <DetailTable
      open={open}
      title={title}
      onClose={onClose}
      columns={columns}
      emptyText="Không có dữ liệu"
      fetch={async (params) => {
        const res = await reportService.getSystemUsers(params)
        if (!roles.length && res.data.roles) setRoles(res.data.roles)
        return res.data
      }}
      buildParams={() => ({ ...range, ...filters, role: roleFilter, search: search || undefined })}
      filterBar={
        <Space className="mb-3 flex flex-wrap gap-2">
          <Select
            allowClear
            placeholder="Vai trò"
            value={roleFilter}
            onChange={setRoleFilter}
            options={roles.map((r) => ({ label: r.label, value: r.key }))}
            style={{ minWidth: 140 }}
          />
          <Input.Search placeholder="Tên, email, SĐT, mã..." value={search} onChange={(e) => setSearch(e.target.value)} allowClear style={{ width: 240 }} />
        </Space>
      }
    />
  )
}
