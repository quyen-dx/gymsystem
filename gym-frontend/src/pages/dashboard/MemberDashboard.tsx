import MemberLayout from '../../components/layout/MemberLayout'
import { useAuth } from '../../hook/useAuth'
import { useNavigate } from 'react-router-dom'
import { Card, Typography, Row, Col, Button } from 'antd'

const { Title, Text } = Typography

export default function MemberDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const cards = [
    {
      title: 'Đặt lịch PT',
      desc: 'Đặt buổi tập riêng với huấn luyện viên',
      path: '/dashboard/member/booking',
    },
    {
      title: 'Sức khoẻ',
      desc: 'Theo dõi cân nặng, mỡ, và progress',
      path: '/dashboard/member/health',
    },
    {
      title: 'Lộ trình',
      desc: 'Xem kế hoạch tập trong tuần',
      path: '/dashboard/member/workout',
    },
    {
      title: 'Check-in',
      desc: 'Quét QR để vào gym nhanh hơn',
      path: '/dashboard/member/checkin',
    },
  ]

  return (
    <MemberLayout>

      {/* HEADER SECTION */}
      <Card style={{ marginBottom: 24, borderRadius: 16 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>

          <div>
            <Text type="secondary">Member dashboard</Text>

            <Title level={2} style={{ marginTop: 8 }}>
              Xin chào, {user?.name?.split(' ').pop() || 'bạn'}
            </Title>

            <Text type="secondary">
              Giao diện member được tối ưu cho readability và trải nghiệm lâu dài.
            </Text>
          </div>

          <Card size="small" style={{ borderRadius: 12 }}>
            Hôm nay tập trung vào consistency và form.
          </Card>

        </div>

      </Card>

      {/* GRID */}
      <Row gutter={[16, 16]}>
        {cards.map((item, index) => (
          <Col xs={24} sm={12} lg={6} key={item.path}>

            <Card
              hoverable
              onClick={() => navigate(item.path)}
              style={{ borderRadius: 16, height: '100%' }}
            >

              <Text type="secondary">
                0{index + 1}
              </Text>

              <Title level={4} style={{ marginTop: 12 }}>
                {item.title}
              </Title>

              <Text type="secondary">
                {item.desc}
              </Text>

              <div style={{ marginTop: 16 }}>
                <Button type="primary" block>
                  Truy cập
                </Button>
              </div>

            </Card>

          </Col>
        ))}
      </Row>

    </MemberLayout>
  )
}