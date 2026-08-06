import { CameraOutlined, CheckCircleOutlined, ClockCircleOutlined, FilterOutlined, HistoryOutlined, QrcodeOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Card, DatePicker, Empty, Input, List, Space, Statistic, Tag, Typography, message } from 'antd'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { checkInService } from '../../../services/checkInService'

const { RangePicker } = DatePicker

const formatDateTime = (value?: string) => value ? dayjs(value).format('HH:mm:ss DD/MM/YYYY') : '-'

const checkInMethodLabels: Record<string, { label: string; color: string }> = {
  QR_SELF: { label: 'QR tự check-in', color: 'blue' },
  QR_PROJECTOR: { label: 'QR trình chiếu', color: 'cyan' },
  STAFF: { label: 'Lễ tân điểm danh', color: 'orange' },
  RECEPTION: { label: 'Lễ tân điểm danh', color: 'purple' },
  AUTO: { label: 'Tự động', color: 'geekblue' },
}

export default function MemberCheckinPage() {
  const navigate = useNavigate()
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState<[any, any] | null>(null)
  const [manualToken, setManualToken] = useState('')

  const todayCheckin = useMemo(() => {
    const today = dayjs().format('YYYY-MM-DD')
    return history.find((item) => item.checkinTime && dayjs(item.checkinTime).format('YYYY-MM-DD') === today)
  }, [history])

  const fetchHistory = () => {
    setLoading(true)
    const params: Record<string, any> = { limit: 50 }
    if (dateRange?.[0]) {
      params.mode = 'custom'
      params.date = dateRange[0].format('YYYY-MM-DD')
      params.toDate = dateRange[1] ? dateRange[1].format('YYYY-MM-DD') : undefined
    }
    checkInService.getMyCheckinHistory(params)
      .then((res) => setHistory(res.data.checkins || []))
      .catch(() => message.error('Không thể tải lịch sử check-in'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchHistory() }, [])

  const handleManualSubmit = () => {
    const token = manualToken.trim()
    if (!token) {
      message.warning('Vui lòng nhập mã QR')
      return
    }
    navigate(`/checkin/sessions?token=${encodeURIComponent(token)}`)
  }

  return (
    <MemberLayout>
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <section className="mb-6 rounded-2xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="m-0 text-xs uppercase tracking-[0.24em] text-[var(--gs-text-soft)]">CHECK-IN</p>
              <Typography.Title level={2} className="!m-0 !mt-2 !text-[var(--gs-text)]">
                Check-in phòng gym
              </Typography.Title>
              <Typography.Paragraph className="!mb-0 !mt-2 !text-[var(--gs-text-muted)]">
                Quét QR tại phòng gym hoặc nhập mã thủ công nếu camera không hoạt động.
              </Typography.Paragraph>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:min-w-[300px]">
              <Card size="small" className="rounded-xl">
                <Statistic title="Hôm nay" value={todayCheckin ? 'Đã check-in' : 'Chưa check-in'} prefix={todayCheckin ? <CheckCircleOutlined /> : <ClockCircleOutlined />} valueStyle={{ fontSize: 16, color: todayCheckin ? '#10B981' : undefined }} />
              </Card>
              <Card size="small" className="rounded-xl">
                <Statistic title="Lịch sử" value={history.length} suffix="lần" valueStyle={{ fontSize: 18 }} />
              </Card>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
          <div className="space-y-4">
            <Card className="rounded-2xl" styles={{ body: { padding: 20 } }}>
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--theme-accent)]/15 text-[var(--theme-accent)]">
                <CameraOutlined style={{ fontSize: 28 }} />
              </div>
              <Typography.Title level={4} className="!m-0 !text-[var(--gs-text)]">Quét mã QR</Typography.Title>
              <Typography.Paragraph className="!mb-5 !mt-2 !text-sm !text-[var(--gs-text-muted)]">
                Mở camera và đưa mã QR tại phòng gym vào khung quét.
              </Typography.Paragraph>
              <Button type="primary" size="large" icon={<QrcodeOutlined />} block onClick={() => navigate('/checkin/scan')}>
                Mở camera quét QR
              </Button>
            </Card>

            <Card title="Nhập mã thủ công" className="rounded-2xl">
              <Space.Compact className="w-full">
                <Input
                  size="large"
                  placeholder="Dán hoặc nhập mã QR..."
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  onPressEnter={handleManualSubmit}
                />
                <Button size="large" type="primary" onClick={handleManualSubmit}>Xác nhận</Button>
              </Space.Compact>
              <p className="mb-0 mt-2 text-xs text-[var(--gs-text-muted)]">
                Dùng khi camera bị lỗi, máy không có camera hoặc QR được gửi dưới dạng mã.
              </p>
            </Card>
          </div>

          <Card
            className="rounded-2xl"
            title={<span><HistoryOutlined className="mr-2" />Lịch sử check-in</span>}
            extra={<Button size="small" icon={<ReloadOutlined />} onClick={fetchHistory}>Tải lại</Button>}
          >
            <div className="mb-4 grid gap-3 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-4 md:grid-cols-[1fr_auto]">
              <div>
                <div className="mb-1 text-xs font-medium text-[var(--gs-text-soft)]">Khoảng ngày</div>
                <RangePicker
                  className="w-full"
                  value={dateRange as any}
                  onChange={(dates) => setDateRange(dates as any)}
                  format="DD/MM/YYYY"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button type="primary" icon={<FilterOutlined />} onClick={fetchHistory}>Lọc</Button>
                <Button onClick={() => { setDateRange(null); setTimeout(fetchHistory, 0) }}>Tất cả</Button>
              </div>
            </div>

            <List
              loading={loading}
              dataSource={history}
              locale={{ emptyText: <Empty description="Chưa có lịch sử check-in" /> }}
              renderItem={(item: any) => {
                const methodMeta = checkInMethodLabels[item.checkInMethod] || checkInMethodLabels.QR_SELF
                return (
                  <List.Item className="!px-0">
                    <div className="flex w-full gap-3 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-card)] p-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--theme-accent)]/10 text-[var(--theme-accent)]">
                        <HistoryOutlined />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-semibold text-[var(--gs-text)]">{formatDateTime(item.checkinTime)}</div>
                          <Tag color={methodMeta.color}>{methodMeta.label}</Tag>
                        </div>
                        {item.sessionTitle && <div className="mt-1 text-sm text-[var(--gs-text-muted)]">{item.sessionTitle}</div>}
                        {(item.performedByName || item.manualReason) && (
                          <div className="mt-1 space-y-0.5 text-xs text-[var(--gs-text-muted)]">
                            {item.performedByName && <div>Người thực hiện: {item.performedByName}</div>}
                            {item.manualReason && <div>Lý do: {item.manualReason}</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  </List.Item>
                )
              }}
            />
          </Card>
        </div>
      </div>
    </MemberLayout>
  )
}
