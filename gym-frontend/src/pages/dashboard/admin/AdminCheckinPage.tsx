import {
  CalendarOutlined,
  CheckCircleOutlined,
  FilterOutlined,
  QrcodeOutlined,
  ReloadOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Button, Card, Col, DatePicker, Input, Row, Segmented, Select, Space, Spin, Statistic, Table, Tag, Tooltip, message } from 'antd'
import { QRCodeSVG } from 'qrcode.react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { checkInService } from '../../../services/checkInService'
import type { CheckinStats, HeatmapCell } from '../../../types/admin/checkin'

const { RangePicker } = DatePicker

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

const TABS = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'history', label: 'Tra cứu Check-in' },
  { key: 'qr', label: 'Mã QR trình chiếu' },
]

const formatDate = (value?: string) => value ? new Date(value).toLocaleString('vi-VN') : '-'
const formatDateShort = (value?: string) => value ? new Date(value).toLocaleDateString('vi-VN') : '-'
const formatDateLong = (d: string | Date) => new Date(d).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' })
const formatTime = (d: string | Date) => new Date(d).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

function OverviewTab() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day')
  const [stats, setStats] = useState<CheckinStats | null>(null)
  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, heatmapRes] = await Promise.all([
        checkInService.getStats(period),
        checkInService.getHeatmap(),
      ])
      setStats(statsRes.data.stats)
      setHeatmap(heatmapRes.data.heatmap)
    } catch {
      message.error('Không thể tải dữ liệu check-in')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => { fetchData() }, [fetchData])

  const getHeatmapColor = (count: number) => {
    if (count === 0) return 'var(--gs-border)'
    if (count <= 3) return 'rgba(59,130,246,0.3)'
    if (count <= 6) return 'rgba(59,130,246,0.5)'
    if (count <= 10) return 'rgba(59,130,246,0.7)'
    return 'rgba(59,130,246,0.9)'
  }

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card className="rounded-[24px]" hoverable>
            <Statistic title="Tổng check-in" value={stats?.totalCheckins || 0} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="rounded-[24px]" hoverable>
            <Statistic title="Thành viên đã check-in" value={stats?.uniqueMembers || 0} prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="rounded-[24px]" hoverable>
            <Statistic title="Kỳ" value={period === 'day' ? 'Hôm nay' : period === 'week' ? 'Tuần này' : 'Tháng này'} prefix={<CalendarOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card className="rounded-[24px]" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Bản đồ nhiệt</h3>
          <Segmented
            options={[
              { label: 'Hôm nay', value: 'day' },
              { label: 'Tuần', value: 'week' },
              { label: 'Tháng', value: 'month' },
            ]}
            value={period}
            onChange={(val) => setPeriod(val as 'day' | 'week' | 'month')}
          />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '50px repeat(24, 1fr)', gap: 2, minWidth: 600 }}>
            <div />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} style={{ fontSize: 10, textAlign: 'center', color: 'var(--gs-text-soft)' }}>{h}h</div>
            ))}
            {DAY_LABELS.map((day, di) => (
              <div key={day} style={{ display: 'contents' }}>
                <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', color: 'var(--gs-text-muted)' }}>{day}</div>
                {Array.from({ length: 24 }, (_, hi) => {
                  const cell = heatmap[di * 24 + hi] || { count: 0, members: [] }
                  return (
                    <Tooltip 
                      key={hi} 
                      title={
                        <div>
                          <div style={{ fontWeight: 600 }}>{day} {hi}h: {cell.count} lượt</div>
                          {cell.members && cell.members.length > 0 && (
                            <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.2)', fontSize: '11px' }}>
                              {cell.members.map((member: any, idx: number) => (
                                <div key={idx}>• {member.name || member}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      }
                    >
                      <div style={{
                        aspectRatio: '1',
                        borderRadius: 4,
                        background: getHeatmapColor(cell.count),
                        cursor: 'pointer',
                        minHeight: 20,
                      }} />
                    </Tooltip>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </Card>
    </Spin>
  )
}

function HistoryTab() {
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
      title: 'Mã QR (ngày tạo)', key: 'qr', width: 160,
      render: (_: any, r: any) => (
        r.checkinSource === 'daily_qr' ? (
          <span className="text-xs text-[var(--gs-text-muted)]">
            {r.dailyQRDate ? formatDateShort(r.dailyQRDate) : '-'}
          </span>
        ) : (
          <span className="text-xs text-[var(--gs-text-muted)]">QR Staff</span>
        )
      ),
    },
    {
      title: 'Nguồn', dataIndex: 'checkinSource', key: 'checkinSource', width: 100,
      render: (s: string) => {
        if (s === 'daily_qr') return <Tag>QR trình chiếu</Tag>
        return <Tag>Staff quét</Tag>
      },
    },
    {
      title: 'Staff', dataIndex: 'staffName', key: 'staffName', width: 130,
      render: (n: string) => n || '-',
    },
  ]

  return (
    <>
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
          scroll={{ x: 1100 }}
        />
      </div>
    </>
  )
}

function QRTab() {
  const [qrData, setQrData] = useState<{ token: string; date: string; expiresAt: string; createdAt: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const fetchActive = useCallback(async () => {
    setLoading(true)
    try {
      const res = await checkInService.getActiveDailyQR()
      setQrData(res.data.qrCode)
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchActive() }, [fetchActive])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await checkInService.generateDailyQR()
      setQrData(res.data.qrCode)
      message.success(res.data.message || 'Đã tạo mã QR thành công')
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Tạo mã QR thất bại')
    }
    setGenerating(false)
  }

  return (
    <Spin spinning={loading}>
      <Card className="rounded-[24px]">
        {!qrData ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-6">
            <QrcodeOutlined style={{ fontSize: 72, color: 'var(--gs-text-muted)' }} />
            <p className="text-lg text-[var(--gs-text-muted)]">Chưa có mã QR cho hôm nay</p>
            <p className="text-sm text-[var(--gs-text-soft)]">Bấm nút bên dưới để tạo mã QR trình chiếu lên màn hình lớn</p>
            <Button type="primary" size="large" icon={<QrcodeOutlined />} onClick={handleGenerate} loading={generating}>
              Tạo mã QR cho hôm nay
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--gs-text-soft)] uppercase tracking-wider">MÃ QR HÔM NAY</p>
                <p className="text-2xl font-semibold">{formatDateLong(qrData.date)}</p>
                <p className="text-xs text-[var(--gs-text-muted)]">
                  Hiệu lực đến {formatTime(qrData.expiresAt)} • Đã tạo lúc {formatTime(qrData.createdAt)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button icon={<ReloadOutlined />} onClick={fetchActive}>Tải lại</Button>
                <Button type="primary" icon={<QrcodeOutlined />} onClick={handleGenerate} loading={generating}>
                  Tạo mã mới
                </Button>
              </div>
            </div>

            <div className="flex justify-center py-8">
              <div className="bg-white p-8 rounded-2xl shadow-lg" style={{ maxWidth: 500 }}>
                <QRCodeSVG value={qrData.token} size={380} level="L" includeMargin />
                <p className="text-center text-sm text-gray-500 mt-4 font-mono break-all">{qrData.token}</p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-[var(--gs-warning)] bg-[var(--gs-warning-bg)] p-4 text-sm">
              <strong>Lưu ý:</strong> Mã QR này chỉ có hiệu lực đến 23:59:59 hôm nay. Hội viên cần có mặt tại phòng gym để quét mã.
              Mỗi ngày chỉ có 1 mã QR hoạt động. Nếu tạo mã mới, mã cũ trong ngày sẽ bị vô hiệu hóa.
            </div>
          </>
        )}
      </Card>
    </Spin>
  )
}

export default function AdminCheckinPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(() => {
    if (tabFromUrl === 'history') return 'history'
    if (tabFromUrl === 'qr') return 'qr'
    return 'overview'
  })

  const handleTabChange = (key: string) => {
    setActiveTab(key)
    if (key === 'overview') {
      setSearchParams({})
    } else {
      setSearchParams({ tab: key })
    }
  }

  const content = useMemo(() => {
    switch (activeTab) {
      case 'history': return <HistoryTab />
      case 'qr': return <QRTab />
      default: return <OverviewTab />
    }
  }, [activeTab])

  return (
    <DashboardLayout>
      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Admin</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">Quản lý Check-in</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'border-[var(--theme-accent)] bg-[var(--theme-accent)] text-white'
                  : 'border-[var(--theme-border)] bg-[var(--gs-card)] text-[var(--gs-text)] hover:bg-[var(--theme-accent)] hover:text-white'
              }`}
            >
              {tab.key === 'overview' && <CalendarOutlined />}
              {tab.key === 'history' && <SearchOutlined />}
              {tab.key === 'qr' && <QrcodeOutlined />}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[24px] border border-[var(--gs-border)] bg-[var(--gs-card)] p-6 max-[640px]:p-4">
        {content}
      </div>
    </DashboardLayout>
  )
}
