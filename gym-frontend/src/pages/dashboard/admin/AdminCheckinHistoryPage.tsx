import { FilterOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, DatePicker, Input, Select, Space, Table, Tag, message } from 'antd'
import { useEffect, useState } from 'react'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { checkInService } from '../../../services/checkInService'

const { RangePicker } = DatePicker

const formatDate = (value?: string) => value ? new Date(value).toLocaleString('vi-VN') : '-'
const formatDateShort = (value?: string) => value ? new Date(value).toLocaleDateString('vi-VN') : '-'

const checkInMethodLabels: Record<string, { label: string; color: string }> = {
  QR_SELF: { label: 'QR tự check-in', color: 'blue' },
  QR_PROJECTOR: { label: 'QR trình chiếu', color: 'cyan' },
  STAFF: { label: 'Lễ tân điểm danh', color: 'orange' },
  RECEPTION: { label: 'Lễ tân điểm danh', color: 'purple' },
  AUTO: { label: 'Auto check-in', color: 'geekblue' },
}

const sessionTypeLabels: Record<string, string> = {
  scheduled: 'Theo lịch cụ thể',
  free_workout: 'Tập tự do',
}

export default function AdminCheckinHistoryPage() {
  const [checkins, setCheckins] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 })
  const [keyword, setKeyword] = useState('')
  const [sessionType, setSessionType] = useState('')
  const [dateRange, setDateRange] = useState<[any, any] | null>(null)

  const fetchHistory = (page = 1) => {
    setLoading(true)
    const params: Record<string, any> = { page, limit: 20, mode: 'custom' }
    if (keyword.trim()) params.keyword = keyword.trim()
    if (sessionType) params.sessionType = sessionType
    if (dateRange?.[0]) params.date = dateRange[0].format('YYYY-MM-DD')
    if (dateRange?.[1]) params.toDate = dateRange[1].format('YYYY-MM-DD')
    if (!dateRange?.[0]) params.mode = 'last30days'

    checkInService.getStaffHistory(params)
      .then((res) => {
        setCheckins(res.data.checkins || [])
        setPagination(res.data.pagination || { total: 0, page: 1, limit: 20, totalPages: 0 })
      })
      .catch(() => message.error('Không thể tải lịch sử check-in'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchHistory() }, [])

  const columns = [
    {
      title: 'Hội viên', key: 'member', width: 200,
      render: (_: any, r: any) => (
        <div>
          <div className="font-medium text-sm">{r.memberName}</div>
          <div className="text-xs text-[var(--gs-text-muted)]">{r.memberCode || r.email || ''}</div>
        </div>
      ),
    },
    {
      title: 'Thời gian check-in', dataIndex: 'checkinTime', key: 'checkinTime', width: 170,
      render: (t: string) => formatDate(t),
    },
    {
      title: 'Loại', dataIndex: 'sessionType', key: 'sessionType', width: 140,
      render: (t: string) => {
        if (t === 'scheduled') return <Tag color="blue">Theo lịch</Tag>
        if (t === 'free_workout') return <Tag color="green">Tập tự do</Tag>
        return <Tag color="default">QR Staff</Tag>
      },
    },
    {
      title: 'Buổi tập', key: 'session', width: 200,
      render: (_: any, r: any) => (
        r.sessionType === 'scheduled' ? (
          <div>
            <div className="text-sm font-medium">{r.sessionTitle || '-'}</div>
            <div className="text-xs text-[var(--gs-text-muted)]">
              {r.sessionTime || ''} {r.classCode ? `• ${r.classCode}` : ''}
            </div>
          </div>
        ) : (
          <span className="text-sm text-[var(--gs-text-muted)]">-</span>
        )
      ),
    },
    {
      title: 'Hình thức', dataIndex: 'checkInMethod', key: 'checkInMethod', width: 150,
      render: (v: string) => {
        const meta = checkInMethodLabels[v] || { label: v || '—', color: 'default' }
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: 'Người thực hiện', dataIndex: 'performedByName', key: 'performedByName', width: 130,
      render: (v: string, r: any) => v || r.staffName || '—',
    },
    {
      title: 'Lý do', dataIndex: 'manualReason', key: 'manualReason', width: 160,
      ellipsis: true,
      render: (v: string) => v || '—',
    },
  ]

  return (
    <DashboardLayout>
      <div className="w-full" style={{ padding: '32px 40px' }}>
        <div className="mx-auto w-full" style={{ maxWidth: 1400 }}>
          <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">TRA CỨU</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <h1 className="m-0 text-4xl font-semibold text-[var(--gs-text)] max-[767px]:text-2xl">Lịch sử Check-in</h1>
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
            {/* Filters */}
            <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-4">
              <div className="min-w-[200px] flex-1">
                <div className="mb-1 text-xs font-medium text-[var(--gs-text-soft)]">Tìm kiếm hội viên</div>
                <Input prefix={<SearchOutlined />} placeholder="Tên, mã HV, email..." value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onPressEnter={() => fetchHistory(1)}
                />
              </div>
              <div className="min-w-[160px]">
                <div className="mb-1 text-xs font-medium text-[var(--gs-text-soft)]">Loại check-in</div>
                <Select className="w-full" value={sessionType} onChange={(v) => setSessionType(v)}
                  options={[
                    { value: '', label: 'Tất cả' },
                    { value: 'scheduled', label: 'Theo lịch cụ thể' },
                    { value: 'free_workout', label: 'Tập tự do' },
                  ]}
                />
              </div>
              <div className="min-w-[240px]">
                <div className="mb-1 text-xs font-medium text-[var(--gs-text-soft)]">Khoảng ngày</div>
                <RangePicker className="w-full" value={dateRange as any}
                  onChange={(dates) => setDateRange(dates as any)}
                  format="DD/MM/YYYY"
                />
              </div>
              <div className="flex gap-2">
                <Button type="primary" icon={<FilterOutlined />} onClick={() => fetchHistory(1)}>Tra cứu</Button>
                <Button icon={<ReloadOutlined />} onClick={() => {
                  setKeyword(''); setSessionType(''); setDateRange(null); fetchHistory(1)
                }}>Reset</Button>
              </div>
            </div>

            <div className="member-scroll-x">
              <Table
                rowKey="_id"
                dataSource={checkins}
                columns={columns}
                loading={loading}
                pagination={{
                  current: pagination.page,
                  pageSize: pagination.limit,
                  total: pagination.total,
                  showSizeChanger: false,
                  showTotal: (total: number) => `Tổng cộng ${total} lượt check-in`,
                  onChange: (page) => fetchHistory(page),
                }}
                scroll={{ x: 1300 }}
              />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
