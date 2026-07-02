import {
  ArrowLeftOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  LockOutlined,
  OrderedListOutlined,
  UnlockOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Row,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import { memberService } from '../../../services/memberService'
import type { HealthScore, MemberDetail, MemberMembership, TimelineEvent } from '../../../types/admin/member'
import { getUserDisplayName } from '../../../utils/userDisplay'
import MemberRegisterPlanModal from './MemberRegisterPlanModal'
import MemberRenewPlanModal from './MemberRenewPlanModal'

const { Text, Title } = Typography

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [member, setMember] = useState<MemberDetail | null>(null)
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null)
  const [loading, setLoading] = useState(true)

  const [registerModalOpen, setRegisterModalOpen] = useState(false)
  const [renewModalOpen, setRenewModalOpen] = useState(false)

  const fetchMember = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [detailRes, timelineRes, healthRes] = await Promise.all([
        memberService.getMemberById(id),
        memberService.getMemberTimeline(id),
        memberService.getMemberHealthScore(id).catch(() => ({ data: { healthScore: null } })),
      ])
      setMember(detailRes.data.member)
      setTimeline(timelineRes.data.timeline)
      setHealthScore(healthRes.data.healthScore)
    } catch {
      message.error('Không thể tải thông tin thành viên')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchMember()
  }, [fetchMember])

  const toggleStatus = async () => {
    if (!member) return
    try {
      await memberService.toggleMemberStatus(member._id)
      message.success('Cập nhật trạng thái thành công')
      fetchMember()
    } catch {
      message.error('Thao tác thất bại')
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      </DashboardLayout>
    )
  }

  if (!member) {
    return (
      <DashboardLayout>
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--gs-text-muted)' }}>
          Không thể tải thông tin thành viên
        </div>
      </DashboardLayout>
    )
  }

  const membershipColumns = [
    {
      title: 'Gói tập',
      render: (_: unknown, record: MemberMembership) => (
        <Space size={4}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: record.planId?.color || '#3B82F6' }} />
          <span>{record.planId?.nameVi || record.planId?.nameEn || '—'}</span>
        </Space>
      ),
    },
    {
      title: 'Ngày bắt đầu',
      dataIndex: 'startDate',
      render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
    },
    {
      title: 'Ngày kết thúc',
      dataIndex: 'endDate',
      render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (status: string) => {
        const color = status === 'active' ? 'success' : status === 'expired' ? 'error' : 'default'
        return <Tag color={color}>{status}</Tag>
      },
    },
    {
      title: 'Giá',
      dataIndex: 'planId',
      render: (plan: { price?: number }) =>
        plan?.price ? `${plan.price.toLocaleString('vi-VN')}đ` : '—',
    },
  ]

  const getTimelineIcon = (type: string) => {
    switch (type) {
      case 'membership':
        return <CalendarOutlined style={{ color: '#8B5CF6' }} />
      case 'checkin':
        return <CheckCircleOutlined style={{ color: '#10B981' }} />
      case 'workout_complete':
        return <CheckCircleOutlined style={{ color: '#3B82F6' }} />
      default:
        return <OrderedListOutlined />
    }
  }

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  }

  const timelineItems = timeline.map((event) => ({
    key: event._id,
    dot: getTimelineIcon(event.type),
    children: (
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{event.title}</div>
        <div style={{ color: 'var(--gs-text-muted)', fontSize: 13 }}>{event.description}</div>
        <div style={{ fontSize: 11, color: 'var(--gs-text-soft)', marginTop: 2 }}>{formatDateTime(event.createdAt)}</div>
      </div>
    ),
  }))

  const activeMembership = member.activeMembership

  return (
    <DashboardLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/admin/members')}
          style={{ color: 'var(--gs-text)', fontSize: 15 }}
        >
          Quay lại danh sách
        </Button>
        <Space>
          <Button icon={<EditOutlined />} onClick={() => navigate(`/admin/members/${member._id}/edit`)}>
            Chỉnh sửa
          </Button>
          <Button
            icon={member.isActive ? <LockOutlined /> : <UnlockOutlined />}
            onClick={toggleStatus}
            danger={member.isActive}
          >
            {member.isActive ? 'Khóa' : 'Mở khóa'}
          </Button>
          <Button type="primary" onClick={() => setRegisterModalOpen(true)} disabled={!!activeMembership}>
            Đăng ký gói tập
          </Button>
          <Button onClick={() => setRenewModalOpen(true)} disabled={!activeMembership}>
            Gia hạn
          </Button>
        </Space>
      </div>

      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Thành viên</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">Chi tiết thành viên</h1>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card className="rounded-[24px]" style={{ textAlign: 'center', height: '100%' }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: member.avatar ? `url(${member.avatar}) center/cover` : 'var(--gs-border)',
                margin: '0 auto 12px',
              }}
            />
            <Title level={4} style={{ margin: 0 }}>
              {getUserDisplayName(member, 'Thành viên')}
            </Title>
            <div style={{ marginBottom: 4 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>{member.memberCode}</Text>
            </div>
            <Text type="secondary">{member.email || member.phone}</Text>
            <div style={{ marginTop: 12 }}>
              <Tag color={member.isActive ? 'success' : 'error'} icon={member.isActive ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
                {member.isActive ? 'Đang hoạt động' : 'Đã khóa'}
              </Tag>
            </div>

            {healthScore && (
              <div style={{ marginTop: 16, padding: '12px 0', borderTop: '1px solid var(--gs-border)' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Điểm sức khỏe</Text>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: healthScore.overall >= 80 ? '#10B981' : healthScore.overall >= 50 ? '#F59E0B' : '#EF4444',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    fontWeight: 700,
                  }}>
                    {healthScore.overall}
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{healthScore.levelText}</div>
                    <div style={{ fontSize: 12, color: 'var(--gs-text-muted)' }}>
                      {healthScore.checkinCount} check-in
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeMembership ? (
              <div style={{ marginTop: 16, padding: '12px 0', borderTop: '1px solid var(--gs-border)' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Thông tin gói tập</Text>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>
                    {activeMembership.planId?.nameVi || activeMembership.planId?.nameEn}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--gs-text-muted)', marginTop: 4 }}>
                    {new Date(activeMembership.startDate).toLocaleDateString('vi-VN')} → {new Date(activeMembership.endDate).toLocaleDateString('vi-VN')}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Badge
                      count={member.remainingDays}
                      style={{ backgroundColor: member.remainingDays <= 7 ? '#EF4444' : '#10B981' }}
                    />
                    <Text style={{ marginLeft: 8, fontSize: 13 }}>
                      ngày còn lại
                    </Text>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 16, padding: '12px 0', borderTop: '1px solid var(--gs-border)' }}>
                <Text type="secondary">Chưa đăng ký gói tập</Text>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card className="rounded-[24px]" title={<><UserOutlined /> Thông tin cơ bản</>} style={{ marginBottom: 16 }}>
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="Họ và tên">{getUserDisplayName(member, 'Thành viên')}</Descriptions.Item>
              <Descriptions.Item label="Email">{member.email || '—'}</Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">{member.phone || '—'}</Descriptions.Item>
              <Descriptions.Item label="Ngày sinh">
                {member.dateOfBirth ? new Date(member.dateOfBirth).toLocaleDateString('vi-VN') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={member.isActive ? 'success' : 'error'}>
                  {member.isActive ? 'Đang hoạt động' : 'Đã khóa'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="ID">{member._id}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card className="rounded-[24px]">
            <Tabs
              items={[
                {
                  key: 'membership',
                  label: <><OrderedListOutlined /> Lịch sử gói tập</>,
                  children: (
                    <Table
                      dataSource={member.membershipHistory}
                      columns={membershipColumns}
                      rowKey="_id"
                      pagination={false}
                      size="small"
                    />
                  ),
                },
                {
                  key: 'timeline',
                  label: <><CalendarOutlined /> Dòng thời gian</>,
                  children: timelineItems.length > 0 ? (
                    <Timeline items={timelineItems} />
                  ) : (
                    <Text type="secondary">Chưa có dữ liệu</Text>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <MemberRegisterPlanModal
        open={registerModalOpen}
        memberId={member._id}
        memberName={getUserDisplayName(member, member.memberCode)}
        onClose={() => setRegisterModalOpen(false)}
        onSuccess={() => { setRegisterModalOpen(false); fetchMember() }}
      />

      <MemberRenewPlanModal
        open={renewModalOpen}
        memberId={member._id}
        memberName={getUserDisplayName(member, member.memberCode)}
        currentEndDate={activeMembership?.endDate || ''}
        currentStartDate={activeMembership?.startDate || ''}
        currentPlanName={activeMembership?.planId?.nameVi || activeMembership?.planId?.nameEn || ''}
        currentPlanId={activeMembership?.planId?._id || ''}
        onClose={() => setRenewModalOpen(false)}
        onSuccess={() => { setRenewModalOpen(false); fetchMember() }}
      />
    </DashboardLayout>
  )
}
