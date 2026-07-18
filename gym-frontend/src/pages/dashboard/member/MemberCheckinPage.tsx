import { CameraOutlined, FilterOutlined, HistoryOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, Card, DatePicker, List, Select, Tag, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { checkInService } from '../../../services/checkInService'

const { RangePicker } = DatePicker

const formatDate = (value?: string) => value ? new Date(value).toLocaleString('vi-VN') : '-'

export default function MemberCheckinPage() {
  const navigate = useNavigate()
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState<[any, any] | null>(null)

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
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchHistory() }, [])

  return (
    <MemberLayout>
      <div className="mx-auto w-full max-w-lg px-4 py-8">
        <Typography.Title level={3} className="text-center m-0">Check-in</Typography.Title>
        <Typography.Paragraph className="text-center text-sm text-[var(--gs-text-muted)]">
          Chọn hình thức check-in hoặc xem lịch sử
        </Typography.Paragraph>

        <Card
          hoverable
          className="rounded-2xl"
          onClick={() => navigate('/checkin/scan')}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <CameraOutlined style={{ fontSize: 28 }} />
            </div>
            <div>
              <Typography.Text strong className="text-base">Quét mã QR</Typography.Text>
              <div className="text-sm text-[var(--gs-text-muted)]">
                Quét mã QR tại phòng gym để check-in
              </div>
            </div>
          </div>
        </Card>

        <div className="mt-8">
          <Typography.Title level={5} className="m-0 mb-3">Lịch sử check-in</Typography.Title>

          <div className="mb-4 flex flex-col sm:flex-row gap-3 rounded-xl border border-[var(--gs-border)] bg-[var(--gs-elevated)] p-4">
            <div className="flex-1 min-w-0">
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
              <Button icon={<HistoryOutlined />} onClick={() => { setDateRange(null); fetchHistory() }}>Tất cả</Button>
            </div>
          </div>

          <Card className="rounded-2xl">
            <List
              loading={loading}
              dataSource={history}
              locale={{ emptyText: 'Chưa có lịch sử check-in' }}
              renderItem={(item: any) => (
                <List.Item>
                  <div className="flex items-center gap-3 w-full">
                    <HistoryOutlined className="text-[var(--gs-text-muted)] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{formatDate(item.checkinTime)}</div>
                      {item.sessionTitle && (
                        <div className="text-xs text-[var(--gs-text-muted)] truncate">{item.sessionTitle}</div>
                      )}
                    </div>
                    <Tag color={item.sessionType === 'free_workout' ? 'green' : 'blue'} className="shrink-0">
                      {item.sessionType === 'free_workout' ? 'Tập tự do' : 'Theo lịch'}
                    </Tag>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </div>
      </div>
    </MemberLayout>
  )
}
