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
  Input,
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
import type { MemberDetail, MemberMembership, TimelineEvent } from '../../../types/admin/member'
import { getUserDisplayName } from '../../../utils/userDisplay'

const { Text, Title } = Typography

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [member, setMember] = useState<MemberDetail | null>(null)
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMember = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [detailRes, timelineRes] = await Promise.all([
        memberService.getMemberById(id),
        memberService.getMemberTimeline(id),
      ])
      setMember(detailRes.data.member)
      setTimeline(timelineRes.data.timeline)
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
    let reason = ''
    Modal.confirm({
      title: member.isActive ? 'Khóa tài khoản hội viên' : 'Mở khóa tài khoản hội viên',
      content: (
        <div className="mt-3">
          <p className="mb-2 text-sm text-[var(--gs-text-muted)]">Lý do sẽ được lưu vào nhật ký quản trị.</p>
          <Input.TextArea autoFocus rows={3} placeholder="Nhập lý do" onChange={(event) => { reason = event.target.value }} />
        </div>
      ),
      okText: member.isActive ? 'Xác nhận khóa' : 'Xác nhận mở khóa',
      okButtonProps: { danger: member.isActive },
      cancelText: 'Hủy',
      onOk: async () => {
        if (!reason.trim()) {
          message.warning('Vui lòng nhập lý do')
          return Promise.reject()
        }
        await memberService.toggleMemberStatus(member._id, reason.trim())
        message.success('Cập nhật trạng thái thành công')
        fetchMember()
      },
    })
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

  const formatDate = (date?: string) => {
    if (!date || Number.isNaN(new Date(date).getTime())) return '—'
    return new Date(date).toLocaleDateString('vi-VN')
  }

  const membershipColumns = [
    {
      title: 'Gói tập',
      render: (_: unknown, record: MemberMembership) => (
        <Space size={4}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: record.planId?.color || '#3B82F6' }} />
          <span>{record.planId?.nameVi || '—'}</span>
        </Space>
      ),
    },
    {
      title: 'Ngày bắt đầu',
      dataIndex: 'startDate',
      render: (date?: string) => formatDate(date),
    },
    {
      title: 'Ngày kết thúc',
      dataIndex: 'endDate',
      render: (date?: string) => formatDate(date),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (status: string) => {
        const color = status === 'active' ? 'success' : status === 'expired' ? 'error' : status === 'refunded' ? 'warning' : 'default'
        const label = status === 'active'
          ? 'Đang hoạt động'
          : status === 'expired'
            ? 'Đã hết hạn'
            : status === 'cancelled'
              ? 'Đã hủy'
              : status === 'refunded'
                ? 'Đã hoàn tiền'
                : status === 'pending'
                  ? 'Chờ kích hoạt'
                  : status
        return <Tag color={color}>{label}</Tag>
      },
    },
    {
      title: 'Giá',
      render: (_: unknown, record: MemberMembership) => {
        const price = record.price ?? record.planId?.price
        return price != null ? `${price.toLocaleString('vi-VN')}đ` : '—'
      },
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
  const checkinTimelineItems = timelineItems.filter((_, index) => timeline[index]?.type === 'checkin')
  const trainingTimelineItems = timelineItems.filter((_, index) => ['booking', 'pt_assignment', 'workout_complete', 'training'].includes(timeline[index]?.type || ''))

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
        </Space>
      </div>

      <div className="dashboard-hero mb-6 rounded-[28px] border border-[var(--gs-border)] bg-[linear-gradient(135deg,rgba(182,70,47,0.14),rgba(255,255,255,0.02))]">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--gs-text-soft)]">Thành viên</p>
        <h1 className="mt-3 text-4xl font-semibold text-[var(--gs-text)] max-[640px]:text-2xl">Chi tiết thành viên</h1>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card className="rounded-[24px]" style={{ textAlign: 'center' }}>
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

            {activeMembership ? (
              <div style={{ marginTop: 16, padding: '12px 0', borderTop: '1px solid var(--gs-border)' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Thông tin gói tập</Text>
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>
                    {activeMembership.planId?.nameVi}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--gs-text-muted)', marginTop: 4 }}>
                    {formatDate(activeMembership.startDate)} → {formatDate(activeMembership.endDate)}
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
                  key: 'profile',
                  label: <><UserOutlined /> Thông tin liên hệ</>,
                  children: (
                    <Descriptions column={{ xs: 1, sm: 2 }} size="small">
                      <Descriptions.Item label="Email liên hệ">{member.contactEmail || '—'}</Descriptions.Item>
                      <Descriptions.Item label="Địa chỉ">{member.detailedAddress || '—'}</Descriptions.Item>
                      <Descriptions.Item label="Liên hệ khẩn cấp">{member.emergencyContact?.name || '—'}</Descriptions.Item>
                      <Descriptions.Item label="Số điện thoại khẩn cấp">{member.emergencyContact?.phone || '—'}</Descriptions.Item>
                      <Descriptions.Item label="Mối quan hệ">{member.emergencyContact?.relationship || '—'}</Descriptions.Item>
                      <Descriptions.Item label="Sức khỏe">
                        {member.healthInfo?.height || member.healthInfo?.weight
                          ? `${member.healthInfo?.height || '—'} cm · ${member.healthInfo?.weight || '—'} kg`
                          : '—'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Mục tiêu" span={2}>{member.healthInfo?.goals?.join(', ') || '—'}</Descriptions.Item>
                      <Descriptions.Item label="Lưu ý sức khỏe" span={2}>{member.healthInfo?.notes || '—'}</Descriptions.Item>
                    </Descriptions>
                  ),
                },
                {
                  key: 'membership',
                  label: <><OrderedListOutlined /> Gói tập & thanh toán</>,
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
                  key: 'checkin',
                  label: <><CheckCircleOutlined /> Check-in</>,
                  children: checkinTimelineItems.length > 0 ? <Timeline items={checkinTimelineItems} /> : <Text type="secondary">Chưa có lịch sử check-in</Text>,
                },
                {
                  key: 'training',
                  label: <><CalendarOutlined /> PT / lịch tập</>,
                  children: trainingTimelineItems.length > 0 ? <Timeline items={trainingTimelineItems} /> : <Text type="secondary">Chưa có hoạt động PT hoặc lịch tập</Text>,
                },
                {
                  key: 'timeline',
                  label: <><CalendarOutlined /> Nhật ký hoạt động</>,
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

    </DashboardLayout>
  )
}
