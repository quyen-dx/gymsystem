import {
  ArrowLeftOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  PlayCircleOutlined,
  StarFilled,
  UserOutlined,
} from '@ant-design/icons'
import {
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Rate,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { trainerService } from '../../../services/trainerService'
import { useTheme } from '../../../context/ThemeContext'
import type { PT, PTDaySchedule } from '../../../types/admin/trainer'
import { getUserDisplayName } from '../../../utils/userDisplay'

const { Text, Title } = Typography

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

const SHIFT_LABELS = {
  morning: 'Sáng',
  afternoon: 'Chiều',
  evening: 'Tối',
}

export default function TrainerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { tokens } = useTheme()
  const [pt, setPt] = useState<PT | null>(null)
  const [bookings, setBookings] = useState<PTDaySchedule['bookings']>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const { data } = await trainerService.getPTById(id)
      setPt(data.pt)
      setBookings(data.bookings)
    } catch {
      message.error('Không thể tải thông tin huấn luyện viên')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      </DashboardLayout>
    )
  }

  if (!pt) {
    return (
      <DashboardLayout>
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--gs-text-muted)' }}>
          {'Không thể tải thông tin huấn luyện viên'}
        </div>
      </DashboardLayout>
    )
  }

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const groupedByDate: Record<string, typeof bookings> = {}
  bookings.forEach((b: typeof bookings[number]) => {
    const d = new Date(b.date).toISOString().split('T')[0]
    if (!groupedByDate[d]) groupedByDate[d] = []
    groupedByDate[d].push(b)
  })

  const weekDays = []
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  weekStart.setHours(0, 0, 0, 0)
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    const ds = d.toISOString().split('T')[0]
    weekDays.push({
      date: ds,
      dayOfWeek: d.getDay(),
      bookings: groupedByDate[ds] || [],
    })
  }

  return (
    <DashboardLayout>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/admin/trainers')}
        style={{ marginBottom: 16 }}
      >
        'Quay lại'
      </Button>

      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">HUẤN LUYỆN VIÊN</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">Chi tiết huấn luyện viên</h1>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card className="rounded-[24px]" style={{ textAlign: 'center', height: '100%' }}>
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: '50%',
                background: pt.avatar ? `url(${pt.avatar}) center/cover` : 'var(--gs-border)',
                margin: '0 auto 12px',
              }}
            />
            <Title level={4} style={{ margin: 0 }}>{getUserDisplayName(pt, 'PT')}</Title>
            <Text type="secondary">{pt.email || pt.phone}</Text>
            <div style={{ marginTop: 8 }}>
              <Rate disabled value={pt.rating} allowHalf style={{ fontSize: 16 }} character={<StarFilled />} />
              <span style={{ marginLeft: 6, fontSize: 14, color: 'var(--gs-text-muted)' }}>{pt.rating.toFixed(1)}</span>
            </div>
            <div style={{ marginTop: 8 }}>
              <Tag color={pt.isActive ? 'success' : 'error'} icon={pt.isActive ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
                {pt.isActive ? 'Đang hoạt động' : 'Đã khóa'}
              </Tag>
            </div>

            <div style={{ marginTop: 16, padding: '12px 0', borderTop: '1px solid var(--gs-border)' }}>
              <Space size={8} wrap style={{ justifyContent: 'center' }}>
                {pt.experienceYears > 0 && (
                  <Badge count={`${pt.experienceYears}y KN`} style={{ backgroundColor: tokens.accent }} overflowCount={99} />
                )}
                {pt.totalSessions > 0 && (
                  <Badge count={`${pt.totalSessions} buổi`} style={{ backgroundColor: '#3B82F6' }} overflowCount={9999} />
                )}
                {pt.totalStudents > 0 && (
                  <Badge count={`${pt.totalStudents} HV`} style={{ backgroundColor: '#10B981' }} overflowCount={9999} />
                )}
              </Space>
            </div>

            {pt.specialties?.length > 0 && (
              <div style={{ marginTop: 12 }}>
                {pt.specialties.map((s) => (
                  <Tag key={s} color={tokens.accent} style={{ marginBottom: 4 }}>{s}</Tag>
                ))}
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card className="rounded-[24px]" title={<><UserOutlined /> Thông tin cơ bản</>} style={{ marginBottom: 16 }}>
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label='Họ tên'>{pt.name}</Descriptions.Item>
              <Descriptions.Item label='Email'>{pt.email || '—'}</Descriptions.Item>
              <Descriptions.Item label='Số điện thoại'>{pt.phone || '—'}</Descriptions.Item>
              <Descriptions.Item label='Ngày sinh'>
                {pt.dateOfBirth ? new Date(pt.dateOfBirth).toLocaleDateString('vi-VN') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label='Giới tính'>
                {pt.gender ? ({ male: 'Nam', female: 'Nữ', other: 'Khác' }[pt.gender] || pt.gender) : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="ID">{pt._id}</Descriptions.Item>
            </Descriptions>
          </Card>

          {pt.bio && (
            <Card className="rounded-[24px]" title="Bio" style={{ marginBottom: 16 }}>
              <Text>{pt.bio}</Text>
            </Card>
          )}

          <Card
            className="rounded-[24px]"
            title="Thông tin dịch vụ"
            style={{ marginBottom: 16 }}
          >
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Giá PT 1-1">
                {(pt.oneToOnePrice || 0).toLocaleString('vi-VN')} đ / buổi
              </Descriptions.Item>

              <Descriptions.Item label="Giá PT nhóm">
                {(pt.groupPrice || 0).toLocaleString('vi-VN')} đ / người
              </Descriptions.Item>

              <Descriptions.Item label="Sức chứa nhóm">
                {pt.groupCapacity || 5} người
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            {pt.introVideoUrl && (
              <Col xs={24} sm={12}>
                <Card className="rounded-[24px]" size="small" title={<><PlayCircleOutlined /> Video giới thiệu</>}>
                  <video
                    src={pt.introVideoUrl}
                    controls
                    style={{ width: '100%', borderRadius: 12, maxHeight: 200 }}
                  />
                </Card>
              </Col>
            )}
            {pt.certificates?.length > 0 && (
              <Col xs={24} sm={pt.introVideoUrl ? 12 : 24}>
                <Card className="rounded-[24px]" size="small" title={<><CheckCircleOutlined /> Chứng chỉ</>}>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {pt.certificates.map((cert, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>{cert}</li>
                    ))}
                  </ul>
                </Card>
              </Col>
            )}
          </Row>

          <Card
            className="rounded-[24px]"
            title={<><CalendarOutlined /> Lịch làm việc trong tuần</>}
          >
            <Row gutter={[8, 8]}>
              {weekDays.map((day) => {
                const isToday = day.date === todayStr
                return (
                  <Col xs={12} sm={8} md={6} key={day.date}>
                    <div
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        background: isToday ? tokens.accentMuted : 'var(--gs-card)',
                        border: isToday ? `1px solid ${tokens.accent}` : '1px solid var(--gs-border)',
                        minHeight: 100,
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                        {DAY_LABELS[day.dayOfWeek]} {new Date(day.date).getDate()}/{new Date(day.date).getMonth() + 1}
                        {isToday && <Tag color={tokens.accent} style={{ marginLeft: 4, fontSize: 10 }}>Hôm nay</Tag>}
                      </div>
                      {day.bookings.length > 0 ? (
                        day.bookings.map((b) => (
                          <div key={b._id} style={{ fontSize: 12, marginBottom: 4, padding: '2px 6px', background: 'rgba(59,130,246,0.08)', borderRadius: 6 }}>
                            <ClockCircleOutlined style={{ marginRight: 4, fontSize: 10 }} />
                            <span style={{ fontWeight: 500 }}>{b.slot}</span>
                            <div style={{ color: 'var(--gs-text-muted)' }}>{getUserDisplayName(b.memberId, '—')}</div>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--gs-text-soft)', opacity: 0.5 }}>
                          'Không có lịch hẹn'
                        </div>
                      )}
                    </div>
                  </Col>
                )
              })}
            </Row>

            {pt.schedules?.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--gs-border)' }}>
                <Text strong style={{ fontSize: 13 }}>Ca làm việc cố định:</Text>
                <div style={{ marginTop: 8 }}>
                  <Space size={6} wrap>
                    {pt.schedules.map((s) => (
                      <Tag key={`${s.dayOfWeek}-${s.shift}`} color="blue">
                        {DAY_LABELS[s.dayOfWeek]} - {SHIFT_LABELS[s.shift]}
                      </Tag>
                    ))}
                  </Space>
                </div>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </DashboardLayout>
  )
}
