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
import { useNavigate, useParams } from 'react-router-dom'
import DashboardLayout from '../../../components/layout/header/DashboardLayout'
import api from '../../../services/api'
import { AuthContext } from '../../../context/auth.context'
import type { UserDetailResponse } from '../../../types/admin/user'
import { getUserDisplayName } from '../../../utils/userDisplay'

const { Text, Title } = Typography

export default function AdminUserDetailPage() {
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
      message.error(err.response?.data?.message || 'Không thể tải thông tin người dùng')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchUserDetails()
  }, [fetchUserDetails])

  const handleToggleStatus = async () => {
    if (!data?.user) return
    try {
      await api.patch(`/auth/users/${data.user._id}/toggle-status`)
      message.success('Cập nhật trạng thái thành công')
      fetchUserDetails()
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Thao tác thất bại')
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
          <Empty description="Không thể tải thông tin người dùng" />
          <Button onClick={() => navigate('/admin/users')} icon={<ArrowLeftOutlined />}>
            Quay lại
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  const { user, activeMembership, membershipHistory, recentBookings, addresses, orderHistory, totalWorkouts } = data

  const membershipColumns = [
    {
      title: 'Gói tập',
      dataIndex: 'planId',
      key: 'planName',
      render: (plan: any) => plan?.nameVi || '—',
    },
    {
      title: 'Ngày bắt đầu',
      dataIndex: 'startDate',
      key: 'startDate',
      render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
    },
    {
      title: 'Ngày kết thúc',
      dataIndex: 'endDate',
      key: 'endDate',
      render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
    },
    {
      title: 'Giá',
      dataIndex: 'price',
      key: 'price',
      render: (price: number) => price ? `${price.toLocaleString('vi-VN')}đ` : '—',
    },
    {
      title: 'Trạng thái',
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
      title: 'PT',
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
      title: 'Ngày',
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
    },
    {
      title: 'Khung giờ',
      dataIndex: 'slot',
      key: 'slot',
    },
    {
      title: 'Trạng thái',
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
      title: 'Mã đơn hàng',
      dataIndex: '_id',
      key: 'orderId',
      render: (id: string) => `#${id.slice(-6).toUpperCase()}`,
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (total: number) => `${total.toLocaleString('vi-VN')}đ`,
    },
    {
      title: 'Trạng thái',
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
          Quay lại
        </Button>
        <Space>
          <Button
            icon={user.isActive ? <LockOutlined /> : <UnlockOutlined />}
            onClick={handleToggleStatus}
            danger={user.isActive}
          >
            {user.isActive ? 'Khóa' : 'Mở khóa'}
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
              {user.memberCode ? `Mã thành viên: ${user.memberCode}` : ''}
            </Text>
            <div className="mb-4">
              <Space>
                <Tag color={user.isActive ? 'success' : 'error'} icon={user.isActive ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
                  {user.isActive ? 'Đang hoạt động' : 'Đã khóa'}
                </Tag>
                <Tag color={user.isVerified ? 'blue' : 'default'} icon={user.isVerified ? <CheckCircleOutlined /> : <InfoCircleOutlined />}>
                  {user.isVerified ? 'Đã xác thực' : 'Chưa xác thực'}
                </Tag>
              </Space>
            </div>
            
            <Descriptions column={1} size="small" className="text-left mt-6 border-t pt-4">
              <Descriptions.Item label="Vai trò">
                <Tag color="purple">{user.role.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Nhà cung cấp">
                {user.provider.toUpperCase()}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {user.email || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">
                {user.phone || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày tạo">
                {new Date(user.createdAt).toLocaleDateString('vi-VN')}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            title={<><MedicineBoxOutlined /> Thông tin sức khỏe</>}
            className="rounded-[24px] shadow-sm mb-6"
          >
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Chiều cao">{user.healthInfo?.height ? `${user.healthInfo.height} cm` : '—'}</Descriptions.Item>
              <Descriptions.Item label="Cân nặng">{user.healthInfo?.weight ? `${user.healthInfo.weight} kg` : '—'}</Descriptions.Item>
              <Descriptions.Item label="Mức độ hoạt động">{user.healthInfo?.activityLevel || '—'}</Descriptions.Item>
              <Descriptions.Item label="Mục tiêu">
                {user.healthInfo?.goals && user.healthInfo.goals.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {user.healthInfo.goals.map(g => <Tag key={g} color="blue">{g}</Tag>)}
                  </div>
                ) : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Ghi chú sức khỏe">{user.healthInfo?.notes || '—'}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            title={<><PhoneOutlined /> Liên hệ khẩn cấp</>}
            className="rounded-[24px] shadow-sm"
          >
             <Descriptions column={1} size="small">
              <Descriptions.Item label="Tên người liên hệ">{user.emergencyContact?.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">{user.emergencyContact?.phone || '—'}</Descriptions.Item>
              <Descriptions.Item label="Mối quan hệ">{user.emergencyContact?.relationship || '—'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Right Column: Personal, Identity, Gym Profile */}
        <Col xs={24} lg={16}>
          <Card
            title={<><SolutionOutlined /> Thông tin cá nhân</>}
            className="rounded-[24px] shadow-sm mb-6"
          >
            <Descriptions column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Họ và tên">{getUserDisplayName(user, 'Người dùng')}</Descriptions.Item>
              <Descriptions.Item label="Ngày sinh">
                {user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString('vi-VN') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Giới tính">{user.gender || '—'}</Descriptions.Item>
              <Descriptions.Item label="Quốc tịch">{user.nationality || '—'}</Descriptions.Item>
              <Descriptions.Item label="Múi giờ">{user.timezone || '—'}</Descriptions.Item>
            </Descriptions>

            <Title level={5} className="mt-4 mb-3 border-t pt-4">
              <EnvironmentOutlined /> Thông tin liên hệ
            </Title>
            <Descriptions column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Quốc gia">{user.country || '—'}</Descriptions.Item>
              <Descriptions.Item label="Tỉnh/Thành">{user.province || '—'}</Descriptions.Item>
              <Descriptions.Item label="Địa chỉ" span={2}>{user.detailedAddress || '—'}</Descriptions.Item>
              <Descriptions.Item label="Email liên hệ">{user.contactEmail || '—'}</Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">{user.phone || '—'}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            title={<><SafetyCertificateOutlined /> Thông tin định danh</>}
            className="rounded-[24px] shadow-sm mb-6"
          >
             <Descriptions column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Loại giấy tờ">{user.identityType || '—'}</Descriptions.Item>
              <Descriptions.Item label="Số giấy tờ">
                {user.identityNumber ? user.identityNumber.replace(/.(?=.{4})/g, '*') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Quốc gia cấp">{user.identityCountry || '—'}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={user.identityStatus === 'approved' ? 'success' : user.identityStatus === 'rejected' ? 'error' : user.identityStatus === 'pending' ? 'warning' : 'default'}>
                  {user.identityStatus?.toUpperCase() || 'Không có dữ liệu'}
                </Tag>
              </Descriptions.Item>
              {user.identityRejectReason && (
                 <Descriptions.Item label="Lý do từ chối" span={2}>
                    <Text type="danger">{user.identityRejectReason}</Text>
                 </Descriptions.Item>
              )}
            </Descriptions>

            {((user.identityFrontImage || user.identityBackImage) && ['super_admin', 'admin'].includes(currentUser?.role || '')) && (
              <div className="mt-4 pt-4 border-t">
                <Text strong className="block mb-3">Xem hình ảnh</Text>
                <Space size="large">
                  {user.identityFrontImage && (
                    <div className="text-center">
                      <Image
                        width={120}
                        src={user.identityFrontImage}
                        className="rounded-lg border shadow-sm"
                      />
                      <div className="mt-1"><Text type="secondary" style={{ fontSize: 12 }}>Mặt trước</Text></div>
                    </div>
                  )}
                  {user.identityBackImage && (
                    <div className="text-center">
                      <Image
                        width={120}
                        src={user.identityBackImage}
                        className="rounded-lg border shadow-sm"
                      />
                      <div className="mt-1"><Text type="secondary" style={{ fontSize: 12 }}>Mặt sau</Text></div>
                    </div>
                  )}
                </Space>
              </div>
            )}
          </Card>

          <Card
            title={<><TrophyOutlined /> Hồ sơ Gym</>}
            className="rounded-[24px] shadow-sm mb-6"
          >
             <Descriptions column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Ngày tạo">
                 {new Date(user.createdAt).toLocaleDateString('vi-VN')}
              </Descriptions.Item>
              <Descriptions.Item label="Hạng thành viên">
                 <Tag color="gold">GOLD MEMBER</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Gói tập hiện tại" span={2}>
                 {activeMembership ? (
                   <Text strong style={{ color: '#1677ff' }}>{activeMembership.planId?.nameVi} (Hết hạn: {new Date(activeMembership.endDate).toLocaleDateString('vi-VN')})</Text>
                 ) : (
                   <Text type="secondary">Chưa đăng ký gói tập</Text>
                 )}
              </Descriptions.Item>
              <Descriptions.Item label="PT được phân công">
                 {recentBookings && recentBookings.length > 0 ? (
                    <Space>
                      <Avatar size="small" src={recentBookings[0].ptId?.avatar} icon={<UserOutlined />} />
                      <Text>{getUserDisplayName(recentBookings[0].ptId, '—')}</Text>
                    </Space>
                 ) : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Tổng số buổi tập">
                 <Badge count={totalWorkouts} showZero color="#52c41a" /> đã hoàn thành
              </Descriptions.Item>
              <Descriptions.Item label="Điểm thưởng">
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
              label: <><HistoryOutlined /> Lịch sử đăng ký gói tập</>,
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
              label: <><CalendarOutlined /> Lịch sử đặt lịch</>,
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
              label: <><EnvironmentOutlined /> Địa chỉ giao hàng</>,
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
                    <Col span={24}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có dữ liệu" /></Col>
                  )}
                </Row>
              ),
            },
            {
              key: 'orders',
              label: <><OrderedListOutlined /> Lịch sử đơn hàng</>,
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
