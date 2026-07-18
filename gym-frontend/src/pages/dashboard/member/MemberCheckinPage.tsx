import { CameraOutlined, HistoryOutlined } from '@ant-design/icons'
import { Card, List, Tag, Typography, message } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MemberLayout from '../../../components/layout/header/MemberLayout'
import { checkInService } from '../../../services/checkInService'

const formatDate = (value?: string) => value ? new Date(value).toLocaleString('vi-VN') : '-'

export default function MemberCheckinPage() {
  const navigate = useNavigate()
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    checkInService.getStaffHistory({ mode: 'last7days', limit: 5 })
      .then((res) => setHistory(res.data.checkins || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <MemberLayout>
      <div className="mx-auto w-full max-w-lg px-4 py-8">
        <Typography.Title level={3} className="text-center m-0">Check-in</Typography.Title>
        <Typography.Paragraph className="text-center text-sm text-[var(--gs-text-muted)]">
          Chọn hình thức check-in hoặc xem lịch sử
        </Typography.Paragraph>

        <div className="grid grid-cols-1 gap-4 mt-6">
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
        </div>

        <div className="mt-8">
          <Typography.Title level={5}>Lịch sử check-in (7 ngày qua)</Typography.Title>
          <Card className="rounded-2xl">
            <List
              loading={loading}
              dataSource={history}
              locale={{ emptyText: 'Chưa có lịch sử check-in' }}
              renderItem={(item: any) => (
                <List.Item>
                  <div className="flex items-center gap-3 w-full">
                    <HistoryOutlined className="text-[var(--gs-text-muted)]" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{formatDate(item.checkinTime)}</div>
                      {item.sessionTitle && (
                        <div className="text-xs text-[var(--gs-text-muted)] truncate">{item.sessionTitle}</div>
                      )}
                    </div>
                    <Tag color={item.sessionType === 'free_workout' ? 'green' : 'blue'}>
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
