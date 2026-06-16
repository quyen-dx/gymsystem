import {
  ArrowLeftOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EnvironmentOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  LockOutlined,
  MedicineBoxOutlined,
  OrderedListOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  SolutionOutlined,
  TrophyOutlined,
  UnlockOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Image,
  Row,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import { useCallback, useContext, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import api from '../../../services/api'
import { AuthContext } from '../../../context/auth.context'
import type { UserDetailResponse } from '../../../types/admin/user'
import { getUserDisplayName } from '../../../utils/userDisplay'

const { Text, Title } = Typography

export default function AdminUserDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const authContext = useContext(AuthContext)
  const currentUser = authContext?.user
  const [data, setData] = useState<UserDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUserDetails = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await api.get(`/auth/users/${id}`)
      setData(res.data)
    } catch (err: any) {
      message.error(err.response?.data?.message || t('admin.users.messages.fetch_failed'))
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => {
    fetchUserDetails()
  }, [fetchUserDetails])

  const handleToggleStatus = async () => {
    if (!data?.user) return
    try {
      await api.patch(`/auth/users/${data.user._id}/toggle-status`)
      message.success(t('admin.users.messages.toggle_success'))
      fetchUserDetails()
    } catch (err: any) {
      message.error(err.response?.data?.message || t('admin.users.messages.action_failed'))
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

  if (!data?.user) {
    return (
      <DashboardLayout>
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Empty description={t('admin.users.messages.fetch_failed')} />
          <Button onClick={() => navigate('/admin/users')} icon={<ArrowLeftOutlined />}>
            {t('admin.users.detail.back')}
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  const { user, activeMembership, membershipHistory, recentBookings, addresses, orderHistory, totalWorkouts } = data

  const membershipColumns = [
    {
      title: t('admin.users.detail.plan_name'),
      dataIndex: 'planId',
      key: 'planName',
      render: (plan: any) => plan?.nameVi || plan?.nameEn || '—',
    },
    {
      title: t('admin.users.detail.start_date'),
      dataIndex: 'startDate',
      key: 'startDate',
      render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
    },
    {
      title: t('admin.users.detail.end_date'),
      dataIndex: 'endDate',
      key: 'endDate',
      render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
    },
    {
      title: t('admin.users.detail.price'),
      dataIndex: 'price',
      key: 'price',
      render: (price: number) => price ? `${price.toLocaleString('vi-VN')}đ` : '—',
    },
    {
      title: t('admin.users.detail.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const color = status === 'active' ? 'success' : status === 'expired' ? 'error' : 'default'
        return <Tag color={color}>{status.toUpperCase()}</Tag>
      },
    },
  ]

  const bookingColumns = [
    {
      title: t('admin.users.detail.pt'),
      dataIndex: 'ptId',
      key: 'pt',
      render: (pt: any) => (
        <Space>
          <Avatar size="small" src={pt?.avatar} icon={<UserOutlined />} />
          <Text>{getUserDisplayName(pt, '—')}</Text>
        </Space>
      ),
    },
    {
      title: t('admin.users.detail.date'),
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
    },
    {
      title: t('admin.users.detail.slot'),
      dataIndex: 'slot',
      key: 'slot',
    },
    {
      title: t('admin.users.detail.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'default'
        if (status === 'confirmed') color = 'processing'
        if (status === 'completed') color = 'success'
        if (status === 'cancelled') color = 'error'
        return <Tag color={color}>{status.toUpperCase()}</Tag>
      },
    },
  ]

  const orderColumns = [
    {
      title: t('admin.users.detail.order_id'),
      dataIndex: '_id',
      key: 'orderId',
      render: (id: string) => `#${id.slice(-6).toUpperCase()}`,
    },
    {
      title: t('admin.users.detail.created_at'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
    },
    {
      title: t('admin.users.detail.order_total'),
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (total: number) => `${total.toLocaleString('vi-VN')}đ`,
    },
    {
      title: t('admin.users.detail.order_status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
         let color = 'default'
         if (status === 'GIAO THÀNH CÔNG') color = 'success'
         if (status === 'ĐANG GIAO HÀNG') color = 'processing'
         if (status === 'CHỜ XÁC NHẬN') color = 'warning'
         return <Tag color={color}>{status}</Tag>
      }
    }
  ]

  return (
    <DashboardLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/admin/users')}
          style={{ fontSize: 16 }}
        >
          {t('admin.users.detail.back')}
        </Button>
        <Space>
          <Button
            icon={user.isActive ? <LockOutlined /> : <UnlockOutlined />}
            onClick={handleToggleStatus}
            danger={user.isActive}
          >
            {user.isActive ? t('admin.users.tooltips.lock') : t('admin.users.tooltips.unlock')}
          </Button>
        </Space>
      </div>

      <Row gutter={[24, 24]}>
        {/* Left Column: Basic & Health Info */}
        <Col xs={24} lg={8}>
          <Card className="rounded-[24px] text-center shadow-sm mb-6">
            <Avatar
              size={120}
              src={user.avatar}
              icon={<UserOutlined />}
              className="mb-4 border-4 border-white shadow-md"
            />
            <Title level={3} className="mb-1">
              {getUserDisplayName(user, 'Người dùng')}
            </Title>
            <Text type="secondary" className="block mb-3">
              {user.memberCode ? `${t('admin.users.detail.member_code')}: ${user.memberCode}` : ''}
            </Text>
            <div className="mb-4">
              <Space>
                <Tag color={user.isActive ? 'success' : 'error'} icon={user.isActive ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
                  {user.isActive ? t('admin.users.status.active') : t('admin.users.status.locked')}
                </Tag>
                <Tag color={user.isVerified ? 'blue' : 'default'} icon={user.isVerified ? <CheckCircleOutlined /> : <InfoCircleOutlined />}>
                  {user.isVerified ? t('admin.users.status.verified') : t('admin.users.status.unverified')}
                </Tag>
              </Space>
            </div>
            
            <Descriptions column={1} size="small" className="text-left mt-6 border-t pt-4">
              <Descriptions.Item label={t('admin.users.detail.role')}>
                <Tag color="purple">{user.role.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.users.detail.provider')}>
                {user.provider.toUpperCase()}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.users.detail.email')}>
                {user.email || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.users.detail.phone')}>
                {user.phone || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.users.detail.created_at')}>
                {new Date(user.createdAt).toLocaleDateString('vi-VN')}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            title={<><MedicineBoxOutlined /> {t('admin.users.detail.health_info')}</>}
            className="rounded-[24px] shadow-sm mb-6"
          >
            <Descriptions column={1} size="small">
              <Descriptions.Item label={t('admin.users.detail.height')}>{user.healthInfo?.height ? `${user.healthInfo.height} cm` : '—'}</Descriptions.Item>
              <Descriptions.Item label={t('admin.users.detail.weight')}>{user.healthInfo?.weight ? `${user.healthInfo.weight} kg` : '—'}</Descriptions.Item>
              <Descriptions.Item label={t('admin.users.detail.activity_level')}>{user.healthInfo?.activityLevel || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('admin.users.detail.goals')}>
                {user.healthInfo?.goals && user.healthInfo.goals.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {user.healthInfo.goals.map(g => <Tag key={g} color="blue">{g}</Tag>)}
                  </div>
                ) : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.users.detail.health_notes')}>{user.healthInfo?.notes || '—'}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            title={<><PhoneOutlined /> {t('admin.users.detail.emergency')}</>}
            className="rounded-[24px] shadow-sm"
          >
             <Descriptions column={1} size="small">
              <Descriptions.Item label={t('admin.users.detail.emergency_name')}>{user.emergencyContact?.name || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('admin.users.detail.emergency_phone')}>{user.emergencyContact?.phone || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('admin.users.detail.emergency_relationship')}>{user.emergencyContact?.relationship || '—'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Right Column: Personal, Identity, Gym Profile */}
        <Col xs={24} lg={16}>
          <Card
            title={<><SolutionOutlined /> {t('admin.users.detail.personal_info')}</>}
            className="rounded-[24px] shadow-sm mb-6"
          >
            <Descriptions column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label={t('admin.users.detail.full_name')}>{getUserDisplayName(user, 'Người dùng')}</Descriptions.Item>
              <Descriptions.Item label={t('admin.users.detail.dob')}>
                {user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString('vi-VN') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.users.detail.gender')}>{user.gender || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('admin.users.detail.nationality')}>{user.nationality || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('admin.users.detail.timezone')}>{user.timezone || '—'}</Descriptions.Item>
            </Descriptions>

            <Title level={5} className="mt-4 mb-3 border-t pt-4">
              <EnvironmentOutlined /> {t('admin.users.detail.contact_info')}
            </Title>
            <Descriptions column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label={t('admin.users.detail.country')}>{user.country || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('admin.users.detail.province')}>{user.province || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('admin.users.detail.address')} span={2}>{user.detailedAddress || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('admin.users.detail.contact_email')}>{user.contactEmail || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('admin.users.detail.contact_phone')}>{user.phone || '—'}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            title={<><SafetyCertificateOutlined /> {t('admin.users.detail.identity_info')}</>}
            className="rounded-[24px] shadow-sm mb-6"
          >
             <Descriptions column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label={t('admin.users.detail.identity_type')}>{user.identityType || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('admin.users.detail.identity_number')}>
                {user.identityNumber ? user.identityNumber.replace(/.(?=.{4})/g, '*') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.users.detail.identity_country')}>{user.identityCountry || '—'}</Descriptions.Item>
              <Descriptions.Item label={t('admin.users.detail.identity_status')}>
                <Tag color={user.identityStatus === 'approved' ? 'success' : user.identityStatus === 'rejected' ? 'error' : user.identityStatus === 'pending' ? 'warning' : 'default'}>
                  {user.identityStatus?.toUpperCase() || t('admin.users.detail.no_data')}
                </Tag>
              </Descriptions.Item>
              {user.identityRejectReason && (
                 <Descriptions.Item label={t('admin.users.detail.identity_reason')} span={2}>
                    <Text type="danger">{user.identityRejectReason}</Text>
                 </Descriptions.Item>
              )}
            </Descriptions>

            {((user.identityFrontImage || user.identityBackImage) && ['super_admin', 'admin'].includes(currentUser?.role || '')) && (
              <div className="mt-4 pt-4 border-t">
                <Text strong className="block mb-3">{t('admin.users.detail.view_images')}</Text>
                <Space size="large">
                  {user.identityFrontImage && (
                    <div className="text-center">
                      <Image
                        width={120}
                        src={user.identityFrontImage}
                        className="rounded-lg border shadow-sm"
                      />
                      <div className="mt-1"><Text type="secondary" style={{ fontSize: 12 }}>{t('admin.verifications.doc_front')}</Text></div>
                    </div>
                  )}
                  {user.identityBackImage && (
                    <div className="text-center">
                      <Image
                        width={120}
                        src={user.identityBackImage}
                        className="rounded-lg border shadow-sm"
                      />
                      <div className="mt-1"><Text type="secondary" style={{ fontSize: 12 }}>{t('admin.verifications.doc_back')}</Text></div>
                    </div>
                  )}
                </Space>
              </div>
            )}
          </Card>

          <Card
            title={<><TrophyOutlined /> {t('admin.users.detail.gym_profile')}</>}
            className="rounded-[24px] shadow-sm mb-6"
          >
             <Descriptions column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label={t('admin.users.detail.created_at')}>
                 {new Date(user.createdAt).toLocaleDateString('vi-VN')}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.users.detail.membership_grade')}>
                 <Tag color="gold">GOLD MEMBER</Tag> {/* Mock grade for now */}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.users.detail.active_plan')} span={2}>
                 {activeMembership ? (
                   <Text strong style={{ color: '#1677ff' }}>{activeMembership.planId?.nameVi || activeMembership.planId?.nameEn} (Hết hạn: {new Date(activeMembership.endDate).toLocaleDateString('vi-VN')})</Text>
                 ) : (
                   <Text type="secondary">{t('admin.members.detail.no_membership')}</Text>
                 )}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.users.detail.assigned_pt')}>
                 {recentBookings && recentBookings.length > 0 ? (
                    <Space>
                      <Avatar size="small" src={recentBookings[0].ptId?.avatar} icon={<UserOutlined />} />
                      <Text>{getUserDisplayName(recentBookings[0].ptId, '—')}</Text>
                    </Space>
                 ) : '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.users.detail.total_workouts')}>
                 <Badge count={totalWorkouts} showZero color="#52c41a" /> {t('booking.status_completed')}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.users.detail.points')}>
                 <Text strong style={{ color: '#faad14' }}>0 pts</Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      {/* Bottom Tabs for histories and addresses */}
      <Card className="rounded-[24px] shadow-sm mt-6">
        <Tabs
          defaultActiveKey="membership"
          items={[
            {
              key: 'membership',
              label: <><HistoryOutlined /> {t('admin.users.detail.membership_history')}</>,
              children: (
                <Table
                  dataSource={membershipHistory}
                  columns={membershipColumns}
                  rowKey="_id"
                  pagination={{ pageSize: 5 }}
                  size="small"
                />
              ),
            },
            {
              key: 'bookings',
              label: <><CalendarOutlined /> {t('admin.users.detail.booking_history')}</>,
              children: (
                <Table
                  dataSource={recentBookings}
                  columns={bookingColumns}
                  rowKey="_id"
                  pagination={{ pageSize: 5 }}
                  size="small"
                />
              ),
            },
            {
              key: 'shipping',
              label: <><EnvironmentOutlined /> {t('admin.users.detail.shipping_addresses')}</>,
              children: (
                <Row gutter={[16, 16]}>
                  {addresses && addresses.length > 0 ? (
                    addresses.map((addr: any) => (
                      <Col xs={24} sm={12} md={8} key={addr._id}>
                        <Card size="small" className="h-full border-dashed">
                          <div>
                            <Text strong>{addr.fullName}</Text>
                            {addr.isDefault && <Tag color="blue" style={{ marginLeft: 6 }}>Mặc định</Tag>}
                          </div>
                          <div>
                            <Text type="secondary">{addr.phone}</Text>
                          </div>
                          <div className="mt-1">
                            <Text>{addr.street}, {addr.ward}, {addr.district}, {addr.city}</Text>
                          </div>
                        </Card>
                      </Col>
                    ))
                  ) : (
                    <Col span={24}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('admin.users.detail.no_data')} /></Col>
                  )}
                </Row>
              ),
            },
            {
              key: 'orders',
              label: <><OrderedListOutlined /> {t('admin.users.detail.order_history')}</>,
              children: (
                <Table
                  dataSource={orderHistory}
                  columns={orderColumns}
                  rowKey="_id"
                  pagination={{ pageSize: 5 }}
                  size="small"
                />
              ),
            },
          ]}
        />
      </Card>
    </DashboardLayout>
  )
}
